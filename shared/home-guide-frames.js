/* 소녀: GIF의 지우기/색상 필터 대신 완성된 프레임을 25fps로 표시합니다. */
(() => {
  'use strict';
  const canvas = document.getElementById('homeGuideGif');
  const panel = document.getElementById('homeGuide');
  const stage = document.getElementById('stage');
  const config = window.FishConfig.home.guideFrames;
  if (!canvas || !panel || !config) return;
  const sequence = new FrameSequence(canvas, config, {
    cacheSize: config.count, tint: config.color,
    onError() { canvas.setAttribute('aria-label', '빈 어항을 들고 걷는 소녀 · 이미지를 불러오는 중'); },
    onPaint() { canvas.setAttribute('aria-label', '빈 어항을 들고 걷는 소녀'); },
  });
  let raf = null, startedAt = 0, elapsed = 0, running = false;
  const visible = () => !document.hidden && !panel.hidden && stage.dataset.screen === 'home';
  function tick(now) {
    raf = null;
    if (!visible()) { refresh(); return; }
    const index = Math.floor((elapsed + now - startedAt) * config.fps / 1000) % config.count;
    sequence.request(index);
    raf = requestAnimationFrame(tick);
  }
  function refresh() {
    if (visible() && !running) {
      running = true; startedAt = performance.now(); raf = requestAnimationFrame(tick);
    } else if (!visible() && running) {
      elapsed += performance.now() - startedAt; running = false;
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    }
  }
  sequence.request(0); sequence.warm();
  new MutationObserver(refresh).observe(panel, {attributes: true, attributeFilter: ['hidden']});
  new MutationObserver(refresh).observe(stage, {attributes: true, attributeFilter: ['data-screen']});
  document.addEventListener('visibilitychange', refresh);
  window.HomeGuideFrames = {getState: () => ({running, frame: sequence.paintedIndex})};
  refresh();
})();
