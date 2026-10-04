"use strict";
// All writes go to the dedicated, labelled local PostgreSQL 17 container.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const {spawn,execFileSync} = require("node:child_process");
const root = path.resolve(__dirname,"..");
const own = JSON.parse(execFileSync("docker",["inspect","shortscraft-qa-pg17-20261002"],{encoding:"utf8",windowsHide:true}))[0];
assert.equal(own.Config.Labels["shortscraft.qa"],"true"); assert.equal(own.State.Running,true);
assert.deepEqual(own.HostConfig.PortBindings["5432/tcp"],[{HostIp:"127.0.0.1",HostPort:"55437"}]);
const env={...process.env,DATABASE_URL:"postgresql://shortscraft_app:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa?sslmode=disable",
  PORT:"3341",BASE_URL:"http://127.0.0.1:3341",PUBLIC_SITE_URL:"http://127.0.0.1:3341",NODE_ENV:"development",DISABLE_RATE_LIMIT:"true",REFERRALS_ENABLED:"true",
  CREDITS_SECRET:"isolated-test-secret-not-production-long-enough",ALLOW_DB_MUTATION_TESTS:"1",SC_ISOLATED_POSTGRES_QA:"true"};
for(const key of ["NVIDIA_API_KEY","GEMINI_API_KEY","GROQ_API_KEY","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","RESEND_API_KEY","AUTH_FROM_EMAIL","SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_KEY","VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","SUPER_ADMIN_EMAILS","GA_ID"]) env[key]="";
const guard=path.join(__dirname,"helpers/qa-local-only.js");
const app=spawn(process.execPath,["--require",guard,"server.js"],{cwd:root,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
const results=[];
app.stdout.on("data",d=>process.stdout.write(d)); app.stderr.on("data",d=>process.stderr.write(d));
(async()=>{
  const start=Date.now();
  while(true) {
    if(app.exitCode!==null) throw Error("Isolated server exited "+app.exitCode);
    try {if((await fetch(env.BASE_URL+"/api/health",{signal:AbortSignal.timeout(1000)})).ok) break;} catch {}
    if(Date.now()-start>15000) throw Error("Isolated server startup timed out");
    await new Promise(r=>setTimeout(r,250));
  }
  const suites=["verify_auth.js","verify_password_reset.js","verify_export.js","verify_credits.js","verify_admin.js","verify_projects.js","verify_social.js","verify_support.js","verify_publish.js","tests/referral-export-http.test.js","verify_staff.js","verify_notifications.js","verify_skills.js","verify_lottie.js","tests/design-storage-http.test.js","tests/free-release-http.test.js"];
  const requested=process.argv.slice(2);
  assert(requested.every(file=>suites.includes(file)),"Only registered local QA suites may be selected");
  for(const file of requested.length?requested:suites) {
    console.log("\nReal isolated HTTP suite: "+file);
    const status = await new Promise((resolve,reject)=>{
      let output="";
      const child=spawn(process.execPath,["--require",guard,file],{cwd:root,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
      child.stdout.on("data",d=>{output+=d;process.stdout.write(d);});
      child.stderr.on("data",d=>{output+=d;process.stderr.write(d);});
      const timer=setTimeout(()=>{child.kill();reject(Error(file+" timeout"));},240000);
      child.once("error",e=>{clearTimeout(timer);reject(e);}); child.once("close",code=>{
        clearTimeout(timer);
        const folder=path.join(root,"audit_results/postgres-isolated");fs.mkdirSync(folder,{recursive:true});
        fs.writeFileSync(path.join(folder,file.replace(/[\\/]/g,"_")+".log"),output);
        resolve(code);
      });
    });
    results.push({file,status:status===0?"PASS":"FAIL",exitCode:status});
  }
  const out=path.join(root,"audit_results/postgres-isolated",requested.length?"http-selected-evidence.json":"http-evidence.json");
  fs.writeFileSync(out,JSON.stringify({testedAt:new Date().toISOString(),results,
    boundary:"Real Express, custom auth, PostgreSQL 17, rendering and UI. All QA records local; external provider calls blocked; rate limiting disabled for regression volume, not certified."},null,2));
  console.log(JSON.stringify(results,null,2));
  if(results.some(r=>r.status==="FAIL")) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>app.kill());
