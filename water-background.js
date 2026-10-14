/*
 * 물 배경 엔진. 이미지나 외부 라이브러리 없이 Canvas로 그립니다.
 * 기울기에 따라 수면을 돌리고, 수면 높이를 다시 계산해 물의 양을 유지합니다.
 * home.js의 WATER_SETTINGS에서 색상·양·속도를 수정하세요.
 */
(() => {
  'use strict';
  const PI = Math.PI;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rad = (degree) => degree * PI / 180;
  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  // 사각형과 물 영역의 교차 다각형. 화면 밖으로 나간 물은 그리지 않습니다.
  function clipRectangle(width, height, nx, ny, offset) {
    const corners = [
      [-width / 2, -height / 2], [width / 2, -height / 2],
      [width / 2, height / 2], [-width / 2, height / 2],
    ];
    const output = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const da = a[0] * nx + a[1] * ny - offset;
      const db = b[0] * nx + b[1] * ny - offset;
      if (da >= 0) output.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const ratio = da / (da - db);
        output.push([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]);
      }
    }
    return output;
  }
  function polygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(area) / 2;
  }
  function findWaterline(width, height, nx, ny, fill) {
    const limit = Math.hypot(width, height);
    let low = -limit;
    let high = limit;
    const targetArea = width * height * fill;
    for (let i = 0; i < 22; i++) {
      const offset = (low + high) / 2;
      const area = polygonArea(clipRectangle(width, height, nx, ny, offset));
      if (area > targetArea) low = offset;
      else high = offset;
    }
    return (low + high) / 2;
  }

  class WaterBackground {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.options = {
        fillLevel: .88,
        topColor: '#b8ffff',
        middleColor: '#88e9e7',
        bottomColor: '#4fd4d8',
        backColor: '#7adedd',
        wavePx: 8,
        waveSpeed: .7,
        springStrength: 25,
        damping: 6,
        maxTiltDeg: 65,
        bubbleCount: 7,
        bubbleSpeed: 10,
        ...options,
      };
      this.angle = 0;
      this.targetAngle = 0;
      this.velocity = 0;
      this.energy = 0;
      this.time = 0;
      this.running = false;
      this.sensorListening = false;
      this.hasSensor = false;
      this.frameId = null;
      this.bubbles = [];
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.onFrame = this.onFrame.bind(this);
      this.onOrientation = this.onOrientation.bind(this);
      this.onVisibility = () => {
        if (document.hidden) this.stop();
        else if (this.enabled) this.start();
      };
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
      document.addEventListener('visibilitychange', this.onVisibility);
      this.resize();
      this.reset();
      this.start();
    }

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      this.width = bounds.width;
      this.height = bounds.height;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.bubbles = [];
    }

    // PC에서 각도를 전달할 수 있습니다. 예: water.setTilt(25)
    setTilt(degree) {
      if (!Number.isFinite(degree)) return;
      const next = rad(clamp(degree, -this.options.maxTiltDeg, this.options.maxTiltDeg));
      this.energy = Math.min(1.8, this.energy + Math.abs(wrap(next - this.targetAngle)) * .7);
      this.targetAngle = next;
    }
    setFillLevel(fraction) { this.options.fillLevel = clamp(fraction, .05, .98); }
    setWaveSize(pixels) { this.options.wavePx = clamp(pixels, 0, 30); }

    reset() {
      this.angle = 0;
      this.targetAngle = 0;
      this.velocity = 0;
      this.energy = 0;
      this.time = 0;
      this.waveAmplitude = this.options.wavePx;
      this.bubbles = [];
      this.lastFrameTime = null;
    }
    start() {
      this.enabled = true;
      if (this.running || document.hidden) return;
      this.running = true;
      this.lastFrameTime = null;
      this.frameId = requestAnimationFrame(this.onFrame);
    }
    stop() {
      this.running = false;
      if (this.frameId !== null) cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    pause() { this.enabled = false; this.stop(); }

    // 아이폰 센서 연결은 버튼 클릭에서 호출해야 합니다.
    async connectSensors() {
      if (!window.isSecureContext) {
        throw new Error('sensor-needs-https');
      }
      const Orientation = window.DeviceOrientationEvent;
      if (!Orientation) throw new Error('sensor-unavailable');
      if (typeof Orientation.requestPermission === 'function') {
        const permission = await Orientation.requestPermission();
        if (permission !== 'granted') throw new Error('sensor-denied');
      }
      if (!this.sensorListening) {
        window.addEventListener('deviceorientation', this.onOrientation);
        this.sensorListening = true;
      }
    }

    onOrientation(event) {
      if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      this.hasSensor = true;
      const beta = rad(event.beta);
      const gamma = rad(event.gamma);
      // 휴대폰을 잡은 방향에 따라 화면 속 중력 방향을 계산합니다.
      const gx = Math.cos(beta) * Math.sin(gamma);
      const gy = Math.sin(beta);
      const rotation = rad(window.screen.orientation?.angle ?? window.orientation ?? 0);
      const x = gx * Math.cos(rotation) - gy * Math.sin(rotation);
      const y = gx * Math.sin(rotation) + gy * Math.cos(rotation);
      // 화면이 정확히 위를 향하면 각도 계산이 불안정하므로 마지막 각도를 유지합니다.
      if (Math.hypot(x, y) > .16) this.setTilt(Math.atan2(x, y) * 180 / PI);
      this.canvas.dispatchEvent(new CustomEvent('water:sensor', {
        detail: { beta: event.beta, gamma: event.gamma },
      }));
    }

    onFrame(timestamp) {
      if (!this.running) return;
      const dt = this.lastFrameTime === null ? 1 / 60
        : clamp((timestamp - this.lastFrameTime) / 1000, .001, 1 / 30);
      this.lastFrameTime = timestamp;
      this.time += dt;
      // 기울기에 조금 늦게 반응하고, 잠시 흔들린 뒤 잦아듭니다.
      const force = wrap(this.targetAngle - this.angle) * this.options.springStrength;
      this.velocity += (force - this.velocity * this.options.damping) * dt;
      this.angle += this.velocity * dt;
      this.energy *= Math.exp(-dt * 1.7);
      const scale = this.width / 390;
      const motion = Math.min(16, Math.abs(this.velocity) * 10 + this.energy * 10);
      const base = this.options.wavePx * (this.reducedMotion ? .25 : 1);
      const wanted = (base + motion) * scale;
      this.waveAmplitude += (wanted - this.waveAmplitude) * (1 - Math.exp(-dt * 5));
      this.draw(dt);
      this.frameId = requestAnimationFrame(this.onFrame);
    }

    waveAt(s, phase = 0) {
      const x = s / this.width;
      const clock = this.time * this.options.waveSpeed;
      return this.waveAmplitude * (
        Math.sin(x * PI * 2.2 + clock + phase) * .72
        + Math.sin(x * PI * 4.8 - clock * 1.45 + phase * .6) * .21
        + Math.sin(x * PI * 10.1 + clock * 1.8) * .04
      );
    }

    waterPath(nx, ny, offset, phase) {
      const path = new Path2D();
      const extent = Math.hypot(this.width, this.height) * 1.2;
      const tx = ny;
      const ty = -nx;
      const cx = this.width / 2;
      const cy = this.height / 2;
      const samples = 120;
      for (let i = 0; i <= samples; i++) {
        const s = -extent + extent * 2 * i / samples;
        const depth = offset + this.waveAt(s, phase);
        const x = cx + tx * s + nx * depth;
        const y = cy + ty * s + ny * depth;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.lineTo(cx + tx * extent + nx * extent * 3, cy + ty * extent + ny * extent * 3);
      path.lineTo(cx - tx * extent + nx * extent * 3, cy - ty * extent + ny * extent * 3);
      path.closePath();
      return path;
    }

    spawnBubble(nx, ny, offset) {
      const bubble = { alive: false };
      for (let attempt = 0; attempt < 25; attempt++) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        const depth = (x - this.width / 2) * nx + (y - this.height / 2) * ny;
        if (depth > offset + this.waveAmplitude + 22) {
          return {
            alive: true, x, y,
            radius: (2.5 + Math.random() * 6) * this.width / 390,
            speed: this.options.bubbleSpeed * (.6 + Math.random() * .7),
            opacity: .35 + Math.random() * .35,
            phase: Math.random() * PI * 2,
          };
        }
      }
      return bubble;
    }

    draw(dt = 0) {
      if (!this.width || !this.height) return;
      const { ctx, width: w, height: h } = this;
      const nx = Math.sin(this.angle);
      const ny = Math.cos(this.angle);
      const offset = findWaterline(w, h, nx, ny, this.options.fillLevel);
      this.waterline = offset;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // 앞뒤 파도를 어긋나게 그려 레퍼런스처럼 수면을 두 겹으로 만듭니다.
      const back = this.waterPath(nx, ny, offset - w * .01, PI * .92);
      ctx.fillStyle = this.options.backColor;
      ctx.fill(back);
      const front = this.waterPath(nx, ny, offset, 0);
      const sx = w / 2 + nx * offset;
      const sy = h / 2 + ny * offset;
      const gradient = ctx.createLinearGradient(sx, sy, sx + nx * h, sy + ny * h);
      gradient.addColorStop(0, this.options.topColor);
      gradient.addColorStop(.55, this.options.middleColor);
      gradient.addColorStop(1, this.options.bottomColor);
      ctx.fillStyle = gradient;
      ctx.fill(front);

      // 물 안에만 드문 기포를 그립니다.
      ctx.save();
      ctx.clip(front);
      while (this.bubbles.length < this.options.bubbleCount) {
        this.bubbles.push(this.spawnBubble(nx, ny, offset));
      }
      this.bubbles.forEach((bubble, index) => {
        if (bubble.alive) {
          bubble.x -= nx * bubble.speed * dt;
          bubble.y -= ny * bubble.speed * dt;
          const depth = (bubble.x - w / 2) * nx + (bubble.y - h / 2) * ny;
          if (depth < offset + 12 || bubble.x < -10 || bubble.x > w + 10
            || bubble.y < -10 || bubble.y > h + 10) bubble.alive = false;
        }
        if (!bubble.alive) bubble = this.bubbles[index] = this.spawnBubble(nx, ny, offset);
        if (!bubble.alive) return;
        const sway = Math.sin(this.time * .8 + bubble.phase) * 3 * w / 390;
        ctx.beginPath();
        ctx.arc(bubble.x + ny * sway, bubble.y - nx * sway, bubble.radius, 0, PI * 2);
        ctx.fillStyle = `rgba(245,255,255,${bubble.opacity})`;
        ctx.fill();
      });
      ctx.restore();
    }

    destroy() {
      this.pause();
      this.resizeObserver.disconnect();
      window.removeEventListener('deviceorientation', this.onOrientation);
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
  }
  WaterBackground.geometry = { findWaterline, clipRectangle, polygonArea };
  window.WaterBackground = WaterBackground;
})();
