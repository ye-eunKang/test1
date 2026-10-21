/* 2번 LP 게임. 물 붓기와 엔딩·기다림은 공통 흐름을 사용합니다. */
FishApp.registerInteraction('fish02',{
  viewId:'fish02View',
  mount(root,flow){
    'use strict';
    const $=id=>root.querySelector('#'+id);
    const cfg=flow.config.game,assets=flow.config.assets;
    const preview=matchMedia('(hover: hover) and (pointer: fine)').matches
      || new URLSearchParams(location.search).get('debug')==='1';
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scope=null,introStep=0,since=null,lastAt=null,progress=0;
    let target=0,angle=0,frame=null,lastFrame=null,success=false,previewing=false;
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    function feedback(text){if($('lpFeedback').textContent!==text)$('lpFeedback').textContent=text;}
    function setProgress(value){
      progress=clamp(value,0,1);
      $('lpProgress').style.setProperty('--lp-progress',String(progress));
      $('lpProgress').setAttribute('aria-valuenow',String(Math.round(progress*100)));
    }
    function clearHold(){since=null;lastAt=null;setProgress(0);}
    function reset(){
      introStep=0;since=null;lastAt=null;target=angle=0;success=false;previewing=false;
      root.dataset.step='intro';root.dataset.balanced='false';
      $('lpIntro').hidden=false;$('lpGame').hidden=true;
      root.querySelector('.intro-one').src=assets.introOne;
      root.querySelector('.intro-two').src=assets.introTwo;
      root.querySelector('.intro-two').hidden=true;
      root.querySelector('.instruction').src=assets.instruction;
      $('lpRecord').src=assets.record;$('lpBase').src=assets.balanceBase;
      $('lpRecord').style.setProperty('--lp-angle','0deg');
      $('lpPreview').hidden=!preview;$('lpPreviewTilt').value='18';
      setProgress(0);feedback('휴대폰을 좌우로 천천히 기울여 중심을 잡아주세요.');
    }
    async function complete(){
      if(success||!scope?.active)return;
      success=true;setProgress(1);root.dataset.step='complete';root.dataset.balanced='true';
      target=0;feedback('음반이 안정적으로 돌아가기 시작했어!');
      const current=scope;
      if(await current.delay(cfg.successPauseMs))flow.complete();
    }
    function sample(value){
      if(!scope?.active||root.dataset.step!=='game'||document.hidden||success)return;
      const {gamma,beta,receivedAt}=value;
      if(![gamma,beta,receivedAt].every(Number.isFinite)){clearHold();return;}
      if(lastAt!==null&&(receivedAt-lastAt>FishConfig.common.sensorGapMs||receivedAt<lastAt))clearHold();
      lastAt=receivedAt;
      target=clamp(gamma,-cfg.maxVisualTilt,cfg.maxVisualTilt);
      const balanced=Math.abs(gamma)<=cfg.balanceTolerance&&Math.abs(beta)<=135;
      root.dataset.balanced=String(balanced);
      if(!balanced){since=null;setProgress(0);feedback('넘어지지 않게 반대쪽으로 살짝 기울여주세요.');return;}
      if(since===null)since=receivedAt;
      setProgress((receivedAt-since)/cfg.balanceHoldMs);
      feedback('좋아, 이대로 잠시 중심을 유지해줘!');
      if(progress>=1)complete();
    }
    function render(at){
      frame=null;
      if(!scope?.active)return;
      const dt=lastFrame===null?1/60:clamp((at-lastFrame)/1000,0,.1);lastFrame=at;
      if(previewing&&root.dataset.step==='game')sample({beta:90,gamma:Number($('lpPreviewTilt').value),receivedAt:at});
      if(!success&&lastAt!==null&&at-lastAt>FishConfig.common.sensorGapMs){clearHold();root.dataset.balanced='false';feedback('휴대폰을 천천히 움직여 중심을 잡아주세요.');}
      angle=reduced?target:angle+(target-angle)*(1-Math.exp(-dt/cfg.smoothingSeconds));
      $('lpRecord').style.setProperty('--lp-angle',angle.toFixed(2)+'deg');
      frame=requestAnimationFrame(render);
    }
    function beginGame(){
      root.dataset.step='game';$('lpIntro').hidden=true;$('lpGame').hidden=false;clearHold();
      flow.motion.enable().catch(()=>feedback('화면을 한 번 터치해 기울기를 허용해주세요.'));
      flow.announce(`음반이 넘어지지 않게 좌우 중심을 ${cfg.balanceHoldMs/1000}초 유지해주세요.`);
    }
    return{
      start(){
        scope?.abort();scope=new RunScope();reset();lastFrame=null;
        scope.listen($('lpIntro'),'click',()=>{
          if(root.dataset.step!=='intro')return;
          if(introStep++===0)root.querySelector('.intro-two').hidden=false;else beginGame();
        });
        scope.cleanup(flow.motion.subscribe(value=>{if(!previewing)sample(value);}));
        scope.listen($('lpGame'),'click',()=>{if(!flow.motion.enabled)flow.motion.enable().catch(()=>{});});
        scope.listen($('lpPreviewTilt'),'input',()=>{if(preview){previewing=true;clearHold();}});
        scope.listen(document,'visibilitychange',()=>{clearHold();lastFrame=null;});
        scope.listen(window,'blur',clearHold);
        scope.cleanup(()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;});
        frame=requestAnimationFrame(render);
      },
      stop(){scope?.abort();scope=null;},reset,
      getState:()=>({step:root.dataset.step,progress,success,angle,target}),
    };
  },
});
