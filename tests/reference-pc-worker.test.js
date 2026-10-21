'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const worker = require('../reference-motion/pc-worker'), config = require('../reference-motion/pc-worker-config');
const TOKEN = 't'.repeat(43), ID = 'ab123456-1234-4234-8234-123456789abc', LEASE = 'l'.repeat(43);
const settings = {baseUrl:'https://shortscraft.online',token:TOKEN,workerId:ID};
const claim = {id:ID,kind:'analyze',lease:LEASE};
const source = Buffer.from('000000186674797069736f6d0000000069736f6d','hex');
const input = {input:{video:'data:video/mp4;base64,'+source.toString('base64'),analysisMode:'local'},plan:'free',userId:'owner'};
function scene() {return {format:'shortscraft-reference-motion',version:1,width:100,height:100,fps:30,durationFrames:1,background:'#ffffff',layers:[{
 id:'card',label:'Grouped card',assetId:'card',width:100,height:100,zIndex:1,visible:true,offset:{x:0,y:0},scale:1,rotation:0,opacity:1,
 keyframes:[{frame:0,corners:[[0,0],[100,0],[100,100],[0,100]],opacity:1}]}]};}
function json(value,status=200) {return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});}
test('fixed HTTPS origins; local HTTP needs explicit QA opt-in; no credentials/path/query',()=>{
 assert.equal(config.validateBaseUrl('https://shortscraft.online'),'https://shortscraft.online');
 for(const url of ['http://shortscraft.online','https://evil.example','https://shortscraft.online/a','https://user:pass@shortscraft.online','https://shortscraft.online/?token=x','http://127.0.0.1:3333'])assert.throws(()=>config.validateBaseUrl(url));
 assert.equal(config.validateBaseUrl('http://127.0.0.1:3333',{allowLoopback:true}),'http://127.0.0.1:3333');
 assert.throws(()=>config.validateBaseUrl('http://192.168.1.2',{allowLoopback:true}));
});
test('claim is closed, UUID-bounded and lease-bounded',()=>{
 assert.deepEqual(worker.validateClaim(claim),claim);
 for(const value of [{...claim,url:'http://evil'},{...claim,id:'../x'},{...claim,lease:'short'},{...claim,kind:'execute'}])assert.throws(()=>worker.validateClaim(value));
});
test('analyze accepts local data only, rejects provider switch, arbitrary paths and user plan injection',()=>{
 assert.equal(worker.validateInput('analyze',input),input);
 assert.equal(worker.validateInput('analyze',{...input,input:{...input.input,ownerPcConsent:true}}).input.ownerPcConsent,true);
 for(const value of [{...input,plan:'admin'},{...input,input:{...input.input,analysisMode:'gemini'}},{...input,input:{...input.input,cloudConsent:true}},
  {...input,input:{...input.input,ownerPcConsent:false}}, {...input,input:{file:'C:\\private.mp4'}},{...input,pythonPath:'evil.exe'}])assert.throws(()=>worker.validateInput('analyze',value));
});
test('render requires closed controlled document/options with safe raster planes',()=>{
 const value={document:{scene:scene(),images:{card:'data:image/png;base64,AAAA'}},options:{height:480,watermark:true}};
 assert.equal(worker.validateInput('render',value).document.scene.width,100);
 for(const bad of [{...value,options:{...value.options,output:'C:\\user.txt'}},{...value,options:{height:999,watermark:true}},
  {...value,document:{...value.document,images:{card:'https://evil/image'}}},{...value,document:{...value.document,sourceCode:'evil'}}])assert.throws(()=>worker.validateInput('render',bad));
});
test('claim request pins origin, uses bearer only as header, no redirects, bounded response',async()=>{
 let observed;
 const client=worker.createClient(settings,{fetchImpl:async(url,options)=>{observed={url,options};return json(claim);}});
 assert.deepEqual(await client.claim(),claim);
 assert.equal(observed.url,'https://shortscraft.online/api/reference-motion/worker/claim');
 assert.equal(observed.options.redirect,'error');assert.equal(observed.options.headers.Authorization,'Bearer '+TOKEN);
 assert.equal(observed.options.body,JSON.stringify({workerId:ID}));assert(!observed.url.includes(TOKEN));
});
test('idle 204 accepted, redirected/error/HTML claims rejected',async()=>{
 assert.equal(await worker.createClient(settings,{fetchImpl:async()=>new Response(null,{status:204})}).claim(),null);
 for(const response of [new Response(null,{status:302,headers:{Location:'https://evil'}}),new Response('html',{status:200}),json({},500)]){
  await assert.rejects(()=>worker.createClient(settings,{fetchImpl:async()=>response}).claim());
 }
});
test('oversized headers and streaming bodies are cancelled',async()=>{
 await assert.rejects(()=>worker.readBounded(new Response('abc',{headers:{'content-length':'1000'}}),10));
 await assert.rejects(()=>worker.readBounded(new Response('a'.repeat(30)),10));
});
test('input includes lease, validates JSON and treats missing lease as cancellation',async()=>{
 let options;
 const client=worker.createClient(settings,{fetchImpl:async(_url,value)=>{options=value;return json(input);}});
 assert.deepEqual(await client.input(claim),input);assert.equal(options.headers['X-Reference-Lease'],LEASE);
 const missing=worker.createClient(settings,{fetchImpl:async()=>json({},404)});
 await assert.rejects(()=>missing.input(claim),error=>error.leaseGone===true);
});
test('request timeout aborts network and does not expose diagnostic text',async()=>{
 const client=worker.createClient(settings,{requestMs:10,fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 await assert.rejects(()=>client.claim(),error=>error.code==='REFERENCE_PC_JOB_TIMEOUT');
});
test('fail sends only a whitelisted code and no source data or raw message',async()=>{
 let sent;
 await worker.createClient(settings,{fetchImpl:async(_url,value)=>{sent=value.body;return new Response(null,{status:204});}}).fail(claim,Error('secret '+TOKEN));
 assert.equal(sent,'{"code":"REFERENCE_PC_JOB_FAILED"}');
});
test('render completion validates a real MP4 container signature; sends raw bytes only',async()=>{
 let options;const client=worker.createClient(settings,{fetchImpl:async(_url,value)=>{options=value;return new Response(null,{status:204});}});
 await assert.rejects(()=>client.complete({...claim,kind:'render'},{buffer:Buffer.alloc(2048)}));
 const buffer=Buffer.alloc(2048);buffer.write('ftyp',4);
 await client.complete({...claim,kind:'render'},{buffer});assert.equal(options.body,buffer);assert.equal(options.headers['Content-Type'],'video/mp4');
});
test('job input, pulse, process, completion order is controlled',async()=>{
 const calls=[];
 const client={pulse:async()=>calls.push('pulse'),input:async()=>{calls.push('input');return input;},complete:async()=>calls.push('complete'),fail:async()=>calls.push('fail')};
 assert.equal(await worker.performJob(claim,{client,processJob:async(kind,value)=>{calls.push('process');assert.equal(kind,'analyze');assert.equal(value,input);return {};}}),true);
 assert.deepEqual(calls,['pulse','input','process','complete']);
});
test('expired heartbeat aborts active work and never publishes its output',async()=>{
 let pulses=0,aborted=false,complete=false,failed=0;
 const client={pulse:async()=>{if(++pulses>1){const error=Error();error.leaseGone=true;throw error;}},input:async()=>input,complete:async()=>{complete=true;},fail:async()=>failed++};
 const result=await worker.performJob(claim,{client,pulseMs:5,processJob:async(_kind,_input,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true}))});
 assert.equal(result,false);assert.equal(aborted,true);assert.equal(complete,false);assert.equal(failed,0);
});
test('whole job timeout awaits processor cancellation before reporting failure',async()=>{
 let cleaned=false,reported;
 const client={pulse:async()=>{},input:async()=>input,complete:async()=>assert.fail('must not complete'),fail:async(_job,error)=>{assert.equal(cleaned,true);reported=error.code;}};
 assert.equal(await worker.performJob(claim,{client,deadlineMs:15,processJob:async(_kind,_input,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>setTimeout(()=>{cleaned=true;reject(signal.reason);},5),{once:true}))}),false);
 assert.equal(reported,'REFERENCE_PC_JOB_TIMEOUT');
});
test('single worker processes jobs serially; startup doctor precedes first claim',async()=>{
 let active=0,max=0,count=0,checked=false;
 const client={claim:async()=>{assert.equal(checked,true);return claim;},pulse:async()=>{},input:async()=>input,complete:async()=>{},fail:async()=>{}};
 await worker.runWorker(settings,{client,preflight:async()=>{checked=true;return {};},freeMemory:()=>3*1024**3,pollMs:1,maxIterations:2,log:()=>{},
 processJob:async()=>{count++;active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return {};}});
 assert.equal(count,2);assert.equal(max,1);
});
test('low available RAM fails a claimed job before starting heavy processing',async()=>{
 let code,ran=false;
 const client={claim:async()=>claim,fail:async(_job,error)=>{code=error.code;}};
 await worker.runWorker(settings,{client,preflight:async()=>({}),freeMemory:()=>1024,pollMs:1,maxIterations:1,log:()=>{},processJob:async()=>{ran=true;}});
 assert.equal(code,'REFERENCE_PC_MEMORY_LOW');assert.equal(ran,false);
 await assert.rejects(()=>worker.doctor({},{freeMemory:()=>1024}),error=>error.code==='REFERENCE_PC_MEMORY_LOW');
});
test('probe child environment strips DB keys, provider token, Node options and proxies',()=>{
 const result=config.childEnvironment({PATH:'bin',SC_REFERENCE_PC_TOKEN:TOKEN,DATABASE_URL:'secret',GEMINI_API_KEY:'secret',NODE_OPTIONS:'--require evil',HTTPS_PROXY:'credential',USERPROFILE:'user'});
 assert.deepEqual(result,{PATH:'bin',USERPROFILE:'user'});
});
test('private config stores only DPAPI ciphertext outside source and refuses overwrite',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sc-pc-config-test-'));
 const encrypted='01000000'+'f'.repeat(128);let decrypted=false;
 try {
  const setup={baseUrl:settings.baseUrl,token:TOKEN,pythonPath:process.execPath};
  await config.saveConfig(setup,{directory,platform:'win32',encrypt:async token=>{assert.equal(token,TOKEN);return encrypted;}});
  const raw=await fs.readFile(path.join(directory,'config.json'),'utf8');assert(!raw.includes(TOKEN));assert(raw.includes(encrypted));
  const loaded=await config.loadConfig({directory,platform:'win32',decrypt:async value=>{decrypted=true;assert.equal(value,encrypted);return TOKEN;}});
  assert.equal(loaded.token,TOKEN);assert.equal(decrypted,true);assert.match(loaded.workerId,/^[a-f0-9-]{36}$/);
  await assert.rejects(()=>config.saveConfig(setup,{directory,platform:'win32',encrypt:async()=>encrypted}),error=>error.code==='EEXIST');
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('setup rejects secret command arguments and unsupported executable metadata',()=>{
 assert.throws(()=>config.validateSetup({baseUrl:settings.baseUrl,token:'short',pythonPath:process.execPath}));
 assert.throws(()=>config.validateSetup({baseUrl:settings.baseUrl,token:TOKEN,pythonPath:'python'}));
 assert.throws(()=>config.validateSetup({baseUrl:settings.baseUrl,token:TOKEN,pythonPath:process.execPath,command:'evil'}));
});
test('helper scripts are scoped, hidden, manual-start-only and never generic process killers',async()=>{
 const start=await fs.readFile(path.join(__dirname,'../tools/start-reference-pc-worker.ps1'),'utf8');
 const stop=await fs.readFile(path.join(__dirname,'../tools/stop-reference-pc-worker.ps1'),'utf8');
 assert(start.includes('-WindowStyle Hidden'));assert(!/Register-ScheduledTask|New-NetFirewallRule/i.test(start));
 assert(stop.includes('CreationDate'));assert(stop.includes('ExecutablePath'));assert(stop.includes('CommandLine'));
 assert(!/Stop-Process\s+-Name|taskkill[^\r\n]*\/IM/i.test(stop));
});
