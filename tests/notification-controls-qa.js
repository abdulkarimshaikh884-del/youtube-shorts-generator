"use strict";
// Owned local PostgreSQL + actual HTTP/browser UI. Only push permission transport is simulated.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{Pool}=require("pg"),browserTools=require("./qa-browser");
require("./helpers/isolated-postgres").assertIsolatedPostgres();
const base="http://127.0.0.1:3341",out=path.resolve("audit_results/notification-controls");
const pool=new Pool({connectionString:"postgresql://postgres:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa",ssl:false});
const ids=[];let browser;
function jar(){let cookies={};return {cookies,call:async(route,method="GET",body)=>{const r=await fetch(base+route,{method,headers:{Cookie:Object.entries(cookies).map(([k,v])=>k+"="+v).join("; "),"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});for(const line of r.headers.getSetCookie()){const p=line.split(";")[0],at=p.indexOf("=");cookies[p.slice(0,at)]=p.slice(at+1);}return {status:r.status,data:await r.json()};}};}
(async()=>{
  const a=jar(),b=jar(),guest=jar(),suffix=crypto.randomBytes(6).toString("hex");
  for(const [j,n] of [[a,"a"],[b,"b"]]){const r=await j.call("/api/auth/signup","POST",{email:`notes-${n}-${suffix}@example.invalid`,handle:`notes_${n}_${suffix}`,password:"Local-QA-strong-password-2026"});assert.equal(r.status,200,JSON.stringify(r));ids.push(r.data.user.id);}
  await pool.query("update public.notifications set read_at=now(),pushed_at=now() where user_id=any($1::uuid[])",[ids]);
  async function seed(type,entity,message){return (await pool.query("insert into public.notifications(user_id,type,entity_type,message) values($1,$2,$3,$4) returning id",[ids[0],type,entity,message])).rows[0].id;}
  const follow=await seed("follow","creator","started following you"),comment=await seed("comment","template","commented on your template");
  assert.equal((await guest.call("/api/notifications/"+follow,"DELETE")).status,401);
  assert.equal((await b.call("/api/notifications/"+follow,"DELETE")).status,404);
  assert.equal((await b.call("/api/notifications/"+follow+"/mute","PUT",{active:true})).status,404);
  assert.equal((await a.call("/api/notifications/not-an-id/mute","PUT",{active:true})).status,400);
  assert.equal((await a.call("/api/notifications/"+follow+"/mute","PUT",{active:"true"})).status,400);
  console.log("PASS delete/mute authentication, ownership and input validation");
  const security=(await pool.query("select relrowsecurity from pg_class where oid='public.notification_mutes'::regclass")).rows[0];assert.equal(security.relrowsecurity,true);
  for(const role of ["anon","authenticated"]) assert.equal((await pool.query("select has_table_privilege($1,'public.notification_mutes','SELECT') as allowed",[role])).rows[0].allowed,false);
  console.log("PASS private mute table: RLS enabled, no public Data API access");
  browser=await browserTools.launch({headless:true});const page=await browser.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.setCookie(...Object.entries(a.cookies).map(([name,value])=>({name,value,url:base,httpOnly:true})));
  await page.evaluateOnNewDocument(()=>{
    if (window.top !== window) return; // App template previews use sandboxed child frames.
    let permission=sessionStorage.getItem("qa_push")==="on"?"granted":"default",subscription=null;
    const sub={endpoint:"https://push.example.invalid/test",options:{},toJSON:()=>({endpoint:"https://push.example.invalid/test",keys:{p256dh:"fixture",auth:"fixture"}}),unsubscribe:async()=>{subscription=null;return true;}};
    if(permission==="granted")subscription=sub;
    const reg={pushManager:{getSubscription:async()=>subscription,subscribe:async()=>{subscription=sub;return sub;}}};
    Object.defineProperty(Notification,"permission",{get:()=>permission});Notification.requestPermission=async()=>{permission="granted";sessionStorage.setItem("qa_push","on");return permission;};
    Object.defineProperty(navigator,"serviceWorker",{value:{getRegistration:async()=>reg,register:async()=>reg,ready:Promise.resolve(reg),addEventListener:()=>{}}});
  });
  await page.setRequestInterception(true);let failAction=false;
  page.on("request",r=>{const u=new URL(r.url());if(["data:","blob:","about:"].includes(u.protocol))return r.continue();if(u.origin!==base)return r.abort();
    if(u.pathname.startsWith("/api/push/"))return r.respond({status:200,contentType:"application/json",body:JSON.stringify({success:true,publicKey:"AQID"})});
    if(failAction&&r.method()==="DELETE"&&u.pathname.startsWith("/api/notifications/"))return r.respond({status:503,contentType:"application/json",body:'{"success":false}'});
    return r.continue();});
  await page.setViewport({width:1440,height:1000});await page.goto(base+"/account/notifications",{waitUntil:"networkidle2"});await page.waitForSelector("#accountNotificationList .sh-notification-actions");
  assert.equal(await page.$eval(".pf-detail-back",e=>e.textContent),"←");assert.equal(await page.$eval("#accountPageHeading",e=>e.textContent),"Notifications");
  assert.equal(await page.$eval("#accountNotificationsRead",e=>e.parentElement.className),"pf-detail-head");assert(!(await page.$eval("#accountDetail",e=>e.textContent)).includes("Your notifications"));
  await page.waitForFunction(()=>!document.querySelector("#pushSettingsBtn").hidden);await page.click("#pushSettingsBtn");await page.waitForFunction(()=>document.querySelector("#pushSettingsBtn").closest("[data-push-row]").hidden);
  console.log("PASS compact arrow/title/Mark all read header; permission prompt disappears on enable");
  const selector=id=>'#accountNotificationList [data-notification-id="'+id+'"]';
  async function choose(id,text){await page.click(selector(id)+" summary");const buttons=await page.$$(selector(id)+" .sh-notification-options button");for(const button of buttons){if((await button.evaluate(e=>e.textContent)).includes(text)){await button.click();return;}}throw Error("Missing menu action "+text);}
  await choose(follow,"Mute similar");await page.waitForSelector(selector(follow)+" .sh-notification-muted");
  await page.reload({waitUntil:"networkidle2"});assert(await page.$(selector(follow)+" .sh-notification-muted"));assert.equal(await page.$eval("#pushSettingsBtn",e=>e.closest("[data-push-row]").hidden),true);
  const future=await seed("follow","creator","another future follow");const listed=await a.call("/api/notifications");assert(listed.data.notifications.find(n=>n.id===future).muted);assert.equal(listed.data.unread,1);assert.equal((await a.call("/api/notifications/unread")).data.latest.id,comment);
  // Exercise the actual delivery module against this same owned DB, with a fake sender.
  process.env.DATABASE_URL="postgresql://shortscraft_app:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa?sslmode=disable";
  const notify=require("../notify"),sent=[];notify._setSender(async(_sub,payload)=>{sent.push(JSON.parse(payload));});
  await pool.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,$2,$3,$4)",[ids[0],"https://fcm.googleapis.com/fcm/send/qa-"+suffix,"a".repeat(64),"b".repeat(24)]);
  await notify.flush();assert(!sent.some(n=>n.id===future||n.id===follow));assert(sent.some(n=>n.id===comment));
  console.log("PASS category mute persists, future unread/toast suppressed, real push selection skips muted alerts");
  await choose(follow,"Unmute");await page.waitForFunction(sel=>!document.querySelector(sel+" .sh-notification-muted"),{},selector(follow));
  assert.equal((await a.call("/api/notifications")).data.notifications.find(n=>n.id===future).muted,false);
  assert.equal((await a.call("/api/notifications")).data.notifications.find(n=>n.id===future).read,true);
  const resumed=await seed("follow","creator","follow alerts resumed");assert.equal((await a.call("/api/notifications/unread")).data.unread,2);
  console.log("PASS Unmute resumes future alerts");
  failAction=true;await choose(comment,"Delete");await page.waitForFunction(()=>document.body.textContent.includes("Could not update notification"));assert(await page.$(selector(comment)));failAction=false;
  await page.reload({waitUntil:"networkidle2"});await choose(comment,"Delete");await page.waitForFunction(sel=>!document.querySelector(sel),{},selector(comment));assert(!(await a.call("/api/notifications")).data.notifications.some(n=>n.id===comment));
  await page.reload({waitUntil:"networkidle2"});assert(!await page.$(selector(comment)));console.log("PASS deletion persists; failed deletion preserves the notification");
  await page.click("#accountNotificationsRead");await page.waitForFunction(()=>document.querySelector("#notificationCount").hidden);
  assert.equal((await a.call("/api/notifications/unread")).data.unread,0);
  fs.mkdirSync(out,{recursive:true});
  for(const width of [1440,390])for(const theme of ["light","dark"]){await page.setViewport({width,height:900});await page.evaluate(t=>{localStorage.setItem("sc_theme",t);document.documentElement.dataset.theme=t;},theme);await page.reload({waitUntil:"networkidle2"});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.click(selector(resumed)+" summary");await page.screenshot({path:path.join(out,`notifications-${width}-${theme}.png`)});await page.keyboard.press("Escape");assert.equal(await page.$eval(selector(resumed)+" details",e=>e.open),false);}
  assert.deepEqual(errors,[]);console.log("PASS mark all read, menu Escape, 390/1440 light/dark fit and visual evidence; no page errors");
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(ids.length)await pool.query("delete from public.users where id=any($1::uuid[])",[ids]);await pool.end();if(process.env.DATABASE_URL)await require("../db").getPool().end();});
