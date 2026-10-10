const fs=require('node:fs'),path=require('node:path');
const ROLES={carry:'Carry · posición 1',mid:'Mid · posición 2',offlane:'Offlane · posición 3',support4:'Support · posición 4',support5:'Hard support · posición 5'};
class RoleTracker{
 constructor(dir){this.dir=dir;fs.mkdirSync(dir,{recursive:true});this.file=path.join(dir,'happy-games-role-state.json');this.matchesFile=path.join(dir,'happy-games-role-matches.jsonl');try{this.state=JSON.parse(fs.readFileSync(this.file));}catch{this.state={schemaVersion:1,currentMatchId:null,nextRole:null,matches:{}};}this.state.matches ||= {};this.modeOverridesFile=path.join(dir,'happy-games-match-modes.json');try{this.modeOverrides=JSON.parse(fs.readFileSync(this.modeOverridesFile));}catch{this.modeOverrides={};}}
 save(){const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.state,null,2));fs.renameSync(tmp,this.file);}
 observe(data){
  const id=String(data?.map?.matchid ?? data?.map?.match_id ?? '');if(!/^[1-9]\d+$/.test(id))return;
  const ended=!!data?.map?.win_team&&data.map.win_team!=='none';let dirty=false;
  if(id!==this.state.currentMatchId){
   this.state.currentMatchId=id;
   if(!this.state.matches[id]){const role=ended?null:this.state.nextRole;this.state.matches[id]={matchId:id,role:role||'unknown',roleSource:role?'manual':'unconfirmed',selectedAt:role?this.state.nextSelectedAt:null,history:[],matchMode:role?(this.state.nextMatchMode||'unknown'):'unknown',matchModeSource:role&&this.state.nextMatchMode?'manual':'unconfirmed',finished:ended};if(role){this.state.nextRole=null;this.state.nextSelectedAt=null;this.state.nextMatchMode=null;}dirty=true;}
   dirty=true;
  }
  const m=this.state.matches[id];
  if(m.finished!==ended){m.finished=ended;dirty=true;}
  if(data?.hero?.name&&m.heroName!==data.hero.name){m.heroName=data.hero.name;dirty=true;}
  m.clock=data?.map?.clock_time ?? null;if(dirty)this.save();
 }
 assignment(id=this.state.currentMatchId){const m=this.state.matches[String(id)];return m?{role:m.role,roleSource:m.roleSource,roleConfirmedAt:m.selectedAt,roleHistory:m.history,matchMode:this.modeOverrides[String(id)]?.matchMode||m.matchMode||'unknown',matchModeSource:this.modeOverrides[String(id)]?'manual-correction':m.matchModeSource||'unconfirmed'}: {role:'unknown',roleSource:'unconfirmed',roleConfirmedAt:null,roleHistory:[],matchMode:'unknown',matchModeSource:'unconfirmed'};}
 choose({role,target,matchId,matchMode}){
  if(matchMode!==undefined&&!['normal','turbo','unknown'].includes(matchMode))throw Object.assign(Error('Elige Normal o Turbo.'),{status:400});
  if(!ROLES[role])throw Object.assign(Error('Elige uno de los cinco roles.'),{status:400});
  const now=new Date().toISOString();
  if(target==='next'){this.state.nextRole=role;this.state.nextSelectedAt=now;this.state.nextMatchMode=matchMode||'unknown';}
  else if(target==='current'){
   if(String(matchId)!==this.state.currentMatchId||!this.state.matches[matchId]||this.state.matches[matchId].finished)throw Object.assign(Error('La partida cambió o terminó. Actualiza la página y elige la próxima partida.'),{status:409});
   const m=this.state.matches[matchId];m.history.push({previousRole:m.role,role,selectedAt:now,clock:m.clock,previousMatchMode:m.matchMode||'unknown',matchMode:matchMode||m.matchMode||'unknown'});m.matchMode=matchMode||m.matchMode||'unknown';m.matchModeSource=m.matchMode==='unknown'?'unconfirmed':'manual';m.role=role;m.roleSource='manual';m.selectedAt=now;
  }else throw Object.assign(Error('Indica partida actual o próxima partida.'),{status:400});
  this.save();return this.status();
 }
 decorate(match){
  const tagged={...match,...this.assignment(match.id),schemaVersion:3};
  tagged.captureValidForBalance=!!(match.captureValidForBalance ?? match.validForBalance);
  tagged.validForBalance=tagged.captureValidForBalance&&tagged.matchMode==='normal';
  tagged.validForRoleBalance=tagged.validForBalance&&tagged.role!=='unknown'&&typeof tagged.firstClock==='number'&&Number.isFinite(tagged.firstClock)&&tagged.firstClock<=300;
  tagged.balanceExclusion=tagged.matchMode==='turbo'?'turbo':tagged.matchMode!=='normal'?'unconfirmed_match_mode':!tagged.validForRoleBalance?'unconfirmed_role_or_incomplete_capture':null;
  return tagged;
 }
 correctMode(id,matchMode){
  if(!['normal','turbo'].includes(matchMode)||!this.state.matches[String(id)])throw Error('Partida o modalidad inválida.');
  this.modeOverrides[String(id)]={matchMode,source:'manual-correction',updatedAt:new Date().toISOString()};const tmp=this.modeOverridesFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.modeOverrides,null,2));fs.renameSync(tmp,this.modeOverridesFile);
  const m=this.state.matches[String(id)];m.history.push({previousMatchMode:m.matchMode||'unknown',matchMode,selectedAt:new Date().toISOString(),reason:'manual-correction'});m.matchMode=matchMode;m.matchModeSource='manual';this.save();
 }
 record(match){const tagged=this.decorate(match);fs.appendFileSync(this.matchesFile,JSON.stringify(tagged)+'\n');return tagged;}
 export(){
  const byId=new Map();if(fs.existsSync(this.matchesFile))for(const line of fs.readFileSync(this.matchesFile,'utf8').split('\n')){try{const m=this.decorate(JSON.parse(line));const prev=byId.get(m.id);if(!prev||Number(m.durationSeconds)>=Number(prev.durationSeconds))byId.set(m.id,m);}catch{}}
  const matches=[...byId.values()];const byRole=Object.fromEntries([...Object.keys(ROLES),'unknown'].map(role=>[role,matches.filter(m=>m.role===role&&m.validForRoleBalance)]));
  return {schemaVersion:1,exportedAt:new Date().toISOString(),roleLabels:ROLES,matches,byRole,normalBalanceMatches:matches.filter(m=>m.validForRoleBalance),turboMatches:matches.filter(m=>m.matchMode==='turbo'),unconfirmedMatches:matches.filter(m=>m.matchMode==='unknown'),current:this.status(false)};
 }
 status(includeCounts=true){return {current:this.state.matches[this.state.currentMatchId]||null,nextRole:this.state.nextRole,nextMatchMode:this.state.nextMatchMode||'unknown',roles:ROLES,...(includeCounts?{counts:Object.fromEntries(Object.entries(this.export().byRole).map(([r,rows])=>[r,rows.length]))}:{})};}
 handle(req,res){
  const url=new URL(req.url,'http://127.0.0.1');if(!['/roles','/role','/role/export'].includes(url.pathname))return false;
  const send=(status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(type.startsWith('application/json')?JSON.stringify(data):data);};
  if(!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(String(req.headers.host))){send(403,{error:'Usa el panel local de esta computadora.'});return true;}
  if(req.method==='GET'&&url.pathname==='/roles'){send(200,ROLE_HTML,'text/html; charset=utf-8');return true;}
  if(req.method==='GET'&&url.pathname==='/role/export'){res.setHeader('content-disposition','attachment; filename="happy-games-role-research.json"');send(200,this.export());return true;}
  if(req.method==='GET'&&url.pathname==='/role'){send(200,this.status());return true;}
  if(req.method!=='POST'||url.pathname!=='/role'){send(405,{error:'Método no permitido.'});return true;}
  const expected='http://'+req.headers.host;
  if(req.headers.origin&&req.headers.origin!==expected){send(403,{error:'Selecciona el rol desde el panel local del bridge.'});return true;}
  if(!String(req.headers['content-type']).startsWith('application/json')){send(415,{error:'Formato inválido.'});return true;}
  let body='',size=0,oversized=false;req.on('data',c=>{size+=c.length;if(size>8192){if(!oversized)send(413,{error:'Solicitud demasiado grande.'});oversized=true;}else body+=c;});
  req.on('end',()=>{if(oversized)return;try{send(200,this.choose(JSON.parse(body)));}catch(e){send(e.status||400,{error:e.message});}});return true;
 }
}
const ROLE_HTML=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tu rol · Happy Games</title>
<style>:root{color-scheme:dark;font-family:Arial,sans-serif;background:#102832;color:#e1eeea}*{box-sizing:border-box}body{margin:0;padding:32px 20px}main{max-width:680px;margin:auto}h1{font:700 34px Georgia,serif;color:#fff0c9;margin:0 0 16px}p{line-height:1.55}fieldset{border:0;padding:0;margin:24px 0}legend{font-weight:700;margin-bottom:12px}label{display:block;margin:12px 0;cursor:pointer}input{accent-color:#e6c58a}button{display:block;text-align:left;width:100%;padding:17px 20px;border:1px solid #b69a61;background:#21434c;color:#fff0c9;font-size:18px;font-weight:700;cursor:pointer;margin:10px 0;border-radius:6px}button:hover{background:#305964}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #76ded5;outline-offset:4px}button:disabled{opacity:.5;cursor:wait}button[aria-pressed=true]{background:#66532e;border-width:3px;padding:15px 18px}#status{padding:16px 0;border-bottom:1px solid #b69a61}#message{min-height:28px;color:#f1d389}a{color:#76ded5;text-underline-offset:4px}::selection{background:#b69a61;color:#102832}footer{margin-top:30px} @media(max-width:480px){body{padding:24px 16px}h1{font-size:29px}}</style>
<main><h1>¿Qué vas a jugar?</h1><p>Confirma la modalidad y tu posición para separar las estadísticas de tus partidas. Puedes corregirla mientras juegas.</p><div id="status" role="status">Conectando con el bridge…</div>
<fieldset><legend>Aplicar selección a</legend><label><input type="radio" name="target" value="next" checked> Próxima partida</label><label><input id="currentChoice" type="radio" name="target" value="current"> Partida actual</label></fieldset>
<fieldset><legend>Modalidad de la partida</legend><label><input type="radio" name="matchMode" value="normal"> Normal</label><label><input type="radio" name="matchMode" value="turbo"> Turbo — no cuenta para el balance normal</label></fieldset>
<p>Después, elige tu posición para guardar ambas selecciones.</p><div id="buttons"></div><p id="message" role="status"></p><p>Si no eliges, guardamos la partida como «sin confirmar». No asumimos support ni una modalidad. Turbo se guarda por separado y se excluye del balance normal.</p><footer><a href="/role/export">Descargar datos de todos los roles</a></footer></main>
<script>let state,lastMatch=null,lastTarget=null,busy=false;const labels={carry:'Carry · posición 1',mid:'Mid · posición 2',offlane:'Offlane · posición 3',support4:'Support · posición 4',support5:'Hard support · posición 5'};const modes={normal:'Normal',turbo:'Turbo',unknown:'modalidad sin confirmar'};
const status=document.getElementById('status'),message=document.getElementById('message'),buttons=document.getElementById('buttons'),currentChoice=document.getElementById('currentChoice');for(const [role,label] of Object.entries(labels)){const b=document.createElement('button');b.textContent=label;b.dataset.role=role;b.onclick=()=>choose(role);buttons.append(b)}
function render(s){state=s;const m=s.current,active=m&&!m.finished;currentChoice.disabled=!active;if(m?.matchId!==lastMatch){lastMatch=m?.matchId;if(active&&(m.role==='unknown'||!m.matchMode||m.matchMode==='unknown'))currentChoice.checked=true}if(!active)document.querySelector('[name=target][value=next]').checked=true;
const target=document.querySelector('[name=target]:checked').value,key=target+':'+(m?.matchId||''),selected=target==='current'?m?.role:s.nextRole,mode=target==='current'?m?.matchMode:s.nextMatchMode;
if(key!==lastTarget){lastTarget=key;document.querySelectorAll('[name=matchMode]').forEach(x=>x.checked=x.value===mode)}
status.textContent=(active?'Partida '+m.matchId+' · '+(labels[m.role]||'Falta confirmar tu rol')+' · '+(modes[m.matchMode]||modes.unknown):'Esperando la próxima partida')+(s.nextRole?' — Preparado: '+labels[s.nextRole]+' · '+(modes[s.nextMatchMode]||modes.unknown):'');for(const b of buttons.children){b.setAttribute('aria-pressed',String(b.dataset.role===selected));b.disabled=busy}}
async function refresh(){if(busy)return;try{const r=await fetch('/role');if(!r.ok)throw Error();render(await r.json())}catch{status.textContent='Bridge desconectado. Enciéndelo para elegir modalidad y rol.';for(const b of buttons.children)b.disabled=true}}
async function choose(role){const matchMode=document.querySelector('[name=matchMode]:checked')?.value;if(!matchMode){message.textContent='Primero indica si vas a jugar Normal o Turbo.';return}busy=true;for(const b of buttons.children)b.disabled=true;message.textContent='Guardando…';try{const r=await fetch('/role',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role,matchMode,target:document.querySelector('[name=target]:checked').value,matchId:state?.current?.matchId})});const s=await r.json();if(!r.ok)throw Error(s.error);busy=false;render(s);message.textContent='Guardado: '+labels[role]+' · '+modes[matchMode]+'.'}catch(e){message.textContent=e.message;busy=false;await refresh()}}
document.querySelectorAll('[name=target]').forEach(x=>x.onchange=()=>{lastTarget=null;state&&render(state)});document.querySelectorAll('[name=matchMode]').forEach(x=>x.onchange=()=>message.textContent='Elige tu posición para guardar '+modes[x.value]+'.');refresh();setInterval(refresh,2500);</script></html>`;
module.exports={RoleTracker,ROLES,ROLE_HTML};
