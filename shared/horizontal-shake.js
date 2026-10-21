/* 기울이기와 구별하여 좌우 가속도의 빠른 방향 전환을 감지합니다. */
(() => {
  'use strict';
  class HorizontalShake {
    constructor(config,onShake) {this.config=config;this.onShake=onShake;this.reset();}
    reset(at=performance.now()) {
      this.armedAt=at+this.config.armDelayMs;this.lastAt=null;this.gravity=null;
      this.firstPeak=null;this.lastPeak=null;this.sign=0;this.peaks=0;
      this.locked=false;this.lastShake=-Infinity;this.lastStrong=-Infinity;
    }
    clearPeaks() {this.firstPeak=this.lastPeak=null;this.sign=0;this.peaks=0;}
    feed(event,at=performance.now()) {
      const cfg=this.config;
      if(!Number.isFinite(at))return false;
      if(this.lastAt!==null&&(at<this.lastAt||at-this.lastAt>cfg.sensorGapMs)) {
        this.reset(at);
      }
      const dt=this.lastAt===null?1/60:Math.max(.001,Math.min(.2,(at-this.lastAt)/1000));
      this.lastAt=at;
      let x,y;
      const linear=event.acceleration;
      if(Number.isFinite(linear?.x)&&Number.isFinite(linear?.y)) {
        x=linear.x;y=linear.y;
      } else {
        const raw=event.accelerationIncludingGravity;
        if(!Number.isFinite(raw?.x)||!Number.isFinite(raw?.y)) {this.clearPeaks();return false;}
        if(!this.gravity) {this.gravity={x:raw.x,y:raw.y};return false;}
        const blend=1-Math.exp(-dt/.35);
        this.gravity.x+=(raw.x-this.gravity.x)*blend;this.gravity.y+=(raw.y-this.gravity.y)*blend;
        x=raw.x-this.gravity.x;y=raw.y-this.gravity.y;
      }
      const angle=Number(screen.orientation?.angle ?? window.orientation ?? 0)*Math.PI/180;
      return this.axis(x*Math.cos(angle)-y*Math.sin(angle),at);
    }
    axis(value,at) {
      const cfg=this.config;
      if(!Number.isFinite(value)||!Number.isFinite(at)||at<this.armedAt)return false;
      if(Math.abs(value)>=cfg.shakeThreshold*.5)this.lastStrong=at;
      if(this.locked) {
        if(at-this.lastShake<cfg.shakeCooldownMs||at-this.lastStrong<cfg.rearmQuietMs)return false;
        this.locked=false;this.clearPeaks();
      }
      if(Math.abs(value)<cfg.shakeThreshold)return false;
      if(this.firstPeak!==null&&at-this.firstPeak>cfg.shakeWindowMs)this.clearPeaks();
      const sign=Math.sign(value);
      if(sign===this.sign||(this.lastPeak!==null&&at-this.lastPeak<cfg.minPeakGapMs))return false;
      this.firstPeak??=at;this.lastPeak=at;this.sign=sign;this.peaks++;
      if(this.peaks<cfg.shakeAlternations+1)return false;
      this.lastShake=at;this.lastStrong=at;this.locked=true;this.clearPeaks();
      this.onShake();return true;
    }
  }
  window.HorizontalShake=HorizontalShake;
})();
