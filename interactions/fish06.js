/* 6번: 좌우로 흔들어 고르기 → 버튼으로 확정·저장. 다음 장면은 추후 연결합니다. */
FishApp.registerInteraction('fish06',{
  viewId:'fish06View',
  mount(root,flow){
    'use strict';
    const $=id=>root.querySelector('#'+id),assets=flow.config.assets,items=assets.items;
    const preview=matchMedia('(hover: hover) and (pointer: fine)').matches
      ||new URLSearchParams(location.search).get('debug')==='1';
    let scope=null,current=null,chosen=null,version=0,busy=false,permission=false,permissionTask=null;
    const detector=new HorizontalShake(flow.config.game,()=>roll());
    const feedback=text=>{$('tradeFeedback').textContent=text;};
    function reset(){
      version++;current=chosen=null;busy=false;detector.reset();
      root.dataset.step='intro';root.dataset.item='';
      $('tradeIntro').hidden=false;$('tradeGame').hidden=true;
      $('tradeInstruction').hidden=false;$('tradeMentOne').hidden=$('tradeMentTwo').hidden=true;
      $('tradeItem').hidden=true;$('tradeConfirm').hidden=true;$('tradeConfirm').disabled=false;
      $('tradeConfirm').textContent='이걸로 정했어!';$('tradePreviewShake').hidden=!preview;
      feedback('휴대폰을 좌우로 세게 흔들어주세요.');
    }
    function warm(){
      const sources=[assets.introOne,assets.introTwo,assets.instruction,assets.frame,
        ...items.flatMap(item=>[item.image,item.mentOne,item.mentTwo])];
      for(const src of sources){const image=new Image();image.src=src;if(image.decode)image.decode().catch(()=>{});}
    }
    function enable(){
      if(permission)return Promise.resolve();
      if(permissionTask)return permissionTask;
      if(!window.isSecureContext)return Promise.reject(new Error('https-required'));
      const device=window.DeviceMotionEvent;
      if(!device)return Promise.reject(new Error('motion-unavailable'));
      let request;
      try {request=typeof device.requestPermission==='function'?device.requestPermission():Promise.resolve('granted');}
      catch(error){return Promise.reject(error);}
      permissionTask=Promise.resolve(request).then(result=>{
        if(result!=='granted')throw new Error('motion-denied');
        permission=true;
      }).finally(()=>{permissionTask=null;});
      return permissionTask;
    }
    function requestMotion(){
      const active=scope;
      enable().then(()=>{
        if(scope===active&&active?.active&&!current)feedback('휴대폰을 좌우로 세게 흔들어주세요.');
      },()=>{
        if(scope===active&&active?.active&&!chosen)feedback(preview?'미리보기 버튼으로 물건을 골라보세요.':'화면을 한 번 터치해 흔들기 권한을 허용해주세요.');
      });
    }
    function begin(){
      if(root.dataset.step!=='intro')return;
      requestMotion();root.dataset.step='game';$('tradeIntro').hidden=true;$('tradeGame').hidden=false;
      detector.reset();flow.announce('휴대폰을 좌우로 세게 흔들면 물건이 나타나요.');
    }
    async function roll(){
      if(!scope?.active||root.dataset.step!=='game'||busy||chosen||document.hidden)return;
      const pool=items.filter(item=>item.id!==current?.id);
      const item=pool[Math.floor(Math.random()*pool.length)];
      if(!item)return;
      busy=true;const active=scope,draw=++version;
      $('tradeConfirm').disabled=true;
      const images=[['tradeItem',item.image],['tradeMentOne',item.mentOne],['tradeMentTwo',item.mentTwo]];
      for(const [id,src] of images){$(id).hidden=true;$(id).src=src;}
      await Promise.all(images.map(([id])=>$(id).decode?.().catch(()=>{})));
      if(scope!==active||!active.active||draw!==version)return;
      current=item;root.dataset.item=item.id;
      $('tradeItem').alt=item.label;$('tradeMentOne').alt=`${item.label} 소개`;$('tradeMentTwo').alt=`${item.label} 이야기`;
      for(const [id] of images)$(id).hidden=false;
      $('tradeInstruction').hidden=true;$('tradeConfirm').hidden=false;$('tradeConfirm').disabled=false;
      busy=false;feedback('다시 흔들거나, 이걸로 정해줘!');
      flow.announce(`${item.label}이 나왔어요. 다시 흔들어 바꾸거나 이걸로 정했어 버튼을 눌러주세요.`);
    }
    async function confirm(){
      if(!scope?.active||!current||chosen||busy||root.dataset.step!=='game')return;
      const active=scope,item=current;busy=true;$('tradeConfirm').disabled=true;
      try {
        const record=await ItemChoices.choose(item);
        if(scope!==active||!active.active)return;
        chosen=record;busy=false;root.dataset.step='chosen';detector.reset();
        $('tradeConfirm').textContent='이걸로 정했어! ✓';$('tradePreviewShake').hidden=true;
        feedback('좋아, 이 물건으로 정했어!');flow.announce(`${item.label} 선택을 기록했어요.`);
        window.dispatchEvent(new CustomEvent('fish:item-chosen',{detail:record}));
      } catch(_) {
        if(scope!==active||!active.active)return;
        busy=false;$('tradeConfirm').disabled=false;feedback('기록하지 못했어. 다시 눌러줄래?');
      }
    }
    warm();
    return{
      start(){
        scope?.abort();scope=new RunScope();reset();
        scope.listen($('tradeBegin'),'click',begin);
        scope.listen($('tradeGame'),'click',event=>{
          if(!event.target.closest('button')&&!permission&&root.dataset.step==='game')requestMotion();
        });
        scope.listen(window,'devicemotion',event=>{
          if(root.dataset.step==='game'&&!busy&&permission&&!document.hidden)detector.feed(event);
        });
        scope.listen($('tradeConfirm'),'click',confirm);
        scope.listen($('tradePreviewShake'),'click',()=>{if(preview)roll();});
        scope.listen(document,'visibilitychange',()=>detector.reset());
        scope.listen(window,'blur',()=>detector.reset());
        scope.listen(window,'fish:item-choice-saved',event=>{
          if(chosen?.id===event.detail.id)chosen=event.detail;
        });
        scope.cleanup(()=>{version++;busy=false;});
      },
      stop(){scope?.abort();scope=null;detector.reset();},reset,
      getState:()=>({step:root.dataset.step,itemId:current?.id??null,selected:chosen,busy}),
    };
  },
});
