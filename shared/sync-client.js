/* 기본 WebSocket 공유. 첫 상태 수신 후 송신하고, 끊기면 다시 연결합니다. */
(() => {
  'use strict';
  class ExhibitClient {
    constructor({role, fish, onState, onStatus = () => {}, onError = () => {}}) {
      this.role = role; this.fish = fish; this.onState = onState; this.onStatus = onStatus; this.onError = onError;
      try { this.clientId = sessionStorage.getItem(`fish-client-${role}`) || crypto.randomUUID();
        sessionStorage.setItem(`fish-client-${role}`,this.clientId); }
      catch (_) { this.clientId = `${Date.now()}-${Math.random()}`; }
      this.state = null; this.ready = false; this.stopped = false; this.attempts = 0; this.queue = [];
      this.connect();
    }
    connect() {
      if (this.stopped) return;
      this.ready = false; this.onStatus(false);
      const base = window.FishSyncConfig.serverUrl || location.origin;
      let url;
      try { url = new URL('/exhibit',base); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; }
      catch (_) { this.onError('server-url'); return; }
      const socket = this.socket = new WebSocket(url.href);
      socket.addEventListener('open', () => {
        if (this.stopped || this.socket !== socket) return;
        this.attempts = 0;
        socket.send(JSON.stringify({type:'join',role:this.role,fish:this.fish,clientId:this.clientId}));
        this.pingTimer = setInterval(() => { if (socket.readyState === 1) socket.send('{"type":"ping"}'); },20000);
      });
      socket.addEventListener('message', event => {
        if (this.stopped || this.socket !== socket) return;
        let data; try { data = JSON.parse(event.data); } catch (_) { return; }
        if (data.type === 'state') {
          this.state = data; this.ready = true; this.onStatus(true); this.onState(data);
          const queue = this.queue.splice(0);
          for (const item of queue) {
            // 다른 관객의 세션으로 이전 성공 신호를 보내지 않습니다.
            if (item.name === 'tag' || item.session === data.session) this.event(item.name,item.detail);
          }
        } else if (data.type === 'error') this.onError(data.message);
      });
      socket.addEventListener('error', () => { if (!this.stopped && this.socket === socket) this.onStatus(false); });
      socket.addEventListener('close', () => {
        if (this.socket !== socket) return;
        clearInterval(this.pingTimer); this.ready = false;
        if (!this.stopped) this.onStatus(false);
        if (!this.stopped) this.retryTimer = setTimeout(() => this.connect(), Math.min(1000 * 2 ** this.attempts++,10000));
      });
    }
    event(name, detail = {}) {
      if (!this.ready || this.socket.readyState !== 1) {
        if (!['pour','video-ended'].includes(name)) {
          this.queue = this.queue.filter(item => item.name !== name);
          this.queue.push({name,detail,session:this.state?.session});
        }
        return false;
      }
      this.socket.send(JSON.stringify({type:'event',...detail,name,session:this.state?.session}));
      return true;
    }
    stop() { this.stopped = true; clearTimeout(this.retryTimer); clearInterval(this.pingTimer); this.socket?.close(); }
  }
  window.ExhibitClient = ExhibitClient;
})();
