/* 1번 접시 게임. 사진 꾹 누르기 → 손을 떼지 않고 천천히 아래에 놓기 × 3. */
FishApp.registerInteraction('fish01', {
  viewId: 'fish01View',
  mount(root, flow) {
    'use strict';
    const $ = id => root.querySelector(`#${id}`);
    const cfg = flow.config.game, assets = flow.config.assets;
    const stack = [...$('dishStack').querySelectorAll('img')];
    const moving = $('dishMoving'), tray = $('dishTray'), platform = $('dishPlatform');
    let scope = null, count = 0, busy = false, introStep = 0;
    let plate = null, drag = null, pickup = null, ready = null, feedbackVersion = 0, keyboardSince = null;
    const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
    function bounds() {
      const r = $('dishGame').getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    }
    function imageSource(image, src) {
      image.decoding = 'async';
      if (image.getAttribute('src') !== src) image.src = src;
    }
    function floor(r) {
      const rect = platform.getBoundingClientRect();
      const height = rect.height || r.width*(platform.height || 633)/(platform.width || 2048);
      const top = rect.height ? rect.top-r.top : r.height-height;
      return clamp((top+height*(cfg.platformSurfaceY ?? 395/633)-(cfg.platformInsetPx ?? 2))/r.height,.5,.995);
    }
    function positionStack() {
      const r = bounds(); if (!r) return;
      const ground = floor(r);
      stack.forEach((image,index) => {image.style.bottom = `${(1-ground+cfg.plateLifts[index])*100}%`;});
    }
    function layout(index, r) {
      const width = cfg.plateWidths[index];
      return {x:.5, y:floor(r)-cfg.plateLifts[index]-width*r.width*cfg.plateRatios[index]/r.height/2, width};
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
      const target = layout(plate.index,r);
      platform.dataset.near = String(Math.abs(plate.x-target.x) <= .18 && Math.abs(plate.y-target.y) <= .075);
    }
    function instruction() {
      if (count >= 3) return '';
      if (pickup) return '조금만 더 꾹 눌러주세요.';
      if (plate?.keyboard) return '방향키로 옮긴 뒤 Enter를 눌러 놓아주세요.';
      return plate ? '손을 떼지 않고 아래로 천천히 옮겨주세요.' : '그릇 사진을 꾹 누른 채 아래로 천천히 옮겨주세요.';
    }
    function feedback(text) {
      const version = ++feedbackVersion, current = scope;
      $('dishFeedback').textContent = text || instruction();
      if (text) flow.announce(text);
      if (text && current?.active) current.delay(2300).then(active => {
        if (active && version === feedbackVersion) $('dishFeedback').textContent = instruction();
      });
    }
    function release(record) {
      if (record?.capture?.hasPointerCapture?.(record.id)) {
        try { record.capture.releasePointerCapture(record.id); } catch (_) {}
      }
    }
    function clearPickup(keepCapture = false) {
      const old = pickup; pickup = null; tray.dataset.pressing = 'false';
      if (old) busy = false;
      if (!keepCapture) release(old);
      return old;
    }
    function takeDrag() {
      const old = drag; drag = null; moving.dataset.dragging = 'false';
      tray.dataset.carrying = 'false'; release(old);
      return old;
    }
    function reset() {
      clearPickup(); takeDrag(); count = 0; busy = false; plate = null; keyboardSince = null; introStep = 0; feedbackVersion++;
      root.dataset.step = 'intro'; root.dataset.count = '0';
      tray.style.setProperty('--dish-hold-time',`${cfg.pickupHoldMs ?? 450}ms`);
      platform.dataset.near = 'false';
      $('dishIntro').hidden = false; $('dishGame').hidden = true;
      root.querySelector('.intro-one').hidden = false; root.querySelector('.intro-two').hidden = true;
      imageSource(root.querySelector('.intro-one'),assets.introOne);
      imageSource(root.querySelector('.intro-two'),assets.introTwo);
      imageSource(root.querySelector('.instruction'),assets.instruction);
      imageSource(tray.querySelector('img'),assets.dishes);
      imageSource(platform,assets.platform);
      stack.forEach((image,index) => {
        image.hidden = true; imageSource(image,assets.plates[index]);
        image.style.width = `${cfg.plateWidths[index]*100}%`;
      });
      positionStack();
      moving.hidden = true; moving.dataset.settling = 'false'; moving.dataset.dragging = 'false';
      tray.disabled = false; tray.setAttribute('aria-label','그릇 사진을 꾹 누른 채 첫 번째 접시를 아래로 천천히 옮기기');
      $('dishFeedback').textContent = instruction();
      $('dishCount').textContent = '접시 0개 / 3개';
    }
    function preload() {
      if (ready) return ready;
      const sources = [assets.dishes,assets.platform,...assets.plates];
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
      positionStack();
      flow.announce('그릇 사진을 꾹 누른 채, 손을 떼지 않고 아래 받침 위까지 천천히 끌어 놓아주세요.');
    }
    async function pick(record, current) {
      if (!current.active || pickup !== record) return;
      busy = true;
      try { await preload(); }
      catch (_) {
        if (current.active && pickup === record) {clearPickup(); feedback('접시 이미지를 불러오지 못했어요. 다시 꾹 눌러주세요.');}
        return;
      }
      // 이미지가 늦게 준비되어도 이미 뗀 손가락에서 접시가 생성되지 않습니다.
      if (!current.active || pickup !== record) return;
      const r = bounds(), photo = tray.getBoundingClientRect();
      if (!r) {clearPickup(); return;}
      const origin = cfg.pickupPoints[count];
      const home = {x:(photo.left-r.left+photo.width*origin[0])/r.width,
        y:(photo.top-r.top+photo.height*origin[1])/r.height};
      plate = {index:count, origin:home, keyboard:record.kind === 'key',
        x:record.kind === 'key' ? home.x : (record.x-r.left)/r.width,
        y:record.kind === 'key' ? home.y : (record.y-r.top)/r.height};
      keyboardSince = null; clearPickup(true);
      imageSource($('dishMovingImage'),assets.plates[count]);
      moving.dataset.settling = 'false'; position(); moving.hidden = false; busy = false;
      moving.setAttribute('aria-label',`${count+1}번째 접시를 아래 받침 위까지 천천히 끌어 놓기`);
      if (record.kind === 'key') {tray.disabled = true; moving.focus({preventScroll:true});}
      else beginDrag(record,tray);
      feedback('');
      flow.announce('접시를 잡았어요. 아래 받침 위까지 천천히 옮겨주세요.');
    }
    function queuePickup(record) {
      if (!scope?.active || root.dataset.step !== 'game' || busy || plate || pickup || count >= 3) return;
      const current = scope; pickup = record; tray.dataset.pressing = 'true'; feedback('');
      if (record.kind === 'pointer') {
        record.capture = tray;
        try { tray.setPointerCapture?.(record.id); } catch (_) {}
      }
      current.delay(cfg.pickupHoldMs ?? 450).then(active => {
        if (active && pickup === record) pick(record,current);
      });
    }
    function hold(event) {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      queuePickup({kind:'pointer',id:event.pointerId,x:event.clientX,y:event.clientY,
        startX:event.clientX,startY:event.clientY});
    }
    function holdKey(event) {
      if (!['Enter',' '].includes(event.key)) return;
      event.preventDefault();
      if (!event.repeat) queuePickup({kind:'key',key:event.key});
    }
    function releaseKey(event) {
      if (pickup?.kind === 'key' && pickup.key === event.key) {clearPickup(); feedback('');}
    }
    async function returnPlate(text) {
      takeDrag(); if (!plate || !scope?.active) return;
      const current = scope; busy = true; keyboardSince = null; tray.disabled = true;
      moving.dataset.settling = 'true'; Object.assign(plate,plate.origin); position(); feedback(text);
      if (await current.delay(cfg.settleMs)) {
        moving.dataset.settling = 'false'; moving.hidden = true; plate = null;
        platform.dataset.near = 'false'; busy = false; tray.disabled = false;
      }
    }
    function beginDrag(record, capture) {
      if (!scope?.active || !plate || busy || drag) return;
      const r = bounds(); if (!r) return;
      plate.keyboard = false;
      const now = performance.now();
      drag = {id:record.id, capture, started:now, at:now, x:record.x,y:record.y,
        offsetX:record.x-r.left-plate.x*r.width, offsetY:record.y-r.top-plate.y*r.height,
        speed:0, excess:0, unsafe:false};
      moving.dataset.dragging = 'true'; moving.dataset.settling = 'false';
      tray.dataset.carrying = 'true';
      // 사진 쪽의 포인터 캡처를 유지해 손을 떼지 않고 드래그로 이어갑니다.
      try { capture.setPointerCapture?.(record.id); } catch (_) {}
      feedback('');
    }
    function down(event) {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      beginDrag({id:event.pointerId,x:event.clientX,y:event.clientY},moving);
    }
    function move(event) {
      if (pickup?.kind === 'pointer' && event.pointerId === pickup.id) {
        event.preventDefault(); pickup.x = event.clientX; pickup.y = event.clientY;
        if (Math.hypot(pickup.x-pickup.startX,pickup.y-pickup.startY) > (cfg.pickupMovePx ?? 12)) {
          clearPickup(); feedback('사진을 잠깐 꾹 누른 다음 옮겨주세요.');
        }
        return;
      }
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
        returnPlate('아래 받침 위에 접시를 놓아주세요.'); return;
      }
      if (record.unsafe || performance.now()-record.started < cfg.minCarryMs) {
        returnPlate('조금 더 천천히 옮겨주세요. 지금 접시만 다시 해보면 돼요.'); return;
      }
      const current = scope; busy = true; tray.disabled = true;
      moving.dataset.settling = 'true'; plate.x = target.x; plate.y = target.y; position();
      if (!await current.delay(cfg.settleMs)) return;
      stack[count].hidden = false; count++; plate = null; keyboardSince = null;
      moving.hidden = true; moving.dataset.settling = 'false';
      root.dataset.count = String(count); platform.dataset.near = 'false';
      $('dishCount').textContent = `접시 ${count}개 / 3개`;
      flow.announce(`${count}개의 접시를 안전하게 옮겼어요.`);
      if (count === 3) {
        root.dataset.step = 'complete'; feedback('');
        if (await current.delay(cfg.successPauseMs)) flow.complete();
      } else {
        busy = false; tray.disabled = false;
        tray.setAttribute('aria-label',`그릇 사진을 꾹 누른 채 ${count+1}번째 접시를 아래로 천천히 옮기기`);
        feedback('');
      }
    }
    function up(event) {
      if (pickup?.kind === 'pointer' && pickup.id === event.pointerId) {clearPickup(); feedback(''); return;}
      if (!drag || drag.id !== event.pointerId) return;
      move(event); const old = takeDrag(); if (old) drop(old);
    }
    function cancel(event) {
      if (pickup && (event.pointerId === undefined || event.pointerId === pickup.id)) {clearPickup(); feedback('');}
      if (drag && (event.pointerId === undefined || event.pointerId === drag.id)) returnPlate('그릇 사진을 다시 꾹 누른 채 아래로 천천히 옮겨주세요.');
    }
    function key(event) {
      if (!plate || busy || !scope?.active) return;
      const directions = {ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]};
      if (directions[event.key]) {
        event.preventDefault(); keyboardSince ??= performance.now();
        plate.x += directions[event.key][0]; plate.y += directions[event.key][1]; position();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); if (!event.repeat) drop({started:keyboardSince ?? performance.now(),unsafe:false});
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
        scope.listen(tray,'pointerdown',hold);
        scope.listen(tray,'keydown',holdKey);
        scope.listen(tray,'keyup',releaseKey);
        scope.listen(tray,'contextmenu',event => event.preventDefault());
        scope.listen(moving,'contextmenu',event => event.preventDefault());
        scope.listen(moving,'pointerdown',down);
        scope.listen(window,'pointermove',move,{passive:false});
        scope.listen(window,'pointerup',up);
        scope.listen(window,'pointercancel',cancel);
        scope.listen(moving,'lostpointercapture',cancel);
        scope.listen(tray,'lostpointercapture',cancel);
        scope.listen(moving,'keydown',key);
        scope.listen(document,'visibilitychange',() => {if (document.hidden) cancel({});});
        scope.listen(window,'blur',() => cancel({}));
        scope.listen(window,'resize',() => {positionStack(); position();});
        scope.listen(platform,'load',() => {positionStack(); position();});
      },
      stop() { clearPickup(); takeDrag(); scope?.abort(); scope = null; },
      reset,
      getState:() => ({count,busy,picking:!!pickup,dragging:!!drag,step:root.dataset.step,plate:plate ? {index:plate.index,x:plate.x,y:plate.y} : null}),
    };
  },
});
