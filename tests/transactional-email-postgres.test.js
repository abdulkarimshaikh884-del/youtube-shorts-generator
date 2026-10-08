"use strict";
// Real isolated PostgreSQL, mock provider: never sends mail to a person.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
require("./helpers/isolated-postgres").assertIsolatedPostgres();
const { Pool } = require("pg");
const db = require("../db");
const original = { query: db.query, tx: db.tx, fetch: global.fetch };
const pool = new Pool({ host:"127.0.0.1",port:55437,user:"shortscraft_app",password:"local-qa-only-not-production",database:"shortscraft_qa",ssl:false });
db.query = (...args) => pool.query(...args);
db.tx = async fn => { const c=await pool.connect(); try {await c.query("begin");const result=await fn(c);await c.query("commit");return result;} catch(e){await c.query("rollback");throw e;} finally{c.release();} };
process.env.TRANSACTIONAL_EMAILS_ENABLED="true";
process.env.RESEND_API_KEY="mock-only-never-a-real-key";
process.env.AUTH_FROM_EMAIL="ShortsCraft <no-reply@mail.example.test>";
process.env.PUBLIC_SITE_URL="https://shortscraft.online";
const mailer=require("../mailer");
const events=require("../email-events");
const sends=[];
let failStatus=null;
global.fetch=async (url,opts)=>{
  assert.equal(url,"https://api.resend.com/emails");
  const payload=JSON.parse(opts.body);
  assert(payload.to[0].endsWith("@example.test"));
  sends.push({key:opts.headers["Idempotency-Key"],payload});
  if(failStatus) return {ok:false,status:failStatus};
  return {ok:true,json:async()=>({id:"mock-provider-id"})};
};
const userId=crypto.randomUUID();
const extraUsers=[];
let passed=0;
const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{passed++;console.log("PASS "+name);});
async function unpace(){await db.query("update public.email_outbox set last_attempt_at=now()-interval '2 seconds' where user_id=$1",[userId]);}
async function row(key){return (await db.query("select * from public.email_outbox where user_id=$1 and payload->>'subject'=$2",[userId,key])).rows[0];}
(async()=>{
  await db.query("insert into public.users(id,email,password_hash,handle,display_name) values($1,$2,'fixture',$3,'Mail QA')",[userId,`mail-${userId}@example.test`,"@mail_"+userId.replace(/-/g,"").slice(0,20)]);
  await check("one welcome on duplicate concurrent callbacks",async()=>{
    const result=await Promise.all(Array.from({length:8},()=>events.enqueue({userId,kind:"welcome",eventKey:"created",data:{displayName:"<script>"}})));
    assert.equal(result.filter(Boolean).length,1);
    const r=await row("Welcome to ShortsCraft");assert(r.payload.html.includes("&lt;script&gt;"));assert(!r.payload.html.includes("<script>"));
  });
  await check("provider acceptance tracked honestly, no duplicate flush",async()=>{
    await events.flush();const r=await row("Welcome to ShortsCraft");assert.equal(r.status,"accepted");assert.equal(r.provider_id,"mock-provider-id");
    await unpace();await events.flush();assert.equal(sends.length,1);
  });
  await check("unsupported events and inactive money never queue",async()=>{
    assert.equal(await events.enqueue({userId,kind:"spam",eventKey:"x"}),false);
    assert.equal(await events.enqueue({userId,kind:"purchase_receipt",eventKey:"pay",data:{amountPaise:9900,reference:"payment-id"}}),false);
  });
  await check("disabled rollout makes no database/provider calls",async()=>{
    process.env.TRANSACTIONAL_EMAILS_ENABLED="false";assert.equal(await events.enqueue({userId,kind:"welcome",eventKey:"disabled"}),false);await events.flush();assert.equal(sends.length,1);process.env.TRANSACTIONAL_EMAILS_ENABLED="true";
  });
  await check("bad email event cannot abort successful business transaction",async()=>{
    await db.tx(async c=>{assert.equal(await events.enqueueSafe({userId,kind:"template_status",eventKey:"bad",data:{status:"invalid"}},c),false);await c.query("update public.users set display_name='Transaction survived' where id=$1",[userId]);});
    assert.equal((await db.query("select display_name from public.users where id=$1",[userId])).rows[0].display_name,"Transaction survived");
  });
  await check("outer rollback also rolls back queued event",async()=>{
    await assert.rejects(db.tx(async c=>{await events.enqueue({userId,kind:"google_linked",eventKey:"rollback"},c);throw Error("rollback fixture");}));
    assert.equal((await db.query("select count(*)::int as n from public.email_outbox where user_id=$1 and kind='google_linked'",[userId])).rows[0].n,0);
  });
  await check("actual PostgreSQL statement error is recovered by savepoint",async()=>{
    await db.tx(async c=>{
      const wrapped={query:(sql,params)=>sql.startsWith("insert into public.email_outbox")?c.query("select missing_email_column from public.users"):c.query(sql,params)};
      assert.equal(await events.enqueueSafe({userId,kind:"google_linked",eventKey:"sql-error"},wrapped),false);
      assert.equal((await c.query("select 1 as alive")).rows[0].alive,1);
    });
  });
  await check("temporary provider failure persists retry and identical payload/key",async()=>{
    await events.enqueue({userId,kind:"password_changed",eventKey:"changed"});await unpace();failStatus=503;await events.flush();
    let r=await row("Your ShortsCraft password was changed");assert.equal(r.status,"pending");assert.equal(r.last_error,"provider_503");
    const first=sends[sends.length-1];await db.query("update public.email_outbox set next_attempt_at=now(),last_attempt_at=now()-interval '2 seconds' where id=$1",[r.id]);
    failStatus=null;await events.flush();r=await row("Your ShortsCraft password was changed");assert.equal(r.status,"accepted");assert.deepEqual(sends[sends.length-1],first);
  });
  await check("uncertain attempts older than 23 hours require review, no blind resend",async()=>{
    await events.enqueue({userId,kind:"new_device",eventKey:"stale",data:{browser:"Chrome on Android"}});const r=await row("New browser login to your ShortsCraft account");
    await db.query("update public.email_outbox set first_attempt_at=now()-interval '25 hours',status='sending',lease_until=now()-interval '1 minute',attempts=1 where id=$1",[r.id]);await unpace();const before=sends.length;await events.flush();assert.equal(sends.length,before);assert.equal((await row(r.payload.subject)).status,"review");
  });
  await check("permanent provider rejection moves to review",async()=>{
    await events.enqueue({userId,kind:"google_linked",eventKey:"permanent"});await unpace();failStatus=422;await events.flush();failStatus=null;assert.equal((await row("Google sign-in connected to ShortsCraft")).status,"review");
  });
  await check("changed recipient cancels old-address notification",async()=>{
    await events.enqueue({userId,kind:"support_reply",eventKey:"ticket-1",data:{reference:"ticket-1"}});
    await db.query("update public.users set email=$2 where id=$1",[userId,`changed-${userId}@example.test`]);await unpace();const before=sends.length;await events.flush();assert.equal(sends.length,before);
    assert.equal((await db.query("select status from public.email_outbox where user_id=$1 and kind='support_reply'",[userId])).rows[0].status,"cancelled");
  });
  await check("shared rolling budget and pacing block additional sends",async()=>{
    const queued=await events.enqueue({userId,kind:"template_status",eventKey:"budget",data:{status:"published",title:"Budget QA"}});assert(queued);
    process.env.TRANSACTIONAL_EMAILS_DAILY_LIMIT="1";await unpace();const before=sends.length;await events.flush();assert.equal(sends.length,before);
    delete process.env.TRANSACTIONAL_EMAILS_DAILY_LIMIT;
    await db.query("update public.email_outbox set status='cancelled',payload='{}' where user_id=$1 and kind='template_status'",[userId]);
  });
  await check("all templates are bounded, escaped, use site links, exclude private payment fields",async()=>{
    for(const kind of ["welcome","new_device","password_changed","google_linked","referral_reward","purchase_receipt","withdrawal_requested","withdrawal_processed","withdrawal_rejected","support_reply","template_status"]){
      const p=mailer.transactionalPayload({to:"fixture@example.test",kind,data:{displayName:"<img>",title:"<script>",status:"published",reference:"fixture-123",amountPaise:19900,credits:10,product:"Pro",upi:"sensitive@bank",url:"https://attacker.invalid"}});
      assert(p.html.includes('name="viewport"'));assert(p.text.includes("https://shortscraft.online"));assert(!JSON.stringify(p).includes("sensitive@bank"));assert(!JSON.stringify(p).includes("attacker.invalid"));assert(!p.html.includes("<script>"));
    }
  });
  await check("private tables have RLS and no anon/authenticated privileges",async()=>{
    const result=await db.query("select relname,relrowsecurity from pg_class where oid in ('public.email_outbox'::regclass,'public.account_devices'::regclass)");assert.equal(result.rows.length,2);assert(result.rows.every(r=>r.relrowsecurity));
    const acl=await db.query("select has_table_privilege('anon','public.email_outbox','SELECT') as a,has_table_privilege('authenticated','public.account_devices','SELECT') as b");assert.equal(acl.rows[0].a,false);assert.equal(acl.rows[0].b,false);
  });
  const auth=require("../auth"),authEmail=require("../auth-email");
  // Test hooks without the opportunistic background timer racing assertions.
  events.schedule=()=>{};
  function response(){const headers={};return {headers,getHeader:key=>headers[key],setHeader:(key,value)=>{headers[key]=value;},append:(key,value)=>{headers[key]=[...(headers[key]||[]),value];}};}
  const newEmail=`authmail-${userId}@example.test`,password="Isolated-mail-test-123";
  const signed=await auth.signUp(response(),newEmail,password,"authmail_"+userId.replace(/-/g,"").slice(0,18));extraUsers.push(signed.user.id);
  const count=async(kind,id=signed.user.id)=>(await db.query("select count(*)::int as n from public.email_outbox where user_id=$1 and kind=$2",[id,kind])).rows[0].n;
  await check("signup welcome is persisted once, invalid signup sends none",async()=>{
    assert.equal(await count("welcome"),1);assert((await auth.signUp(response(),newEmail,password)).error);assert.equal(await count("welcome"),1);
  });
  const req={headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0) Chrome/123.0 Safari/537.36"}};
  const browserRes=response();await authEmail.rememberBrowser(req,browserRes,signed.user,{baseline:true});
  const cookie=browserRes.headers["Set-Cookie"][0];
  await check("signup baseline sets HttpOnly browser cookie without redundant alert",async()=>{
    assert(cookie.includes("HttpOnly; SameSite=Lax"));assert.equal(await count("new_device"),0);
    const device=(await db.query("select device_hash,browser_label from public.account_devices where user_id=$1",[signed.user.id])).rows[0];assert.match(device.device_hash,/^[a-f0-9]{64}$/);assert.equal(device.browser_label,"Chrome on Windows");assert(!cookie.includes(device.device_hash));
  });
  await check("known browser login does not repeat security alert",async()=>{
    const logged=await auth.logIn(response(),newEmail,password);assert(logged.user);await authEmail.rememberBrowser({headers:{...req.headers,cookie:cookie.split(";")[0]}},response(),logged.user);assert.equal(await count("new_device"),0);
  });
  await check("new browser creates only one security alert, even with concurrent requests",async()=>{
    const newCookie="sc_device="+crypto.randomBytes(32).toString("base64url");
    await Promise.all(Array.from({length:5},()=>authEmail.rememberBrowser({headers:{cookie:newCookie,"user-agent":"Firefox/100 Android"}},response(),signed.user)));
    assert.equal(await count("new_device"),1);assert((await auth.logIn(response(),newEmail,"wrong")).error);assert.equal(await count("new_device"),1);
  });
  await check("reset completion creates security event once and invalidates old password",async()=>{
    const reset=await auth.requestPasswordReset(newEmail);assert((await auth.resetPassword(response(),reset.token,"Changed-mail-test-123")).user);assert((await auth.resetPassword(response(),reset.token,"Changed-mail-test-123")).error);assert.equal(await count("password_changed"),1);assert((await auth.logIn(response(),newEmail,password)).error);
    const payload=(await db.query("select payload from public.email_outbox where user_id=$1 and kind='password_changed'",[signed.user.id])).rows[0].payload;assert(!JSON.stringify(payload).includes(reset.token));
  });
  await check("Google signup welcome and explicit link security events are not repeated",async()=>{
    const info={sub:"emailqa_"+userId,email:`googlemail-${userId}@example.test`,email_verified:true,name:"Google Mail QA"};
    const google=await auth.googleAccount(response(),info);extraUsers.push(google.user.id);assert.equal(google.created,true);assert.equal(await count("welcome",google.user.id),1);assert.equal((await auth.googleAccount(response(),info)).created,false);assert.equal(await count("welcome",google.user.id),1);
    const linked=await auth.googleAccount(response(),{...info,sub:"linkqa_"+userId,email:newEmail},signed.user.id);assert.equal(linked.linkedNow,true);assert.equal(await count("google_linked"),1);assert.equal((await auth.googleAccount(response(),{...info,sub:"linkqa_"+userId,email:newEmail},signed.user.id)).linkedNow,false);assert.equal(await count("google_linked"),1);
  });
  await check("staff support reply queues metadata only; user reply queues no email",async()=>{
    const support=require("../support");const ticket=await support.createTicket(signed.user,{subject:"Email integration QA",message:"Private support question for isolated testing."});assert(ticket.success);
    const owner={...signed.user,role:"super_admin"};assert((await support.addMessage(owner,ticket.ticket.id,"Sensitive private support reply")).success);
    assert.equal(await count("support_reply"),1);const out=(await db.query("select payload from public.email_outbox where user_id=$1 and kind='support_reply'",[signed.user.id])).rows[0].payload;assert(!JSON.stringify(out).includes("Sensitive private"));assert(out.text.includes(ticket.ticket.id));
    assert((await support.addMessage(signed.user,ticket.ticket.id,"User reply is not a staff event")).success);assert.equal(await count("support_reply"),1);
  });
  await check("moderation change queues once and excludes private review notes",async()=>{
    const notify=require("../notify");const after={id:crypto.randomUUID(),author_id:signed.user.id,title:"Mail moderation QA",status:"rejected",review_note:"Private reason not for inbox"};
    await notify.templateModerated({id:userId},{status:"review"},after);assert.equal(await count("template_status"),1);
    await notify.templateModerated({id:userId},after,after);assert.equal(await count("template_status"),1);
    const payload=(await db.query("select payload from public.email_outbox where user_id=$1 and kind='template_status'",[signed.user.id])).rows[0].payload;assert(!JSON.stringify(payload).includes("Private reason"));
  });
  await check("qualifying referral emits exactly two reward emails on concurrent replay",async()=>{
    process.env.REFERRALS_ENABLED="true";const referrals=require("../referrals"),credits=require("../credits");
    const code=(await referrals.summary(signed.user)).code;
    const info={sub:"refmail_"+userId,email:`refmail-${userId}@example.test`,email_verified:true,name:"Referral Mail QA"};
    const invited=await auth.googleAccount(response(),info,null,code);extraUsers.push(invited.user.id);
    await credits.ensureRecord("u:"+invited.user.id,"free");
    const tx=await db.query("insert into public.credit_transactions(credit_key,user_id,kind,amount,balance_after,idempotency_key) values($1,$2,'export',-1,4,$3) returning id",["u:"+invited.user.id,invited.user.id,"email-export-"+userId]);
    await Promise.all(Array.from({length:4},()=>referrals.successfulExport(invited.user,tx.rows[0].id)));
    assert.equal(await count("referral_reward"),1);assert.equal(await count("referral_reward",invited.user.id),1);delete process.env.REFERRALS_ENABLED;
  });
  console.log(`${passed} transactional email PostgreSQL checks passed; real email delivery NOT exercised.`);
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{
  await pool.query("delete from public.users where id=any($1::uuid[])",[[userId,...extraUsers]]);await pool.end();db.query=original.query;db.tx=original.tx;global.fetch=original.fetch;
});
