/* 확정한 물건을 브라우저에 남기고 서버에 전달합니다. 오프라인 기록은 재연결 때 재전송합니다. */
(() => {
  'use strict';
  const LAST='fish06:selected-item',OUTBOX='fish:item-choice-outbox';
  const items=new Set(['luck','hairpin','squishy']);
  const valid=value=>value&&value.fish==='fish06'&&typeof value.id==='string'&&items.has(value.itemId);
  function read(key,fallback) {try{return JSON.parse(localStorage.getItem(key))??fallback;}catch(_){return fallback;}}
  function write(key,value) {try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  const loaded=read(OUTBOX,[]);
  const pending=new Map((Array.isArray(loaded)?loaded:[]).filter(valid).map(value=>[value.id,value]));
  const previous=read(LAST,null);
  if(valid(previous)&&previous.status==='pending')pending.set(previous.id,previous);
  let sending=false,retry=null,backoff=2000;
  function persist() {return write(OUTBOX,[...pending.values()]);}
  function notify(record) {window.dispatchEvent(new CustomEvent('fish:item-choice-saved',{detail:record}));}
  async function post(record) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try {
      const base=window.FishSyncConfig?.serverUrl||location.origin;
      const response=await fetch(new URL('/api/item-choices',base),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:record.id,fish:record.fish,itemId:record.itemId}),signal:controller.signal,
      });
      if(!response.ok)throw new Error('choice-save-failed');
      const saved=await response.json();
      if(!valid(saved)||saved.id!==record.id||saved.itemId!==record.itemId)throw new Error('invalid-choice-response');
      return {...saved,status:'saved'};
    } finally {clearTimeout(timer);}
  }
  async function flush() {
    if(sending||!pending.size)return;
    sending=true;clearTimeout(retry);retry=null;
    try {
      while(pending.size) {
        const record=pending.values().next().value;
        const saved=await post(record);
        pending.delete(record.id);persist();
        if(read(LAST,null)?.id===record.id)write(LAST,saved);
        notify(saved);
      }
      backoff=2000;
    } catch(_) {
      retry=setTimeout(flush,backoff);backoff=Math.min(10000,backoff*2);
    } finally {sending=false;}
  }
  async function choose(item) {
    if(!items.has(item.id))throw new Error('invalid-choice-item');
    const record={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fish:'fish06',itemId:item.id,label:item.label,selectedAt:new Date().toISOString(),status:'pending'};
    pending.set(record.id,record);
    const lastStored=write(LAST,record),queueStored=persist();
    if(lastStored||queueStored) {flush();return record;}
    // 브라우저 저장이 차단돼 있으면 서버에 기록된 뒤에만 선택 완료로 처리합니다.
    pending.delete(record.id);
    const saved=await post(record);notify(saved);return saved;
  }
  window.addEventListener('online',()=>{clearTimeout(retry);retry=null;flush();});
  window.ItemChoices={choose,flush,getLast:()=>read(LAST,null)};
  if(pending.size)flush();
})();
