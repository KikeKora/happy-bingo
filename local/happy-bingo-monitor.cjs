const readline=require('node:readline');
const BASE='http://127.0.0.1:'+Number(process.env.HAPPY_BINGO_PORT||4010);
function frame(s){
 const age=s.lastGsiAt?Math.max(0,Math.floor((Date.now()-Date.parse(s.lastGsiAt))/1000)):null;
 const current=s.roleTracking?.current,counts=s.telemetry?.liveEventMetrics?.observedCounts;
 const role=s.roleTracking?.roles?.[current?.role]||'Sin confirmar';
 const clock=current?.clock;
 const time=typeof clock==='number'?`${clock<0?'-':''}${Math.floor(Math.abs(clock)/60)}:${String(Math.floor(Math.abs(clock)%60)).padStart(2,'0')}`:'—';
 const value=k=>typeof counts?.[k]==='number'?counts[k]:'por confirmar';
 return [
  `HAPPY GAMES · MONITOR DEL BRIDGE ${s.bridgeVersion}`,'',
  `HÉROE: ${current?.heroName?.replace('npc_dota_hero_','').split('_').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ')||'por elegir'}` ,
  `POSICIÓN REGISTRADA: ${role}`,
  `MODALIDAD: ${current?.matchMode==='turbo'?'Turbo · EXCLUIDA del balance normal':current?.matchMode==='normal'?'Normal':'Sin confirmar · no cuenta para el balance'}`,'',
  age===null?'Esperando los primeros datos de Dota.':age<=10?'RECIBIENDO DATOS DE DOTA':`Sin paquetes nuevos desde hace ${age} segundos.`,
  `Paquetes recibidos: ${s.gsiPayloadCount} | Eventos enviados: ${s.sentCount} | Fallos de envío: ${s.failedCount}`,
  `Última captura: ${s.lastGsiAt?new Date(s.lastGsiAt).toLocaleTimeString('es-MX'):'todavía ninguna'}${age!==null?' · hace '+age+' s':''}`,'',
  `Partida: ${current?.matchId||'esperando'} | Reloj: ${time}${current?.finished?' · terminada':''}`,
  `Último evento enviado: ${s.lastEventType||'ninguno'}`,'',
  `Wards compradas: Observer ${value('observerWardsPurchased')} · Sentry ${value('sentryWardsPurchased')}`,
  `Wards destruidas: Observer ${value('observerWardsDestroyed')} · Sentry ${value('sentryWardsDestroyed')}`,
  `Smoke activadas: ${value('smokeActivations')} · Bounty: ${value('bountyRunesPickedUp')}`,
  `Captura local: ${Math.round(Number(s.telemetry?.rawCompressedBytes||0)/1024/1024)} MB | Errores de captura: ${s.telemetry?.errors||0}`,'',
  'El monitor se actualiza cada 2 segundos. No todos los paquetes generan eventos.',
  'Elige tu rol en http://127.0.0.1:4010/roles',
  'Puedes cerrar esta ventana: el bridge ya está funcionando en segundo plano.'
 ].join('\n');
}
async function status(){const r=await fetch(BASE+'/status',{signal:AbortSignal.timeout(1500)});if(!r.ok)throw Error('Bridge sin respuesta');return r.json();}
async function monitor(){
 while(true){let text;try{text=frame(await status());}catch{text='No se pudo contactar al bridge. Reintentando…\nAbre Start-Happy-Bingo.cmd si el bridge está apagado.';}
  if(process.stdout.isTTY){readline.cursorTo(process.stdout,0,0);readline.clearScreenDown(process.stdout);}
  process.stdout.write(text+'\n');await new Promise(r=>setTimeout(r,2000));
 }
}
if(require.main===module){if(process.argv.includes('--once'))status().then(s=>console.log(frame(s))).catch(e=>{console.error(e.message);process.exitCode=1;});else monitor();}
module.exports={monitor,frame};
