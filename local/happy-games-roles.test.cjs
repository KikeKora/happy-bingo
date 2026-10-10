const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {RoleTracker}=require('./happy-games-roles.cjs');
const {GsiCollector}=require('./happy-games-gsi.cjs');
const packet=(id,clock=0,winner='none')=>({map:{matchid:id,clock_time:clock,win_team:winner},player:{activity:'playing'},hero:{name:'npc_dota_hero_hoodwink'}});
const create=()=>new RoleTracker(fs.mkdtempSync(path.join(os.tmpdir(),'happy-role-test-')));
test('next role is consumed once; each new match defaults unknown, hero never implies role',()=>{
 const r=create();r.choose({role:'carry',matchMode:'normal',target:'next'});r.observe(packet('1001'));
 assert.equal(r.assignment().role,'carry');assert.equal(r.status().nextRole,null);
 r.observe(packet('1002'));assert.equal(r.assignment().role,'unknown');
});
test('manual correction persists through restart and tags GSI without changing native payload',()=>{
 const r=create();const data=packet('1001',300);r.observe(data);
 r.choose({role:'offlane',matchMode:'normal',target:'current',matchId:'1001'});
 const restored=new RoleTracker(r.dir);assert.equal(restored.assignment().role,'offlane');
 const c=new GsiCollector({dir:path.join(r.dir,'capture'),roleProvider:id=>restored.assignment(id)});
 c.process(data);assert.equal(c.latest.role,'offlane');assert.equal(c.latest.blocks.role,undefined);c.close();
});
test('late confirmation labels the complete research record; unknown and partial captures excluded',()=>{
 const r=create();r.observe(packet('1001'));
 let tagged=r.record({id:'1001',firstClock:0,durationSeconds:1800,validForBalance:true});assert.equal(tagged.validForRoleBalance,false);
 r.choose({role:'mid',matchMode:'normal',target:'current',matchId:'1001'});
 tagged=r.record({id:'1001',firstClock:0,durationSeconds:1801,validForBalance:true});assert.equal(tagged.validForRoleBalance,true);
 assert.equal(r.export().byRole.mid.length,1);assert.equal(r.export().byRole.unknown.length,0);
 tagged=r.record({id:'1001',firstClock:900,durationSeconds:1802,validForBalance:true});assert.equal(tagged.validForRoleBalance,false);
});
test('old-match UI, unsupported roles and postgame selection cannot change current match',()=>{
 const r=create();r.observe(packet('1001'));
 assert.throws(()=>r.choose({role:'support4',matchMode:'normal',target:'current',matchId:'9999'}),/partida cambió/);
 assert.throws(()=>r.choose({role:'jungle',matchMode:'normal',target:'next'}),/cinco roles/);
 r.observe(packet('1001',1800,'radiant'));assert.throws(()=>r.choose({role:'carry',matchMode:'normal',target:'current',matchId:'1001'}),/terminó/);
 r.choose({role:'support5',matchMode:'normal',target:'next'});r.observe(packet('1001',1801,'radiant'));assert.equal(r.status().nextRole,'support5');
 r.observe(packet('1002',-60));assert.equal(r.assignment().role,'support5');
});
test('Turbo stays archived but is excluded from normal balance and per-role training',()=>{
 const r=create();r.choose({role:'support4',matchMode:'turbo',target:'next'});r.observe(packet('2001'));
 const m=r.record({id:'2001',firstClock:0,durationSeconds:1800,validForBalance:true});
 assert.equal(m.matchMode,'turbo');assert.equal(m.captureValidForBalance,true);assert.equal(m.validForBalance,false);assert.equal(m.validForRoleBalance,false);
 assert.equal(r.export().turboMatches.length,1);assert.equal(r.export().normalBalanceMatches.length,0);assert.equal(r.export().byRole.support4.length,0);
 r.observe(packet('2002'));assert.equal(r.assignment().matchMode,'unknown');
});
test('omitted modality is unconfirmed and never silently assumed normal',()=>{
 const r=create();r.choose({role:'carry',target:'next'});r.observe(packet('3001'));
 const m=r.record({id:'3001',firstClock:0,durationSeconds:1800,validForBalance:true});
 assert.equal(m.matchMode,'unknown');assert.equal(m.validForBalance,false);assert.equal(r.export().unconfirmedMatches.length,1);
 assert.throws(()=>r.choose({role:'carry',matchMode:'ranked-ish',target:'next'}),/Normal o Turbo/);
});
test('retroactive Turbo correction excludes an already saved match and persists separately',()=>{
 const r=create();r.choose({role:'mid',matchMode:'normal',target:'next'});r.observe(packet('4001'));
 r.record({id:'4001',firstClock:0,durationSeconds:1800,validForBalance:true});assert.equal(r.export().normalBalanceMatches.length,1);
 r.correctMode('4001','turbo');assert.equal(r.export().normalBalanceMatches.length,0);
 assert.equal(new RoleTracker(r.dir).export().turboMatches.length,1);
});
