/* 공통 화면 전환. 미니게임을 더 추가해도 홈·센서·엔딩은 이 파일을 공유합니다. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const profiles = window.FishConfig.interactions;
  const common = window.FishConfig.common;
  const definitions = new Map();
  const instances = new Map();
  const artworkCache = new Map();
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
  let revealStep = 'awake';
  let waitingReady = false;
  let completionRequested = false;
  let motionHint = '화면을 한 번 터치해 기울기를 허용해주세요.';
  const buttonFinish = () => common.finishWithButton !== false;
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
    if (water) {
      if (name === 'home') { water.resize(); water.start(); }
      else water.pause();
    }
    updateDebugState();
    syncSensorButtons();
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
    waitingReady = false;
    $('ocean').dataset.ready = 'false';
    completionRequested = false;
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
  function prepareArtwork(id) {
    const assets = profiles.find(entry => entry.id === id)?.assets;
    if (!assets) return;
    // iPad의 영상이 재생되는 동안 폰의 다음 이미지를 미리 불러오고 디코딩합니다.
    for (const key of ['rays','fish','fishName','awakeMessage','levelMessage','waitingMessage','bubble']) {
      const src = assets[key];
      if (!src || artworkCache.has(src)) continue;
      const image = new Image();
      image.decoding = 'async';
      artworkCache.set(src, image);
      image.src = src;
      if (typeof image.decode === 'function') image.decode().catch(() => artworkCache.delete(src));
    }
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
    prepareArtwork(id);
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
  function reveal() {
    if (!run?.active) return;
    instances.get(activeId)?.stop();
    assignArtwork();
    revealReady = false;
    revealStep = 'awake';
    $('sensorPanel').hidden = true;
    $('message').src = profile.assets.awakeMessage || '';
    $('message').hidden = !profile.assets.awakeMessage;
    $('message').className = 'art awake';
    $('message').alt = '물고기의 몸에 물이 닿자, 물고기가 깨어났어요!';
    show('reveal');
    announce('물고기가 깨어났어요. 화면을 터치해 다음 안내를 보세요.');
  }
  function advanceReveal() {
    if (screen !== 'reveal' || !run?.active) return;
    if (revealStep === 'level') {
      if (buttonFinish()) endingWait();
      else {
        revealReady = true; levelSince = null;
        $('sensorPanel').hidden = false;
        syncSensorButtons(); watchSensor();
      }
      return;
    }
    revealStep = 'level';
    $('message').src = profile.assets.levelMessage || '';
    $('message').hidden = !profile.assets.levelMessage;
    $('message').className = 'art level';
    $('message').alt = '물고기가 헤엄칠 수 있도록 핸드폰을 수평으로 유지해주세요';
    announce('화면을 터치해 물고기를 보내는 단계로 이동하세요.');
  }
  function endingWait() {
    if (!run?.active) return;
    revealReady = false;
    stillness.reset();
    endingStarted = false;
    waitingReady = false;
    $('ocean').dataset.ready = 'false';
    previewPending = false;
    assignArtwork();
    $('waitingMessage').hidden = !profile.assets.waitingMessage;
    $('endingFish').hidden = true;
    $('fishVideo').hidden = true;
    $('endingPlay').hidden = true;
    $('endingPlay').textContent = '물고기 영상 재생하기';
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
    announce('화면을 터치해 다음으로 진행하세요.');
    window.dispatchEvent(new CustomEvent('fish:level-ready', {detail:{fish:activeId}}));
  }
  function advanceWaiting() {
    if (screen !== 'ocean' || !run?.active || endingStarted || waitingReady) return;
    waitingReady = true;
    $('ocean').dataset.ready = 'true';
    $('waitingMessage').hidden = true;
    if (buttonFinish()) {
      $('endingFish').src = profile.assets.fish || '';
      $('endingFish').hidden = !profile.assets.fish;
      $('endingPlay').textContent = '물고기 보내기';
      $('endingPlay').hidden = false;
      announce('물고기 보내기 버튼을 눌러주세요.');
    } else { syncSensorButtons(); watchSensor(); }
  }
  function holdCompletion() {
    endingStarted = true;
    clearTimeout(sensorWatch);
    $('waitingMessage').hidden = true;
    $('previewStill').hidden = true;
    $('endingPlay').hidden = true;
    $('fishVideo').pause();
    $('endingStatus').textContent = '물고기를 바다로 보냈어요.';
  }
  function finishInteraction() {
    if (!run?.active || completionRequested) return;
    completionRequested = true;
    const fish = activeId;
    const linked = window.PhoneSync?.isActive(fish);
    holdCompletion();
    window.dispatchEvent(new CustomEvent('fish:finished', {detail:{fish}}));
    if (!linked) showHome();
  }
  async function playEnding() {
    if (!run?.active || endingStarted || screen !== 'ocean') return;
    const current = run;
    endingStarted = true;
    $('waitingMessage').hidden = true;
    $('previewStill').hidden = true;
    clearTimeout(sensorWatch);
    const fishId = activeId;
    window.dispatchEvent(new CustomEvent('fish:swim-started', { detail: { fish: fishId } }));
    let finished = false;
    let placeholder = false;
    function finish() {
      if (finished || !current.active) return;
      finished = true;
      finishInteraction();
    }
    function showPlaceholder() {
      if (!current.active || finished) return;
      placeholder = true;
      $('fishVideo').pause();
      $('fishVideo').hidden = true;
      $('endingFish').src = profile.assets.fish || '';
      $('endingFish').hidden = !profile.assets.fish;
      $('endingStatus').textContent = '영상 대신 아래 버튼으로 물고기를 보내주세요.';
      $('endingPlay').textContent = '물고기 보내기 · 영상 완료 테스트';
      $('endingPlay').hidden = false;
    }
    if (profile.videoSrc) {
      const video = $('fishVideo');
      video.loop = false;
      video.muted = true;
      video.hidden = false;
      current.listen(video, 'ended', () => { if (!placeholder) finish(); });
      current.listen(video, 'error', showPlaceholder);
      video.src = profile.videoSrc;
      video.load();
      const play = async () => {
        if (!current.active) return;
        try {
          await video.play();
          if (!current.active) { video.pause(); return; }
          if (placeholder || finished) { video.pause(); return; }
          $('endingPlay').hidden = true;
          $('endingStatus').textContent = '';
        } catch (_) {
          if (!current.active || placeholder || finished) return;
          $('endingStatus').textContent = '버튼을 눌러 물고기를 만나보세요.';
          $('endingPlay').hidden = false;
        }
      };
      current.listen($('endingPlay'), 'click', () => { if (placeholder) finish(); else play(); });
      play();
    } else {
      // 영상 미등록: 버튼으로 영상 종료를 대신합니다. 자동으로 홈으로 보내지 않습니다.
      showPlaceholder();
      current.listen($('endingPlay'), 'click', finish);
    }
  }

  function onMotion(sample) {
    if (document.hidden) { levelSince = null; stillness.reset(); return; }
    if (screen === 'home') water?.onOrientation(sample);
    if (!buttonFinish() && screen === 'reveal' && revealReady) {
      const flat = Math.abs(sample.beta) < common.levelTolerance && Math.abs(sample.gamma) < common.levelTolerance;
      const interrupted = levelSince !== null && motion.previousAt !== undefined
        && sample.receivedAt - motion.previousAt > common.sensorGapMs;
      if (!flat || interrupted) levelSince = null;
      if (flat) {
        levelSince ??= sample.receivedAt;
        if (sample.receivedAt - levelSince >= common.levelHoldMs) endingWait();
      }
    } else if (!buttonFinish() && screen === 'ocean' && waitingReady && !endingStarted) {
      const flat = Math.abs(sample.beta) < common.levelTolerance && Math.abs(sample.gamma) < common.levelTolerance;
      if (!flat) stillness.reset();
      else if (stillness.update(sample)) playEnding();
    }
    motion.previousAt = sample.receivedAt;
  }
  function syncSensorButtons() {
    const guidePhase = window.HomeGuide?.getState().phase;
    const linkedPhase = window.PhoneSync?.getState()?.phase;
    const waterNeeded = screen === 'home' && ['water', 'pouring'].includes(guidePhase)
      && (!linkedPhase || ['water-ready', 'water-playing'].includes(linkedPhase));
    const permissionNeeded = !motion.enabled && !motion.isFresh();
    $('homeMotionGate').hidden = desktop || !waterNeeded || !permissionNeeded;
    if (waterNeeded && permissionNeeded) $('homeMotionStatus').textContent = motionHint;
    $('simulate').hidden = !debug || buttonFinish();
    $('previewStill').hidden = !debug || buttonFinish() || !waitingReady || endingStarted;
    $('sensorNote').textContent = buttonFinish() ? ''
      : motion.enabled ? '화면이 위를 향하도록 평평하게 들어주세요.' : motionHint;
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
  async function enableMotion({silent = false} = {}) {
    try {
      await motion.enable();
      motionHint = '화면을 한 번 터치해 기울기를 허용해주세요.';
      $('homeMotionStatus').textContent = '휴대폰을 좌우로 기울여보세요.';
      syncSensorButtons();
      if (!silent) watchSensor();
    } catch (error) {
      const text = error.message === 'https-required' ? '휴대폰 센서는 HTTPS 배포 주소에서 연결해주세요.'
        : error.message === 'sensor-denied' ? 'Chrome 사이트 설정에서 동작 센서를 허용해주세요.'
        : error.message === 'sensor-unavailable' ? '이 기기에서 기울기 신호를 읽을 수 없어요.'
        : '화면을 한 번 터치해 기울기를 허용해주세요.';
      motionHint = text;
      if (!silent) {
        $('homeMotionStatus').textContent = text;
        $('sensorNote').textContent = text;
      }
      syncSensorButtons();
    }
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
    // 홈 안내는 같은 화면 안에서 단계가 바뀌므로 버튼 표시를 다시 계산합니다.
    new MutationObserver(syncSensorButtons).observe($('homeGuide'), {
      attributes: true, attributeFilter: ['data-phase'],
    });
    $('developerPanel').hidden = !debug;
    document.body.classList.toggle('has-debug', debug);
    renderPicker();
    $('debugHome').addEventListener('click', showHome);
    // 자동 허용이면 즉시 연결하고, 권한 요청이 필요하면 기존 화면의 첫 터치에서 연결합니다.
    $('stage').addEventListener('click', () => {
      if (!desktop && !motion.enabled) enableMotion();
    }, {capture:true});
    $('reveal').addEventListener('click', (event) => {
      if (!event.target.closest('button,a,input')) advanceReveal();
    });
    $('ocean').addEventListener('click', (event) => {
      if (!event.target.closest('button,a,input')) advanceWaiting();
    });
    $('endingPlay').addEventListener('click', () => {
      if (buttonFinish() && screen === 'ocean' && waitingReady && !endingStarted) finishInteraction();
    });
    $('simulate').addEventListener('click', endingWait);
    $('previewStill').addEventListener('click', previewStillness);
    $('debugReveal').addEventListener('click', () => previewScene(activeId || 'fish05', 'reveal'));
    $('debugOcean').addEventListener('click', () => previewScene(activeId || 'fish05', 'ocean'));
    $('homeTilt').addEventListener('input', (event) => {
      water.setTilt(Number(event.target.value), true);
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
    if (!desktop && window.isSecureContext && window.DeviceOrientationEvent) enableMotion({silent:true});
  }
  window.FishApp = {
    hasInteraction: (id) => definitions.has(id), registerInteraction, startInteraction, showHome, initialize,
    previewScene, motion,
    prepareWater(id) { water?.reset(); prepareArtwork(id); },
    setPouring(enabled) { water?.setPouring(enabled); },
    getWaterState: () => water?.getPourState(),
    presentReveal(id) { if (activeId !== id || !run?.active) startInteraction(id); return reveal(); },
    presentWaiting(id) { if (activeId !== id || !run?.active) startInteraction(id); endingWait(); },
    pauseGame() { if (activeId) instances.get(activeId)?.stop(); },
    presentCompleted(id) {
      if (activeId !== id || !run?.active) startInteraction(id);
      if (screen !== 'ocean') endingWait();
      holdCompletion();
    },
    playEnding,
    getState: () => ({ screen, activeId, revealReady, endingStarted,
      game: activeId ? instances.get(activeId)?.getState?.() : null }),
  };
})();
