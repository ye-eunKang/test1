/* 모든 게임이 공유하는 정지 감지. 미세한 센서 떨림은 허용합니다. */
(() => {
  class StillnessTracker {
    constructor({ holdMs = 3000, tolerance = 2, maxGapMs = 700 } = {}) {
      this.holdMs = holdMs;
      this.tolerance = tolerance;
      this.maxGapMs = maxGapMs;
      this.reset();
    }
    reset() { this.anchor = null; this.since = null; this.lastAt = null; }
    update(sample) {
      const { beta, gamma, receivedAt } = sample;
      if (![beta, gamma, receivedAt].every(Number.isFinite)) { this.reset(); return false; }
      const interrupted = this.lastAt !== null
        && (receivedAt - this.lastAt > this.maxGapMs || receivedAt < this.lastAt);
      // 기준 각도와 비교하므로 조금씩 계속 움직여도 측정 시간이 초기화됩니다.
      const moved = !this.anchor || interrupted
        || Math.abs(beta - this.anchor.beta) > this.tolerance
        || Math.abs(gamma - this.anchor.gamma) > this.tolerance;
      if (moved) {
        this.anchor = { beta, gamma };
        this.since = receivedAt;
      }
      this.lastAt = receivedAt;
      return receivedAt - this.since >= this.holdMs;
    }
  }
  window.StillnessTracker = StillnessTracker;
})();
