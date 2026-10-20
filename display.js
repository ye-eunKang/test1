/* iPad: 물은 배출량에 대응하는 사진, 나머지 장면은 기존 영상으로 표시합니다. */
(() => {
  'use strict';
  const fish = new URLSearchParams(location.search).get('fish') || 'fish05';
  const profile = FishSyncConfig.fish[fish];
  const video = document.getElementById('displayVideo');
  const canvas = document.getElementById('waterSequence');
  const gate = document.getElementById('displayGate');
  const note = document.getElementById('displayStatus');
  if (!profile) { note.textContent = '물고기 영상 설정을 확인해주세요.'; return; }
  let unlocked = false, currentClip = null, desired = null, token = 0, endedKey = null;
  let waterRaf = null, finishRaf = null, finishKey = null, usingFrames = false;
  const clamp = value => Math.max(0, Math.min(1, value));
  const waterPhase = state => ['water-ready', 'water-playing'].includes(state?.phase);
  const waterIndex = state => Math.round(clamp(state?.waterProgress || 0) * (profile.waterFrames.count - 1));
  const sequence = profile.waterFrames ? new FrameSequence(canvas, profile.waterFrames, {
    cacheSize: 10,
    onPaint() {
      if (usingFrames && unlocked && waterPhase(desired)) {
        canvas.hidden = false; video.hidden = true; note.textContent = '';
        confirmWaterEnd();
      }
    },
    onError() {
      if (usingFrames) note.textContent = '물 장면을 불러오는 중이에요. 연결과 assets/frames 폴더를 확인해주세요.';
    },
  }) : null;

  function sendEnded(clip, state = desired) {
    if (!client.ready || !state?.session) return;
    if (clip === 'water' && Number.isFinite(state.waterProgress) && state.waterProgress < 1) return;
    const key = `${state.session}:${state.phase}:${clip}`;
    if (endedKey !== key && client.event('video-ended', {clip, stage: state.phase})) endedKey = key;
  }
  function cancelWaterEnd() {
    if (finishRaf !== null) cancelAnimationFrame(finishRaf);
    finishRaf = null; finishKey = null;
  }
  function confirmWaterEnd() {
    if (!usingFrames || !unlocked || document.hidden || !client.ready || desired?.phase !== 'water-playing'
      || desired.waterProgress < 1 || sequence.paintedIndex !== profile.waterFrames.count - 1) return;
    const key = `${desired.session}:${desired.phase}:water`;
    if (finishKey === key || endedKey === key) return;
    finishKey = key;
    // 마지막 프레임이 화면에 표시될 기회를 한 번 기다린 뒤 다음 장면으로 넘어갑니다.
    finishRaf = requestAnimationFrame(() => {
      finishRaf = requestAnimationFrame(() => {
        finishRaf = null;
        if (finishKey !== key) return;
        finishKey = null;
        if (usingFrames && !document.hidden && client.ready && `${desired.session}:${desired.phase}:water` === key
          && desired.waterProgress >= 1 && sequence.paintedIndex === profile.waterFrames.count - 1) sendEnded('water');
      });
    });
  }
  function stopWater() {
    if (waterRaf !== null) cancelAnimationFrame(waterRaf);
    waterRaf = null; cancelWaterEnd();
  }
  function followWater() {
    if (!usingFrames || !unlocked || document.hidden || !client.ready) return;
    sequence.request(waterIndex(desired));
    if (sequence.paintedIndex === waterIndex(desired)) {
      canvas.hidden = false; video.hidden = true;
      confirmWaterEnd();
    }
  }
  function startWater() {
    followWater();
    if (waterRaf !== null) return;
    const tick = () => {
      waterRaf = null;
      if (!usingFrames || !unlocked || !client.ready || document.hidden) return;
      followWater(); waterRaf = requestAnimationFrame(tick);
    };
    waterRaf = requestAnimationFrame(tick);
  }
  function mediaFor(state) {
    if (state.phase === 'idle') return {clip: 'walk', play: true, loop: true, position: 'start'};
    if (state.phase === 'water-ready') return {clip: 'water', play: false, position: 'start', frames: !!sequence};
    if (state.phase === 'water-playing') return {clip: 'water', play: state.playing && !state.waterEnded,
      frames: !!sequence && Number.isFinite(state.waterProgress)};
    if (state.phase === 'main-playing') return {clip: 'main', play: true};
    if (state.phase === 'game') return {clip: 'ending', play: false, position: 'start'};
    if (state.phase === 'ending-playing') return {clip: 'ending', play: true};
    return {clip: 'ending', play: false, position: 'end'};
  }
  function apply(state) {
    const previous = desired;
    desired = state;
    if (!unlocked) return;
    const media = mediaFor(state);
    const previousFrames = usingFrames;
    const changed = currentClip !== media.clip || previousFrames !== !!media.frames;
    const phaseChanged = previous?.phase !== state.phase || previous?.session !== state.session;
    if (previous?.session !== state.session) { endedKey = null; cancelWaterEnd(); }
    currentClip = media.clip; usingFrames = !!media.frames;
    const current = ++token;
    video.onloadedmetadata = null; video.onended = null;
    if (usingFrames) {
      video.pause();
      startWater();
      return;
    }
    stopWater(); canvas.hidden = true; video.hidden = false;
    video.muted = true; video.loop = !!media.loop; video.playbackRate = 1;
    video.onended = () => {
      if (current !== token || !client.ready || desired.session !== state.session) return;
      if ((media.clip === 'water' && desired.phase === 'water-playing')
        || (media.clip === 'main' && desired.phase === 'main-playing')
        || (media.clip === 'ending' && desired.phase === 'ending-playing')) sendEnded(media.clip);
    };
    const ready = async () => {
      if (current !== token) return;
      if (media.position === 'start' && (changed || phaseChanged)) video.currentTime = 0;
      if (media.position === 'end' && Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.duration - .04);
      if (!media.play) { video.pause(); return; }
      if (video.ended) { video.onended(); return; }
      try { await video.play(); }
      catch (_) { if (current === token) { gate.hidden = false; note.textContent = '화면을 눌러 재생을 시작해주세요.'; } }
    };
    if (changed) {
      video.pause(); video.src = profile.display[media.clip];
      video.onloadedmetadata = ready; video.load();
    } else if (video.readyState >= 1) ready();
    else video.onloadedmetadata = ready;
    if (!media.play) video.pause();
    if (state.phase === 'idle' && sequence) sequence.request(0);
  }
  const client = new ExhibitClient({role: 'display', fish, onState: apply,
    onStatus(online) {
      if (online) {
        if (note.textContent === '연결을 다시 확인하고 있어요.') note.textContent = '';
      }
      else { note.textContent = '연결을 다시 확인하고 있어요.'; video.pause(); stopWater(); }
    },
    onError() { note.textContent = '디스플레이 연결 설정을 확인해주세요.'; },
  });
  video.addEventListener('error', () => {
    if (!usingFrames) note.textContent = `영상을 불러오지 못했어요: ${profile.display[currentClip] || ''}`;
  });
  document.getElementById('displayStart').addEventListener('click', () => {
    unlocked = true; gate.hidden = true; note.textContent = '';
    if (desired) apply(desired);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { video.pause(); stopWater(); }
    else if (desired) apply(desired);
  });
  // 서버가 아직 종료 신호를 받지 못한 채 재연결됐다면 같은 단계의 종료만 다시 보냅니다.
  const originalApply = client.onState;
  client.onState = state => {
    if (!client.ready || desired?.session !== state.session || desired?.phase !== state.phase) { originalApply(state); return; }
    if (usingFrames && state.phase === 'water-playing' && state.waterProgress >= 1
      && sequence.paintedIndex === profile.waterFrames.count - 1) endedKey = null;
    else if (video.ended && !usingFrames
      && ((currentClip === 'water' && state.phase === 'water-playing')
      || (currentClip === 'main' && state.phase === 'main-playing')
      || (currentClip === 'ending' && state.phase === 'ending-playing'))) {
      endedKey = null; desired = state; sendEnded(currentClip); return;
    }
    originalApply(state);
  };
  // 준비 화면 동안 압축 프레임을 미리 받되, 전체를 디코딩해 메모리에 쌓지 않습니다.
  if (sequence) { sequence.request(0); sequence.warm(6); }
  window.FishDisplay = {getState: () => desired,
    getWaterState: () => sequence && ({frame: sequence.paintedIndex, target: sequence.targetIndex, loaded: sequence.blobs.size})};
})();
