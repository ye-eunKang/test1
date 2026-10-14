/* 공통 화면 전환. 미니게임을 더 추가해도 홈·센서·엔딩은 이 파일을 공유합니다. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const profiles = window.FishConfig.interactions;
  const common = window.FishConfig.common;
  const definitions = new Map();
  const instances = new Map();
  const motion = new MotionService();
  const stillness = new StillnessTracker({
    holdMs: common.stillHoldMs, tolerance: common.stillTolerance, maxGapMs: common.sensorGapMs,
  });
  let screen = 'home';
  let activeId = null;
  let profile = null;
  let run = null;
  let water = null;
  let levelSince = null;
  let revealReady = false;
  let endingStarted = false;
  let initialized = false;
  let previewPending = false;
  let sensorWatch = null;
  const desktop = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const debug = desktop || new URLSearchParams(location.search).get('debug') === '1';

  function announce(text) { $('live').textContent = text; }
  function updateRoute(id) {
    const url = new URL(location.href);
    url.searchParams.delete('phase');
    url.searchParams.delete('interaction');
    url.searchParams.delete('preview');
    if (id) url.searchParams.set('fish', id);
    else url.searchParams.delete('fish');
    try { history.replaceState({}, '', url.href); } catch (_) { /* 로컬 파일에서도 실행 */ }
  }
  function show(name) {
    screen = name;
    const views = { home: 'home', interaction: 'interactionScreen', reveal: 'reveal', ocean: 'ocean' };
    for (const [key, id] of Object.entries(views)) $(id).hidden = key !== name;
    $('stage').dataset.screen = name;
    $('restart').hidden = name === 'home';
    if (water) {
      if (name === 'home') { water.resize(); water.start(); }
      else water.pause();
    }
    updateDebugState();
  }
  function cancelRun() {
    run?.abort();
    run = null;
    if (activeId) {
      const game = instances.get(activeId);
      game?.stop();
      game?.reset();
    }
    const video = $('fishVideo');
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.hidden = true;
    $('endingFish').hidden = true;
    $('endingPlay').hidden = true;
    stillness.reset();
    levelSince = null;
    revealReady = false;
    endingStarted = false;
    previewPending = false;
    clearTimeout(sensorWatch);
  }
  function showHome() {
    cancelRun();
    activeId = null;
    profile = null;
    delete $('stage').dataset.fish;
    $('routeNotice').textContent = '';
    $('waitingMessage').hidden = false;
    $('endingStatus').textContent = '';
    $('previewStill').disabled = false;
    document.querySelectorAll('.interaction-view').forEach((view) => { view.hidden = true; });
    water?.reset();
    $('homeTilt').value = '0';
    $('homeTiltValue').textContent = '0°';
    updateRoute(null);
    show('home');
    syncSensorButtons();
    announce('첫 화면으로 돌아왔어요.');
    window.dispatchEvent(new CustomEvent('fishhome:show'));
  }
  function registerInteraction(id, definition) {
    if (!profiles.some((entry) => entry.id === id)) throw new Error(`config.js에 없는 물고기: ${id}`);
    if (definitions.has(id)) throw new Error(`중복 등록: ${id}`);
    if (typeof definition.mount !== 'function') throw new Error('mount 함수가 필요합니다.');
    definitions.set(id, definition);
    if (initialized) renderPicker();
  }
  function startInteraction(id) {
    if (id === '5') id = 'fish05';
    const entry = profiles.find((item) => item.id === id);
    const definition = definitions.get(id);
    if (!entry || !definition) {
      showHome();
      $('routeNotice').textContent = '이 물고기 인터랙션은 아직 준비 중이에요.';
      announce('선택한 인터랙션이 아직 등록되지 않았어요.');
      return false;
    }
    const root = $(definition.viewId);
    if (!root) {
      showHome();
      $('routeNotice').textContent = '인터랙션 화면을 찾지 못했어요.';
      return false;
    }
    cancelRun();
    activeId = id;
    profile = entry;
    $('stage').dataset.fish = id;
    run = new RunScope();
    for (const item of document.querySelectorAll('.interaction-view')) item.hidden = item !== root;
    let game = instances.get(id);
    if (!game) {
      // 추가 게임도 flow.complete()를 호출하면 공통 물고기 소개로 넘어갑니다.
      game = definition.mount(root, {
        config: entry,
        complete: () => {
          if (activeId !== id || screen !== 'interaction') return;
          instances.get(id)?.stop();
          if (window.PhoneSync?.isActive(id)) {
            window.dispatchEvent(new CustomEvent('fish:game-complete', {detail:{fish:id}}));
          } else reveal();
        },
        returnHome: showHome,
        announce,
        motion,
      });
      instances.set(id, game);
    }
    updateRoute(id);
    show('interaction');
    game.start();
    return true;
  }
  function assignArtwork() {
    const assets = profile.assets;
    for (const [id, key] of [['rays','rays'], ['fish','fish'], ['fishName','fishName'], ['waitingMessage','waitingMessage']]) {
      if (assets[key]) { $(id).src = assets[key]; $(id).hidden = false; }
      else $(id).hidden = true;
    }
    $('fish').alt = profile.label;
    $('fishName').alt = profile.label;
    $('stage').style.setProperty('--rays-duration', `${profile.rotationSeconds ?? common.rotationSeconds}s`);
  }
  async function reveal() {
    if (!run?.active) return;
    const current = run;
    instances.get(activeId)?.stop();
    assignArtwork();
    revealReady = false;
    $('sensorPanel').hidden = true;
    $('message').src = profile.assets.awakeMessage || '';
    $('message').hidden = !profile.assets.awakeMessage;
    $('message').className = 'art awake';
    $('message').alt = '물고기의 몸에 물이 닿자, 물고기가 깨어났어요!';
    show('reveal');
    if (!await current.delay(profile.revealMessageMs ?? common.revealMessageMs)) return;
    $('message').src = profile.assets.levelMessage || '';
    $('message').hidden = !profile.assets.levelMessage;
    $('message').className = 'art level';
    $('message').alt = '물고기가 헤엄칠 수 있도록 핸드폰을 수평으로 유지해주세요';
    revealReady = true;
    levelSince = null;
    $('sensorPanel').hidden = false;
    syncSensorButtons();
    watchSensor();
    announce('휴대폰을 수평으로 유지해주세요.');
  }
  function endingWait() {
    if (!run?.active) return;
    revealReady = false;
    stillness.reset();
    endingStarted = false;
    previewPending = false;
    assignArtwork();
    $('waitingMessage').hidden = !profile.assets.waitingMessage;
    $('endingFish').hidden = true;
    $('fishVideo').hidden = true;
    $('endingStatus').textContent = '';
    $('previewStill').disabled = false;
    const positions = [[7,20,9],[15,23,18],[78,45,9],[64,52,19],[65,56,31],[21,80,9],[9,87,15]];
    $('bubbles').replaceChildren();
    for (const [i, [left, top, width]] of positions.entries()) {
      if (!profile.assets.bubble) break;
      const image = new Image();
      image.src = profile.assets.bubble;
      image.alt = '';
      image.className = 'bubble';
      image.style.cssText = `left:${left}%;top:${top}%;width:${width}%;animation-delay:-${i*.7}s`;
      $('bubbles').append(image);
    }
    show('ocean');
    syncSensorButtons();
    watchSensor();
    announce('휴대폰을 수평으로 들고 잠시 멈춰주세요.');
    window.dispatchEvent(new CustomEvent('fish:level-ready', {detail:{fish:activeId}}));
  }
  async function playEnding() {
    if (!run?.active || endingStarted || screen !== 'ocean') return;
    const current = run;
    endingStarted = true;
    $('waitingMessage').hidden = true;
    $('endingMotion').hidden = true;
    $('previewStill').hidden = true;
    clearTimeout(sensorWatch);
    const fishId = activeId;
    window.dispatchEvent(new CustomEvent('fish:swim-started', { detail: { fish: fishId } }));
    if (profile.videoSrc) {
      const video = $('fishVideo');
      video.loop = false;
      video.muted = true;
      video.hidden = false;
      let finished = false;
      current.listen(video, 'ended', async () => {
        if (finished || !current.active) return;
        finished = true;
        window.dispatchEvent(new CustomEvent('fish:finished', { detail: { fish: fishId } }));
        // 영상이 끝난 뒤 TD 신호를 보내고 4초 후 복귀합니다.
        if (await current.delay(window.FishSyncConfig?.returnHomeMs ?? 4000)) showHome();
      });
      current.listen(video, 'error', () => {
        $('endingStatus').textContent = '물고기 영상을 불러오지 못했어요. 영상 경로를 확인해주세요.';
        $('endingPlay').hidden = false;
      });
      video.src = profile.videoSrc;
      video.load();
      const play = async () => {
        if (!current.active) return;
        try {
          await video.play();
          if (!current.active) { video.pause(); return; }
          $('endingPlay').hidden = true;
          $('endingStatus').textContent = '';
        } catch (_) {
          if (!current.active) return;
          $('endingStatus').textContent = '버튼을 눌러 물고기를 만나보세요.';
          $('endingPlay').hidden = false;
        }
      };
      current.listen($('endingPlay'), 'click', play);
      play();
    } else {
      // 마지막 영상 미등록: 기존 물고기 그림으로 홈 복귀 흐름을 확인합니다.
      $('endingFish').src = profile.assets.fish || '';
      $('endingFish').hidden = !profile.assets.fish;
      if (debug) $('endingStatus').textContent = '영상 미등록 · 임시 물고기 그림 후 홈으로 돌아갑니다.';
      if (await current.delay(profile.fallbackDisplayMs ?? common.fallbackDisplayMs)) showHome();
    }
  }

  function onMotion(sample) {
    if (document.hidden) { levelSince = null; stillness.reset(); return; }
    $('homeMotionGate').hidden = true;
    if (screen === 'home') water?.onOrientation(sample);
    if (screen === 'reveal' && revealReady) {
      const flat = Math.abs(sample.beta) < common.levelTolerance && Math.abs(sample.gamma) < common.levelTolerance;
      const interrupted = levelSince !== null && motion.previousAt !== undefined
        && sample.receivedAt - motion.previousAt > common.sensorGapMs;
      if (!flat || interrupted) levelSince = null;
      if (flat) {
        levelSince ??= sample.receivedAt;
        if (sample.receivedAt - levelSince >= common.levelHoldMs) endingWait();
      }
    } else if (screen === 'ocean' && !endingStarted) {
      const flat = Math.abs(sample.beta) < common.levelTolerance && Math.abs(sample.gamma) < common.levelTolerance;
      if (!flat) stillness.reset();
      else if (stillness.update(sample)) playEnding();
    }
    motion.previousAt = sample.receivedAt;
  }
  function syncSensorButtons() {
    $('enableMotion').hidden = motion.enabled;
    $('endingMotion').hidden = motion.enabled || endingStarted;
    $('simulate').hidden = !debug;
    $('previewStill').hidden = !debug || endingStarted;
    if (screen === 'home') $('homeMotionGate').hidden = desktop || motion.isFresh();
    $('sensorNote').textContent = motion.enabled ? '화면이 위를 향하도록 평평하게 들어주세요.' : '';
  }
  function watchSensor() {
    clearTimeout(sensorWatch);
    sensorWatch = setTimeout(() => {
      if (!motion.isFresh() && (screen === 'reveal' || screen === 'ocean') && !endingStarted) {
        const target = screen === 'reveal' ? $('sensorNote') : $('endingStatus');
        target.textContent = '기울기 신호가 없어요. 센서 권한을 허용해주세요.';
      }
    }, 3500);
  }
  async function enableMotion() {
    const buttons = [$('enableHomeMotion'), $('enableMotion'), $('endingMotion')].filter(Boolean);
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await motion.enable();
      $('homeMotionStatus').textContent = '휴대폰을 좌우로 기울여보세요.';
      syncSensorButtons();
      watchSensor();
    } catch (error) {
      const text = error.message === 'https-required'
        ? '휴대폰 센서는 HTTPS 배포 주소에서 연결해주세요.' : '기울기 권한을 허용해주세요.';
      $('homeMotionStatus').textContent = text;
      $('sensorNote').textContent = text;
      $('endingStatus').textContent = text;
    } finally { buttons.forEach((button) => { button.disabled = false; }); }
  }
  async function previewStillness() {
    if (!debug || !run?.active || screen !== 'ocean' || endingStarted || previewPending) return;
    previewPending = true;
    $('previewStill').disabled = true;
    const current = run;
    $('endingStatus').textContent = 'PC 미리보기 · 3초 기다리는 중…';
    if (await current.delay(common.stillHoldMs)) playEnding();
  }
  function previewScene(id, target) {
    if (!debug || !startInteraction(id)) return;
    if (target === 'reveal') reveal();
    if (target === 'ocean') { instances.get(activeId)?.stop(); endingWait(); }
    const url = new URL(location.href);
    url.searchParams.set('preview', target);
    try { history.replaceState({}, '', url.href); } catch (_) {}
  }
  function renderPicker() {
    $('interactionPicker').replaceChildren();
    for (const entry of profiles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.label;
      button.disabled = !definitions.has(entry.id);
      button.dataset.fish = entry.id;
      button.addEventListener('click', () => startInteraction(entry.id));
      $('interactionPicker').append(button);
    }
  }
  function updateDebugState() {
    if (!$('debugState')) return;
    $('debugState').textContent = `${activeId || '홈'} · ${screen}`;
  }
  function initialize() {
    if (initialized) return;
    initialized = true;
    water = new WaterBackground($('homeWater'), window.FishConfig.home);
    motion.subscribe(onMotion);
    $('developerPanel').hidden = !debug;
    document.body.classList.toggle('has-debug', debug);
    renderPicker();
    $('restart').addEventListener('click', showHome);
    $('debugHome').addEventListener('click', showHome);
    for (const id of ['enableHomeMotion', 'enableMotion', 'endingMotion']) $(id)?.addEventListener('click', enableMotion);
    $('simulate').addEventListener('click', endingWait);
    $('previewStill').addEventListener('click', previewStillness);
    $('debugReveal').addEventListener('click', () => previewScene(activeId || 'fish05', 'reveal'));
    $('debugOcean').addEventListener('click', () => previewScene(activeId || 'fish05', 'ocean'));
    $('homeTilt').addEventListener('input', (event) => {
      water.setTilt(Number(event.target.value));
      $('homeTiltValue').textContent = `${event.target.value}°`;
    });
    const params = new URLSearchParams(location.search);
    const selected = params.get('fish') || params.get('interaction');
    const phase = params.get('phase');
    const preview = debug ? params.get('preview') : null;
    showHome();
    if (selected) {
  if (phase === 'water') {
    if (window.HomeGuide) {
      HomeGuide.enterWater(selected);
    }
  } else if (preview) {
    previewScene(selected, preview);
  } else {
    startInteraction(selected);
  }
}
    if (!desktop && window.isSecureContext && window.DeviceOrientationEvent
      && typeof DeviceOrientationEvent.requestPermission !== 'function') enableMotion();
  }
  window.FishApp = {
    hasInteraction: (id) => definitions.has(id), registerInteraction, startInteraction, showHome, initialize,
    previewScene, motion,
    presentReveal(id) { if (activeId !== id || !run?.active) startInteraction(id); return reveal(); },
    presentWaiting(id) { if (activeId !== id || !run?.active) startInteraction(id); endingWait(); },
    pauseGame() { if (activeId) instances.get(activeId)?.stop(); },
    playEnding,
    getState: () => ({ screen, activeId, revealReady, endingStarted,
      game: activeId ? instances.get(activeId)?.getState?.() : null }),
  };
})();
