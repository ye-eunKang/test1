/* 공통 화면 전환. 미니게임을 더 추가해도 홈·센서·엔딩은 이 파일을 공유합니다. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const profiles = window.FishConfig.interactions;
  const common = window.FishConfig.common;
  const definitions = new Map();
  const instances = new Map();
  const artworkCache = new Map();
  const decodedArtwork = new WeakMap();
  const motion = new MotionService();
  let screen = 'home';
  let activeId = null;
  let profile = null;
  let run = null;
  let water = null;
  let levelSince = null;
  let tiltSince = null;
  let revealOrigin = null;
  let finishGeneration = 0;
  let revealReady = false;
  let endingStarted = false;
  let initialized = false;
  let previewPending = false;
  let sensorWatch = null;
  let revealStep = 'awake';
  let waitingReady = false;
  let completionRequested = false;
  let motionHint = '화면을 한 번 터치해 기울기를 허용해주세요.';
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
    $('endingMedia').hidden = true;
    $('endingMedia').replaceChildren();
    $('endingPlay').hidden = true;
    finishGeneration++;
    levelSince = null;
    tiltSince = null;
    revealOrigin = null;
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
    // 게임 중에는 파일만 다운로드하여, 마지막 순간에 GIF 로딩을 기다리지 않게 합니다.
    const finishGif = assets.finishGif ?? common.finishGifSrc;
    if (finishGif) EndingGif.preload(finishGif).catch(() => {});
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
  function setArtworkSource(id, source) {
    const image = $(id);
    image.decoding = 'async';
    if (!source) {
      image.removeAttribute('src'); decodedArtwork.delete(image); return;
    }
    if (image.getAttribute('src') !== source) image.src = source;
    if (decodedArtwork.get(image) === source) return;
    decodedArtwork.set(image, source);
    if (typeof image.decode === 'function') image.decode().catch(() => {
      if (decodedArtwork.get(image) === source) decodedArtwork.delete(image);
    });
  }
  function startInteraction(id) {
    if (id === '1') id = 'fish01';
    if (id === '2') id = 'fish02';
    if (id === '5') id = 'fish05';
    if (id === '6') id = 'fish06';
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
    // 게임/아이패드 영상 중에 실제 표시할 img도 준비합니다. 등장 순간에는 src를 다시 지정하지 않습니다.
    assignArtwork();
    setArtworkSource('message', entry.assets.awakeMessage);
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
      if (assets[key]) { setArtworkSource(id, assets[key]); $(id).hidden = false; }
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
    revealOrigin = null; tiltSince = null;
    revealStep = 'awake';
    $('sensorPanel').hidden = true;
    setArtworkSource('message', profile.assets.awakeMessage);
    $('message').hidden = !profile.assets.awakeMessage;
    $('message').className = 'art awake';
    $('message').alt = '물고기의 몸에 물이 닿자, 물고기가 깨어났어요!';
    show('reveal');
    announce('물고기가 깨어났어요. 화면을 터치해 다음 안내를 보세요.');
  }
  function advanceReveal() {
    if (screen !== 'reveal' || !run?.active) return;
    if (revealStep === 'level') {
      // 5_09는 터치로 넘기지 않고 안내가 뜬 순간부터의 각도 변화를 판정합니다.
      return;
    }
    revealStep = 'level';
    setArtworkSource('message', profile.assets.levelMessage);
    $('message').hidden = !profile.assets.levelMessage;
    $('message').className = 'art level';
    $('message').alt = '휴대폰을 천천히 기울여 다음 안내로 넘어가세요';
    revealReady = true; levelSince = null; tiltSince = null;
    revealOrigin = motion.isFresh() ? {beta:motion.last.beta,gamma:motion.last.gamma} : null;
    syncSensorButtons(); watchSensor();
    announce('휴대폰의 각도를 천천히 바꿔주세요.');
  }
  function endingWait() {
    if (!run?.active) return;
    revealReady = false;
    finishGeneration++;
    levelSince = null; tiltSince = null; revealOrigin = null;
    endingStarted = false;
    waitingReady = false;
    $('ocean').dataset.ready = 'false';
    previewPending = false;
    assignArtwork();
    $('waitingMessage').hidden = !profile.assets.waitingMessage;
    $('endingFish').hidden = true;
    $('endingMedia').hidden = true;
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
    watchSensor();
    announce('휴대폰을 수평으로 유지하면 물고기가 나타납니다.');
    window.dispatchEvent(new CustomEvent('fish:level-ready', {detail:{fish:activeId}}));
  }
  async function advanceWaiting() {
    if (screen !== 'ocean' || !run?.active || endingStarted || waitingReady) return;
    const current = run, version = finishGeneration;
    waitingReady = true;
    endingStarted = true;
    tiltSince = null;
    levelSince = null;
    clearTimeout(sensorWatch);
    $('ocean').dataset.ready = 'true';
    $('waitingMessage').hidden = true;
    $('endingFish').hidden = true;
    $('endingPlay').hidden = true;
    $('previewStill').hidden = true;
    $('endingStatus').textContent = '';
    announce('물고기를 보내고 있어요. 잠시 기다려주세요.');
    const stillValid = () => run === current && current.active && version === finishGeneration
      && screen === 'ocean' && waitingReady;
    const src = profile.assets.finishGif ?? common.finishGifSrc;
    if (src) {
      const result = await EndingGif.play($('endingMedia'),src,{
        scope:current,stillDurationMs:common.finishReturnMs ?? 3000,
      });
      if (!stillValid() || result.status === 'cancelled') return;
      if (result.status === 'completed') { finishInteraction(); return; }
    }
    // 파일 로딩에 실패하면 기존 정지 물고기를 표시하고 홈으로 돌아갑니다.
    if (!stillValid()) return;
    setArtworkSource('endingFish', profile.assets.fish);
    $('endingFish').hidden = !profile.assets.fish;
    if (await current.delay(common.finishReturnMs ?? 3000)) {
      if (stillValid()) finishInteraction();
    }
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
    holdCompletion();
    window.dispatchEvent(new CustomEvent('fish:finished', {detail:{fish}}));
    // GIF가 끝나면 폰은 즉시 홈으로 갑니다. 종료 통신은 동기화 모듈이 계속 처리합니다.
    showHome();
  }
  // 연결 모듈의 기존 진입점도 같은 GIF 한 번 재생으로 연결합니다.
  function playEnding() { return advanceWaiting(); }

  function onMotion(sample) {
    if (document.hidden || ![sample.beta, sample.gamma, sample.receivedAt].every(Number.isFinite)) {
      levelSince = null; tiltSince = null; revealOrigin = null; return;
    }
    const interrupted = motion.previousAt !== undefined
      && (sample.receivedAt - motion.previousAt > common.sensorGapMs || sample.receivedAt < motion.previousAt);
    if (screen === 'home') water?.onOrientation(sample);
    if (screen === 'reveal' && revealReady) {
      if (interrupted) revealOrigin = null;
      revealOrigin ??= {beta:sample.beta,gamma:sample.gamma};
      // ±180도 경계의 작은 변화를 큰 움직임으로 처리하지 않습니다.
      const difference = (a,b) => Math.abs((a-b+540)%360-180);
      const change = Math.max(difference(sample.beta,revealOrigin.beta),difference(sample.gamma,revealOrigin.gamma));
      const moved = change >= (common.revealChangeDeg ?? 20);
      if (!moved || interrupted) tiltSince = null;
      if (moved) {
        tiltSince ??= sample.receivedAt;
        if (sample.receivedAt - tiltSince >= (common.revealChangeHoldMs ?? 200)) endingWait();
      }
    } else if (screen === 'ocean' && !waitingReady && !endingStarted) {
      const flat = Math.abs(sample.beta) < common.levelTolerance && Math.abs(sample.gamma) < common.levelTolerance;
      if (!flat || interrupted) levelSince = null;
      if (flat) {
        levelSince ??= sample.receivedAt;
        if (sample.receivedAt - levelSince >= common.levelHoldMs) advanceWaiting();
      }
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
    $('sensorPanel').hidden = screen !== 'reveal' || !revealReady || (!debug && !permissionNeeded);
    $('simulate').hidden = !debug || screen !== 'reveal' || !revealReady;
    $('previewStill').hidden = !debug || screen !== 'ocean' || waitingReady || endingStarted;
    $('simulate').textContent = 'PC 미리보기 · 각도 바꾸기';
    $('previewStill').textContent = 'PC 미리보기 · 수평 유지';
    $('sensorNote').textContent = motion.enabled ? '휴대폰의 각도를 천천히 바꿔주세요.' : motionHint;
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
  function previewStillness() {
    if (!debug || !run?.active || screen !== 'ocean' || endingStarted || previewPending) return;
    previewPending = true;
    $('previewStill').disabled = true;
    advanceWaiting();
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
    $('simulate').addEventListener('click', () => {
      if (debug && screen === 'reveal' && revealReady) endingWait();
    });
    $('previewStill').addEventListener('click', previewStillness);
    $('debugReveal').addEventListener('click', () => previewScene(activeId || 'fish05', 'reveal'));
    $('debugOcean').addEventListener('click', () => previewScene(activeId || 'fish05', 'ocean'));
    $('homeTilt').addEventListener('input', (event) => {
      water.setTilt(Number(event.target.value), true);
      $('homeTiltValue').textContent = `${event.target.value}°`;
    });
    const params = new URLSearchParams(location.search);
    const rawSelected = params.get('fish') || params.get('interaction');
    const selected = rawSelected === '1' ? 'fish01' : rawSelected === '2' ? 'fish02' : rawSelected === '5' ? 'fish05' : rawSelected === '6' ? 'fish06' : rawSelected;
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
    restoreWaterProgress(progress) { water?.restoreProgress(progress); },
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
