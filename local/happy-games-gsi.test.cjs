const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {GsiCollector,modeOf,metricsOf,sourceEventClock}=require('./happy-games-gsi.cjs');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'happy-gsi-test-'));
const packet=(clock=120,id='1234567890')=>({provider:{name:'Dota 2'},map:{matchid:id,clock_time:clock},
  player:{activity:'playing',team_name:'radiant',kills:0,deaths:0,gold:0},hero:{name:'npc_dota_hero_hoodwink',level:5},
  items:{slot0:{name:'item_ward_observer',charges:2}},abilities:{ability0:{name:'hoodwink_acorn_shot',level:1,cooldown:0}}});
const kill=(time=115)=>({event_type:'generic_event',game_time:116,data:JSON.stringify({type:'CHAT_MESSAGE_HERO_KILL',playerid1:7,playerid2:2,time})});

test('missing metrics stay null, actual zero is preserved',()=>{
  const m=metricsOf({gold:0,wards_placed:0,gpm:undefined,net_worth:null});
  assert.equal(m.gold,0);assert.equal(m.wardsPlaced,0);assert.equal(m.netWorth,null);assert.equal(m.gpm,null);
});
test('all blocks, unknown fields and arrays captured, secrets removed',()=>{
  const dir=temp(),c=new GsiCollector({dir});const d=packet();
  d.auth={token:'secret-test-value'};d.futureBlock={list:[{newValue:4}]};d.minimap={minimap42:{xpos:3}};
  c.process(d);c.close();
  assert.ok(c.fields.fields['futureBlock.list[].newValue']);
  assert.ok(c.fields.fields['minimap.minimap*.xpos']);
  const files=fs.readdirSync(path.join(dir,'raw'));
  const raw=zlib.gunzipSync(fs.readFileSync(path.join(dir,'raw',files[0]))).toString();
  assert.ok(raw.includes('futureBlock'));assert.ok(!raw.includes('secret-test-value'));
  assert.equal(c.latest.inventory[0].charges,2);assert.equal(c.latest.inventory[0].purchasedQuantity,null);
});
test('minimap entity IDs share field shapes while namespaces and original payloads survive',()=>{
  const dir=temp(),c=new GsiCollector({dir});
  const withEntities=(first,clock)=>{
    const d=packet(clock);
    d.minimap={
      ['o'+first]:{xpos:3,futureValue:null,nested:{o9:{value:1}},list:[{o8:{value:2}}]},
      ['o'+(first+1)]:{xpos:5,futureValue:17},minimap42:{xpos:7},otherName:{o7:{value:3}}};
    d.added={minimap:{['o'+(first+2)]:{xpos:11}}};
    d.previously={minimap:{['o'+(first+3)]:{xpos:null}}};
    d.futureBlock={o0:{value:4},list:[{o1:{value:5}}],minimap:[{o6:{value:6}}]};
    return d;
  };
  const first=withEntities(0,120),originalFirst=JSON.stringify(first);
  c.process(first);const pathsAfterFirst=c.status().fieldPaths;
  const second=withEntities(400,121),originalSecond=JSON.stringify(second);
  c.process(second);c.close();
  assert.equal(c.status().fieldPaths,pathsAfterFirst);
  assert.equal(c.fields.fields['minimap.o*'].observations,4);
  assert.equal(c.fields.fields['minimap.o*.futureValue'].observations,4);
  assert.equal(c.fields.fields['minimap.o*.futureValue'].nonNullObservations,2);
  assert.deepEqual(c.fields.fields['minimap.o*.futureValue'].types,['null','number']);
  assert.equal(c.fields.fields['added.minimap.o*.xpos'].observations,2);
  assert.equal(c.fields.fields['previously.minimap.o*.xpos'].nonNullObservations,0);
  for(const field of ['minimap.minimap*.xpos','minimap.o*.nested.o9.value',
    'minimap.o*.list[].o8.value','minimap.otherName.o7.value','futureBlock.o0.value',
    'futureBlock.list[].o1.value','futureBlock.minimap[].o6.value']) assert.ok(c.fields.fields[field],field);
  assert.ok(!Object.keys(c.fields.fields).some(field=>/(^|\.)minimap\.o\d+(\.|$)/.test(field)));
  assert.equal(JSON.stringify(first),originalFirst);assert.equal(JSON.stringify(second),originalSecond);
  assert.equal(c.latest.blocks.minimap.o400.futureValue,null);
  const raw=fs.readdirSync(path.join(dir,'raw')).flatMap(file=>zlib.gunzipSync(
    fs.readFileSync(path.join(dir,'raw',file))).toString().trim().split('\n').map(JSON.parse));
  assert.deepEqual(raw.map(record=>record.payload),[first,second]);
});
test('legacy minimap catalog compacts on restart without losing observations or merging namespaces',()=>{
  const dir=temp(),file=path.join(dir,'happy-games-gsi-fields.json');
  const entry=(observations,nonNullObservations,firstSeenAt,lastSeenAt,types,modes)=>({
    observations,nonNullObservations,firstSeenAt,lastSeenAt,types,modes});
  const at=day=>'2026-10-0'+day+'T12:00:00.000Z';
  const legacy={schemaVersion:2,blocks:{minimap:{observations:6,modes:['player']}},fields:{
    'minimap.o0':entry(2,2,at(2),at(4),['object'],['player']),
    'minimap.o7':entry(3,3,at(1),at(3),['object'],['spectator']),
    'minimap.o*':entry(1,1,at(3),at(5),['object'],['perspective']),
    'minimap.o0.xpos':entry(2,2,at(2),at(4),['number'],['player']),
    'minimap.o7.xpos':entry(3,0,at(1),at(3),['null'],['spectator']),
    'minimap.o*.xpos':entry(1,1,at(3),at(5),['number'],['perspective']),
    'added.minimap.o5.xpos':entry(4,4,at(2),at(3),['number'],['player']),
    'added.minimap.o9.xpos':entry(2,0,at(1),at(4),['null'],['perspective']),
    'previously.minimap.o4.xpos':entry(5,5,at(2),at(4),['number'],['spectator']),
    'minimap.o1.nested.o2':entry(2,2,at(2),at(3),['object'],['player']),
    'futureBlock.o1.xpos':entry(7,7,at(1),at(5),['number'],['unknown']),
    'futureBlock.minimap[].o6.xpos':entry(8,8,at(1),at(5),['number'],['unknown'])}};
  fs.writeFileSync(file,JSON.stringify(legacy));
  let c=new GsiCollector({dir});
  assert.deepEqual(c.fields.fields['minimap.o*'],entry(6,6,at(1),at(5),
    ['object'],['player','spectator','perspective']));
  assert.deepEqual(c.fields.fields['minimap.o*.xpos'],entry(6,3,at(1),at(5),
    ['number','null'],['player','spectator','perspective']));
  assert.deepEqual(c.fields.fields['added.minimap.o*.xpos'],entry(6,4,at(1),at(4),
    ['number','null'],['player','perspective']));
  assert.deepEqual(c.fields.fields['previously.minimap.o*.xpos'],legacy.fields['previously.minimap.o4.xpos']);
  assert.deepEqual(c.fields.fields['minimap.o*.nested.o2'],legacy.fields['minimap.o1.nested.o2']);
  for(const field of ['futureBlock.o1.xpos','futureBlock.minimap[].o6.xpos'])
    assert.deepEqual(c.fields.fields[field],legacy.fields[field]);
  for(const counter of ['observations','nonNullObservations']) assert.equal(
    Object.values(c.fields.fields).reduce((sum,f)=>sum+f[counter],0),
    Object.values(legacy.fields).reduce((sum,f)=>sum+f[counter],0));
  assert.deepEqual({...c.fields.blocks},legacy.blocks);
  c.close();const compact=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(Object.keys(compact.fields).length,7);
  c=new GsiCollector({dir,now:()=>Date.parse(at(6))});
  assert.deepEqual({...c.fields.fields},compact.fields);
  const d=packet();d.minimap={o900:{xpos:42}};c.process(d);c.close();
  assert.equal(c.fields.fields['minimap.o*'].observations,7);
  assert.equal(c.fields.fields['minimap.o*.xpos'].observations,7);
  assert.equal(c.fields.fields['minimap.o*.xpos'].nonNullObservations,4);
  assert.equal(c.fields.fields['minimap.o*.xpos'].firstSeenAt,at(1));
  assert.equal(c.fields.fields['minimap.o*.xpos'].lastSeenAt,at(6));
});
test('hero kill source clock retained and repeated pairs counted without skill attribution',()=>{
  const c=new GsiCollector({dir:temp()});const d=packet();d.events=[kill()];
  const r=c.process(d).records[0];assert.equal(r.clock,115);assert.equal(r.receivedClock,120);
  assert.equal(r.killerPlayerId,2);assert.equal(r.victimPlayerId,7);assert.equal(r.byAbility,null);
  const e=packet(200);e.events=[kill(195)];assert.equal(c.process(e).records[0].samePairCount,2);c.close();
});
test('dedup survives restart and JSON key order, wrapper receipt times',()=>{
  const dir=temp();let c=new GsiCollector({dir});const d=packet();d.events=[kill()];
  assert.equal(c.process(d).directEvents.length,1);assert.equal(c.process(d).directEvents.length,0);c.close();
  c=new GsiCollector({dir});const e=packet(125);e.events=[{event_type:'generic_event',game_time:124,
    data:JSON.stringify({time:115,playerid2:2,playerid1:7,type:'CHAT_MESSAGE_HERO_KILL'})}];
  assert.equal(c.process(e).directEvents.length,0);c.close();
});
test('dedup resets for a new match but not replay rewind in same known match',()=>{
  const c=new GsiCollector({dir:temp()});let d=packet(500);d.events=[kill()];c.process(d);
  d=packet(10);d.events=[kill()];assert.equal(c.process(d).directEvents.length,0);
  d=packet(10,'1234567891');d.events=[kill()];assert.equal(c.process(d).directEvents.length,1);c.close();
});
test('observer roster resolves hero by explicit slot and authoritative team',()=>{
  const c=new GsiCollector({dir:temp()});const d={map:{matchid:'1234567890',clock_time:120},
    player:{team2:{player7:{team_name:'radiant',kills:0}},team3:{player2:{team_name:'dire',kills:1}}},
    hero:{team2:{player7:{name:'npc_dota_hero_lion'}},team3:{player2:{name:'npc_dota_hero_hoodwink'}}},events:[kill()]};
  const result=c.process(d);assert.equal(result.context.mode,'spectator');
  assert.equal(result.records[0].killerTeam,'dire');assert.equal(result.records[0].victimHero,'npc_dota_hero_lion');
  assert.equal(result.state.localPlayer,null);c.close();
});
test('other-person flat perspective is not own gameplay',()=>{
  const d=packet();d.provider.steamid='1';d.player.steamid='2';assert.equal(modeOf(d),'perspective');
});
test('unmapped and malformed direct events remain stored',()=>{
  const c=new GsiCollector({dir:temp()});const d=packet();d.events=[{event_type:'generic_event',data:'{broken'},
    {event_type:'generic_event',data:{type:'CHAT_MESSAGE_ITEM_PURCHASE',value:42,time:119}}];
  const r=c.process(d);assert.equal(r.records.length,2);assert.equal(r.records[1].interpretation,'unmapped');c.close();
});
test('missing-to-known counter is baseline, later changes record real delta',()=>{
  const c=new GsiCollector({dir:temp()});c.process(packet());const d=packet(121);d.player.wards_placed=1;
  assert.equal(c.process(d).records.filter(e=>e.metric==='wardsPlaced').length,0);
  d.player.wards_placed=2;const r=c.process(d).records.find(e=>e.metric==='wardsPlaced');assert.equal(r.delta,1);c.close();
});
test('raw disk cap is visible while latest state continues updating',()=>{
  const c=new GsiCollector({dir:temp(),maxRawBytes:1});c.process(packet());
  assert.equal(c.status().rawSkipped,1);assert.equal(c.latest.localPlayer.metrics.gold,0);c.close();
});
test('concatenated gzip members preserve every payload',()=>{
  const dir=temp(),c=new GsiCollector({dir});c.process(packet(120));c.process(packet(121));c.close();
  const f=fs.readdirSync(path.join(dir,'raw'))[0];const lines=zlib.gunzipSync(fs.readFileSync(path.join(dir,'raw',f))).toString().trim().split('\n');
  assert.equal(lines.length,2);assert.equal(JSON.parse(lines[1]).clock,121);
});

test('native engine clocks calibrate to match time and never fabricate missing offsets',()=>{
  const e={event_type:'roshan_killed',game_time:2336,killer_player_id:3,killed_by_team:'radiant'};
  const c=new GsiCollector({dir:temp()});const d=packet(2087);d.map.game_time=2336;d.events=[e];
  const r=c.process(d).records[0];assert.equal(r.clock,2087);assert.equal(r.sourceClock,2336);
  assert.equal(r.clockSource,'event.game_time-minus-map-offset');assert.equal(r.type,'ROSHAN_KILLED_DETAIL');
  // Offset drift must not cause a repeated engine event to count twice.
  d.map.clock_time=2090;assert.equal(c.process(d).directEvents.length,0);c.close();
  assert.equal(sourceEventClock(e,null).clock,null);
  assert.equal(sourceEventClock(e,null).sourceClock,2336);
  assert.equal(sourceEventClock({game_time:999},{time:-15},{game_time:1000,clock_time:0}).clock,-15);
});
test('own identity ignores player_slot, resolves two KDA observations and backfills earlier ward counters',()=>{
  const dir=temp();let now=1000000,c=new GsiCollector({dir,now:()=>now});
  const d=packet(0);d.player.player_slot=7;
  const purchase={event_type:'generic_event',data:{type:'CHAT_MESSAGE_ITEM_PURCHASE',playerid1:2,value:43,time:-15}};
  const generic=(type,id,time)=>({event_type:'generic_event',data:{type,playerid1:id,playerid2:3,time}});
  d.events=[purchase,generic('CHAT_MESSAGE_OBSERVER_WARD_KILLED',2,-1)];
  const start=c.process(d).state;assert.equal(start.localPlayer.playerId,null);assert.equal(start.liveEventMetrics,null);
  now+=100;const first=packet(10);first.player.player_slot=7;first.player.kills=1;first.events=[kill(10)];
  assert.equal(c.process(first).state.localPlayer.playerId,null);
  now+=100;const second=packet(20);second.player.kills=2;second.player.player_slot=7;second.events=[kill(20)];
  const resolved=c.process(second);assert.equal(resolved.state.localPlayer.playerId,2);
  assert.equal(resolved.state.localIdentity.evidence,2);
  assert.equal(resolved.records.find(r=>r.type==='HERO_KILL_DETAIL').killerHero,'npc_dota_hero_hoodwink');
  assert.equal(resolved.records.find(r=>r.metric==='kills').playerId,2);
  assert.equal(resolved.state.liveEventMetrics.observedCounts.sentryWardsPurchased,1);
  assert.equal(resolved.state.liveEventMetrics.observedCounts.observerWardsDestroyed,1);
  const snapshot=resolved.state.liveEventMetrics;c.close();
  c=new GsiCollector({dir,now:()=>now});second.events=[purchase];
  const afterRestart=c.process(second).state;assert.equal(afterRestart.localPlayer.playerId,2);
  assert.equal(afterRestart.liveEventMetrics.observedCounts.sentryWardsPurchased,1);
  now+=100;second.events=[{...purchase,data:{...purchase.data,time:21}}];c.process(second);c.close();
  assert.equal(snapshot.observedCounts.sentryWardsPurchased,1);
});
test('short counter delay resolves; ambiguous kills and contradicting identities fail closed',()=>{
  let now=1000000;const c=new GsiCollector({dir:temp(),now:()=>now});c.process(packet());
  now+=100;const first=packet(121);first.player.deaths=1;first.events=[{event_type:'generic_event',
    data:{type:'CHAT_MESSAGE_HERO_KILL',playerid1:3,playerid2:6,time:121}}];c.process(first);
  now+=100;const event=packet(122);event.player.deaths=1;event.events=[{event_type:'generic_event',
    data:{type:'CHAT_MESSAGE_HERO_KILL',playerid1:3,playerid2:8,time:122}}];c.process(event);
  now+=266;const delayed=packet(122);delayed.player.deaths=2;
  assert.equal(c.process(delayed).state.localPlayer.playerId,3);
  now+=1000;const ambiguous=packet(123);ambiguous.player.deaths=3;
  ambiguous.events=[kill(123),{event_type:'generic_event',data:{type:'CHAT_MESSAGE_HERO_KILL',playerid1:3,playerid2:8,time:123}}];
  assert.equal(c.process(ambiguous).state.localIdentity.evidence,2);
  now+=1000;const contradiction=packet(124);contradiction.player.deaths=4;contradiction.events=[kill(124)];
  const result=c.process(contradiction).state;assert.equal(result.localIdentity.conflicted,true);
  assert.equal(result.localPlayer.playerId,null);assert.equal(result.liveEventMetrics,null);c.close();
});
test('ward events have their own actor order and unknown purchases or placements stay unmapped',()=>{
  const c=new GsiCollector({dir:temp()});const d=packet();d.player.playerid=3;
  const message=(type,p1,p2,value,time)=>({event_type:'generic_event',data:{type,playerid1:p1,playerid2:p2,value,time}});
  d.events=[message('CHAT_MESSAGE_SENTRY_WARD_KILLED',3,8,0,119),
    message('CHAT_MESSAGE_OBSERVER_WARD_KILLED',8,3,100,119),
    message('CHAT_MESSAGE_ITEM_PURCHASE',3,-1,42,119),message('CHAT_MESSAGE_ITEM_PURCHASE',3,-1,16,119),
    message('CHAT_MESSAGE_SMOKE_ACTIVATED',3,-1,0,119),message('CHAT_MESSAGE_BUYBACK',3,-1,0,119)];
  const {records,state}=c.process(d);const counters=state.liveEventMetrics.observedCounts;
  assert.equal(counters.sentryWardsDestroyed,1);assert.equal(counters.observerWardsDestroyed,0);
  assert.equal(counters.observerWardsPurchased,1);assert.equal(counters.smokeActivations,1);assert.equal(counters.buybacks,1);
  assert.equal(records[0].actorPlayerId,3);assert.equal(records[0].actorIsLocal,true);
  assert.equal(records[3].interpretation,'unmapped');assert.ok(!('wardsPlaced' in counters));
  assert.equal(c.process(d).directEvents.length,0);c.close();
});
test('explicit identity cannot silently revive an older inferred candidate',()=>{
  const c=new GsiCollector({dir:temp()});c.process(packet());
  for(const k of [1,2]){const p=packet(120+k);p.player.kills=k;p.events=[kill(120+k)];c.process(p);}
  assert.equal(c.latest.localPlayer.playerId,2);
  const explicit=packet(123);explicit.player.kills=2;explicit.player.playerid=3;
  assert.equal(c.process(explicit).state.localIdentity.conflicted,true);
  delete explicit.player.playerid;const closed=c.process(explicit).state;
  assert.equal(closed.localPlayer.playerId,null);assert.equal(closed.liveEventMetrics,null);
  const newMatch=packet(0,'1234567891');newMatch.player.playerid=3;
  assert.equal(c.process(newMatch).state.localPlayer.playerId,3);
  delete newMatch.player.playerid;assert.equal(c.process(newMatch).state.localPlayer.playerId,3);c.close();
});
test('spectator counters never leak into player metrics and empty player has no fictional roster row',()=>{
  const c=new GsiCollector({dir:temp()});const d={map:{matchid:'1234567890',clock_time:120},
    player:{team2:{player3:{team_name:'radiant',kills:0}}},hero:{team2:{player3:{name:'npc_dota_hero_crystal_maiden'}}},
    events:[{event_type:'generic_event',data:{type:'CHAT_MESSAGE_ITEM_PURCHASE',playerid1:3,value:42,time:119}}]};
  assert.equal(c.process(d).state.liveEventMetrics,null);
  const p=packet(121);p.player.playerid=3;const state=c.process(p).state;
  assert.equal(state.liveEventMetrics.observedCounts.observerWardsPurchased,0);
  p.player={};p.hero={};const empty=c.process(p).state;assert.equal(empty.localPlayer,null);assert.deepEqual(empty.players,[]);c.close();
});
