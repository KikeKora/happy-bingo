const fs = require('fs');
const path = require('path');

const EXPECTED_PROTOCOL = 2;
const MIN_BRIDGE_VERSION = '1.3.1';
const CONFIG_FILE = path.join(__dirname, 'happy-bingo-online-config.json');

function ok(label, detail='') { console.log(`PASS  ${label}${detail ? ' - ' + detail : ''}`); }
function warn(label, detail='') { console.log(`WARN  ${label}${detail ? ' - ' + detail : ''}`); }
function fail(label, detail='') { console.log(`FAIL  ${label}${detail ? ' - ' + detail : ''}`); }
function semverGte(a,b){
  const pa=String(a||'0').split('.').map(Number), pb=String(b||'0').split('.').map(Number);
  for(let i=0;i<3;i++){ const x=pa[i]||0,y=pb[i]||0; if(x>y)return true; if(x<y)return false; }
  return true;
}

async function main(){
  console.log('===============================================');
  console.log(' HAPPY BINGO PREFLIGHT');
  console.log('===============================================');

  if(!fs.existsSync(CONFIG_FILE)){
    fail('Configuracion local', 'falta happy-bingo-online-config.json');
    process.exitCode=1; return;
  }
  ok('Configuracion local');

  const cfg=JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'));
  const workerUrl=String(cfg.workerUrl||'').replace(/\/+$/,'');
  if(!workerUrl){ fail('Worker URL','no configurada'); process.exitCode=1; return; }

  let worker;
  try{
    const r=await fetch(workerUrl+'/api/health');
    worker=await r.json();
    if(!r.ok||!worker?.ok) throw new Error(`HTTP ${r.status}`);
    ok('Worker online', worker.service||workerUrl);
  }catch(e){ fail('Worker online', e.message); process.exitCode=1; return; }

  if(Number(worker.eventProtocolVersion)===EXPECTED_PROTOCOL) ok('Protocolo Worker', `v${EXPECTED_PROTOCOL}`);
  else fail('Protocolo Worker', `esperado v${EXPECTED_PROTOCOL}, recibido ${worker.eventProtocolVersion ?? '?'}`);

  let bridge;
  try{
    const r=await fetch('http://127.0.0.1:4010/status');
    bridge=await r.json();
    if(!r.ok||!bridge?.ok) throw new Error(`HTTP ${r.status}`);
    ok('Bridge local activo', `v${bridge.bridgeVersion}`);
  }catch(e){
    fail('Bridge local activo', 'ejecuta: node .\\local\\happy-bingo-online-bridge.cjs');
    process.exitCode=1; return;
  }

  if(semverGte(bridge.bridgeVersion,MIN_BRIDGE_VERSION)) ok('Version del bridge', bridge.bridgeVersion);
  else fail('Version del bridge', `requiere ${MIN_BRIDGE_VERSION}+`);

  if(Number(bridge.eventProtocolVersion)===EXPECTED_PROTOCOL && bridge.protocolCompatible) ok('Bridge/Worker compatibles', `protocolo v${EXPECTED_PROTOCOL}`);
  else fail('Bridge/Worker compatibles', `bridge=${bridge.eventProtocolVersion ?? '?'} worker=${bridge.workerProtocolVersion ?? '?'}`);

  if(Number(bridge.failedCount)===0) ok('Envios sin fallos', `${bridge.sentCount} enviados`);
  else fail('Envios sin fallos', `${bridge.failedCount} fallos`);

  if(Number(bridge.gsiPayloadCount)>0) ok('Dota GSI detectado', `${bridge.gsiPayloadCount} payloads`);
  else warn('Dota GSI detectado', 'aun no llegaron payloads; abre Dota o entra a una partida');

  if(bridge.lastMatchTickAt) ok('MATCH_TICK activo', bridge.lastMatchTickAt);
  else warn('MATCH_TICK activo', 'todavia no se ha generado; cambia una estadistica en partida');

  if(bridge.lastItemAt) ok('Objetos adquiridos', bridge.lastItemAt);
  else warn('Objetos adquiridos', 'todavia no se ha detectado un cambio de inventario en esta sesion');

  if(bridge.telemetry?.schemaVersion===2 && !bridge.telemetry.errors) ok('Captura ampliada GSI', `${bridge.telemetry.fieldPaths} campos, ${bridge.telemetry.capturedBlocks.length} bloques observados`);
  else fail('Captura ampliada GSI','revisar errores del colector');
  if(bridge.telemetry?.rawSkipped) warn('Archivo completo GSI', 'se alcanzo el limite local; exporta los registros antes de ampliar el limite');
  if(bridge.telemetry?.mode && bridge.telemetry.mode!=='player') warn('Modo de captura',bridge.telemetry.mode+'; espectador/replay no otorga puntos del bingo');
  if(bridge.telemetry?.missingMetrics?.length) warn('Metricas aun no recibidas',bridge.telemetry.missingMetrics.join(', '));
  if(bridge.openDota) ok('Presupuesto OpenDota',JSON.stringify(bridge.openDota.usage ?? bridge.openDota.budget ?? {}));

  const hardFail = Number(worker.eventProtocolVersion)!==EXPECTED_PROTOCOL ||
    !semverGte(bridge.bridgeVersion,MIN_BRIDGE_VERSION) ||
    Number(bridge.eventProtocolVersion)!==EXPECTED_PROTOCOL ||
    !bridge.protocolCompatible || Number(bridge.failedCount)>0 || Number(bridge.telemetry?.errors)>0 || bridge.telemetry?.schemaVersion!==2;

  console.log('-----------------------------------------------');
  if(hardFail){
    console.log('RESULTADO: NO READY');
    console.log('No inicies stream hasta corregir los FAIL.');
    process.exitCode=1;
  }else if(!bridge.lastMatchTickAt){
    console.log('RESULTADO: CASI READY');
    console.log('Falta confirmar al menos un MATCH_TICK en una partida.');
  }else{
    console.log('RESULTADO: READY FOR STREAM');
  }
}

main().catch(e=>{ console.error(e); process.exitCode=1; });
