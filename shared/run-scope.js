/* 화면을 벗어나면 타이머·이벤트·대기 작업을 한 번에 취소합니다. */
(() => {
  class RunScope {
    constructor() {
      this.active = true;
      this.timers = new Map();
      this.cleanups = new Set();
    }
    delay(ms) {
      if (!this.active) return Promise.resolve(false);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          resolve(this.active);
        }, Math.max(0, ms));
        this.timers.set(timer, resolve);
      });
    }
    listen(target, type, callback, options) {
      const wrapped = (event) => { if (this.active) callback(event); };
      target.addEventListener(type, wrapped, options);
      const remove = () => target.removeEventListener(type, wrapped, options);
      this.cleanups.add(remove);
      return remove;
    }
    cleanup(callback) {
      if (this.active) this.cleanups.add(callback);
      else callback();
    }
    abort() {
      if (!this.active) return;
      this.active = false;
      for (const [timer, resolve] of this.timers) {
        clearTimeout(timer);
        resolve(false);
      }
      this.timers.clear();
      for (const cleanup of this.cleanups) cleanup();
      this.cleanups.clear();
    }
  }
  window.RunScope = RunScope;
})();
