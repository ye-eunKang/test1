/* iPad: display.html?fish=fish05. 시작 버튼은 전시 준비 시 한 번 누릅니다. */
(() => {
  'use strict';
  const fish = new URLSearchParams(location.search).get('fish') || 'fish05';
  const profile = FishSyncConfig.fish[fish];
  const video = document.getElementById('displayVideo');
  const gate = document.getElementById('displayGate');
  const note = document.getElementById('displayStatus');
  let unlocked = false, currentClip = null, desired = null, token = 0, endedKey = null;
  if (!profile) { note.textContent = '물고기 영상 설정을 확인해주세요.'; return; }
  function mediaFor(state) {
    if (state.phase === 'idle') return {clip:'walk',play:true,loop:true,position:'start'};
    if (state.phase === 'water-ready') return {clip:'water',play:false,position:'start'};
    if (state.phase === 'water-playing') return {clip:'water',play:state.playing && !state.waterEnded};
    if (state.phase === 'main-playing') return {clip:'main',play:true};
    if (state.phase === 'game') return {clip:'ending',play:false,position:'start'};
    if (state.phase === 'ending-playing') return {clip:'ending',play:true};
    return {clip:'ending',play:false,position:'end'};
  }
  function apply(state) {
    const previous = desired;
    desired = state;
    if (!unlocked) return;
    const media = mediaFor(state);
    const changed = currentClip !== media.clip;
    const phaseChanged = previous?.phase !== state.phase || previous?.session !== state.session;
    currentClip = media.clip;
    const current = ++token;
    video.muted = true; video.loop = !!media.loop;
    video.onended = () => {
      if (current !== token || !client.ready || desired.session !== state.session) return;
      const clip = media.clip;
      const key = `${state.session}:${state.phase}:${clip}`;
      if ((clip === 'water' && desired.phase === 'water-playing')
        || (clip === 'main' && desired.phase === 'main-playing')
        || (clip === 'ending' && desired.phase === 'ending-playing')) {
        if (endedKey !== key && client.event('video-ended',{clip,stage:state.phase})) endedKey = key;
      }
    };
    const ready = async () => {
      if (current !== token) return;
      if (media.position === 'start' && (changed || phaseChanged)) video.currentTime = 0;
      if (media.position === 'end' && Number.isFinite(video.duration)) video.currentTime = Math.max(0,video.duration-.04);
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
    if (!media.play) video.pause();
  }
  const client = new ExhibitClient({role:'display',fish,onState:apply,
    onStatus(online) {
      if (online) note.textContent = '';
      else { note.textContent = '연결을 다시 확인하고 있어요.'; video.pause(); }
    },
    onError() { note.textContent = '디스플레이 연결 설정을 확인해주세요.'; },
  });
  video.addEventListener('error', () => { note.textContent = `영상을 불러오지 못했어요: ${profile.display[currentClip] || ''}`; });
  document.getElementById('displayStart').addEventListener('click', () => {
    unlocked = true; gate.hidden = true;
    if (desired) apply(desired);
  });
  // 영상이 끝나는 순간 연결이 끊겼다면, 재연결 후 종료 신호를 한 번 전송합니다.
  const originalApply = client.onState;
  client.onState = state => {
    if (video.ended && desired?.session === state.session && desired?.phase === state.phase
      && ((currentClip === 'water' && state.phase === 'water-playing')
      || (currentClip === 'main' && state.phase === 'main-playing')
      || (currentClip === 'ending' && state.phase === 'ending-playing'))) {
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
