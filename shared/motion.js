/* 홈과 모든 게임이 한 센서 연결을 공유합니다. 권한을 반복 요청하지 않습니다. */
(() => {
  class MotionService {
    constructor() {
      this.enabled = false;
      this.last = null;
      this.listeners = new Set();
      this.permissionPromise = null;
      this.onOrientation = this.onOrientation.bind(this);
    }
    subscribe(callback) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }
    enable() {
      if (this.enabled) return Promise.resolve();
      if (this.permissionPromise) return this.permissionPromise;
      const Device = window.DeviceOrientationEvent;
      if (!window.isSecureContext) return Promise.reject(new Error('https-required'));
      if (!Device) return Promise.reject(new Error('sensor-unavailable'));
      // 권한 요청은 버튼 클릭 처리 안에서 즉시 실행해야 합니다.
      let permission;
      try {
        permission = typeof Device.requestPermission === 'function'
          ? Device.requestPermission() : Promise.resolve('granted');
      } catch (error) { return Promise.reject(error); }
      this.permissionPromise = Promise.resolve(permission).then((result) => {
        if (result !== 'granted') throw new Error('sensor-denied');
        window.addEventListener('deviceorientation', this.onOrientation);
        this.enabled = true;
      }).finally(() => { this.permissionPromise = null; });
      return this.permissionPromise;
    }
    onOrientation(event) {
      if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      this.last = {
        beta: event.beta, gamma: event.gamma,
        receivedAt: performance.now(),
      };
      for (const listener of this.listeners) listener(this.last);
    }
    isFresh() {
      return this.last !== null && performance.now() - this.last.receivedAt < 700;
    }
  }
  window.MotionService = MotionService;
})();
