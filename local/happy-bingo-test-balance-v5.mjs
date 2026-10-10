import {randomCard,itemAllowedForContext,RULE_MAP} from '../src/worker.js';

let passed=0;
function assert(condition,message){if(!condition)throw new Error(message);passed++;}
const combat=new Set(['combat','kda','support','combo','participation','deaths','survival','multikill']);
const contexts=[
  {mode:'blind'},
  {mode:'strategist',heroName:'npc_dota_hero_hoodwink'},
  {mode:'strategist',heroName:'npc_dota_hero_venomancer'}
];

for(const context of contexts){
  const cards=[];
  for(let i=0;i<100;i++){
    const card=randomCard(cards.slice(-20),context);
    const rules=card.filter(id=>id!=='FREE').map(id=>RULE_MAP[id]);
    assert(card.length===25&&card[12]==='FREE','Tarjeta invalida');
    assert(new Set(card).size===25,'Reglas duplicadas');
    assert(!card.includes('KIKE_WINS'),'KIKE_WINS no puede aparecer');
    assert(rules.filter(r=>r.category==='items').length===3,'Debe haber 3 items');
    assert(rules.filter(r=>combat.has(r.category)).length<=3,'Demasiadas casillas de combate');
    assert(rules.filter(r=>/\bantes del\b|\bal minuto\b|\bal min\b/i.test(r.label)).length<=10,'Demasiados deadlines');
    assert(rules.filter(r=>r.category==='items').every(r=>itemAllowedForContext(r,context)),'Item incompatible con heroe');
    for(const category of ['vision','utility','deward','exploration','objectives'])assert(rules.some(r=>r.category===category&&r.counter),'Falta categoria nueva '+category);
    cards.push(card);
  }
}

assert(itemAllowedForContext(RULE_MAP.ITEM_SHEEPSTICK,{mode:'strategist',heroName:'hoodwink'})===true,'Scythe debe ser valida para Hoodwink');
assert(itemAllowedForContext(RULE_MAP.ITEM_SHEEPSTICK,{mode:'strategist',heroName:'venomancer'})===false,'Scythe debe quedar fuera para Venomancer');
console.log(`${passed}/${passed} TESTS PASSED · 300 tarjetas v6`);
