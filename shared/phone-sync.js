/* 전시 순서 연결. 미니게임마다 flow.complete()만 호출하면 됩니다. */
(() => {
  'use strict';
  const settings = window.FishSyncConfig;
  let client = null, pendingTag = false, lastPhase = '', lastPour = null, heldSince = null, lastSensorAt = null;
  let homeTimer = null, tiltWatch = null, applying = false;
  const note = document.getElementById('syncStatus');
  function status(text = '') { note.textContent = text; note.hidden = !text; }
  function apply(state) {
    if (state.owner && state.owner !== client.clientId) {
      status('이 물고기는 다른 관객이 만나고 있어요. 잠시 기다려주세요.'); return;
    }
    if (state.phase === 'idle' && pendingTag) return;
    pendingTag = false;
    if (state.phase === lastPhase) return;
    const previous = lastPhase;
    lastPhase = state.phase; heldSince = null; lastPour = null; lastSensorAt = null;
    clearTimeout(homeTimer);
    if (!['water-ready','water-playing'].includes(state.phase)) clearTimeout(tiltWatch);
    applying = true;
    try {
      switch (state.phase) {
        case 'idle':
          if (previous) FishApp.showHome();
          client?.stop(); client = null; lastPhase = ''; status();
          break;
        case 'water-ready':
          if (HomeGuide.getState().pendingId !== state.fish) HomeGuide.restore(state.fish);
          break;
        case 'water-playing':
          if (HomeGuide.getState().pendingId !== state.fish) HomeGuide.restore(state.fish,true);
          break;
        case 'main-playing':
          HomeGuide.restore(state.fish,true);
          break;
        case 'game': FishApp.startInteraction(state.fish); break;
        case 'ending-playing':
          if (FishApp.getState().activeId !== state.fish) FishApp.startInteraction(state.fish);
          FishApp.pauseGame(); break;
        case 'reveal': FishApp.presentReveal(state.fish); break;
        case 'waiting':
          if (FishApp.getState().screen !== 'ocean') FishApp.presentWaiting(state.fish);
          break;
        case 'swimming':
          if (!FishApp.getState().endingStarted) { FishApp.presentWaiting(state.fish); FishApp.playEnding(); }
          break;
        case 'returning':
          // 영상 종료 중 재연결되어도 수영 영상/TD 신호를 다시 실행하지 않습니다.
          homeTimer = setTimeout(() => FishApp.showHome(), Math.max(0,state.returnAt-Date.now()));
          break;
      }
    } finally { applying = false; }
  }
  function begin(fish) {
    if (!settings.fish[fish]) { status('이 물고기의 아이패드 영상 설정을 확인해주세요.'); return; }
    client?.stop(); clearTimeout(homeTimer); clearTimeout(tiltWatch);
    pendingTag = true; lastPhase = ''; lastPour = null; heldSince = null; lastSensorAt = null;
    status('아이패드 연결을 확인하고 있어요.');
    client = new ExhibitClient({role:'phone',fish,onState:apply,
      onStatus(online) { if (online) status(); else { status('연결을 다시 확인하고 있어요.'); heldSince = null; lastPour = null; } },
      onError(error) {
        if (error === 'busy') { pendingTag = false; client?.stop(); client = null; HomeGuide.reset(); }
        status(error === 'busy' ? '다른 관객이 진행 중이에요. 잠시 기다려주세요.' : '아이패드 연결 설정을 확인해주세요.');
      },
    });
    client.event('tag');
  }
  function emit(name) { if (client && !applying) client.event(name); }
  window.addEventListener('fish:tag-selected', event => begin(event.detail.fish));
  window.addEventListener('fish:pour-progress', event => {
    const sample = event.detail;
    if (!client?.ready || sample.fish !== client.fish || client.state.owner !== client.clientId
      || !['water-ready','water-playing'].includes(client.state.phase)) return;
    if (lastSensorAt !== null && sample.receivedAt - lastSensorAt > FishConfig.common.sensorGapMs) heldSince = null;
    lastSensorAt = sample.receivedAt;
    clearTimeout(tiltWatch);
    tiltWatch = setTimeout(() => {
      client?.event('pour',{active:false}); lastPour = null; heldSince = null; lastSensorAt = null;
    }, FishConfig.common.sensorGapMs);
    if (sample.active !== lastPour) { client.event('pour',{active:sample.active}); lastPour = sample.active; }
    if (!sample.active || sample.moved < settings.pourSuccessDeg) { heldSince = null; return; }
    heldSince ??= sample.receivedAt;
    if (sample.receivedAt - heldSince >= settings.pourHoldMs) {
      if (client.event('pour-complete')) heldSince = null;
    }
  });
  window.addEventListener('fish:game-complete', () => emit('game-complete'));
  window.addEventListener('fish:level-ready', () => emit('waiting'));
  window.addEventListener('fish:swim-started', () => emit('swim-started'));
  window.addEventListener('fish:finished', () => emit('swim-ended'));
  document.addEventListener('visibilitychange', () => {
    heldSince = null; lastSensorAt = null;
    clearTimeout(tiltWatch);
    if (document.hidden) { client?.event('pour',{active:false}); lastPour = null; }
  });
  window.addEventListener('fishhome:show', () => {
    if (applying) return;
    if (client && client.state?.owner === client.clientId) client.event('reset');
    client?.stop(); client = null; clearTimeout(homeTimer); clearTimeout(tiltWatch); lastPhase = ''; pendingTag = false;
    status();
  });
  window.PhoneSync = {isActive:fish => !!client && client.fish === fish,
    getState:() => client?.state || null};
})();
