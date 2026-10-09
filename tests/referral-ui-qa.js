"use strict";
// DB-free browser fixtures only. Start tests/polish-preview-server.js first.
// Every API is intercepted; external requests and unmocked writes are blocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const browserQA = require("./qa-browser");
const base = "http://127.0.0.1:3327";
const out = path.join(__dirname,"../audit_results/referral-ui");
const checks = [], requests = [], errors = [], confirmations = [];
let mode = "ready", historyMode = "ready", guest = false, verified = false, sendMode = "success", confirmMode = "success", delay = 0;
const user = {id:"qa-referral-owner",email:"owner@example.test",handle:"qa_referral_owner",displayName:"QA Creator",plan:"free",role:"user",followers:0,following:0};
const summaries = {
  ready:{success:true,enabled:true,available:true,code:"qa_code_12345678",reward:10,monthlyLimit:10,rewarded:3,pending:2,this_month:1,emailVerified:false,totalInvited:6,bonusEarned:30,limited:1},
  disabled:{success:true,enabled:false,available:false},
  paused:{success:true,enabled:false,available:true,reward:10,monthlyLimit:10,rewarded:3,pending:2,this_month:1,emailVerified:false,totalInvited:6,bonusEarned:30,limited:1},
  legacy:{success:true,enabled:true,code:"qa_code_12345678",reward:10,monthlyLimit:10,rewarded:3,pending:2,this_month:1,emailVerified:false},
  invalid:{success:true,enabled:true,code:"not-a-valid-code",reward:10,monthlyLimit:10,rewarded:-1,pending:2,this_month:1},
  empty:{success:true,enabled:true,available:true,code:"qa_code_12345678",reward:10,monthlyLimit:10,rewarded:0,pending:0,this_month:0,emailVerified:false,totalInvited:0,bonusEarned:0,limited:0},
  cap:{success:true,enabled:true,available:true,code:"qa_code_12345678",reward:10,monthlyLimit:10,rewarded:10,pending:1,this_month:10,emailVerified:false,totalInvited:12,bonusEarned:100,limited:1}
};
function item(id,status) { return {id,displayLabel:"Referral "+id,status,createdAt:"2026-10-07T12:00:00Z",rewardedAt:status==="rewarded"?"2026-10-08T12:00:00Z":null,credits:status==="rewarded"?10:0}; }
const first = [item("opaque001","unverified"),item("opaque002","export_pending"),item("opaque003","rewarded"),item("opaque004","limited")];
function fixture(url,request) {
  if (url.pathname === "/api/auth/me") return {body:{success:true,user:guest?null:user}};
  if (url.pathname === "/api/credits") return {body:{success:true,plan:"free",planLabel:"Free",left:5,dailyLeft:5,perDay:5,bonusCredits:30,cost:{export:1,animate:2}}};
  if (url.pathname === "/api/referrals") {
    if (mode === "error") return {status:503,body:{success:false,error:"Referral details are temporarily unavailable. Please retry."}};
    return {body:{...summaries[mode],emailVerified:verified}};
  }
  if (url.pathname === "/api/referrals/history") {
    if (historyMode === "error") return {status:503,body:{success:false,error:"Activity temporarily unavailable. Please retry."}};
    if (mode === "legacy") return {status:404,body:{error:"Not found"}};
    if (mode === "empty") return {body:{success:true,available:true,items:[],hasMore:false,nextCursor:null}};
    if (historyMode === "invalid") return {body:{success:true,items:[{id:"bad",status:"invented",displayLabel:"<img src=x onerror=alert(1)>"}],hasMore:false,nextCursor:null}};
    if (historyMode === "prototype") return {body:{success:true,items:[{id:"bad",status:"constructor",displayLabel:"Referral opaque008"}],hasMore:false,nextCursor:null}};
    if (historyMode === "recovery") return {body:{success:true,available:true,items:[item("opaque006","reward_pending"),item("opaque007","ineligible")],hasMore:false,nextCursor:null}};
    if (url.searchParams.has("cursor")) {
      assert.equal(url.searchParams.get("cursor"),"signed-owner-cursor");
      return {body:{success:true,available:true,items:[first[2],{...item("opaque005","unverified"),displayLabel:"private@example.test",email:"never-render@example.test",userId:"private-account-uuid"}],hasMore:false,nextCursor:null}};
    }
    return {body:{success:true,available:true,items:first,hasMore:true,nextCursor:"signed-owner-cursor"}};
  }
  if (url.pathname === "/api/auth/verification/send") {
    if (sendMode === "rate") return {status:429,headers:{"Retry-After":"120"},body:{success:false,error:"Too many requests. Please try later."}};
    if (sendMode === "error") return {status:503,body:{success:false,error:"Verification email could not be sent. Please retry later."}};
    if (sendMode === "malformed") return {body:{}};
    return {body:{success:true,message:"Check your inbox for a verification link. It expires in 24 hours."}};
  }
  if (url.pathname === "/api/auth/verification/confirm") {
    confirmations.push(JSON.parse(request.postData()));
    if (sendMode === "expired") return {status:400,body:{success:false,error:"This link expired, was already used, or belongs to another account."}};
    if (confirmMode === "transient") return {status:503,body:{success:false,error:"Verification temporarily unavailable. Please retry."}};
    if (confirmMode === "ambiguous") { verified = true; return {abort:true}; }
    if (confirmMode === "refresherror") { verified = true; mode = "error"; return {body:{success:true}}; }
    verified = true; return {body:{success:true}};
  }
  if (url.pathname === "/api/auth/google/config") return {body:{enabled:false}};
  return {body:{success:true,notifications:[],unread:0,items:[],tickets:[],creations:[],followers:[],following:[],users:[],transactions:[],balance:0,templates:[],hasMore:false,total:0}};
}
function pass(label) { checks.push(label); console.log("PASS",label); }
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser = await browserQA.launch({headless:true});
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror",e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on("request",async request=>{
      const url = new URL(request.url());
      if (url.origin !== base && !["data:","about:","blob:"].includes(url.protocol)) return request.abort();
      if (url.pathname.startsWith("/api/")) {
        requests.push({path:url.pathname,method:request.method(),search:url.search});
        const reply=fixture(url,request);
        if (reply.abort) return request.abort("failed");
        if (url.pathname === "/api/referrals" && delay) await new Promise(r=>setTimeout(r,delay));
        return request.respond({status:reply.status||200,contentType:"application/json",headers:reply.headers||{},body:JSON.stringify(reply.body)});
      }
      if (!["GET","HEAD"].includes(request.method())) return request.abort();
      request.continue();
    });
    async function go(route="/account/referrals",clear=true) {
      if (clear && page.url().startsWith(base)) await page.evaluate(()=>sessionStorage.clear());
      await page.goto(base+route,{waitUntil:"domcontentloaded"});
      await page.waitForFunction(()=>window.SC_ACCOUNT_NAV && window.SC_UI && (document.querySelector("#accountBox")?.hidden === false || document.querySelector("#accountGuest")?.hidden === false));
    }
    async function ready() {
      await page.waitForFunction(()=>document.querySelector("#referralState").dataset.state === "ready" && !document.querySelector("#referralHistoryMessage").textContent.includes("Loading"));
    }
    async function layout() {
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.equal(await page.$$eval("[id]",els=>els.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i).length),0);
      assert(await page.$$eval('#referralSettings[aria-labelledby], #referralSettings [aria-labelledby]',els=>els.every(e=>e.getAttribute("aria-labelledby").split(/\s+/).every(id=>document.getElementById(id)))));
      assert(await page.$$eval("#referralSettings button",els=>els.filter(e=>e.checkVisibility()).every(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.width>=44&&r.left>=0&&r.right<=innerWidth+1;})));
    }
    for (const width of [320,390,768,1440]) {
      await page.setViewport({width,height:900,isMobile:width<600,hasTouch:width<600});
      for (const theme of ["light","dark"]) {
        mode="ready"; verified=false; historyMode="ready";
        await go(); await page.evaluate(t=>localStorage.setItem("sc_theme",t),theme); await go(); await ready(); await layout();
        assert.deepEqual(await page.$$eval(".rf-stats strong",els=>els.map(e=>e.textContent)),["6","2","30","1/10"]);
        assert.equal(await page.$$eval(".rf-history-row",els=>els.length),4);
        assert.deepEqual(await page.$$eval(".rf-status",els=>els.map(e=>e.dataset.status)),["unverified","export_pending","rewarded","limited"]);
        if ([390,1440].includes(width)) await page.screenshot({path:path.join(out,`referral-${theme}-${width}.png`),fullPage:true});
        pass(`${width}px ${theme}: real stats, four statuses, all controls >=44px, no overflow/duplicate IDs`);
      }
    }
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    delay=350; await go(); assert.equal(await page.$eval("#referralState",e=>e.dataset.state),"loading"); assert.equal(await page.$eval("#copyReferralLink",e=>e.disabled),true); delay=0; await ready(); pass("Loading state disables invite actions until real data arrives");
    mode="disabled"; await go(); await page.waitForFunction(()=>document.querySelector("#referralState").dataset.state==="disabled");
    assert.equal(await page.$eval("#retryReferral",e=>e.hidden),true); assert.equal(await page.$eval("#referralReady",e=>e.hidden),true); assert.equal(await page.$eval("#referralLink",e=>e.value),""); pass("Unconfigured disabled state has no Retry, fake counters or invite link");
    mode="paused"; await go(); await page.waitForFunction(()=>document.querySelector("#referralState").dataset.state==="paused" && document.querySelectorAll(".rf-history-row").length===4);
    assert.equal(await page.$eval("#referralReady",e=>e.hidden),false); assert.equal(await page.$eval("#referralInvitePanel",e=>e.hidden),true); assert.equal(await page.$eval("#referralBonus",e=>e.textContent),"30"); assert.equal(await page.$eval("#retryReferral",e=>e.hidden),true); pass("Paused feature retains real bonus/activity but blocks new invites and verification");
    mode="error"; await go(); await page.waitForFunction(()=>document.querySelector("#referralState").dataset.state==="error");
    mode="ready"; await page.click("#retryReferral"); await ready(); pass("Transient summary error offers explicit retry and recovers");
    mode="invalid"; await go(); await page.waitForFunction(()=>document.querySelector("#referralState").dataset.state==="error"); assert.equal(await page.$eval("#referralReady",e=>e.hidden),true); pass("Malformed counters/code never render a fake ready state");
    mode="legacy"; await go(); await ready(); assert.equal(await page.$eval("#referralTotal",e=>e.textContent),"—"); assert.equal(await page.$eval("#referralBonus",e=>e.textContent),"—"); assert.match(await page.$eval("#referralHistoryMessage",e=>e.textContent),/not available in this version/); pass("Older schema preserves available counters without inventing totals or empty history");
    mode="empty"; await go(); await ready(); assert.equal(await page.$$eval(".rf-history-row",els=>els.length),0); assert.match(await page.$eval("#referralHistoryMessage",e=>e.textContent),/No referrals yet/); pass("Actual empty activity is distinct from unavailable history");
    mode="cap"; await go(); await ready(); assert.match(await page.$eval("#referralCapNotice",e=>e.textContent),/not carried into next month/); pass("Monthly cap is explicit and makes no next-month reward promise");
    mode="ready"; historyMode="recovery"; await go(); await ready(); assert.deepEqual(await page.$$eval(".rf-status",els=>els.map(e=>e.textContent)),["Reward processing","Not eligible"]); pass("Recovery-pending and ineligible progress stay truthful without premature reward claims");
    mode="ready"; historyMode="error"; await go(); await ready(); assert.equal(await page.$eval("#retryReferralHistory",e=>e.hidden),false); historyMode="ready"; await page.click("#retryReferralHistory"); await page.waitForFunction(()=>document.querySelectorAll(".rf-history-row").length===4); pass("History failure preserves summary and supports its own retry");
    await page.click("#moreReferralHistory"); await page.waitForFunction(()=>document.querySelectorAll(".rf-history-row").length===5);
    assert.equal(await page.$eval("#moreReferralHistory",e=>e.hidden),true); assert.equal(await page.$$eval(".rf-history-row strong",els=>els.at(-1).textContent),"Referral"); assert(!await page.$eval("#referralHistoryList",e=>/private@|never-render@|private-account-uuid/.test(e.textContent))); pass("Signed-cursor pagination deduplicates rows and never renders friend PII");
    historyMode="invalid"; await go(); await ready(); assert.equal(await page.$$eval(".rf-history-row",els=>els.length),0); assert.equal(await page.$("#referralHistoryList img"),null); pass("Unknown statuses/injected row markup fail safely without partial history"); historyMode="ready";
    historyMode="prototype"; await go(); await ready(); assert.equal(await page.$$eval(".rf-history-row",els=>els.length),0); pass("Prototype property names cannot bypass the history status allowlist"); historyMode="ready";
    await go(); await ready(); await page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async value=>{window.qaCopied=value;}}}));
    await page.click("#copyReferralLink"); await page.waitForFunction(()=>window.qaCopied); assert.equal(await page.evaluate(()=>window.qaCopied),base+"/signup?ref=qa_code_12345678"); assert.match(await page.$eval("#referralMessage",e=>e.textContent),/Share your link/); pass("Copy has separate feedback and does not erase eligibility state");
    await page.click("#shareReferralLink"); await page.waitForSelector("#scShareDialog[open]"); assert.equal(await page.$eval("#scShareDialog input",e=>e.value),base+"/signup?ref=qa_code_12345678"); assert(await page.$eval("#scShareDialog",e=>e.getBoundingClientRect().right<=innerWidth+1)); await page.keyboard.press("Escape"); await page.waitForFunction(()=>!document.querySelector("#scShareDialog")); assert.equal(await page.evaluate(()=>document.activeElement.id),"shareReferralLink"); pass("Share uses the real SC_UI dialog, fits mobile and restores focus on Escape");
    await page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async()=>{throw Error("blocked");}}})); await page.click("#copyReferralLink"); await page.waitForFunction(()=>document.querySelector("#referralFeedback").textContent.includes("Select and copy")); assert.equal(await page.evaluate(()=>document.activeElement.id),"referralLink"); pass("Clipboard rejection falls back to selectable link");
    const sendCount=()=>requests.filter(r=>r.path==="/api/auth/verification/send").length;
    sendMode="success"; await go(); await ready(); const beforeSend=sendCount(); await page.click("#sendVerification"); await page.waitForFunction(()=>document.querySelector("#referralVerificationMessage").textContent.includes("Check your inbox")); await page.click("#sendVerification"); assert.equal(sendCount(),beforeSend+1); assert.match(await page.$eval("#sendVerification",e=>e.textContent),/Resend in \d+s/); await go("/account/referrals",false); await ready(); assert.equal(await page.$eval("#sendVerification",e=>e.disabled),true); pass("Explicit send has 60s countdown, blocks duplicate sends and survives reload");
    await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+61000;}); await page.waitForFunction(()=>!document.querySelector("#sendVerification").disabled); await page.click("#sendVerification"); await page.waitForFunction(()=>document.querySelector("#referralVerificationMessage").textContent.includes("Check your inbox")); assert.equal(sendCount(),beforeSend+2); pass("Resend is available after cooldown, never an automatic POST");
    sendMode="rate"; await go(); await ready(); await page.click("#sendVerification"); await page.waitForFunction(()=>document.querySelector("#referralVerificationMessage").textContent.includes("Too many")); assert.match(await page.$eval("#sendVerification",e=>e.textContent),/Resend in 1\d\ds/); pass("Server Retry-After extends the cooldown after 429");
    sendMode="error"; await go(); await ready(); await page.click("#sendVerification"); await page.waitForFunction(()=>document.querySelector("#referralVerificationMessage").textContent.includes("could not be sent")); assert(!await page.$eval("#referralVerificationMessage",e=>e.textContent.includes("Check your inbox"))); pass("Mailer outage never claims email delivery or auto-retries");
    sendMode="malformed"; await go(); await ready(); await page.click("#sendVerification"); await page.waitForFunction(()=>document.querySelector("#referralVerificationMessage").textContent.includes("send could not be confirmed")); assert.equal(await page.$eval("#sendVerification",e=>e.disabled),true); pass("Malformed successful HTTP response is not treated as confirmed email delivery");
    const token="a".repeat(43); sendMode="success"; verified=false; await go("/account/referrals?verify="+token); await ready(); assert.equal(new URL(page.url()).searchParams.has("verify"),false); assert.equal(confirmations.length,0); assert.equal(await page.$eval("#confirmReferralEmail",e=>e.disabled),false); await page.click("#confirmReferralEmail"); await page.waitForFunction(()=>document.querySelector("#referralConfirmMessage").textContent.includes("Your email is verified")); assert.deepEqual(confirmations,[{token}]); assert.equal(await page.$eval("#referralVerifyRow",e=>e.hidden),true); await page.reload({waitUntil:"domcontentloaded"}); await ready(); assert.equal(confirmations.length,1); pass("Token is removed immediately; explicit confirmation posts once and reload cannot replay it");
    verified=false; confirmMode="transient"; await go("/account/referrals?verify="+token); await ready(); const beforeTransient=confirmations.length; await page.click("#confirmReferralEmail"); await page.waitForFunction(()=>document.querySelector("#referralConfirmMessage").textContent.includes("retry confirmation below")); assert.equal(confirmations.length,beforeTransient+1); assert.equal(await page.$eval("#confirmReferralEmail",e=>e.disabled),false); assert.equal(new URL(page.url()).searchParams.has("verify"),false); assert(!await page.evaluate(t=>JSON.stringify(sessionStorage).includes(t)||JSON.stringify(localStorage).includes(t),token)); confirmMode="success"; await page.click("#confirmReferralEmail"); await page.waitForFunction(()=>document.querySelector("#referralConfirmMessage").textContent.includes("Your email is verified")); assert.equal(confirmations.length,beforeTransient+2); pass("503 confirmation reconciles current state and retains memory-only token for an explicit retry");
    verified=false; confirmMode="ambiguous"; await go("/account/referrals?verify="+token); await ready(); const beforeAmbiguous=confirmations.length; await page.click("#confirmReferralEmail"); await page.waitForFunction(()=>document.querySelector("#referralConfirmMessage").textContent.includes("Your email is verified")); assert.equal(confirmations.length,beforeAmbiguous+1); assert.equal(await page.$eval("#confirmReferralEmail",e=>e.hidden),true); pass("Lost confirmation response reconciles accepted success with no duplicate POST");
    verified=false; confirmMode="refresherror"; await go("/account/referrals?verify="+token); await ready(); await page.click("#confirmReferralEmail"); await page.waitForFunction(()=>document.querySelector("#referralState").dataset.state==="error"); assert.equal(await page.$eval("#referralConfirmMessage",e=>e.textContent),"Your email is verified."); mode="ready"; await page.click("#retryReferral"); await ready(); assert.equal(await page.$eval("#referralVerifyRow",e=>e.hidden),true); pass("Post-confirmation summary outage preserves success and supports a separate data refresh"); confirmMode="success";
    mode="disabled"; verified=false; const beforeDisabled=confirmations.length; await go("/account/referrals?verify="+token); await page.waitForFunction(()=>document.querySelector("#referralState").dataset.state==="disabled"); assert.equal(await page.$eval("#confirmReferralEmail",e=>e.disabled),true); assert.equal(confirmations.length,beforeDisabled); assert.equal(new URL(page.url()).searchParams.has("verify"),false); pass("Paused/unconfigured verification token is never consumed"); mode="ready";
    verified=false; sendMode="expired"; await go("/account/referrals?verify="+token); await ready(); await page.click("#confirmReferralEmail"); await page.waitForFunction(()=>document.querySelector("#referralConfirmMessage").textContent.includes("expired")); assert.equal(await page.$eval("#confirmReferralEmail",e=>e.hidden),true); assert.equal(await page.$eval("#referralVerifyRow",e=>e.hidden),false); pass("Expired/account-mismatched confirmation offers a new email, not a success claim");
    guest=true; const beforeGuest=requests.length; await go("/account/referrals?verify="+token); await page.waitForFunction(()=>document.querySelector("#referralState").dataset.state==="guest"); assert.equal(new URL(page.url()).searchParams.has("verify"),false); const next=await page.$eval('#accountGuest a[href^="/login"]',e=>new URL(e.href).searchParams.get("next")); assert.equal(next,"/account/referrals?verify="+token); assert(!requests.slice(beforeGuest).some(r=>r.path.startsWith("/api/referrals")||r.path.includes("verification/"))); assert.equal(await page.$eval("#accountDetail",e=>e.checkVisibility()),false); pass("Guest flow protects data and preserves the correct verification login return without consuming token");
    assert.deepEqual(errors,[]); pass("No browser page exceptions; all API mutations stayed in fixtures");
    fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({testedAt:new Date().toISOString(),checks,writes:requests.filter(r=>!["GET","HEAD"].includes(r.method)),boundary:"DB-free real browser with isolated API fixtures; no live email, provider, database or production writes."},null,2));
    console.log(`REFERRAL_UI=PASS (${checks.length} checks)`);
  } finally { await browser.close(); }
})().catch(error=>{console.error("REFERRAL_UI=FAIL",error.stack);process.exitCode=1;});
