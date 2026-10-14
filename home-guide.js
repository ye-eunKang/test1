/* 로고 → 첫 안내 → 가까이 가기(NFC 대기) → 물 주기 안내 → 물만 표시 */
(() => {
  'use strict';
  // 기존에 수정한 파일명과 크기를 여기로 옮겨주세요.
  const GUIDE_SETTINGS = {
    photos: [
      'assets/Web page_intro-ment1.png', // 빈 어항을 들고 걷는 소녀 안내
      'assets/Web page_intro-ment2.png', // 소녀에게 가까이 가주세요 — 여기서 NFC 대기
      'assets/Web page_intro-ment3.png', // 어항에 물이 찰 수 있도록 휴대폰을 천천히 기울여주세요
    ],
    changeAfterMs: 3000,
    awaitTagIndex: 1,
    waterIndex: 2,
    tiltThresholdDeg: 8,   // 진입한 각도에서 이만큼 변하면 기울임으로 인식
    tiltHoldMs: 150,       // 작은 센서 잡음으로 바로 사라지는 것을 방지
    previewFishId: 'fish05',
  };
  const PHOTO_WIDTHS = [70, 83, 72];

  const stage = document.getElementById('stage');
  const button = document.getElementById('homeStart');
  const logo = document.querySelector('#homeContent .home-logo');
  const panel = document.getElementById('homeGuide');
  const photo = document.getElementById('homeGuidePhoto');
  const gif = document.getElementById('homeGuideGif');
  if (!stage || !button || !logo || !panel || !photo || !gif) {
    console.error('홈 안내의 homeStart/home-logo/homeGuide/homeGuidePhoto/homeGuideGif를 확인해주세요.');
    return;
  }
  let phase = 'cover';
  let photoIndex = 0;
  let timer = null;
  let pendingId = null;
  let baseline = null;
  let tiltSince = null;
  let lastSensorAt = null;
  const preloads = GUIDE_SETTINGS.photos.map((src) => { const image = new Image(); image.src = src; return image; });

  function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function setPhase(value) { phase = value; panel.dataset.phase = value; }
  function setPhoto(index) {
    photoIndex = index;
    photo.src = GUIDE_SETTINGS.photos[index];
    photo.alt = index === GUIDE_SETTINGS.awaitTagIndex ? '소녀에게 가까이 가주세요'
      : index === GUIDE_SETTINGS.waterIndex ? '어항에 물이 찰 수 있도록 휴대폰을 천천히 기울여주세요'
      : '빈 어항을 든 소녀 안내';
    photo.style.width = `${PHOTO_WIDTHS[index] ?? 80}%`;
    // GIF src는 유지. 같은 GIF가 계속 재생됩니다.
  }
  function resetGuide() {
    clearTimer();
    setPhase('cover');
    pendingId = null;
    baseline = null;
    tiltSince = null;
    lastSensorAt = null;
    panel.hidden = true;
    logo.hidden = false;
    button.hidden = false;
  }
  function scheduleNext() {
    clearTimer();
    if (phase !== 'guide' || document.hidden || stage.dataset.screen !== 'home') return;
    timer = setTimeout(() => {
      timer = null;
      if (phase !== 'guide' || stage.dataset.screen !== 'home') return;
      const next = Math.min(photoIndex + 1, GUIDE_SETTINGS.awaitTagIndex);
      setPhoto(next);
      if (next === GUIDE_SETTINGS.awaitTagIndex) setPhase('await-tag');
      else scheduleNext();
    }, GUIDE_SETTINGS.changeAfterMs);
  }
  function openGuide() {
    if (stage.dataset.screen !== 'home' || phase !== 'cover') return;
    logo.hidden = true;
    button.hidden = true;
    panel.hidden = false;
    setPhoto(0);
    setPhase(GUIDE_SETTINGS.awaitTagIndex === 0 ? 'await-tag' : 'guide');
    scheduleNext();
  }
  function enterWater(fishId, options = {}) {
    if (stage.dataset.screen !== 'home') return false;
    if (!FishApp.hasInteraction?.(fishId)) {
      const note = document.getElementById('routeNotice');
      if (note) note.textContent = '이 물고기 인터랙션은 아직 준비 중이에요.';
      return false;
    }
    if (!GUIDE_SETTINGS.photos[GUIDE_SETTINGS.waterIndex]) {
      console.error('물 주기 안내 사진을 GUIDE_SETTINGS.photos에 추가해주세요.');
      return false;
    }
    clearTimer();
    pendingId = fishId;
    baseline = FishApp.motion.isFresh() && FishApp.motion.last
      ? { beta: FishApp.motion.last.beta, gamma: FishApp.motion.last.gamma } : null;
    tiltSince = null;
    lastSensorAt = null;
    logo.hidden = true;
    button.hidden = true;
    panel.hidden = false;
    setPhoto(GUIDE_SETTINGS.waterIndex);
    setPhase('water');
    const url = new URL(location.href);
    url.searchParams.set('fish', fishId);
    url.searchParams.set('phase', 'water');
    try { history.replaceState({}, '', url.href); } catch (_) {}
    if (options.notify !== false) window.dispatchEvent(new CustomEvent('fish:tag-selected', { detail: { fish: fishId } }));
    return true;
  }
  function angleDelta(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }
  function onTilt(sample) {
    if (!['water','pouring'].includes(phase) || document.hidden || stage.dataset.screen !== 'home') return;
    const { beta, gamma, receivedAt } = sample;
    if (![beta, gamma, receivedAt].every(Number.isFinite)) return;
    if (lastSensorAt !== null && receivedAt - lastSensorAt > 700) {
      baseline = null;
      tiltSince = null;
    }
    lastSensorAt = receivedAt;
    if (!baseline) {
      baseline = { beta, gamma };
      window.dispatchEvent(new CustomEvent('fish:pour-progress', {detail:{fish:pendingId,moved:0,active:false,receivedAt}}));
      return;
    }
    const moved = Math.max(angleDelta(beta, baseline.beta), angleDelta(gamma, baseline.gamma));
    if (phase === 'water') {
      if (moved < (window.FishSyncConfig?.pourStartDeg ?? GUIDE_SETTINGS.tiltThresholdDeg)) tiltSince = null;
      else {
        tiltSince ??= receivedAt;
        if (receivedAt - tiltSince >= GUIDE_SETTINGS.tiltHoldMs) {
          setPhase('pouring');
          panel.hidden = true;
          window.dispatchEvent(new CustomEvent('fish:pour-started', {detail:{fish:pendingId}}));
        }
      }
    }
    window.dispatchEvent(new CustomEvent('fish:pour-progress', {
      detail:{fish:pendingId,moved,active:phase === 'pouring' && moved >= (window.FishSyncConfig?.pourStartDeg ?? 8),receivedAt},
    }));
  }
  function startPendingInteraction() {
    if (phase !== 'pouring' || !pendingId) return false;
    return FishApp.startInteraction(pendingId);
  }

  button.addEventListener('click', openGuide);
  window.addEventListener('fishhome:show', resetGuide);
  FishApp.motion.subscribe(onTilt);
  new MutationObserver(() => {
    if (stage.dataset.screen !== 'home') resetGuide();
  }).observe(stage, { attributes: true, attributeFilter: ['data-screen'] });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimer(); baseline = null; tiltSince = null; }
    else if (phase === 'guide') scheduleNext();
  });
  window.HomeGuide = {
    enterWater, reset: resetGuide, startPendingInteraction,
    restore(fishId, pouring = false) {
      if (!enterWater(fishId,{notify:false})) return false;
      if (pouring) { setPhase('pouring'); panel.hidden = true; }
      return true;
    },
    getState: () => ({ phase, photoIndex, pendingId }),
  };

  // 편집 패널 전용. 실제 NFC 없이 이 단계까지 테스트할 수 있습니다.
  const developerPanel = document.getElementById('developerPanel');
  if (developerPanel) {
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.textContent = 'NFC 태그 미리보기 · 5번';
    preview.addEventListener('click', () => {
      if (stage.dataset.screen !== 'home') FishApp.showHome();
      enterWater(GUIDE_SETTINGS.previewFishId);
    });
    developerPanel.append(preview);
  }
  resetGuide();
})();
