"use strict";
// Registered fixtures only. No production environment or provider calls.
const {spawnSync}=require("node:child_process");
const fs=require("node:fs"), path=require("node:path");
const root=path.resolve(__dirname,"..");
const files=[
  "tests/request-body-policy.test.js", "tests/free-release-policy.test.js",
  "tests/free-release-donation-alias.test.js", "tests/credit-idempotency-offline.test.js",
  "tests/credit-replay-routes-offline.test.js", "tests/admin-design-moderation-offline.test.js",
  "tests/admin-hardening-offline.test.js",
  "tests/admin-balances-offline.test.js", "tests/referrals-offline.test.js",
  "tests/referral-routes-offline.test.js", "tests/referral-hardening-offline.test.js",
  "tests/verification-mailer-offline.test.js", "tests/export-post-success-offline.test.js",
  "tests/google-auth-offline.test.js",
  "tests/image-validation-offline.test.js", "tests/design-storage-offline.test.js",
  "tests/design-concurrency-sql-offline.test.js", "tests/design-conversion-offline.test.js",
  "tests/design-assets-offline.test.js", "tests/polish-backend-offline.test.js",
  "tests/draft-sync-offline.test.js", "tests/design-save-safety.test.js",
  "tests/manual-pages-build.test.js"
];
const env={...process.env,NODE_ENV:"test",DATABASE_URL:"",MONETIZATION_ENABLED:"false"};
for(const key of ["NVIDIA_API_KEY","GEMINI_API_KEY","GROQ_API_KEY","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","RESEND_API_KEY","AUTH_FROM_EMAIL","SUPABASE_SERVICE_KEY"]) env[key]="";
const results=files.map(file=>{
  console.log("Running isolated launch regression: "+file);
  const result=spawnSync(process.execPath,[file],{cwd:root,env,windowsHide:true,stdio:"inherit",timeout:120000});
  return {file,status:result.status===0&&!result.error?"PASS":"FAIL",exitCode:result.status,error:result.error?.message};
});
fs.mkdirSync(path.join(root,"audit_results"),{recursive:true});
fs.writeFileSync(path.join(root,"audit_results/launch-offline-evidence.json"),JSON.stringify({testedAt:new Date().toISOString(),results,boundary:"Database-free isolated fixtures; actual durable/PostgreSQL and provider release checks are separate."},null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(result=>result.status!=="PASS")) process.exitCode=1;
