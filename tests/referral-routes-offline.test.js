"use strict";
// Execute the actual Express route handlers with dependency stubs. No .env,
// database connection, SMTP/provider call or production writes in this test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname,"../server.js"),"utf8");
const routes = {};
let enabled = true, configured = true, fail = "", status = 200;
const calls = [];
const referrals = {
  enabled:()=>enabled,
  async summary(user) { if (fail === "summary") throw Error("private database detail"); return user ? {success:true,enabled,code:"qa_code_12345678"} : {status:401,error:"Please log in."}; },
  async history(user) { if (fail === "history") throw Error("private database detail"); return user ? {success:true,items:[],hasMore:false} : {status:401,error:"Please log in."}; },
  async createVerification(user,options) { assert.equal(options.enforceCooldown,true); if (fail === "token") throw Error("private token detail"); if(fail==="cooldown") return {error:"Please wait before sending again.",status:429,retryAfter:60}; calls.push("create"); return {token:"a".repeat(43),tokenHash:"test-hash"}; },
  async verifyEmail(user) { if (fail === "verify") throw Error("private database detail"); return !user ? {status:401,error:"Please log in."} : {status,success:status===200}; }
};
const mailer = {configured:()=>configured,async sendEmailVerification(data) { if (fail === "mail") throw Error("private provider detail"); calls.push(data); }};
vm.runInNewContext(source.slice(source.indexOf('app.get("/api/referrals"'),source.indexOf('app.post("/api/auth/forgot"')),{
  app:{get:(url,...handlers)=>routes[url]=handlers.at(-1),post:(url,...handlers)=>routes[url]=handlers.at(-1)},
  rateLimit:()=>()=>{},referrals,mailer,publicSiteUrl:()=>"https://qa.example.test",console:{error:()=>{}}
});
async function run(url,user={id:"qa",email:"preview@example.test"}) {
  const response = {statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
  await routes[url]({user,query:{},body:{token:"a".repeat(43)}},response);
  return response;
}
(async()=>{
  let r = await run("/api/referrals",null); assert.equal(r.statusCode,401); assert.equal(r.headers["Cache-Control"],"no-store");
  r = await run("/api/auth/verification/send",null); assert.equal(r.statusCode,401); assert.equal(calls.length,0);
  enabled=false; assert.equal((await run("/api/auth/verification/send")).statusCode,503); assert.equal((await run("/api/auth/verification/confirm")).statusCode,503); assert.equal(calls.length,0);
  enabled=true; configured=false; assert.equal((await run("/api/auth/verification/send")).statusCode,503); assert.equal(calls.length,0); configured=true;
  assert.equal((await run("/api/referrals/history",null)).statusCode,401);
  for (const [failure,url] of [["summary","/api/referrals"],["history","/api/referrals/history"],["token","/api/auth/verification/send"],["mail","/api/auth/verification/send"],["verify","/api/auth/verification/confirm"]]) {
    fail=failure; r=await run(url); assert.equal(r.statusCode,503); assert(!JSON.stringify(r.body).includes("private"));
  }
  fail="cooldown"; const before=calls.length; r=await run("/api/auth/verification/send"); assert.equal(r.statusCode,429); assert.equal(r.headers["Retry-After"],"60"); assert.equal(calls.length,before);
  fail=""; r=await run("/api/auth/verification/send"); assert.equal(r.statusCode,200); assert.match(r.body.message,/inbox/);
  assert.match(calls.at(-1).verificationUrl,/^https:\/\/qa\.example\.test\/account\?verify=a{43}#referrals$/);
  assert.equal((await run("/api/auth/verification/confirm",null)).statusCode,401);
  status=400; assert.equal((await run("/api/auth/verification/confirm")).statusCode,400);
  status=200; assert.equal((await run("/api/auth/verification/confirm")).statusCode,200);
  console.log("PASS real referral route handlers: auth/config guards, DB/provider failure recovery, safe errors, confirmation statuses, account referral return URL. Dependency stubs only; no delivery or real credit grants.");
})().catch(err=>{console.error(err);process.exitCode=1;});
