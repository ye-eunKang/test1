/* 확정한 물건을 JSONL 파일에 기록합니다. 정적 파일 주소로는 공개하지 않습니다. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const labels={luck:'네잎클로버 키링',hairpin:'알록달록 색핀',squishy:'스퀴시'};
function createChoiceStore(filename){
  const records=new Map();let queue=Promise.resolve();
  try{
    for(const line of fs.readFileSync(filename,'utf8').split('\n')){
      if(!line.trim())continue;
      try{const record=JSON.parse(line);if(record.fish==='fish06'&&Object.hasOwn(labels,record.itemId)&&typeof record.id==='string')records.set(record.id,record);}catch(_){}
    }
  }catch(error){if(error.code!=='ENOENT')throw error;}
  function save(input){
    const job=queue.then(async()=>{
      if(!input||input.fish!=='fish06'||typeof input.id!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(input.id)
        ||!Object.hasOwn(labels,input.itemId))throw Object.assign(new Error('invalid-choice'),{status:400});
      const previous=records.get(input.id);
      if(previous){
        if(previous.itemId!==input.itemId)throw Object.assign(new Error('choice-conflict'),{status:409});
        return previous;
      }
      const record={id:input.id,fish:'fish06',itemId:input.itemId,label:labels[input.itemId],selectedAt:new Date().toISOString()};
      await fs.promises.mkdir(path.dirname(filename),{recursive:true});
      await fs.promises.appendFile(filename,JSON.stringify(record)+'\n','utf8');
      records.set(record.id,record);return record;
    });
    queue=job.catch(()=>{});return job;
  }
  function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(value));}
  function handle(req,res,name){
    const match=/^\/api\/item-choices\/([A-Za-z0-9_-]{8,100})$/.exec(name);
    if(match){
      if(req.method!=='GET'){json(res,405,{error:'method-not-allowed'});return true;}
      const record=records.get(match[1]);json(res,record?200:404,record||{error:'not-found'});return true;
    }
    if(name!=='/api/item-choices')return false;
    if(req.method!=='POST'){json(res,405,{error:'method-not-allowed'});return true;}
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){json(res,415,{error:'json-required'});req.resume();return true;}
    let body='',size=0,ended=false;
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>2048){if(!ended){ended=true;json(res,413,{error:'body-too-large'});}return;}
      body+=chunk.toString('utf8');
    });
    req.on('end',()=>{
      if(ended)return;
      let input;try{input=JSON.parse(body);}catch(_){json(res,400,{error:'invalid-json'});return;}
      save(input).then(record=>json(res,200,record),error=>json(res,error.status||500,{error:error.status?error.message:'save-failed'}));
    });
    req.on('error',()=>{});return true;
  }
  return {handle,save,get:id=>records.get(id),flush:()=>queue};
}
module.exports={createChoiceStore};
