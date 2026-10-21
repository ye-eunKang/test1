/* npm install → npm start. Render: Web Service, npm install / npm start. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');
const settings = require('./sync-config.js');
const { createChoiceStore } = require('./choice-store.js');

function createExhibitServer(options = {}) {
  const root = options.root || __dirname;
  const config = options.config || settings;
  const rooms = new Map();
  const pendingTD = new Map();
  const choiceStore = createChoiceStore(options.choiceFile || process.env.FISH_CHOICE_FILE || path.join(root,'data','item-choices.jsonl'));
  const publicFiles = new Set(['index.html','display.html','display.js','display.css','sync-config.js',
    'sync.css','config.js','app.js','boot.js','home-guide.js','home-guide.css','home.css','style.css','water-background.js']);
  const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8', '.png':'image/png', '.gif':'image/gif', '.svg':'image/svg+xml',
    '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.mp4':'video/mp4', '.mov':'video/quicktime' };
  const server = http.createServer((req, res) => {
    let name;
    try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch (_) { res.writeHead(400).end(); return; }
    if (choiceStore.handle(req,res,name)) return;
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    if (name === '/health') { res.writeHead(200, {'Content-Type':'application/json'}).end('{"ok":true}'); return; }
    if (name === '/') name = '/index.html';
    const relative = name.slice(1);
    if (!(publicFiles.has(relative) || /^(assets|shared|interactions)\//.test(relative))) {
      res.writeHead(404).end('Not Found'); return;
    }
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403).end(); return; }
    fs.stat(filename, (error, stat) => {
      if (error || !stat.isFile()) { res.writeHead(404).end('Not Found'); return; }
      const headers = { 'Content-Type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Accept-Ranges':'bytes', 'Cache-Control': /\.(html|js|css|mp4|mov)$/.test(filename) ? 'no-cache' : 'public, max-age=3600' };
      let start = 0, end = stat.size - 1, status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2])) { res.writeHead(416, {'Content-Range':`bytes */${stat.size}`}).end(); return; }
        start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        if (start > end || start >= stat.size) { res.writeHead(416, {'Content-Range':`bytes */${stat.size}`}).end(); return; }
        status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length'] = stat.size === 0 ? 0 : end - start + 1;
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || !stat.size) { res.end(); return; }
      const stream = fs.createReadStream(filename, {start, end});
      stream.on('error', () => res.destroy()); stream.pipe(res);
    });
  });
  const wss = new WebSocketServer({server, path:'/exhibit', maxPayload:8192});
  function roomFor(fish) {
    if (!rooms.has(fish)) rooms.set(fish, {fish, phase:'idle', playing:false, session:null, owner:null,
      revision:0, returnAt:null, resetTimer:null, disconnectTimer:null, display:null,
      pourComplete:false, waterEnded:false, waterProgress:null, waterRate:0, activeDisplay:null});
    return rooms.get(fish);
  }
  function send(ws, data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
  function snapshot(room) {
    const {fish,phase,playing,session,owner,revision,returnAt,pourComplete,waterEnded,waterProgress,waterRate,activeDisplay} = room;
    return {type:'state',fish,phase,playing,session,owner,revision,returnAt,pourComplete,waterEnded,waterProgress,waterRate,activeDisplay};
  }
  function broadcast(room) {
    room.revision++;
    for (const ws of wss.clients) if (ws.fish === room.fish && ws.role !== 'td') send(ws, snapshot(room));
  }
  function reset(room) {
    clearTimeout(room.resetTimer); clearTimeout(room.disconnectTimer);
    Object.assign(room, {phase:'idle', playing:false, session:null, owner:null, returnAt:null,
      resetTimer:null, disconnectTimer:null, pourComplete:false, waterEnded:false, waterProgress:null, waterRate:0});
    broadcast(room);
  }
  function transition(room, phase, playing = false) { room.phase = phase; room.playing = playing; broadcast(room); }
  function emitTD(room) {
    const id = room.session;
    if (pendingTD.has(id)) return;
    const message = {type:'td:fish', id, fish:room.fish, signal:config.fish[room.fish].tdSignal,
      createdAt:Date.now(), expiresAt:Date.now()+60000};
    pendingTD.set(id, message);
    for (const ws of wss.clients) if (ws.role === 'td') send(ws, message);
    const cleanup = setTimeout(() => pendingTD.delete(id), 60000); cleanup.unref();
  }
  wss.on('connection', (ws) => {
    ws.alive = true;
    ws.on('error', () => {});
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (_) { send(ws, {type:'error', message:'invalid-json'}); return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ping') { send(ws, {type:'pong'}); return; }
      if (msg.type === 'join') {
        if (ws.role) { send(ws, {type:'error',message:'already-joined'}); return; }
        if (msg.role === 'td') {
          ws.role = 'td'; send(ws,{type:'joined',role:'td'});
          for (const value of pendingTD.values()) if (value.expiresAt > Date.now()) send(ws, value);
          return;
        }
        if (!['phone','display'].includes(msg.role) || !Object.hasOwn(config.fish, msg.fish)
          || typeof msg.clientId !== 'string' || msg.clientId.length > 100 || !msg.clientId.length) {
          send(ws,{type:'error',message:'invalid-room'}); return;
        }
        ws.role = msg.role; ws.fish = msg.fish; ws.clientId = msg.clientId;
        const room = roomFor(msg.fish);
        // 새 탭을 여는 것만으로 실제 전시 화면의 재생 권한을 가져가지 않습니다.
        if (ws.role === 'phone' && room.owner === ws.clientId) {
          clearTimeout(room.disconnectTimer); room.disconnectTimer = null;
        }
        send(ws, snapshot(room)); return;
      }
      if (ws.role === 'td') {
        if (msg.type === 'td:ack' && pendingTD.has(msg.id)) pendingTD.delete(msg.id);
        return;
      }
      if (!ws.role || msg.type !== 'event') return;
      const room = roomFor(ws.fish);
      if (ws.role === 'display' && msg.name === 'display-active') {
        if (typeof msg.playerId !== 'string' || !msg.playerId.length || msg.playerId.length > 100) return;
        if (msg.resume && room.activeDisplay && room.activeDisplay !== msg.playerId) return;
        ws.playerId = msg.playerId; room.display = ws; room.activeDisplay = msg.playerId;
        broadcast(room); return;
      }
      if (ws.role === 'display' && msg.name === 'reset') {
        // 이전 연결에 남은 초기화 요청이 다음 관객의 진행을 지우지 않도록 합니다.
        if (msg.session !== room.session) { send(ws,snapshot(room)); return; }
        reset(room); return;
      }
      if (ws.role === 'phone' && msg.name === 'tag') {
        if (room.phase !== 'idle') {
          if (room.owner !== ws.clientId) send(ws,{type:'error',message:'busy'});
          send(ws,snapshot(room)); return;
        }
        room.owner = ws.clientId; room.session = randomUUID(); transition(room,'water-ready'); return;
      }
      if (msg.session !== room.session || !room.session) return;
      if (ws.role === 'phone') {
        if (room.owner !== ws.clientId) return;
        if (msg.name === 'reset') { reset(room); return; }
        if (msg.name === 'pour' && ['water-ready','water-playing'].includes(room.phase)) {
          // 새로운 폰은 물의 실제 배출 비율을 보냅니다. 이전 폰 코드는 재생/정지 방식으로 동작합니다.
          if (Number.isFinite(msg.progress)) {
            const progress = Math.max(0,Math.min(1,msg.progress));
            if (room.waterProgress !== null && progress + .00001 < room.waterProgress) return;
            const rate = Number.isFinite(msg.rate) ? Math.max(0,Math.min(4,msg.rate)) : 0;
            const playing = !room.waterEnded && (msg.active === true || progress >= 1);
            const changed = room.waterProgress !== progress || room.waterRate !== rate || room.playing !== playing;
            room.waterProgress = progress; room.waterRate = rate;
            if (progress >= 1) room.pourComplete = true;
            room.playing = playing;
            if (progress > 0) room.phase = 'water-playing';
            if (room.pourComplete && room.waterEnded) transition(room,'main-playing',true);
            else if (changed) broadcast(room);
            return;
          }
          const playing = !room.waterEnded && (msg.active === true || room.pourComplete);
          if (room.playing !== playing) transition(room, playing ? 'water-playing' : room.phase, playing);
        } else if (msg.name === 'pour-complete' && room.phase === 'water-playing' && !room.pourComplete
          && (room.waterProgress === null || room.waterProgress >= 1)) {
          room.pourComplete = true;
          if (room.waterEnded) transition(room,'main-playing',true);
          else { room.playing = true; broadcast(room); }
        }
        else if (msg.name === 'game-complete' && room.phase === 'game') {
          // 별도 게임 영상이 있는 물고기는 게임 영상 → 엔딩 영상 순서로 재생합니다.
          const phase = config.fish[room.fish].display.game ? 'game-playing' : 'ending-playing';
          transition(room,phase,true);
        }
        else if (msg.name === 'waiting' && room.phase === 'reveal') transition(room,'waiting');
        else if (msg.name === 'swim-started' && room.phase === 'waiting') transition(room,'swimming');
        else if ((msg.name === 'finish' && ['waiting','swimming'].includes(room.phase))
          || (msg.name === 'swim-ended' && room.phase === 'swimming')) {
          emitTD(room);
          // 마지막 전송은 ENDING을 다시 재생하지 않고 두 기기를 바로 처음으로 돌립니다.
          reset(room);
        }
      } else if (ws.role === 'display' && msg.name === 'video-ended') {
        if (ws !== room.display || msg.playerId !== room.activeDisplay) return;
        if (msg.source !== config.fish[room.fish].display[msg.clip]
          || !Number.isFinite(msg.duration) || msg.duration <= 0 || !Number.isFinite(msg.currentTime)
          || msg.currentTime < msg.duration - .08) return;
        // 같은 물고기 화면의 실제 재생 창에서 종료를 받습니다.
        // 다른 탭을 열어도 막히지 않으며, 세션·단계 검사로 중복 전환을 막습니다.
        if (msg.clip === 'water' && msg.stage === 'water-playing' && room.phase === 'water-playing' && !room.waterEnded) {
          if (room.waterProgress !== null && room.waterProgress < 1) return;
          room.waterEnded = true;
          if (room.pourComplete) transition(room,'main-playing',true);
          else { room.playing = false; broadcast(room); }
        }
        else if (msg.clip === 'main' && msg.stage === 'main-playing' && room.phase === 'main-playing') transition(room,'game');
        else if (msg.clip === 'game' && msg.stage === 'game-playing' && room.phase === 'game-playing') transition(room,'ending-playing',true);
        else if (msg.clip === 'ending' && msg.stage === 'ending-playing' && room.phase === 'ending-playing') transition(room,'reveal');
      }
    });
    ws.on('close', () => {
      if (!ws.fish) return;
      const room = roomFor(ws.fish);
      if (room.display === ws) room.display = null;
      if (ws.role === 'phone' && room.owner === ws.clientId && room.phase !== 'idle') {
        const stillOnline = [...wss.clients].some(x => x !== ws && x.role === 'phone' && x.fish === ws.fish
          && x.clientId === ws.clientId && x.readyState === WebSocket.OPEN);
        if (!stillOnline) {
          if (['water-ready','water-playing'].includes(room.phase)) { room.playing = false; broadcast(room); }
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = setTimeout(() => reset(room), config.disconnectGraceMs);
        }
      }
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false; ws.ping();
    }
  }, 20000); heartbeat.unref();
  async function close() {
    await choiceStore.flush();
    clearInterval(heartbeat);
    for (const room of rooms.values()) { clearTimeout(room.resetTimer); clearTimeout(room.disconnectTimer); }
    for (const ws of wss.clients) ws.terminate();
    return new Promise(resolve => wss.close(() => server.close(resolve)));
  }
  return {server, wss, rooms, close};
}
if (require.main === module) {
  const app = createExhibitServer();
  app.server.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('Fish exhibit server started'));
  process.on('SIGTERM', () => app.close().then(() => process.exit(0)));
}
module.exports = {createExhibitServer};
