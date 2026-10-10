const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createOpenDotaCollector}=require('./happy-games-opendota.cjs');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'happy-od-test-'));
const ok=data=>({ok:true,status:200,json:async()=>data});
const wait=()=>new Promise(r=>setImmediate(r));
test('poll live once/minute, no spectators, stop after 3 coverage misses',async()=>{
  let time=100000,calls=0;const c=createOpenDotaCollector({dir:temp(),now:()=>time,timer:false,fetchImpl:async()=>{calls++;return ok([]);}});
  c.observe({matchId:'1234567890',clock:120,mode:'spectator'});await wait();assert.equal(calls,0);
  c.observe({matchId:'1234567890',clock:120,mode:'player'});await wait();assert.equal(calls,1);
  for(let i=0;i<20;i++)c.observe({matchId:'1234567890',clock:130,mode:'player'});await wait();assert.equal(calls,1);
  time+=60000;await c.tick();time+=60000;await c.tick();time+=60000;await c.tick();
  assert.equal(calls,3);assert.equal(c.status().active.suspended,true);c.close();
});
test('save only exact matching live match and no other players matches',async()=>{
  const dir=temp(),c=createOpenDotaCollector({dir,timer:false,fetchImpl:async()=>ok([{match_id:9},{match_id:'1234567890',score:1}])});
  c.observe({matchId:'1234567890',clock:120,mode:'player'});await wait();
  assert.ok(fs.existsSync(path.join(dir,'opendota','live-1234567890.json')));
  assert.equal(c.status().lastLiveFound,true);assert.ok(!fs.existsSync(path.join(dir,'opendota','live-9.json')));c.close();
});
test('600/day quota persists over restart; resets at UTC next day',async()=>{
  const dir=temp(),od=path.join(dir,'opendota');fs.mkdirSync(od);let time=Date.UTC(2026,9,4,12),calls=0;
  fs.writeFileSync(path.join(od,'quota.json'),JSON.stringify({day:'2026-10-04',used:600,minute:[],blockedUntil:0}));
  const c=createOpenDotaCollector({dir,now:()=>time,timer:false,fetchImpl:async()=>{calls++;return ok([]);}});
  c.observe({matchId:'1234567890',clock:120,mode:'player'});await wait();assert.equal(calls,0);
  time+=86400000;await c.tick();assert.equal(calls,1);assert.equal(c.status().usage.usedDailyUnits,1);c.close();
});
test('429 respects Retry-After and never retries per GSI frame',async()=>{
  let time=100000,calls=0;const c=createOpenDotaCollector({dir:temp(),now:()=>time,timer:false,fetchImpl:async()=>{
    calls++;return {ok:false,status:429,headers:{get:()=> '180'}};
  }});c.observe({matchId:'1234567890',clock:120,mode:'player'});await wait();
  time+=60000;await c.tick();assert.equal(calls,1);assert.equal(c.status().usage.blockedUntil,280000);c.close();
});
test('postmatch only after 2min, bounded 5 unparsed attempts, no forced paid parse',async()=>{
  let time=100000;const routes=[];const c=createOpenDotaCollector({dir:temp(),now:()=>time,timer:false,requestParsing:false,fetchImpl:async u=>{
    routes.push(u);return ok({match_id:'1234567890',version:null});
  }});c.observe({matchId:'1234567890',clock:1800,mode:'player',finished:true});await wait();assert.equal(routes.length,0);
  for(let i=0;i<6;i++){time+=120000;await c.tick();}
  assert.equal(routes.length,5);assert.ok(routes.every(u=>u.includes('/matches/')));assert.equal(c.status().postJobs[0].status,'unparsed_final');c.close();
});
test('request replay parsing only once and budget POST as 10 units',async()=>{
  let time=100000;const methods=[];const c=createOpenDotaCollector({dir:temp(),now:()=>time,timer:false,fetchImpl:async(u,{method})=>{
    methods.push(method);return ok(method==='POST'?{job:{jobId:1}}:{match_id:'1234567890',version:null});
  }});c.observe({matchId:'1234567890',clock:1800,mode:'player',finished:true});await wait();
  time+=120000;await c.tick();time+=120000;await c.tick();
  assert.deepEqual(methods,['GET','POST','GET']);assert.equal(c.status().usage.usedDailyUnits,12);c.close();
});
test('fetch timeout frees busy slot',async()=>{
  const c=createOpenDotaCollector({dir:temp(),timer:false,timeoutMs:10,fetchImpl:async(u,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})));
  })});c.observe({matchId:'1234567890',clock:120,mode:'player'});await new Promise(r=>setTimeout(r,25));
  assert.equal(c.status().busy,false);assert.equal(c.status().lastError,'request_timeout');c.close();
});
