import http from 'http';
import { spawn } from 'child_process';
import { once } from 'events';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { matchesRule } from '../src/worker.js';

const MOCK_PORT=14011;
const BRIDGE_PORT=14010;
const received=[];
let passed=0, failed=0;

function assert(name, condition, detail=''){
  if(condition){ passed++; console.log(`PASS  ${name}${detail?' - '+detail:''}`); }
  else { failed++; console.log(`FAIL  ${name}${detail?' - '+detail:''}`); }
}

const mock=http.createServer((req,res)=>{
  if(req.url==='/api/health'){
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({ok:true,service:'Happy Bingo Mock Worker',eventProtocolVersion:2,timedRulesEngineVersion:1}));
    return;
  }
  if(req.url==='/api/event' && req.method==='POST'){
    let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
      received.push(JSON.parse(body)); res.writeHead(200); res.end('OK');
    }); return;
  }
  res.writeHead(404); res.end();
});

async function post(payload){
  const body=JSON.stringify(payload);
  await new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:BRIDGE_PORT,path:'/',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{res.resume();res.on('end',resolve)});
    req.on('error',reject); req.end(body);
  });
}

function payload(clock,{kills=0,deaths=0,assists=0,lastHits=0,denies=0,killStreak=0,items=[],gold=0,gpm=0,xpm=0,level=6,hp=100,alive=true,radiantScore=0,direScore=0,winner='none'}={}){
  const itemObj={}; items.forEach((name,i)=>itemObj[`slot${i}`]={name});
  return {
    map:{clock_time:clock,game_time:clock,matchid:'selftest-1',win_team:winner,radiant_score:radiantScore,dire_score:direScore},
    player:{kills,deaths,assists,last_hits:lastHits,denies,kill_streak:killStreak,team_name:'team2',gold,gpm,xpm},
    hero:{name:'npc_dota_hero_hoodwink',alive,health_percent:hp,level,aghanims_scepter:false,aghanims_shard:false},
    items:itemObj,
    abilities:{},events:[]
  };
}

async function main(){
  console.log('===============================================');
  console.log(' HAPPY BINGO EVENT SELF-TEST');
  console.log(' No toca produccion ni marca casillas reales.');
  console.log('===============================================');

  mock.listen(MOCK_PORT,'127.0.0.1'); await once(mock,'listening');
  const projectDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const configPath=path.join(projectDir,'local','happy-bingo-online-config.json');
  const madeTestConfig=!fs.existsSync(configPath);
  if(madeTestConfig)fs.writeFileSync(configPath,'{}');
  const child=spawn(process.execPath,['./local/happy-bingo-online-bridge.cjs'],{
    cwd:projectDir,
    env:{...process.env,HAPPY_BINGO_PORT:String(BRIDGE_PORT),HAPPY_BINGO_WORKER_URL:`http://127.0.0.1:${MOCK_PORT}`,HAPPY_BINGO_EVENT_TOKEN:'self-test'},
    stdio:['ignore','pipe','pipe']
  });
  let out=''; child.stdout.on('data',d=>out+=d.toString()); child.stderr.on('data',d=>out+=d.toString());

  for(let i=0;i<30;i++){
    try{ const r=await fetch(`http://127.0.0.1:${BRIDGE_PORT}/status`); if(r.ok) break; }catch{}
    await new Promise(r=>setTimeout(r,100));
  }

  await post(payload(599));
  await post(payload(601,{kills:1,deaths:1,assists:1,lastHits:1,denies:1,killStreak:1,items:['item_boots']}));
  await post(payload(899,{kills:5,deaths:1,assists:15,lastHits:50,denies:3,killStreak:3,gold:1600,gpm:260,xpm:310,level:8,items:['item_boots','item_blink','item_dust','item_smoke_of_deceit']}));
  await post(payload(901,{kills:5,deaths:1,assists:15,lastHits:50,denies:3,killStreak:3,gold:1600,gpm:260,xpm:310,level:8,items:['item_boots','item_blink','item_dust','item_smoke_of_deceit']}));
  await post(payload(910,{kills:5,deaths:1,assists:15,lastHits:50,denies:3,killStreak:3,gold:1600,gpm:260,xpm:310,level:8,hp:10,items:['item_boots','item_blink','item_dust','item_smoke_of_deceit']}));
  await post(payload(926,{kills:5,deaths:1,assists:15,lastHits:50,denies:3,killStreak:3,gold:1600,gpm:260,xpm:310,level:8,hp:10,items:['item_boots','item_blink','item_dust','item_smoke_of_deceit']}));
  await post(payload(960,{kills:5,deaths:1,assists:15,lastHits:50,denies:3,killStreak:3,gold:1600,gpm:260,xpm:310,level:8,hp:80,items:['item_boots','item_blink','item_dust','item_smoke_of_deceit']}));
  await new Promise(r=>setTimeout(r,500));

  const status=await (await fetch(`http://127.0.0.1:${BRIDGE_PORT}/status`)).json();
  assert('Bridge v1.2+', /^1\.[2-9]|^[2-9]\./.test(status.bridgeVersion), status.bridgeVersion);
  assert('Protocolo v2', status.eventProtocolVersion===2 && status.protocolCompatible===true);
  assert('GSI recibido', status.gsiPayloadCount===7, `${status.gsiPayloadCount} payloads`);
  assert('KIKE_KILL con telemetria v5', received.some(e=>e.type==='KIKE_KILL'&&e.kills===5&&e.assists===15&&e.gpm===260&&e.heroName==='npc_dota_hero_hoodwink'));
  assert('Heroe detectado antes de generar estratega', received.some(e=>e.type==='HERO_SELECTED'&&e.heroName==='npc_dota_hero_hoodwink'));
  assert('ITEM_ACQUIRED', received.some(e=>e.type==='ITEM_ACQUIRED'&&e.item==='item_blink'));
  assert('MATCH_TICK por stats', received.some(e=>e.type==='MATCH_TICK'&&e.reason==='stats_change'&&e.clock===899));
  assert('MATCH_TICK al cruzar min 15', received.some(e=>e.type==='MATCH_TICK'&&e.reason==='rule_deadline'&&e.clock===901));
  assert('Dust medible por compra', received.some(e=>e.type==='ITEM_ACQUIRED'&&e.item==='item_dust'&&e.clock===899));
  assert('Smoke medible por compra', received.some(e=>e.type==='ITEM_ACQUIRED'&&e.item==='item_smoke_of_deceit'&&e.clock===899));
  assert('Ventana multikill emitida', received.some(e=>e.type==='MULTIKILL_WINDOW'&&e.threeWindowSeconds===0));
  assert('HP bajo sostenido emitido', received.some(e=>e.type==='LOW_HP_15_FOR_15S'&&e.durationSeconds>=15));
  assert('Recuperacion HP emitida', received.some(e=>e.type==='HP_RECOVERED_FROM_25'&&e.recoverySeconds<=120));

  const e899={type:'MATCH_TICK',clock:899,kills:5,deaths:1,assists:10,lastHits:50,denies:3,killStreak:3};
  const e901={...e899,clock:901};
  assert('5 kills antes de 15', matchesRule('KILLS_5_BY_15',e899)===true);
  assert('5 kills despues de 15 no cuenta', matchesRule('KILLS_5_BY_15',e901)===false);
  assert('10 assists antes de 20', matchesRule('ASSISTS_10_BY_20',e899)===true);
  assert('50 LH antes de 20', matchesRule('LH_50_BY_20',e899)===true);
  assert('3 denies antes de 15', matchesRule('DENIES_3_BY_15',e899)===true);
  assert('Supervivencia no marca antes de 15', matchesRule('SURVIVE_MAX1D_AT_15',e899)===false);
  assert('Supervivencia marca al min 15', matchesRule('SURVIVE_MAX1D_AT_15',e901)===true);
  assert('Combo tiempo+stats', matchesRule('COMBO_3K_10A_BY_25',e899)===true);
  assert('Compra con deadline', matchesRule('ITEM_BLINK',{type:'ITEM_ACQUIRED',item:'item_blink',clock:899})===true);
  const v5={...e901,gold:1600,gpm:260,xpm:310,level:20,alive:true,radiantScore:45,direScore:40,kikeTeam:'team2'};
  assert('GPM al minuto 15', matchesRule('GPM_250_AT_15',v5)===true);
  assert('XPM al minuto 15', matchesRule('XPM_300_AT_15',v5)===true);
  assert('Oro antes del minuto 20', matchesRule('GOLD_1500_BY_20',v5)===true);
  assert('Nivel 20 sin deadline', matchesRule('LEVEL_20_TOTAL',v5)===true);
  assert('Double kill por ventana', matchesRule('DOUBLE_KILL_15S',{type:'MULTIKILL_WINDOW',twoWindowSeconds:12})===true);
  assert('Triple kill por ventana', matchesRule('TRIPLE_KILL_30S',{type:'MULTIKILL_WINDOW',threeWindowSeconds:25})===true);
  assert('Dust antes de 15', matchesRule('DUST_BY_15',{type:'ITEM_ACQUIRED',item:'item_dust',clock:899})===true);
  assert('Smoke antes de 20', matchesRule('SMOKE_BY_20',{type:'ITEM_ACQUIRED',item:'item_smoke_of_deceit',clock:1100})===true);
  const final={type:'GAME_FINISHED',clock:2500,kills:5,deaths:4,assists:20,lastHits:80,denies:5,killStreak:0,gold:100,gpm:300,xpm:400,level:22,alive:true,radiantScore:45,direScore:40,kikeTeam:'team2'};
  assert('Duracion larga al finalizar', matchesRule('MATCH_LASTS_40',final)===true);
  assert('80 kills totales al finalizar', matchesRule('MATCH_80_KILLS_TOTAL',final)===true);
  assert('40 kills del equipo', matchesRule('TEAM_40_KILLS_TOTAL',final)===true);
  assert('Vivo al final', matchesRule('ALIVE_AT_END',final)===true);
  assert('Victoria no esta en reglas nuevas', matchesRule('KIKE_WINS',final)===false);

  child.kill('SIGINT'); mock.close(); if(madeTestConfig)fs.unlinkSync(configPath);
  console.log('-----------------------------------------------');
  console.log(`${passed}/${passed+failed} TESTS PASSED`);
  console.log(failed===0?'READY FOR STREAM':'SELF-TEST FAILED');
  if(failed) process.exitCode=1;
}

main().catch(err=>{ console.error(err); try{mock.close()}catch{}; process.exitCode=1; });
