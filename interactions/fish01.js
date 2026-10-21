/* 1번 접시 게임. 사진 터치 → 한 장 꺼내기 → 천천히 아래에 놓기 × 3. */
FishApp.registerInteraction('fish01', {
  viewId: 'fish01View',
  mount(root, flow) {
    'use strict';
    const $ = id => root.querySelector(`#${id}`);
    const cfg = flow.config.game, assets = flow.config.assets;
    const stack = [...$('dishStack').querySelectorAll('img')];
    const moving = $('dishMoving'), tray = $('dishTray');
    let scope = null, count = 0, busy = false, introStep = 0;
    let plate = null, drag = null, ready = null, feedbackVersion = 0, keyboardSince = null;
    const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
    function bounds() {
      const r = $('dishGame').getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    }
    function imageSource(image, src) {
      image.decoding = 'async';
      if (image.getAttribute('src') !== src) image.src = src;
    }
    function layout(index, r) {
      const width = cfg.plateWidths[index];
      return {x:.5, y:cfg.floor-cfg.plateLifts[index]-width*r.width*cfg.plateRatios[index]/r.height/2, width};
    }
    function position() {
      if (!plate) return;
      const r = bounds(); if (!r) return;
      const width = cfg.plateWidths[plate.index], halfHeight = width*r.width*cfg.plateRatios[plate.index]/r.height/2;
      plate.x = clamp(plate.x,width/2+.008,1-width/2-.008);
      plate.y = clamp(plate.y,halfHeight+.008,1-halfHeight-.008);
      moving.style.width = `${width*100}%`;
      moving.style.setProperty('--dish-x',`${plate.x*r.width}px`);
      moving.style.setProperty('--dish-y',`${plate.y*r.height}px`);
    }
    function feedback(text) {
      const version = ++feedbackVersion, current = scope;
      $('dishFeedback').textContent = text;
      flow.announce(text);
      if (text && current?.active) current.delay(2300).then(active => {
        if (active && version === feedbackVersion) $('dishFeedback').textContent = '';
      });
    }
    function takeDrag() {
      const old = drag; drag = null; moving.dataset.dragging = 'false';
      if (old && moving.hasPointerCapture?.(old.id)) {
        try { moving.releasePointerCapture(old.id); } catch (_) {}
      }
      return old;
    }
    function reset() {
      takeDrag(); count = 0; busy = false; plate = null; keyboardSince = null; introStep = 0; feedbackVersion++;
      root.dataset.step = 'intro'; root.dataset.count = '0';
      $('dishIntro').hidden = false; $('dishGame').hidden = true;
      root.querySelector('.intro-one').hidden = false; root.querySelector('.intro-two').hidden = true;
      imageSource(root.querySelector('.intro-one'),assets.introOne);
      imageSource(root.querySelector('.intro-two'),assets.introTwo);
      imageSource(root.querySelector('.instruction'),assets.instruction);
      imageSource(tray.querySelector('img'),assets.dishes);
      imageSource($('dishPlaceHint'),assets.placeHint);
      imageSource(root.querySelector('.dish-shadow'),assets.shadow);
      stack.forEach((image,index) => {
        image.hidden = true; imageSource(image,assets.plates[index]);
        image.style.width = `${cfg.plateWidths[index]*100}%`;
        image.style.bottom = `${(1-cfg.floor+cfg.plateLifts[index])*100}%`;
      });
      moving.hidden = true; moving.dataset.settling = 'false'; moving.dataset.dragging = 'false';
      tray.disabled = false; tray.setAttribute('aria-label','접시 사진을 눌러 첫 번째 접시 꺼내기');
      $('dishPlaceHint').hidden = false; $('dishFeedback').textContent = '';
      $('dishCount').textContent = '접시 0개 / 3개';
    }
    function preload() {
      if (ready) return ready;
      const sources = [assets.dishes,assets.shadow,assets.placeHint,...assets.plates];
      ready = Promise.all(sources.map(src => {
        const image = new Image(); image.decoding = 'async'; image.src = src;
        if (typeof image.decode === 'function') return image.decode();
        if (image.complete && image.naturalWidth) return Promise.resolve();
        return new Promise((resolve,reject) => { image.onload = resolve; image.onerror = reject; });
      })).catch(error => { ready = null; throw error; });
      return ready;
    }
    function game() {
      $('dishIntro').hidden = true; $('dishGame').hidden = false; root.dataset.step = 'game';
      flow.announce('접시 사진을 누른 뒤, 꺼낸 접시를 아래 그림자까지 천천히 끌어 놓아주세요.');
    }
    async function pick() {
      if (!scope?.active || root.dataset.step !== 'game' || busy || plate || count >= 3) return;
      const current = scope; busy = true; tray.disabled = true;
      try { await preload(); }
      catch (_) {
        if (current.active) {busy = false; tray.disabled = false; feedback('접시 이미지를 불러오지 못했어요. 다시 눌러주세요.');}
        return;
      }
      if (!current.active) return;
      const r = bounds(), photo = tray.getBoundingClientRect();
      if (!r) {busy = false; tray.disabled = false; return;}
      const origin = cfg.pickupPoints[count];
      plate = {index:count, x:(photo.left-r.left+photo.width*origin[0])/r.width,
        y:(photo.top-r.top+photo.height*origin[1])/r.height};
      plate.origin = {x:plate.x,y:plate.y}; keyboardSince = null;
      imageSource($('dishMovingImage'),assets.plates[count]);
      moving.dataset.settling = 'false'; position(); moving.hidden = false; busy = false;
      moving.setAttribute('aria-label',`${count+1}번째 접시를 아래 그림자까지 천천히 끌어 놓기`);
      feedback('');
    }
    async function returnPlate(text) {
      takeDrag(); if (!plate || !scope?.active) return;
      const current = scope; busy = true; keyboardSince = null;
      moving.dataset.settling = 'true'; Object.assign(plate,plate.origin); position(); feedback(text);
      if (await current.delay(cfg.settleMs)) {moving.dataset.settling = 'false'; busy = false;}
    }
    function down(event) {
      if (!scope?.active || !plate || busy || drag || (event.button !== undefined && event.button !== 0)) return;
      const r = bounds(); if (!r) return;
      event.preventDefault();
      const now = performance.now();
      drag = {id:event.pointerId, started:now, at:now, x:event.clientX,y:event.clientY,
        offsetX:event.clientX-r.left-plate.x*r.width, offsetY:event.clientY-r.top-plate.y*r.height,
        speed:0, excess:0, unsafe:false};
      moving.dataset.dragging = 'true'; moving.dataset.settling = 'false';
      try { moving.setPointerCapture?.(event.pointerId); } catch (_) {}
      feedback('');
    }
    function move(event) {
      if (!drag || event.pointerId !== drag.id || !plate || !scope?.active) return;
      const r = bounds(); if (!r) return;
      event.preventDefault();
      const now = performance.now(), dt = Math.max(1,now-drag.at);
      const distance = Math.hypot(event.clientX-drag.x,event.clientY-drag.y)/r.height;
      const speed = distance/(dt/1000);
      drag.speed = drag.speed*.65+speed*.35;
      if (drag.speed > cfg.maxSpeed) drag.excess += Math.min(dt,80);
      else drag.excess = Math.max(0,drag.excess-dt*.5);
      if (drag.excess >= cfg.speedGraceMs || distance > .18 || (speed > cfg.maxSpeed*3 && distance > .02)) drag.unsafe = true;
      drag.at = now; drag.x = event.clientX; drag.y = event.clientY;
      plate.x = (event.clientX-r.left-drag.offsetX)/r.width;
      plate.y = (event.clientY-r.top-drag.offsetY)/r.height;
      position();
    }
    async function drop(record) {
      if (!plate || !scope?.active || busy) return;
      const r = bounds(); if (!r) return;
      const target = layout(count,r);
      if (Math.abs(plate.x-target.x) > .18 || Math.abs(plate.y-target.y) > .075) {
        returnPlate('아래 그림자가 있는 곳에 접시를 놓아주세요.'); return;
      }
      if (record.unsafe || performance.now()-record.started < cfg.minCarryMs) {
        returnPlate('조금 더 천천히 옮겨주세요. 지금 접시만 다시 해보면 돼요.'); return;
      }
      const current = scope; busy = true;
      moving.dataset.settling = 'true'; plate.x = target.x; plate.y = target.y; position();
      if (!await current.delay(cfg.settleMs)) return;
      stack[count].hidden = false; count++; plate = null; keyboardSince = null;
      moving.hidden = true; moving.dataset.settling = 'false';
      root.dataset.count = String(count); $('dishPlaceHint').hidden = count > 0;
      $('dishCount').textContent = `접시 ${count}개 / 3개`;
      flow.announce(`${count}개의 접시를 안전하게 옮겼어요.`);
      if (count === 3) {
        root.dataset.step = 'complete';
        if (await current.delay(cfg.successPauseMs)) flow.complete();
      } else {
        busy = false; tray.disabled = false;
        tray.setAttribute('aria-label',`접시 사진을 눌러 ${count+1}번째 접시 꺼내기`);
      }
    }
    function up(event) {
      if (!drag || drag.id !== event.pointerId) return;
      move(event); const old = takeDrag(); if (old) drop(old);
    }
    function cancel(event) {
      if (drag && (event.pointerId === undefined || event.pointerId === drag.id)) returnPlate('접시를 잡고 아래 그림자까지 천천히 옮겨주세요.');
    }
    function key(event) {
      if (!plate || busy || !scope?.active) return;
      const directions = {ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]};
      if (directions[event.key]) {
        event.preventDefault(); keyboardSince ??= performance.now();
        plate.x += directions[event.key][0]; plate.y += directions[event.key][1]; position();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); drop({started:keyboardSince ?? performance.now(),unsafe:false});
      }
    }
    return {
      start() {
        scope?.abort(); scope = new RunScope(); reset(); preload().catch(() => {});
        scope.listen($('dishIntro'),'click',() => {
          if (root.dataset.step !== 'intro') return;
          if (introStep++ === 0) root.querySelector('.intro-two').hidden = false;
          else game();
        });
        scope.listen(tray,'click',pick);
        scope.listen(moving,'pointerdown',down);
        scope.listen(window,'pointermove',move,{passive:false});
        scope.listen(window,'pointerup',up);
        scope.listen(window,'pointercancel',cancel);
        scope.listen(moving,'lostpointercapture',cancel);
        scope.listen(moving,'keydown',key);
        scope.listen(document,'visibilitychange',() => {if (document.hidden && drag) cancel({});});
        scope.listen(window,'resize',position);
      },
      stop() { takeDrag(); scope?.abort(); scope = null; },
      reset,
      getState:() => ({count,busy,step:root.dataset.step,plate:plate ? {index:plate.index,x:plate.x,y:plate.y} : null}),
    };
  },
});
