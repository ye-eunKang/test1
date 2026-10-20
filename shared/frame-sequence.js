/* 압축 이미지는 미리 받고, 필요한 프레임만 디코딩해 Canvas에 교체합니다. */
(() => {
  'use strict';
  class FrameSequence {
    constructor(canvas, config, {cacheSize = 8, tint = '', onPaint = () => {}, onError = () => {}} = {}) {
      this.canvas = canvas; this.config = config; this.context = canvas.getContext('2d');
      this.cacheSize = Math.max(2, cacheSize); this.tint = tint;
      this.onPaint = onPaint; this.onError = onError;
      this.blobs = new Map(); this.downloads = new Map();
      this.frames = new Map(); this.decodes = new Map();
      this.targetIndex = -1; this.paintedIndex = -1; this.failedIndex = -1;
      this.busy = null; this.warming = null; this.disposed = false; this.retryAt = 0;
      canvas.width = config.width; canvas.height = config.height;
    }
    url(index) {
      return `${this.config.prefix}${String(index).padStart(this.config.digits || 3, '0')}${this.config.suffix || '.webp'}`;
    }
    async blob(index) {
      if (this.blobs.has(index)) return this.blobs.get(index);
      if (this.downloads.has(index)) return this.downloads.get(index);
      const job = (async () => {
        const response = await fetch(this.url(index), {cache: 'force-cache'});
        if (!response.ok) throw new Error(`프레임을 불러오지 못했어요: ${this.url(index)}`);
        const blob = await response.blob();
        if (!this.disposed) this.blobs.set(index, blob);
        return blob;
      })();
      this.downloads.set(index, job);
      try { return await job; } finally { this.downloads.delete(index); }
    }
    async decode(index) {
      if (this.frames.has(index)) {
        const frame = this.frames.get(index);
        this.frames.delete(index); this.frames.set(index, frame);
        return frame;
      }
      if (this.decodes.has(index)) return this.decodes.get(index);
      const job = (async () => {
        const blob = await this.blob(index);
        let frame;
        if (typeof createImageBitmap === 'function') {
          try { frame = await createImageBitmap(blob); } catch (_) { /* 구형 Safari는 Image로 표시 */ }
        }
        if (!frame) {
          frame = await new Promise((resolve, reject) => {
            const image = new Image(), url = URL.createObjectURL(blob);
            image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
            image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`프레임을 읽지 못했어요: ${this.url(index)}`)); };
            image.src = url;
          });
        }
        if (this.disposed) { frame.close?.(); return null; }
        this.frames.set(index, frame);
        this.trim(index);
        return frame;
      })();
      this.decodes.set(index, job);
      try { return await job; } finally { this.decodes.delete(index); }
    }
    trim(protectedIndex) {
      for (const [index, frame] of this.frames) {
        if (this.frames.size <= this.cacheSize) break;
        if (index === protectedIndex || index === this.targetIndex) continue;
        this.frames.delete(index); frame.close?.();
      }
    }
    warm(concurrency = 4) {
      if (this.warming) return this.warming;
      let next = 0;
      const worker = async () => {
        while (!this.disposed && next < this.config.count) {
          const index = next++;
          try { await this.blob(index); } catch (_) { /* 실제 요청 시 다시 시도하고 오류를 표시 */ }
        }
      };
      this.warming = Promise.all(Array.from({length: concurrency}, worker));
      // 급하게 전부 부어도 마지막 프레임은 다운로드 대기열 뒤에 밀리지 않습니다.
      this.blob(this.config.count - 1).catch(() => {});
      return this.warming;
    }
    request(index) {
      if (this.disposed) return Promise.resolve(false);
      index = Math.max(0, Math.min(this.config.count - 1, Math.round(index)));
      if (!Number.isFinite(index)) return Promise.resolve(false);
      this.targetIndex = index;
      if (this.paintedIndex === index) return Promise.resolve(true);
      if (this.busy) return this.busy;
      if (this.failedIndex === index && performance.now() < this.retryAt) return Promise.resolve(false);
      const job = this.flush().finally(() => {
        if (this.busy !== job) return;
        this.busy = null;
        if (!this.disposed && this.targetIndex !== this.paintedIndex && this.failedIndex !== this.targetIndex) {
          this.request(this.targetIndex);
        }
      });
      this.busy = job;
      return job;
    }
    async flush() {
      while (!this.disposed && this.targetIndex !== this.paintedIndex) {
        const index = this.targetIndex;
        try {
          const frame = await this.decode(index);
          if (this.disposed) return false;
          // 읽는 동안 새 물의 양이 도착했다면 오래된 프레임으로 되돌리지 않습니다.
          if (index !== this.targetIndex) continue;
          const ctx = this.context;
          // 로딩 중 clearRect를 하지 않습니다. 교체할 그림이 준비되면 한 번에 그립니다.
          ctx.globalCompositeOperation = 'copy';
          ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
          if (this.tint) {
            ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = this.tint;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          }
          ctx.globalCompositeOperation = 'source-over';
          this.failedIndex = -1; this.paintedIndex = index;
          this.canvas.dataset.frame = String(index);
          this.onPaint(index);
        } catch (error) {
          if (index !== this.targetIndex) continue;
          this.failedIndex = index; this.retryAt = performance.now() + 1000;
          this.onError(error, index); return false;
        }
      }
      return !this.disposed;
    }
    destroy() {
      this.disposed = true;
      for (const frame of this.frames.values()) frame.close?.();
      this.frames.clear(); this.blobs.clear();
    }
  }
  window.FrameSequence = FrameSequence;
})();
