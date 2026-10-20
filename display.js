/* iPad: display.html?fish=fish05. 시작 버튼은 전시 준비 시 한 번 누릅니다. */
(() => {
  'use strict';
  const fish = new URLSearchParams(location.search).get('fish') || 'fish05';
  const profile = FishSyncConfig.fish[fish];
  const video = document.getElementById('displayVideo');
  const gate = document.getElementById('displayGate');
  const note = document.getElementById('displayStatus');
  let unlocked = false, currentClip = null, desired = null, token = 0, endedKey = null;
  let waterFrame = null, waterPlay = null, waterBlocked = false;
  // 물 영상만 적용. 최고 속도와 속도 변화 시간을 여기서 조정하세요.
  const WATER_PLAYBACK = {
    maxRate: 3,          // 기존 최대 8배 → 3배. 급가속과 장면 건너뛰기를 줄입니다.
    responseSeconds: .3,// 속도가 목표값까지 부드럽게 바뀌는 시간
    bufferSeconds: .24, // 약 0.24초 여유를 두어 네트워크 갱신 사이에도 이어 재생합니다.
    maxAcceleration: 4,// 1초 동안 올릴 수 있는 배속의 최대 변화량
    restartGap: .08,
    stopGap: .008,
  };
  let waterRate = 1, lastWaterTick = null, waterRestorePending = true;
  if (!profile) { note.textContent = '물고기 영상 설정을 확인해주세요.'; return; }
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  function waterSync(state = desired) {
    return currentClip === 'water' && Number.isFinite(state?.waterProgress)
      && ['water-ready','water-playing'].includes(state.phase);
  }
  function sendEnded(clip, state = desired) {
    if (!client.ready || !state?.session) return;
    if (clip === 'water' && Number.isFinite(state.waterProgress) && state.waterProgress < 1) return;
    const key = `${state.session}:${state.phase}:${clip}`;
    if (endedKey !== key && client.event('video-ended',{clip,stage:state.phase})) endedKey = key;
  }
  function stopWaterSync() {
    if (waterFrame !== null) cancelAnimationFrame(waterFrame);
    waterFrame = null;
    lastWaterTick = null;
  }
  function followWater() {
    if (!unlocked || document.hidden || !client.ready || !waterSync() || video.readyState < 2) return;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const now = performance.now();
    const dt = lastWaterTick === null ? 1 / 60 : clamp((now - lastWaterTick) / 1000,0,.1);
    lastWaterTick = now;
    const progress = clamp(desired.waterProgress,0,1);
    const target = progress * duration;
    // 새로 접속/재연결한 경우에만 현재 물의 양으로 한 번 복구합니다.
    // 평소 기울임·정지·마지막 따라잡기 중에는 currentTime을 변경하지 않습니다.
    if (waterRestorePending) {
      waterRestorePending = false;
      const restored = Math.min(target,Math.max(0,duration-.25));
      if (Math.abs(restored-video.currentTime) > WATER_PLAYBACK.restartGap) {
        video.currentTime = restored;
        waterRate = 1; video.playbackRate = 1;
        return;
      }
    }
    if (video.seeking) return;
    const remaining = target - video.currentTime;
    if (video.ended) {
      video.pause();
      if (progress >= 1) sendEnded('water');
      return;
    }
    if (progress < 1 && (remaining <= WATER_PLAYBACK.stopGap
      || (video.paused && remaining < WATER_PLAYBACK.restartGap))) {
      video.pause();
      return;
    }
    const pouringRate = desired.playing && progress < 1 ? Math.max(0,desired.waterRate || 0) * duration : 0;
    const buffer = desired.playing && progress < 1 ? WATER_PLAYBACK.bufferSeconds : 0;
    const wantedRate = clamp((progress >= 1 ? 1 : pouringRate) + (remaining-buffer) * 1.8,
      .25,WATER_PLAYBACK.maxRate);
    const easedRate = waterRate + (wantedRate-waterRate) * (1-Math.exp(-dt/WATER_PLAYBACK.responseSeconds));
    // 목표 위치에 가까워지면 감속해서 다음 신호가 오기 전에 앞서가지 않게 합니다.
    const brakeTime = desired.playing ? .04 : .10;
    const brakeRate = progress >= 1 ? WATER_PLAYBACK.maxRate : Math.max(.25,remaining/brakeTime);
    waterRate = clamp(Math.min(easedRate,waterRate+WATER_PLAYBACK.maxAcceleration*dt,brakeRate),
      .25,WATER_PLAYBACK.maxRate);
    video.playbackRate = waterRate;
    if (video.paused && !waterPlay && !waterBlocked) {
      const session = desired.session;
      const blocked = () => {
        if (waterSync() && desired.session === session) {
          waterBlocked = true; gate.hidden = false; note.textContent = '화면을 눌러 재생을 시작해주세요.';
        }
      };
      try {
        const pending = Promise.resolve(video.play()).catch(blocked)
          .finally(() => { if (waterPlay === pending) waterPlay = null; });
        waterPlay = pending;
      } catch (_) { blocked(); }
    }
  }
  function startWaterSync() {
    followWater();
    if (waterFrame !== null) return;
    const tick = () => {
      waterFrame = null;
      if (!waterSync() || !unlocked || !client.ready) return;
      followWater();
      waterFrame = requestAnimationFrame(tick);
    };
    waterFrame = requestAnimationFrame(tick);
  }
  function mediaFor(state) {
    if (state.phase === 'idle') return {clip:'walk',play:true,loop:true,position:'start'};
    if (state.phase === 'water-ready') return {clip:'water',play:false,position:'start',waterSync:Number.isFinite(state.waterProgress)};
    if (state.phase === 'water-playing') return {clip:'water',play:state.playing && !state.waterEnded,
      waterSync:Number.isFinite(state.waterProgress)};
    if (state.phase === 'main-playing') return {clip:'main',play:true};
    if (state.phase === 'game') return {clip:'ending',play:false,position:'start'};
    if (state.phase === 'ending-playing') return {clip:'ending',play:true};
    return {clip:'ending',play:false,position:'end'};
  }
  function apply(state) {
    const previous = desired;
    desired = state;
    if (!['water-ready','water-playing'].includes(state.phase)) waterRestorePending = false;
    if (!unlocked) return;
    const media = mediaFor(state);
    const changed = currentClip !== media.clip;
    if (changed) { waterBlocked = false; waterPlay = null; waterRate = 1; lastWaterTick = null; }
    const phaseChanged = previous?.phase !== state.phase || previous?.session !== state.session;
    currentClip = media.clip;
    if (!media.waterSync) { stopWaterSync(); video.playbackRate = 1; }
    const current = ++token;
    video.muted = true; video.loop = !!media.loop;
    video.onended = () => {
      if (current !== token || !client.ready || desired.session !== state.session) return;
      const clip = media.clip;
      if ((clip === 'water' && desired.phase === 'water-playing')
        || (clip === 'main' && desired.phase === 'main-playing')
        || (clip === 'ending' && desired.phase === 'ending-playing')) {
        sendEnded(clip,desired);
      }
    };
    const ready = async () => {
      if (current !== token) return;
      if (media.position === 'start' && (changed || phaseChanged)) video.currentTime = 0;
      if (media.position === 'end' && Number.isFinite(video.duration)) video.currentTime = Math.max(0,video.duration-.04);
      if (media.waterSync) { startWaterSync(); return; }
      if (!media.play) { video.pause(); return; }
      // 물의 양이 아직 부족해도 종료된 물 영상을 처음부터 다시 재생하지 않습니다.
      if (media.clip === 'water' && video.ended) {
        video.onended(); video.pause(); return;
      }
      try { await video.play(); if (current !== token && !mediaFor(desired).play) video.pause(); }
      catch (_) { if (current === token) { gate.hidden = false; note.textContent = '화면을 눌러 재생을 시작해주세요.'; } }
    };
    if (changed) {
      video.pause(); video.src = profile.display[media.clip];
      video.onloadedmetadata = ready; video.load();
    } else if (video.readyState >= 1) ready();
    else video.onloadedmetadata = ready;
    if (!media.play && !media.waterSync) video.pause();
  }
  const client = new ExhibitClient({role:'display',fish,onState:apply,
    onStatus(online) {
      if (online) note.textContent = '';
      else {
        note.textContent = '연결을 다시 확인하고 있어요.';
        waterRestorePending = true; video.pause(); stopWaterSync();
      }
    },
    onError() { note.textContent = '디스플레이 연결 설정을 확인해주세요.'; },
  });
  video.addEventListener('error', () => { note.textContent = `영상을 불러오지 못했어요: ${profile.display[currentClip] || ''}`; });
  video.addEventListener('loadeddata', () => { if (waterSync()) startWaterSync(); });
  video.addEventListener('seeked', () => { if (waterSync()) startWaterSync(); });
  document.getElementById('displayStart').addEventListener('click', () => {
    unlocked = true; waterBlocked = false; gate.hidden = true;
    if (desired) apply(desired);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { video.pause(); stopWaterSync(); }
    else if (desired) apply(desired);
  });
  // 영상이 끝나는 순간 연결이 끊겼다면, 재연결 후 종료 신호를 한 번 전송합니다.
  const originalApply = client.onState;
  client.onState = state => {
    if (video.ended && desired?.session === state.session && desired?.phase === state.phase
      && ((currentClip === 'water' && state.phase === 'water-playing')
      || (currentClip === 'main' && state.phase === 'main-playing')
      || (currentClip === 'ending' && state.phase === 'ending-playing'))
      && (currentClip !== 'water' || !Number.isFinite(state.waterProgress) || state.waterProgress >= 1)) {
      const key = `${state.session}:${state.phase}:${currentClip}`;
      // 서버가 아직 같은 단계라면 종료를 확인하지 못한 상태입니다. 재연결 때 다시 전송합니다.
      if (client.event('video-ended',{clip:currentClip,stage:state.phase})) endedKey = key;
      desired = state;
      return;
    }
    originalApply(state);
  };
  window.FishDisplay = {getState:() => desired};
})();
