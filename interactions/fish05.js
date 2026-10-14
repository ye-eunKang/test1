/* 5번 미니게임만 담당. 물고기 소개·정지 감지·영상·홈 복귀는 app.js가 담당합니다. */
FishApp.registerInteraction('fish05', {
  viewId: 'fish05View',
  mount(root, flow) {
    const $ = (id) => root.querySelector(`#${id}`);
    let scope = null;
    let count = 0;
    let busy = false;
    const config = flow.config.game;
    const assets = flow.config.assets;
    let imagesReady;

    function show(name) {
      $('intro').hidden = name !== 'intro';
      $('water').hidden = name !== 'water';
      root.dataset.step = name;
      flow.announce(name === 'water' ? `수도꼭지를 ${config.requiredTaps}번 돌려주세요.` : '말풍선 안내');
    }
    function reset() {
      count = 0;
      busy = false;
      $('tapButton').disabled = false;
      $('tap').src = 'assets/tap-0.png';
      $('hose').src = 'assets/hose-0.png';
      $('fill').setAttribute('y', '110');
      $('count').textContent = `물을 ${config.requiredTaps}번 주세요`;
      root.querySelector('.intro-one').src = assets.introOne;
      root.querySelector('.intro-two').src = assets.introTwo;
      root.querySelector('.instruction').src = assets.instruction;
      show('intro');
    }
    function preload() {
      if (imagesReady) return imagesReady;
      const jobs = [];
      for (const [kind, times] of [['tap', config.tapTimes], ['hose', config.hoseTimes]]) {
        times.forEach((_, index) => {
          const image = new Image();
          image.src = `assets/${kind}-${index}.png`;
          jobs.push(image.decode());
        });
      }
      imagesReady = Promise.all(jobs).catch((error) => { imagesReady = null; throw error; });
      return imagesReady;
    }
    async function frames(kind, times, current) {
      for (let index = 0; index < times.length; index++) {
        if (!current.active) return false;
        $(kind).src = `assets/${kind}-${index}.png`;
        if (!await current.delay(times[index])) return false;
      }
      if (!current.active) return false;
      $(kind).src = `assets/${kind}-0.png`;
      return true;
    }
    async function tap() {
      if (!scope?.active || busy || root.dataset.step !== 'water') return;
      const current = scope;
      busy = true;
      $('tapButton').disabled = true;
      try {
        await preload();
        if (!current.active) return;
        if (!await frames('tap', config.tapTimes, current)) return;
        if (!await frames('hose', config.hoseTimes, current)) return;
        count++;
        $('fill').setAttribute('y', String(110 - count / config.requiredTaps * 105));
        $('count').textContent = `물방울 ${count}/${config.requiredTaps} 채움`;
        if (!await current.delay(config.fillPauseMs)) return;
        busy = false;
        if (count >= config.requiredTaps) flow.complete();
        else $('tapButton').disabled = false;
      } catch (error) {
        if (!current.active) return;
        busy = false;
        $('tapButton').disabled = false;
        flow.announce('수도꼭지 또는 호스 이미지를 불러오지 못했어요. assets 파일을 확인해주세요.');
      }
    }
    return {
      start() {
        scope?.abort();
        scope = new RunScope();
        reset();
        scope.listen($('tapButton'), 'click', tap);
        const current = scope;
        current.delay(config.introMs).then((active) => { if (active) show('water'); });
      },
      stop() { scope?.abort(); scope = null; },
      reset,
      getState: () => ({ count, busy, step: root.dataset.step }),
    };
  },
});
