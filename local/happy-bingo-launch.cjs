const fs=require('node:fs'),path=require('node:path');const {spawn}=require('node:child_process');
const PORT=Number(process.env.HAPPY_BINGO_PORT||4010),BASE='http://127.0.0.1:'+PORT;
function openRoles(){
  if(process.env.HAPPY_BINGO_NO_BROWSER==='1')return;
  const child=spawn('powershell.exe',['-NoProfile','-Command',`Start-Process '${BASE}/roles'`],{stdio:'ignore',windowsHide:true});child.on('error',()=>console.log('Elige tu rol en '+BASE+'/roles'));
}
async function getStatus(){try{const r=await fetch(BASE+'/status',{signal:AbortSignal.timeout(1500)});if(r.ok)return await r.json();}catch{}return null;}
async function main(){
  let status=await getStatus();
  if(status?.service!=='Happy Bingo Online Bridge'){
    const dir=path.join(__dirname,'research');fs.mkdirSync(dir,{recursive:true});
    const out=fs.openSync(path.join(dir,'bridge-background.stdout.log'),'a'),err=fs.openSync(path.join(dir,'bridge-background.stderr.log'),'a');
    const child=spawn(process.execPath,[path.join(__dirname,'happy-bingo-online-bridge.cjs')],{stdio:['ignore',out,err],detached:true,windowsHide:true});
    fs.closeSync(out);fs.closeSync(err);let startupError=null;child.on('error',e=>{startupError=e;});child.unref();
    for(let attempt=0;attempt<20;attempt++){await new Promise(r=>setTimeout(r,500));if(startupError)throw startupError;status=await getStatus();if(status?.service==='Happy Bingo Online Bridge')break;}
    if(status?.service!=='Happy Bingo Online Bridge')throw Error('No arrancó el bridge. Revisa local/research/bridge-background.stderr.log.');
  }
  if(status.roleTracking)openRoles();
  await require('./happy-bingo-monitor.cjs').monitor();
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
