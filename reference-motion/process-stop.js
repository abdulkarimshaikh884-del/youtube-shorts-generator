'use strict';
const {spawn}=require('node:child_process');

// The Windows venv executable can be a launcher with a separate Python child.
// Killing only the launcher leaves inference running after cancellation and
// after scratch cleanup. Target only the process object spawned by this job.
function stopOwnedProcess(child,{platform=process.platform,run=spawn}={}){
 if(!child||child.exitCode!==null&&child.exitCode!==undefined||child.signalCode)return;
 if(platform!=='win32'||!Number.isSafeInteger(child.pid)||child.pid<=0){child.kill('SIGKILL');return;}
 let fallback=false;
 const killLauncher=()=>{if(fallback)return;fallback=true;if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');};
 try{
  const allowed=new Set(['PATH','SYSTEMROOT','WINDIR','TEMP','TMP']);
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>allowed.has(key.toUpperCase())));
  const killer=run('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{shell:false,windowsHide:true,stdio:'ignore',env});
  killer.once('error',killLauncher);killer.once('close',code=>{if(code!==0)killLauncher();});
 }catch{killLauncher();}
}
module.exports={stopOwnedProcess};
