"use strict";
const assert=require("node:assert/strict"), fs=require("node:fs"), path=require("node:path"), crypto=require("node:crypto");
const target=new URL(process.env.DATABASE_URL);
assert.equal(target.hostname,"127.0.0.1"); assert.equal(target.port,"55437"); assert.equal(target.pathname,"/shortscraft_qa");
assert.equal(process.env.SC_ISOLATED_POSTGRES_QA,"true");
const db=require("../db"), referrals=require("../referrals");
const BASE=process.env.BASE_URL; assert.equal(new URL(BASE).hostname,"127.0.0.1");
const suffix=crypto.randomBytes(4).toString("hex"), checks=[];
function check(label, fn) {fn(); checks.push(label); console.log("PASS "+label);}
function jar() {return {cookies:new Map(), header(){return [...this.cookies].map(([k,v])=>k+"="+v).join("; ");},absorb(r){for(const raw of r.headers.getSetCookie()) {const [kv]=raw.split(";"); const at=kv.indexOf("="); this.cookies.set(kv.slice(0,at),kv.slice(at+1));}}};}
async function call(j,method,route,body,extra={}) {
  const r=await fetch(BASE+route,{method,headers:{"Content-Type":"application/json",...(j?{cookie:j.header()}:{}),...extra},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
  if(j) j.absorb(r);
  const data=/video\/mp4/.test(r.headers.get("content-type"))?Buffer.from(await r.arrayBuffer()):await r.json();
  return {status:r.status,data,headers:r.headers};
}
async function signup(label,j) {
  const r=await call(j,"POST","/api/auth/signup",{email:`${label}-${suffix}@example.com`,password:"Isolated-http-password-2026",handle:`${label}_${suffix}`});
  assert.equal(r.status,200); return r.data.user;
}
async function bonus(user) {return (await db.query("select bonus_credits from public.credits where key=$1",["u:"+user.id])).rows[0]?.bonus_credits || 0;}
(async()=>{
  const inviterJar=jar(), inviteeJar=jar(); const inviter=await signup("httpinviter",inviterJar);
  const own=await call(inviterJar,"GET","/api/referrals"); assert.equal(own.status,200);
  const capture=await fetch(BASE+"/?ref="+own.data.code); inviteeJar.absorb(capture); await capture.arrayBuffer();
  const invitee=await signup("httpinvitee",inviteeJar);
  check("HTTP referral cookie attaches only at new-account signup",()=>assert.equal(inviteeJar.cookies.has("sc_ref"),true));
  const verification=await referrals.createVerification(invitee);
  assert.equal((await call(inviteeJar,"POST","/api/auth/verification/confirm",{token:verification.token})).status,200);
  assert.equal(await bonus(inviter),0); assert.equal(await bonus(invitee),0);
  check("email confirmation alone does not award credits",()=>{});
  const body={tpl:"text-cascade",dur:1000,fps:24,height:1440,aspect:"9:16",lines:["REAL EXPORT", "REAL REFERRAL", "ShortsCraft QA"]};
  const idem=crypto.randomUUID();
  const exported=await call(inviteeJar,"POST","/api/export",body,{"Idempotency-Key":idem});
  check("actual HTTP export delivers MP4 and qualifies 10+10",()=>{assert.equal(exported.status,200); assert.equal(exported.data.toString("ascii",4,8),"ftyp");});
  assert.equal(await bonus(inviter),10); assert.equal(await bonus(invitee),10);
  assert.equal(exported.headers.get("x-credits-left"),"14");
  const credit=(await call(inviteeJar,"GET","/api/credits")).data;
  const failed=await call(inviteeJar,"POST","/api/export",{...body,tpl:"unknown-template-qa"});
  assert.equal(failed.status,400);
  const after=(await call(inviteeJar,"GET","/api/credits")).data;
  check("a real failed render refunds and does not increase referral bonus",()=>{assert.equal(after.left,credit.left); assert.equal(after.bonusCredits,10);});
  const repeated=await call(inviteeJar,"POST","/api/export",body,{"Idempotency-Key":idem});
  assert.equal(repeated.status,200); assert.equal(await bonus(inviter),10); assert.equal(await bonus(invitee),10);
  assert.equal((await call(inviteeJar,"GET","/api/credits")).data.left,14);
  check("HTTP retry does not spend or award referral twice",()=>{});
  const offer=await call(null,"GET","/api/offer"); assert.equal(offer.data.paymentsLive,false);
  assert.equal((await call(inviteeJar,"POST","/api/razorpay/order",{plan:"pro"})).status,503);
  assert.equal((await call(inviteeJar,"GET","/api/auth/me")).data.user.plan,"free");
  check("unconfigured payments do not create an order or upgrade the account",()=>{});
  assert.equal((await call(inviteeJar,"POST","/api/auth/verification/send",{})).status,503);
  check("unconfigured email reports unavailable instead of claiming sent",()=>{});
  const owner=(await db.query("select * from public.users where role='super_admin' order by created_at limit 1")).rows[0];
  const auth=require("../auth"), admin=require("../admin");
  const broadcast=await admin.broadcastNotification(auth.publicUser(owner),{audience:"all",title:"Isolated QA",message:"Real local broadcast regression."});
  check("admin broadcast completes and its audit message is defined",()=>assert.equal(broadcast.success,true));
  const audit=(await db.query("select after_data from public.admin_audit_log where actor_id=$1 and action='broadcast_sent' order by created_at desc limit 1",[owner.id])).rows[0];
  assert.match(audit.after_data.message,/Real local broadcast/);
  const out=path.resolve(__dirname,"../audit_results/postgres-isolated");
  fs.writeFileSync(path.join(out,"referral-http.mp4"),exported.data);
  fs.writeFileSync(path.join(out,"referral-http-evidence.json"),JSON.stringify({testedAt:new Date().toISOString(),checks,scope:"Real local Express + PostgreSQL + Chromium/ffmpeg; token delivery supplied directly for QA, not an email delivery test"},null,2));
  console.log(`${checks.length} integrated HTTP/referral/payment-unavailable checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.getPool().end());
