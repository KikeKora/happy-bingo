const fs=require('node:fs');
const path=require('node:path');
const API='https://api.opendota.com/api';
const DAY_BUDGET=600,MINUTE_BUDGET=20,LIVE_INTERVAL=60000,POST_INTERVAL=120000;
const idOf=v=>v!=null && /^\d+$/.test(String(v)) && BigInt(String(v))>0n?String(v):null;
const read=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
function write(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file);}

function createOpenDotaCollector({dir,fetchImpl=fetch,now=()=>Date.now(),enabledLive=true,enabledPostMatch=true,
  requestParsing=true,timer=true,timeoutMs=10000}={}){
  if(!dir)throw new Error('dir is required');
  const out=path.join(dir,'opendota');fs.mkdirSync(out,{recursive:true});
  const quotaFile=path.join(out,'quota.json'),jobsFile=path.join(out,'jobs.json');
  let quota=read(quotaFile,{day:null,used:0,minute:[],blockedUntil:0});
  let jobs=read(jobsFile,{}),active=null,busy=false,closed=false,controller=null;
  let failures=0,lastError=null,lastLiveAt=null,lastLiveFound=false,lastPostAt=null;
  function save(){write(quotaFile,quota);write(jobsFile,jobs);}
  function refresh(){
    const day=new Date(now()).toISOString().slice(0,10);
    if(quota.day!==day){quota.day=day;quota.used=0;}
    quota.minute=(quota.minute||[]).filter(t=>t>now()-60000);
  }
  async function get(route,{method='GET',weight=1}={}){
    refresh();
    if(closed || quota.used+weight>DAY_BUDGET || quota.minute.length+weight>MINUTE_BUDGET || now()<quota.blockedUntil)return null;
    quota.used+=weight;quota.requests=(quota.requests||0)+1;
    for(let i=0;i<weight;i++)quota.minute.push(now());save(); // POST parse is conservatively budgeted as ten units.
    controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),timeoutMs);
    try{
      const response=await fetchImpl(API+route,{method,headers:{accept:'application/json'},signal:controller.signal});
      if(response.status===429){
        const retry=response.headers?.get?.('retry-after');
        const seconds=Number(retry),absolute=Date.parse(retry||'');
        const until=Number.isFinite(seconds)?now()+seconds*1000:absolute;
        quota.blockedUntil=Math.max(now()+60000,Number.isFinite(until)?until:now()+60000);save();
        lastError='HTTP 429; cooldown applied';return null;
      }
      if(!response.ok){failures++;lastError='HTTP '+response.status;return null;}
      const data=await response.json();lastError=null;return data;
    }catch(e){failures++;lastError=e.name==='AbortError'?'request_timeout':String(e.message);return null;}
    finally{clearTimeout(timeout);controller=null;}
  }
  function observe({matchId,clock,finished=false,mode}={}){
    if(closed)return;
    const id=idOf(matchId);
    if(mode!=='player' || !id || !Number.isFinite(clock))return;
    if(!active || active.id!==id)active={id,nextAt:now(),misses:0,suspended:false,finished:false};
    active.finished=finished;
    if(finished && enabledPostMatch && !jobs[id]){jobs[id]={id,status:'waiting',attempts:0,nextAt:now()+POST_INTERVAL};save();}
    void tick().catch(e=>{failures++;lastError=String(e.message);});
  }
  async function tick(){
    if(closed || busy)return;busy=true;
    try{
      const job=enabledPostMatch?Object.values(jobs).find(j=>['waiting','unparsed','retry'].includes(j.status) && j.attempts<5 && now()>=j.nextAt):null;
      if(job){
        refresh();if(quota.used>=DAY_BUDGET || quota.minute.length>=MINUTE_BUDGET || now()<quota.blockedUntil)return;
        job.attempts++;job.nextAt=now()+POST_INTERVAL;save();
        const data=await get('/matches/'+job.id);lastPostAt=new Date(now()).toISOString();
        if(data && idOf(data.match_id)===job.id){
          const parsed=typeof data.version==='number' && data.version>0;
          write(path.join(out,'match-'+job.id+'.json'),{source:'opendota',timing:'postmatch',receivedAt:lastPostAt,
            parsed,matchId:job.id,data});
          job.status=parsed?'parsed':job.attempts>=5?'unparsed_final':'unparsed';
          if(!parsed && requestParsing && !job.parseRequested && quota.used+10<=DAY_BUDGET && quota.minute.length+10<=MINUTE_BUDGET && now()>=quota.blockedUntil){
            job.parseRequested=true;save();
            const queued=await get('/request/'+job.id,{method:'POST',weight:10});
            job.parseAccepted=queued!==null;
          }
        }else job.status=job.attempts>=5?'unavailable':'retry';
        save();return;
      }
      if(enabledLive && active && !active.finished && !active.suspended && now()>=active.nextAt){
        refresh();if(quota.used>=DAY_BUDGET || quota.minute.length>=MINUTE_BUDGET || now()<quota.blockedUntil)return;
        const selected=active;selected.nextAt=now()+LIVE_INTERVAL;
        const data=await get('/live');lastLiveAt=new Date(now()).toISOString();
        if(!Array.isArray(data))return;
        const found=data.find(m=>idOf(m?.match_id ?? m?.matchid)===selected.id);
        lastLiveFound=!!found;
        if(found){selected.misses=0;write(path.join(out,'live-'+selected.id+'.json'),{source:'opendota',timing:'live',
          coverage:'top-live-games-only',receivedAt:lastLiveAt,matchId:selected.id,data:found});}
        else{selected.misses++;if(selected.misses>=3)selected.suspended=true;}
      }
    }finally{busy=false;}
  }
  const interval=timer?setInterval(()=>{void tick().catch(e=>{failures++;lastError=String(e.message);});},2000):null;
  interval?.unref();
  function status(){refresh();return {source:'opendota',enabledLive,enabledPostMatch,busy,
    coverage:'top-live-games-only; no guaranteed own-match live feed',
    usage:{dayUtc:quota.day,usedDailyUnits:quota.used,dailyCap:DAY_BUDGET,requestsSinceInstall:quota.requests||0,freeDailyLimit:3000,
      minuteUsed:quota.minute.length,minuteCap:MINUTE_BUDGET,freeMinuteLimit:60,blockedUntil:quota.blockedUntil},
    active:active?{matchId:active.id,finished:active.finished,misses:active.misses,suspended:active.suspended}:null,
    lastLiveAt,lastLiveFound,lastPostAt,postJobs:Object.values(jobs).map(j=>({matchId:j.id,status:j.status,attempts:j.attempts})),
    failures,lastError,paidRequests:false};}
  function close(){closed=true;if(interval)clearInterval(interval);controller?.abort();save();}
  return {observe,tick,status,close};
}
module.exports={createOpenDotaCollector,DAY_BUDGET,MINUTE_BUDGET,LIVE_INTERVAL,POST_INTERVAL};
