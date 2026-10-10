const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),net=require('node:net');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<60;i++){try{const value=await fn();if(value)return value;}catch{}await delay(50);}throw new Error('test wait expired');}
test('bridge captures extras, keeps protocol 2, isolates observers, never sends raw credentials',async t=>{
  const events=[];const worker=http.createServer(async(req,res)=>{
    if(req.url==='/api/health'){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,eventProtocolVersion:2}));return;}
    let body='';for await(const c of req)body+=c;
    events.push(JSON.parse(body));res.setHeader('content-type','application/json');res.end('{"ok":true}');
  });await new Promise(r=>worker.listen(0,'127.0.0.1',r));t.after(()=>worker.close());
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;
  await new Promise(r=>probe.close(r));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'happy-bridge-test-'));
  for(const name of ['happy-bingo-online-bridge.cjs','happy-games-gsi.cjs','happy-games-opendota.cjs','happy-games-roles.cjs'])fs.copyFileSync(path.join(__dirname,name),path.join(dir,name));
  fs.writeFileSync(path.join(dir,'happy-bingo-online-config.json'),JSON.stringify({workerUrl:'http://127.0.0.1:'+worker.address().port,eventToken:'local-test-only',openDota:{live:false,postMatch:false}}));
  const child=spawn(process.execPath,[path.join(dir,'happy-bingo-online-bridge.cjs')],{env:{...process.env,HAPPY_BINGO_PORT:String(port),HAPPY_BINGO_EVENT_TOKEN:'local-test-only',HAPPY_BINGO_WORKER_URL:'http://127.0.0.1:'+worker.address().port},stdio:'ignore'});
  t.after(()=>child.kill());const base='http://127.0.0.1:'+port;
  const status=await until(async()=>{const r=await fetch(base+'/status');return r.ok?await r.json():null;});
  assert.equal(status.eventProtocolVersion,2);assert.equal(status.telemetry.schemaVersion,2);assert.equal(status.bridgeVersion,'1.6.0');
  const data={auth:{token:'secret-not-for-logs'},provider:{name:'Dota 2'},map:{matchid:'1234567890',clock_time:100,win_team:'none'},
    player:{activity:'playing',playerid:2,team_name:'radiant',kills:0,deaths:0,assists:0,last_hits:0,denies:0,gold:500},
    hero:{name:'npc_dota_hero_hoodwink',level:5,alive:true,health_percent:100},items:{slot0:{name:'item_boots'}},events:[]};
  const post=async d=>fetch(base+'/',{method:'POST',body:JSON.stringify(d)});
  const wrongOrigin=await fetch(base+'/role',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:JSON.stringify({role:'mid',target:'next'})});
  assert.equal(wrongOrigin.status,403);
  const choice=await fetch(base+'/role',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role:'support4',target:'next'})});assert.equal(choice.status,200);
  assert.equal((await post(data)).status,200);await until(()=>events.length>=3);
  assert.ok(events.some(e=>e.role==='support4'&&e.roleSource==='manual'));
  data.map.clock_time=110;data.player.kills=1;
  data.events=[{event_type:'generic_event',game_time:109,data:JSON.stringify({type:'CHAT_MESSAGE_HERO_KILL',playerid1:7,playerid2:2,time:108})}];
  await post(data);await until(()=>events.some(e=>e.type==='KIKE_KILL'));
  const direct=events.find(e=>e.type==='HERO_KILL_EVENT');assert.equal(direct.eventClock,108);assert.equal(direct.clock,110);
  const before=events.length;await post(data);await delay(100);assert.equal(events.length,before);
  data.map.clock_time=115;data.events=[{event_type:'generic_event',data:{type:'CHAT_MESSAGE_ITEM_PURCHASE',playerid1:2,value:43,time:114}}];
  await post(data);await until(()=>events.some(e=>e.liveEventMetrics?.observedCounts?.sentryWardsPurchased===1));
  const beforeIsolated=events.length;
  await post({map:{matchid:'1234567890',clock_time:120},player:{team2:{player0:{kills:10}}},hero:{team2:{player0:{name:'npc_dota_hero_lion'}}}});
  await delay(100);assert.equal(events.length,beforeIsolated);
  const live=await(await fetch(base+'/telemetry')).json();assert.equal(live.mode,'spectator');
  data.map.clock_time=130;data.map.customgamename='hero_demo';data.player.kills=4;
  await post(data);await delay(100);assert.equal(events.length,beforeIsolated);
  assert.ok(!JSON.stringify(events).includes('secret-not-for-logs'));
  // A real match ID precedes hero selection; the start event must lead the queue.
  const newGame={...data,map:{matchid:'1234567891',clock_time:-60,win_team:'none'},hero:{},events:[]};
  const startIndex=events.length;await post(newGame);
  await until(()=>events.some(e=>e.type==='MATCH_DETECTED'&&e.matchId==='1234567891'));
  assert.equal(events[startIndex].type,'MATCH_DETECTED');
  assert.equal(events[startIndex].role,'unknown');
  await post(newGame);await delay(100);
  assert.equal(events.filter(e=>e.type==='MATCH_DETECTED'&&e.matchId==='1234567891').length,1);
  newGame.map.clock_time=900;
  newGame.events=[{event_type:'roshan_killed',killer_player_id:7,killed_by_team:3,game_time:899}];
  await post(newGame);
  await until(()=>events.some(e=>e.matchId==='1234567891'&&e.matchEventMetrics?.observedCounts?.roshanDeaths===1));
  const n=events.length;await post(newGame);await delay(100);assert.equal(events.length,n);
  assert.equal((await fetch(base+'/',{method:'POST',body:'{invalid'})).status,400);
});
