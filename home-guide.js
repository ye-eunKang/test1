/* 로고 → 터치 안내 → NFC 대기 → 즉시 물 기울이기 + 3초 뒤 안내 페이드 */
(() => {
  'use strict';
  const GUIDE_SETTINGS = {
    photos: [
      'assets/web/Web page_intro-ment1.png',
      'assets/web/Web page_intro-ment2.png',
      'assets/web/Web page_intro-ment3.png',
    ],
    awaitTagIndex: 1,
    waterIndex: 2,
    previewFishId: 'fish05',
    waterGuideHoldMs: 3000, // NFC 후 기울이기 안내에서만 대기하는 시간
    waterGuideFadeMs: 600,  // 그 안내의 GIF·말풍선만 사라지는 시간
  };
  const PHOTO_WIDTHS = [70, 83, 72];
  const PHOTO_SIZES = [[1024, 526], [1024, 425], [1024, 493]];
  const stage = document.getElementById('stage');
  const button = document.getElementById('homeStart');
  const logo = document.querySelector('#homeContent .home-logo');
  const panel = document.getElementById('homeGuide');
  const photo = document.getElementById('homeGuidePhoto');
  const gif = document.getElementById('homeGuideGif');
  const canvas = document.getElementById('homeWater');
  if (!stage || !button || !logo || !panel || !photo || !gif || !canvas) return;
  let phase = 'cover', photoIndex = 0, pendingId = null;
  let fadeTimer = null, hideTimer = null, fadeVersion = 0;
  let photoVersion = 0;
  GUIDE_SETTINGS.photos.forEach(src => {
    const image = new Image(); image.decoding = 'async'; image.src = src;
    if (typeof image.decode === 'function') image.decode().catch(() => {});
  });
  function setPhase(value) { phase = value; panel.dataset.phase = value; }
  function setPhoto(index) {
    const version = ++photoVersion;
    photoIndex = index;
    // 새 문구의 크기를 먼저 정하고 디코딩이 끝난 다음 표시해 중간 크기가 보이지 않게 합니다.
    photo.hidden = true;
    photo.style.width = `${PHOTO_WIDTHS[index] ?? 80}%`;
    [photo.width, photo.height] = PHOTO_SIZES[index];
    const source = GUIDE_SETTINGS.photos[index];
    if (photo.getAttribute('src') !== source) photo.src = source;
    photo.alt = index === GUIDE_SETTINGS.awaitTagIndex ? '소녀에게 가까이 가주세요'
      : index === GUIDE_SETTINGS.waterIndex ? '어항에 물이 찰 수 있도록 휴대폰을 천천히 기울여주세요'
      : '빈 어항을 든 소녀 안내';
    const showPhoto = () => { if (version === photoVersion) photo.hidden = false; };
    if (typeof photo.decode === 'function') photo.decode().then(showPhoto, showPhoto);
    else showPhoto();
  }
  function clearWaterFade() {
    fadeVersion++;
    clearTimeout(fadeTimer); clearTimeout(hideTimer);
    fadeTimer = hideTimer = null;
    panel.style.removeProperty('--water-guide-fade');
    panel.classList.remove('is-fading');
  }
  function isWaterGuide() {
    return phase === 'pouring' && photoIndex === GUIDE_SETTINGS.waterIndex
      && pendingId !== null && stage.dataset.screen === 'home';
  }
  function fadeWaterGuide() {
    clearWaterFade();
    if (!isWaterGuide()) return;
    const version = fadeVersion;
    panel.style.setProperty('--water-guide-fade', `${GUIDE_SETTINGS.waterGuideFadeMs}ms`);
    fadeTimer = setTimeout(() => {
      if (version !== fadeVersion || !isWaterGuide()) return;
      panel.classList.add('is-fading');
      hideTimer = setTimeout(() => {
        if (version !== fadeVersion || !isWaterGuide()) return;
        panel.hidden = true;
        clearWaterFade();
      }, GUIDE_SETTINGS.waterGuideFadeMs);
    }, GUIDE_SETTINGS.waterGuideHoldMs);
  }
  function resetGuide() {
    photoVersion++;
    clearWaterFade();
    FishApp.setPouring(false);
    setPhase('cover'); pendingId = null;
    panel.hidden = true; logo.hidden = false; button.hidden = false;
  }
  function openGuide() {
    if (stage.dataset.screen !== 'home' || phase !== 'cover') return;
    clearWaterFade();
    logo.hidden = true; button.hidden = true;
    setPhoto(0);
    setPhase(GUIDE_SETTINGS.awaitTagIndex === 0 ? 'await-tag' : 'guide');
    panel.hidden = false;
  }
  function advance() {
    if (stage.dataset.screen !== 'home' || document.hidden) return;
    if (phase === 'guide') {
      const next = Math.min(photoIndex + 1, GUIDE_SETTINGS.awaitTagIndex);
      setPhoto(next);
      if (next === GUIDE_SETTINGS.awaitTagIndex) setPhase('await-tag');
    }
    // 소녀에게 가까이 가기 안내는 실제 NFC 태그를 받을 때까지 유지합니다.
  }
  function enterWater(fishId, options = {}) {
    if (stage.dataset.screen !== 'home') return false;
    if (!FishApp.hasInteraction(fishId)) {
      document.getElementById('routeNotice').textContent = '이 물고기 인터랙션은 아직 준비 중이에요.';
      return false;
    }
    const continuing = pendingId === fishId && ['water','pouring','main'].includes(phase);
    if (continuing) return true;
    FishApp.prepareWater(fishId);
    pendingId = fishId;
    logo.hidden = true; button.hidden = true;
    setPhoto(GUIDE_SETTINGS.waterIndex); setPhase('pouring');
    panel.hidden = false;
    FishApp.setPouring(true);
    fadeWaterGuide();
    const url = new URL(location.href);
    url.searchParams.set('fish', fishId); url.searchParams.set('phase', 'water');
    try { history.replaceState({}, '', url.href); } catch (_) {}
    if (options.notify !== false) window.dispatchEvent(new CustomEvent('fish:tag-selected', {detail:{fish:fishId}}));
    window.dispatchEvent(new CustomEvent('fish:pour-started', {detail:{fish:fishId}}));
    return true;
  }
  canvas.addEventListener('water:progress', event => {
    if (phase !== 'pouring' || stage.dataset.screen !== 'home' || document.hidden) return;
    const sample = event.detail;
    window.dispatchEvent(new CustomEvent('fish:pour-progress', {detail:{
      ...sample, fish:pendingId, active:sample.spilling || sample.complete,
    }}));
  });
  button.addEventListener('click', openGuide);
  panel.addEventListener('click', advance);
  panel.tabIndex = 0;
  panel.addEventListener('keydown', event => {
    if (['Enter',' '].includes(event.key)) { event.preventDefault(); panel.click(); }
  });
  window.addEventListener('fishhome:show', resetGuide);
  new MutationObserver(() => {
    if (stage.dataset.screen !== 'home') resetGuide();
  }).observe(stage, {attributes:true,attributeFilter:['data-screen']});
  window.HomeGuide = {
    enterWater, reset:resetGuide,
    startPendingInteraction() { return phase === 'pouring' && !!pendingId && FishApp.startInteraction(pendingId); },
    restore(fishId) {
      if (pendingId !== fishId && !enterWater(fishId,{notify:false})) return false;
      return true;
    },
    finishPour(fishId) {
      if (pendingId !== fishId && !enterWater(fishId,{notify:false})) return;
      clearWaterFade();
      setPhase('main'); panel.hidden = true; FishApp.setPouring(false);
    },
    getState:() => ({phase,photoIndex,pendingId}),
  };
  const developerPanel = document.getElementById('developerPanel');
  if (developerPanel) {
    const preview = document.createElement('button');
    preview.type = 'button'; preview.textContent = 'NFC 태그 미리보기 · 5번';
    preview.addEventListener('click', () => {
      if (stage.dataset.screen !== 'home') FishApp.showHome();
      enterWater(GUIDE_SETTINGS.previewFishId);
    });
    developerPanel.append(preview);
  }
  resetGuide();
})();
