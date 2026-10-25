'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/authui.js'),'utf8');
const start=source.indexOf('  var PUSH = (function () {'),end=source.indexOf('\n  /* One control,',start);
function setup(config){
  const calls={permission:0,registration:0,subscribe:0,save:0};
  const subscription={options:{},toJSON:()=>({endpoint:'https://example.invalid/push-test'})};
  const registration={pushManager:{getSubscription:async()=>null,subscribe:async args=>{calls.subscribe++;assert.equal(args.applicationServerKey.length,65);return subscription;}}};
  const Notification={permission:'default',requestPermission:async()=>{calls.permission++;return 'granted';}};
  const context={navigator:{userAgent:'Desktop',platform:'Windows',serviceWorker:{register:async()=>{calls.registration++;return registration;},ready:Promise.resolve(registration),getRegistration:async()=>null}},window:{PushManager:function(){},Notification,isSecureContext:true,matchMedia:()=>({matches:false})},Notification,crypto:crypto.webcrypto,Date,Uint8Array,AbortSignal,atob:s=>Buffer.from(s,'base64').toString('binary'),fetch:async(url)=>{if(url==='/api/push/subscribe')calls.save++;return {ok:true,json:async()=>url==='/api/push/key'?{success:true,...config}:{success:true}};}};
  return {calls,push:vm.runInNewContext(source.slice(start,end)+'\nPUSH;',context)};
}
test('disabled preview push is unavailable before permission, worker registration or subscribe',async()=>{const f=setup({enabled:false,publicKey:''});assert.equal(await f.push.state(),'unavailable');await assert.rejects(f.push.enable(),/In-app notifications still work/);assert.deepEqual(f.calls,{permission:0,registration:0,subscribe:0,save:0});});
test('empty, malformed and invalid curve points never reach browser subscription',async()=>{
  const invalidPoint=Buffer.alloc(65);invalidPoint[0]=4;
  for(const publicKey of ['', 'not-a-key',invalidPoint.toString('base64url')]){const f=setup({publicKey});assert.equal(await f.push.state(),'unavailable');await assert.rejects(f.push.enable(),/Device notifications are unavailable/);assert.equal(f.calls.permission,0);assert.equal(f.calls.subscribe,0);}
});
test('valid real P-256 key permits explicit consent then worker subscribe and account save',async()=>{
  const key=crypto.createECDH('prime256v1');key.generateKeys();const f=setup({publicKey:key.getPublicKey().toString('base64url')});
  assert.equal(await f.push.state(),'off');assert.equal(f.calls.permission,0);
  await f.push.enable();assert.deepEqual(f.calls,{permission:1,registration:1,subscribe:1,save:1});
});
