"use strict";
// Real application modules and PostgreSQL; never load .env or target production.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {execFileSync} = require("node:child_process");
const {Pool} = require("pg");
require("./helpers/isolated-postgres").assertIsolatedPostgres();
process.env.DATABASE_URL = "postgresql://shortscraft_app:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa?sslmode=disable";
process.env.REFERRALS_ENABLED = "true"; process.env.NODE_ENV = "test";
process.env.CREDITS_SECRET = "isolated-postgres-test-secret";
delete process.env.SUPER_ADMIN_EMAILS;
const db = require("../db"), auth = require("../auth"), credits = require("../credits"), referrals = require("../referrals"), admin = require("../admin");
const root = path.resolve(__dirname,"..");
const setup = new Pool({connectionString:"postgresql://postgres:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa",ssl:false});
const suffix = crypto.randomBytes(4).toString("hex");
const password = "Isolated-strong-password-2026";
const checks = [];
function check(label, fn) {fn(); checks.push(label); console.log("PASS " + label);}
function res() {return {headers:{},getHeader(k){return this.headers[k];},setHeader(k,v){this.headers[k]=v;}};}
const cookie = response => [].concat(response.headers["Set-Cookie"] || [])[0]?.split(";")[0];
async function create(name, code) {
  const result = await auth.signUp(res(),`${name}-${suffix}@example.com`,password,`${name}_${suffix}`,code);
  assert.ok(result.user, result.error); return result.user;
}
function req(user, idem=crypto.randomUUID()) {return {user,headers:{},body:{},path:"/api/export",credits:{key:"u:"+user.id,token:"isolated"},get:() => idem};}
async function balance(user) {return (await db.query("select * from public.credits where key=$1",["u:"+user.id])).rows[0];}
async function charged(user) {const r=req(user); assert.equal((await credits.charge(r,"export")).ok,true); return r;}
(async () => {
  const version = await db.query("select version() as version");
  check("real PostgreSQL 17 app-role connection",()=>assert.match(version.rows[0].version,/PostgreSQL 17/));
  // Same 15 assertions as referral_access.test.sql, using catalog queries so
  // the portable runtime does not require an unavailable pgTAP extension.
  const rls = await setup.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('referrals','referral_codes','email_verification_tokens')");
  check("three referral tables have real PostgreSQL RLS",()=>{assert.equal(rls.rows.length,3);assert(rls.rows.every(r=>r.relrowsecurity));});
  const denied = await setup.query("select not has_table_privilege('anon', t.name, p.privilege) and not has_table_privilege('authenticated', t.name, p.privilege) as denied from (values ('public.referrals'),('public.referral_codes'),('public.email_verification_tokens')) t(name) cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(privilege)");
  check("12 real browser-role referral privilege denials",()=>{assert.equal(denied.rows.length,12);assert(denied.rows.every(r=>r.denied));});
  const inviter = await create("inviter"), invitee = await create("invitee");
  const owner = await create("owner");
  await setup.query("update public.users set role='super_admin' where id=$1",[owner.id]); owner.role="super_admin";
  const races = await Promise.all([auth.signUp(res(),`race-${suffix}@example.com`,password,`racea_${suffix}`), auth.signUp(res(),`RACE-${suffix}@example.com`,password,`raceb_${suffix}`)]);
  check("concurrent case-insensitive duplicate email rejected without a 500",()=>{assert.equal(races.filter(r=>r.user).length,1); assert.equal(races.filter(r=>r.error).length,1);});
  const handles = await Promise.all([auth.signUp(res(),`handlea-${suffix}@example.com`,password,`unique_${suffix}`),auth.signUp(res(),`handleb-${suffix}@example.com`,password,`UNIQUE_${suffix}`)]);
  check("concurrent duplicate creator handles rejected",()=>{assert.equal(handles.filter(r=>r.user).length,1); assert.match(handles.find(r=>r.error).error,/handle.*taken/);});
  const loginRes=res(); await auth.logIn(loginRes,inviter.email,password);
  const sessionReq={headers:{cookie:cookie(loginRes)}}; await auth.middleware(sessionReq,res(),()=>{});
  check("real signup/login/session resolves the correct account",()=>{assert.equal(sessionReq.user.id,inviter.id); assert.equal(sessionReq.user.role,"user");});
  check("wrong and unknown login return the same message",()=>{});
  assert.deepEqual(await auth.logIn(res(),inviter.email,"wrong"),await auth.logIn(res(),`absent-${suffix}@example.com`,"wrong"));
  const reset=await auth.requestPasswordReset(inviter.email);
  const replacement="New-isolated-password-2026";
  assert.ok((await auth.resetPassword(res(),reset.token,replacement)).user);
  await auth.middleware(sessionReq,res(),()=>{});
  check("password reset invalidates old sessions and old password",()=>assert.equal(sessionReq.user,null));
  assert.ok((await auth.logIn(res(),inviter.email,password)).error);
  assert.ok((await auth.logIn(res(),inviter.email,replacement)).user);
  check("password reset token is consumed once",()=>{});
  assert.ok((await auth.resetPassword(res(),reset.token,replacement)).error);
  const logoutRes=res(); await auth.logIn(logoutRes,inviter.email,replacement);
  const logoutReq={headers:{cookie:cookie(logoutRes)}}; await auth.logOut(logoutReq,res()); await auth.middleware(logoutReq,res(),()=>{});
  check("logout destroys the real session",()=>assert.equal(logoutReq.user,null));
  const spender=await create("spender"); await credits.ensureRecord("u:"+spender.id,"free");
  await setup.query("update public.credits set left_credits=1,spent=4 where key=$1",["u:"+spender.id]);
  const spend=await Promise.all(Array.from({length:10},()=>credits.charge(req(spender),"export")));
  check("ten concurrent spends cannot overdraft one remaining credit",()=>{assert.equal(spend.filter(b=>b.ok).length,1);});
  assert.equal((await balance(spender)).left_credits,0);
  const replayer=await create("replayer"); const key=crypto.randomUUID();
  const replay=await Promise.all(Array.from({length:10},()=>credits.charge(req(replayer,key),"export")));
  check("ten concurrent requests admit one operation and reject nine replays without a second debit",()=>{assert.equal(replay.filter(b=>b.ok && b.charged===1).length,1); assert.equal(replay.filter(b=>!b.ok && b.status===409 && b.code==="CREDIT_OPERATION_REPLAY" && b.reused && b.charged===0).length,9);});
  assert.equal((await balance(replayer)).left_credits,4);
  const refundUser=await create("refunduser"); await credits.ensureRecord("u:"+refundUser.id,"free");
  await setup.query("update public.credits set left_credits=0,spent=5,bonus_credits=10 where key=$1",["u:"+refundUser.id]);
  const refundReq=await charged(refundUser); await Promise.all(Array.from({length:10},()=>credits.refund(refundReq,"export")));
  check("concurrent refunds restore bonus source exactly once",()=>{});
  const refunded=await balance(refundUser); assert.equal(refunded.left_credits,0); assert.equal(refunded.bonus_credits,10);
  const code=(await referrals.summary(inviter)).code;
  const referred=await create("referred",code);
  const token=await referrals.createVerification(referred);
  const stored=(await db.query("select token_hash from public.email_verification_tokens where user_id=$1",[referred.id])).rows[0];
  check("verification tokens are hashed in PostgreSQL",()=>{assert.equal(stored.token_hash,token.tokenHash); assert.notEqual(stored.token_hash,token.token);});
  assert.equal((await referrals.verifyEmail(invitee,token.token)).status,400);
  assert.equal((await referrals.verifyEmail(referred,token.token)).success,true);
  assert.equal((await referrals.verifyEmail(referred,token.token)).status,400);
  check("verification account binding and replay rejection",()=>{});
  assert.equal((await referrals.qualify(referred.id)).rewarded,false);
  check("verified account without a successful export cannot earn referral",()=>{});
  const charge=await charged(referred);
  await Promise.all(Array.from({length:10},()=>referrals.successfulExport(referred,charge._creditChargeIds.export)));
  const inviterBalance=await balance(inviter), referredBalance=await balance(referred);
  check("real PostgreSQL replay gives exactly 10 bonus credits to each",()=>{assert.equal(inviterBalance.bonus_credits,10); assert.equal(referredBalance.bonus_credits,10);});
  const candidates=[];
  for(let i=0;i<11;i++) {const user=await create("cap"+i,code); await setup.query("update public.users set email_verified_at=now() where id=$1",[user.id]); candidates.push({user,charge:await charged(user)});}
  await Promise.all(candidates.map(c=>referrals.successfulExport(c.user,c.charge._creditChargeIds.export)));
  const counts=(await db.query("select status,count(*)::int as total from public.referrals where inviter_id=$1 group by status",[inviter.id])).rows;
  check("concurrent inviter-month cap is exactly ten rewarded referrals",()=>{assert.equal(counts.find(c=>c.status==="rewarded").total,10); assert.equal(counts.find(c=>c.status==="limited").total,2);});
  assert.equal((await balance(inviter)).bonus_credits,100);
  const rollback=await create("rollback",code); // a different inviter avoids the exhausted cap
  const other=await create("otherinviter");
  await setup.query("update public.referrals set inviter_id=$2 where invitee_id=$1",[rollback.id,other.id]);
  await setup.query("update public.users set email_verified_at=now() where id=$1",[rollback.id]);
  const rollbackCharge=await charged(rollback);
  await setup.query(`create function public.qa_fail_referral() returns trigger language plpgsql as $$ begin
    if new.metadata->>'inviteeId' = '${rollback.id}' then raise exception 'injected local grant failure'; end if; return new; end $$;
    create trigger qa_fail_referral before insert on public.credit_transactions for each row execute function public.qa_fail_referral();`);
  const recoveredLater = await referrals.successfulExport(rollback,rollbackCharge._creditChargeIds.export);
  assert.equal(recoveredLater.recoveryPending,true,"successful export is not undone by an auxiliary reward failure");
  assert.equal((await db.query("select metadata->>'exportSucceeded' as proof from public.credit_transactions where id=$1",[rollbackCharge._creditChargeIds.export])).rows[0].proof,"true","actual completion proof survives the reward transaction rollback");
  check("a real SQL grant failure rolls back both referral awards",()=>{});
  assert.equal((await balance(rollback)).bonus_credits,0); assert.equal(await balance(other),undefined);
  await setup.query("drop trigger qa_fail_referral on public.credit_transactions; drop function public.qa_fail_referral()");
  assert.equal((await referrals.reconcile()).rewarded,1); assert.equal((await balance(rollback)).bonus_credits,10); assert.equal((await balance(other)).bonus_credits,10);
  assert.equal((await referrals.qualify(rollback.id)).rewarded,false,"recovered reward cannot be granted twice");
  check("referral retry after rollback awards once",()=>{});
  assert.equal((await admin.adjustUserBalance(invitee,referred.id,{type:"credits",delta:10,reason:"QA"})).status,403);
  assert.equal((await admin.setStaff(invitee,referred.id,{role:"admin"})).status,403);
  check("ordinary users cannot adjust balances or appoint staff",()=>{});
  assert.equal((await admin.adjustUserBalance(owner,invitee.id,{type:"credits",delta:10,reason:"Isolated QA"})).success,true);
  assert.equal((await balance(invitee)).left_credits,5); assert.equal((await balance(invitee)).bonus_credits,10);
  assert.equal((await admin.adjustUserBalance(owner,invitee.id,{type:"credits",delta:-11,reason:"Isolated QA"})).status,409);
  assert.equal((await admin.adjustUserBalance(owner,invitee.id,{type:"stars",delta:260,reason:"Isolated QA"})).success,true);
  const stars=(await db.query("select amount,kind,sender_id,note from public.star_transactions where receiver_id=$1",[invitee.id])).rows;
  check("real admin bonus adjustments preserve daily grant and Stars are not earnings",()=>{assert.deepEqual(stars.map(s=>s.amount).sort((a,b)=>a-b),[60,100,100]); assert.ok(stars.every(s=>s.kind==="admin_adjustment" && s.sender_id===null));});
  const out=path.join(root,"audit_results","postgres-isolated"); fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({testedAt:new Date().toISOString(),checks,mode:"Real PostgreSQL 17/application modules, isolated QA records only; no external provider or production writes",
    unverified:["HTTP middleware/rate limits", "actual Google or email delivery", "render-to-referral integration", "full admin financial actions", "production migration or restore"]},null,2));
  console.log(`${checks.length} real isolated PostgreSQL checks passed.`);
})().catch(err=>{console.error(err); process.exitCode=1;}).finally(async()=>{await db.getPool().end(); await setup.end();});
