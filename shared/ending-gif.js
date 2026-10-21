/* GIF를 미리 다운로드하고, 반복 확장만 제거하여 원래 프레임 그대로 한 번 재생합니다. */
(() => {
  'use strict';
  const cache = new Map();
  const text = bytes => String.fromCharCode(...bytes);
  function inspect(buffer) {
    const bytes = new Uint8Array(buffer);
    const signature = text(bytes.subarray(0,6));
    if (signature !== 'GIF87a' && signature !== 'GIF89a') {
      // 정지 PNG를 올렸을 때에는 설정된 대기 시간만 표시합니다.
      const png = [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
      if (!png) throw new Error('finish-image-format');
      return {blob:new Blob([bytes],{type:'image/png'}),frames:1,durationMs:0,animated:false};
    }
    if (bytes.length < 14) throw new Error('invalid-gif');
    let at = 13 + ((bytes[10] & 128) ? 3 * (2 << (bytes[10] & 7)) : 0);
    const parts = [bytes.subarray(0,at)];
    let frames = 0, durationMs = 0, delayMs = 100, trailer = false;
    function need(count) { if (at + count > bytes.length) throw new Error('truncated-gif'); }
    function subblocks() {
      for (;;) {
        need(1); const size = bytes[at++];
        if (!size) return;
        need(size); at += size;
      }
    }
    while (at < bytes.length) {
      const start = at, marker = bytes[at++];
      let omit = false;
      if (marker === 0x3b) {
        parts.push(bytes.subarray(start,at)); trailer = true; break;
      } else if (marker === 0x21) {
        need(2); const label = bytes[at++];
        if (label === 0xf9) {
          need(6);
          if (bytes[at] !== 4 || bytes[at+5] !== 0) throw new Error('invalid-gif-control');
          const ms = (bytes[at+2] | bytes[at+3] << 8) * 10;
          // Chrome/Safari에서 매우 짧은 GIF 지연은 100ms로 처리됩니다.
          delayMs = ms <= 10 ? 100 : ms;
        } else if (label === 0xff) {
          need(1 + bytes[at]);
          const name = text(bytes.subarray(at+1,at+1+bytes[at]));
          omit = name === 'NETSCAPE2.0' || name === 'ANIMEXTS1.0';
        }
        subblocks();
      } else if (marker === 0x2c) {
        need(9); const packed = bytes[at+8]; at += 9;
        if (packed & 128) { const size = 3 * (2 << (packed & 7)); need(size); at += size; }
        need(1); at++; subblocks();
        frames++; durationMs += delayMs; delayMs = 100;
      } else throw new Error('invalid-gif-block');
      if (!omit) parts.push(bytes.subarray(start,at));
    }
    if (!trailer || !frames) throw new Error('incomplete-gif');
    return {blob:new Blob(parts,{type:'image/gif'}),frames,durationMs,animated:frames > 1};
  }
  function preload(src) {
    if (!src) return Promise.reject(new Error('missing-finish-image'));
    if (!cache.has(src)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(),20000);
      const pending = fetch(src,{signal:controller.signal,cache:'no-cache'})
        .then(response => {
          if (!response.ok) throw new Error('finish-image-load');
          return response.arrayBuffer();
        }).then(inspect).finally(() => clearTimeout(timeout));
      cache.set(src,pending);
      pending.catch(() => { if (cache.get(src) === pending) cache.delete(src); });
    }
    return cache.get(src);
  }
  function play(host,src,{scope,stillDurationMs = 3000,onReady = () => {}}) {
    return new Promise(resolve => {
      let settled = false, image = null, url = null, started = false;
      const loadTimeout = setTimeout(() => fail(),20000);
      function settle(status,media) {
        if (settled) return;
        settled = true; clearTimeout(loadTimeout); resolve({status,media});
      }
      function dispose() {
        clearTimeout(loadTimeout);
        if (image) { image.onload = image.onerror = null; image.removeAttribute('src'); image.remove(); }
        if (url) { URL.revokeObjectURL(url); url = null; }
      }
      function fail() { dispose(); settle('failed'); }
      scope.cleanup(() => { dispose(); settle('cancelled'); });
      if (!scope.active) return;
      preload(src).then(media => {
        if (settled || !scope.active) return;
        image = new Image(); image.id = 'endingGif'; image.alt = '물고기가 바다로 헤엄쳐요';
        image.draggable = false;
        image.onload = () => {
          if (settled || started || !scope.active) return;
          started = true; clearTimeout(loadTimeout);
          host.hidden = false; onReady(media);
          const ms = media.animated ? media.durationMs : Math.max(0,stillDurationMs);
          scope.delay(ms).then(done => settle(done ? 'completed' : 'cancelled',media));
        };
        image.onerror = fail;
        host.replaceChildren(image);
        // 매번 다른 메모리 URL을 사용해 다음 관객도 반드시 첫 프레임부터 봅니다.
        url = URL.createObjectURL(media.blob); image.src = url;
      },fail);
    });
  }
  window.EndingGif = {preload,play};
})();
