import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesRule,RULE_MAP,BingoRoom,ruleFeasibleForLate} from '../src/worker.js';

const evidence=(counts,scope='local')=>({type:'MATCH_TICK',telemetrySource:'dota-gsi',telemetryMode:'player',
 [scope==='local'?'liveEventMetrics':'matchEventMetrics']:{source:'deduplicated-gsi-direct-events',observedCounts:counts}});
test('all new rules score only verified player counters, never inventory or absent data',()=>{
 const rules=Object.values(RULE_MAP).filter(r=>r.counter);
 assert.equal(rules.length,15);
 for(const r of rules){
  const counts=r.counter==='wardsDestroyedTotal'?{observerWardsDestroyed:3,sentryWardsDestroyed:3}:{[r.counter]:r.threshold};
  const e=evidence(counts,r.liveCounterScope);
  assert.equal(matchesRule(r.id,e),true,r.id);
  assert.equal(matchesRule(r.id,{...e,telemetryMode:'spectator'}),false,r.id+' spectator');
  assert.equal(matchesRule(r.id,{type:'ITEM_ACQUIRED',item:'item_ward_observer'}),false);
  assert.equal(matchesRule(r.id,evidence({},r.liveCounterScope)),false);
  assert.equal(matchesRule(r.id,evidence({[r.counter]:null},r.liveCounterScope)),false);
  const low=r.counter==='wardsDestroyedTotal'?{observerWardsDestroyed:2,sentryWardsDestroyed:3}:{[r.counter]:r.threshold-1};
  assert.equal(matchesRule(r.id,evidence(low,r.liveCounterScope)),false);
 }
 assert.equal(matchesRule('DEWARD_TOTAL_6',evidence({observerWardsDestroyed:6})),false);
 assert.equal(matchesRule('ROSHAN_1',evidence({roshanDeaths:1})),false,'own counter cannot score global objective');
});
function room(meta={}){
 const r=Object.create(BingoRoom.prototype);
 r.meta={round:1,gameStatus:'waiting',...meta};r.persistMeta=async()=>{};r.broadcastPublicState=()=>{};
 r.adminAction=async()=>{r.resetCount=(r.resetCount||0)+1;r.meta.gameStatus='waiting';return new Response('{}');};
 return r;
}
const start=(r,id,clock)=>r.applyEvent(new Request('https://local',{method:'POST',body:JSON.stringify({type:'MATCH_DETECTED',matchId:id,clock})}));
test('earliest match signal works without hero, and repeats/restarts cannot announce twice',async()=>{
 const r=room();await start(r,'9039990001',-60);
 assert.equal(r.meta.registrationOpen,true);assert.equal(r.meta.matchStartAnnouncement.id,'9039990001');
 const first=r.meta.matchStartAnnouncement;
 await start(r,'9039990001',0);assert.equal(r.meta.matchStartAnnouncement,first);assert.equal(r.resetCount,undefined);
 await start(r,'9039990002',-10);assert.equal(r.resetCount,1);assert.equal(r.meta.matchStartAnnouncement.id,'9039990002');
});
test('late bridge restarts and invalid IDs do not announce a new game',async()=>{
 const r=room();await start(r,'9039990001',1500);assert.equal(r.meta.matchStartAnnouncement,null);
 await start(r,'9039990001',0);assert.equal(r.meta.matchStartAnnouncement,null);
 const invalid=room();await start(invalid,'0',0);assert.equal(invalid.meta.currentMatchId,undefined);
});
test('failed point consolidation prevents automatic reset and start advertisement',async()=>{
 const r=room({gameStatus:'finished'});r.adminAction=async()=>new Response('{}',{status:500});
 assert.equal((await start(r,'9039990001',0)).status,500);assert.equal(r.meta.currentMatchId,undefined);
});
test('Sprint and Swap only offer future thresholds with resolved telemetry',()=>{
 const rule=RULE_MAP.OBS_WARDS_12;
 assert.equal(ruleFeasibleForLate(rule,{gameClock:1500}),false);
 assert.equal(ruleFeasibleForLate(rule,{currentStats:evidence({observerWardsPurchased:12})}),false);
 assert.equal(ruleFeasibleForLate(rule,{currentStats:evidence({observerWardsPurchased:11})}),true);
 assert.equal(ruleFeasibleForLate(rule,{currentStats:evidence({observerWardsPurchased:11}),completedRuleIds:[rule.id]}),false);
});
