"use strict";
// Browser-only fixtures on the DB-free preview; no live data or provider calls.
// Start tests/polish-preview-server.js first. Screenshot names say preview.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {execFileSync} = require("node:child_process");
const crypto = require("node:crypto");
const puppeteer = require("puppeteer");
const base = "http://127.0.0.1:3327";
const out = "audit_results/profile-settings";
let role = "user", saveFails = false, referralMode = "disabled", emailFails = false, verified = false;
let user = {id:"qa-profile",email:"preview@example.test",handle:"preview_creator",displayName:"Preview Creator",plan:"free",role:"user",createdAt:"2026-10-01",followers:0,following:0};
const mutations = [], errors = [];
function fixture(url, request) {
  if (url.pathname === "/api/auth/me") return {success:true,user:role ? {...user,role} : null};
  if (url.pathname === "/api/credits") return {success:true,plan:"free",planLabel:"Free",left:5,dailyLeft:5,perDay:5,bonusCredits:0,cost:{export:1,animate:2}};
  if (url.pathname === "/api/referrals") {
    if (referralMode === "error") return {error:"Referral details are temporarily unavailable. Please retry."};
    if (referralMode === "disabled") return {success:true,enabled:false};
    return {success:true,enabled:true,code:"qa_code_12345678",reward:10,monthlyLimit:10,rewarded:3,pending:2,this_month:1,emailVerified:verified};
  }
  if (url.pathname === "/api/auth/verification/send") return emailFails ? {error:"Verification email could not be sent. Please retry later."} : {success:true,message:"Check your inbox for a verification link."};
  if (url.pathname === "/api/auth/verification/confirm") { verified = true; return {success:true}; }
  if (url.pathname === "/api/auth/google/config") return {enabled:false};
  if (url.pathname === "/api/auth/profile") {
    mutations.push(url.pathname);
    if (saveFails) return {success:false,error:"Preview save unavailable"};
    user = {...user,...JSON.parse(request.postData())};
    return {success:true,user};
  }
  if (url.pathname === "/api/user/creations") return {success:true,creations:[{id:"qa-preview-template",tpl:"text-cascade",title:"Preview animation (test fixture)",status:"published"}]};
  if (url.pathname === "/api/stars/wallet") return {success:true,canWithdraw:false,balance:0};
  return {success:true,templates:[],items:[],notifications:[],creations:[],projects:[],tickets:[],users:[],followers:[],following:[],balance:0};
}
(async () => {
  const canonical = ["public/account.html","public/settings.html"];
  const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const beforeBuild = canonical.map(hash);
  execFileSync(process.execPath,["build_pages.js","account.html","settings.html"],{stdio:"pipe"});
  assert.deepEqual(canonical.map(hash),beforeBuild,"Page generation must preserve the consolidated workspace");
  fs.mkdirSync(out,{recursive:true});
  const browser = await puppeteer.launch({headless:true});
  try {
    const page = await browser.newPage();
    page.on("pageerror",e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on("request",r=>{
      const url = new URL(r.url());
      if (url.origin !== base && url.protocol !== "data:" && url.protocol !== "about:") return r.abort();
      if (url.pathname.startsWith("/api/")) return r.respond({status:200,contentType:"application/json",body:JSON.stringify(fixture(url,r))});
      if (!["GET","HEAD"].includes(r.method())) return r.abort();
      r.continue();
    });
    const go = async route => {
      await page.goto(base+route,{waitUntil:"networkidle2"});
      await page.waitForFunction(()=>window.SC_ACCOUNT && document.querySelector("#accountBox").hidden === false);
    };
    const visible = selector => page.$eval(selector,e=>e.checkVisibility({visibilityProperty:true}));
    for (const width of [320,390,768,1440]) {
      await page.setViewport({width,height:900,isMobile:width<600,hasTouch:width<600});
      for (const theme of ["light","dark"]) {
        await go("/account");
        await page.evaluate(t=>localStorage.setItem("sc_theme",t),theme);
        await go("/account#settings");
        assert(await visible(".ig-header"));
        assert(await visible("#igPaneSettings"));
        assert.equal(await visible("#igPaneCreations"),false);
        assert.equal(await page.$(".ig-tabs"),null,"No extra Creations/Settings tab bar");
        assert.equal(await page.$eval("#settingsHeading",e=>e.textContent.trim()),"Settings");
        assert.equal(await page.$eval(".pf-settings-list > :first-child",e=>e.dataset.settingsGroup),"creations");
        assert.equal(await page.$$eval("[id]",els=>{const ids=els.map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i).length;}),0);
        assert.equal(await page.$$eval("#navMobile a",els=>els.filter(e=>e.textContent.trim()==="Settings").length),1);
        assert.equal(await visible(".pf-admin-link"),false);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        if ([390,1440].includes(width)) {
          await page.screenshot({path:`${out}/preview-profile-${theme}-${width}.png`,fullPage:true});
          await page.evaluate(()=>document.querySelector("#igPaneSettings").scrollIntoView({block:"center"}));
          await page.screenshot({path:`${out}/preview-settings-${theme}-${width}.png`});
        }
        await page.click('[data-settings-group="creations"] > summary');
        assert(await visible("#igPaneCreations"));
        await page.click('[data-settings-group="creations"] > summary');
        assert.equal(await visible("#igPaneCreations"),false);
        await page.click("[data-theme-toggle]");
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme==="light"?"dark":"light");
        await page.reload({waitUntil:"networkidle2"});
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme==="light"?"dark":"light");
        for (const [hash,name] of [["creations","creations"],["edit-profile","edit"],["account","account"],["stars","stars"],["support","support"],["referrals","referrals"]]) {
          await go("/account#"+hash);
          assert(await visible("#igPaneSettings"));
          assert(await page.$eval(`[data-settings-group="${name}"]`,e=>e.open));
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        }
        console.log(`PASS profile/settings ${width}px ${theme}: creations first, no tabs, grouped panels, deep links, theme persistence, privacy, no overflow`);
      }
    }
    await page.setViewport({width:1440,height:1000});
    await go("/settings?google_error=cancelled");
    assert.equal(new URL(page.url()).pathname,"/account");
    assert.equal(new URL(page.url()).hash,"#settings");
    assert(new URL(page.url()).searchParams.has("google_error"));
    await page.click("#openEditProfileBtn");
    await page.$eval("#pageDisplayName",e=>e.value="Updated preview name");
    await page.click("#pageSaveProfileBtn");
    await page.waitForFunction(()=>document.querySelector("#pageProfileMsg").textContent.includes("successfully"));
    assert.equal(await page.$eval("#crDisplayName",e=>e.textContent.trim()),"Updated preview name");
    saveFails = true;
    await page.click("#pageSaveProfileBtn");
    await page.waitForFunction(()=>document.querySelector("#pageProfileMsg").textContent.includes("unavailable"));
    assert.equal(await page.$eval("#pageSaveProfileBtn",e=>e.disabled),false);
    await page.click("#pageCancelProfileBtn");
    assert(await visible("#igPaneCreations"));
    role="super_admin";
    await go("/account#settings");
    assert(await visible(".pf-admin-link"));
    await page.evaluate(()=>document.querySelector('[data-settings-group="creations"] > summary').focus());
    await page.keyboard.press("Enter");
    assert(await visible("#igPaneCreations"),"Creations accordion opens with keyboard");
    await page.keyboard.press("Enter");
    assert.equal(await visible("#igPaneCreations"),false);
    await go("/account#followers");
    assert(await visible("#igPaneFollowers"));
    await page.click('#igPaneFollowers [data-ig-back="settings"]');
    assert(await visible("#igPaneSettings"));
    await go("/account#referrals");
    assert(await visible("#referralSettings"));
    assert.equal(await visible("#referralReady"),false);
    assert.match(await page.$eval("#referralMessage",e=>e.textContent),/not available yet/);
    assert.equal(await page.$eval("#copyReferralLink",e=>e.disabled),true);
    referralMode = "error";
    await page.click("#retryReferral");
    await page.waitForFunction(()=>document.querySelector("#referralMessage").textContent.includes("temporarily unavailable"));
    assert.equal(await visible("#referralReady"),false);
    referralMode = "ready";
    await page.click("#retryReferral");
    await page.waitForFunction(()=>!document.querySelector("#referralReady").hidden);
    assert.equal(await page.$eval("#referralLink",e=>e.value),base+"/signup?ref=qa_code_12345678");
    assert.match(await page.$eval("#referralStats",e=>e.textContent),/3 rewarded · 2 pending · 1\/10/);
    await page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async value=>{window.qaCopied=value;}}}));
    await page.click("#copyReferralLink");
    await page.waitForFunction(()=>window.qaCopied);
    assert.equal(await page.evaluate(()=>window.qaCopied),base+"/signup?ref=qa_code_12345678");
    emailFails = true;
    await page.click("#sendVerification");
    await page.waitForFunction(()=>document.querySelector("#referralMessage").textContent.includes("could not be sent"));
    assert.equal(await page.$eval("#sendVerification",e=>e.disabled),false);
    emailFails = false;
    await page.click("#sendVerification");
    await page.waitForFunction(()=>document.querySelector("#referralMessage").textContent.includes("Check your inbox"));
    await go("/account?verify="+"a".repeat(43)+"#referrals");
    assert.equal(new URL(page.url()).searchParams.has("verify"),false,"Verification token removed from address bar");
    assert.equal(await visible("#referralVerifyRow"),false);
    assert.match(await page.$eval("#referralMessage",e=>e.textContent),/email is verified/);
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await page.evaluate(()=>document.querySelector("#referralSettings").scrollIntoView({block:"center"}));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:out+"/preview-referrals-390.png"});
    console.log("PASS referral UI fixtures: unavailable, outage/retry, actual response fields, copy, verification send/error, confirmation cleanup, mobile overflow. Provider delivery and reward grants tested separately.");
    role=null;
    await page.goto(base+"/settings",{waitUntil:"networkidle2"});
    assert.equal(await visible("#accountBox"),false);
    assert(await visible("#accountGuest"));
    assert.equal(await visible("#igPaneSettings"),false);
    assert(await visible("#accountGuest [data-theme-toggle]"),"Guest appearance remains accessible without exposing private settings");
    assert.equal(await page.$eval('#accountGuest a[href^="/login"]',e=>new URL(e.href).searchParams.get("next")),"/account#settings");
    await page.goto(base+"/creator?handle=preview_creator",{waitUntil:"networkidle2"});
    assert.equal(await page.$("#igPaneSettings"),null,"Public profile is not an account-settings surface");
    assert.deepEqual(mutations,["/api/auth/profile","/api/auth/profile"]);
    assert.deepEqual(errors,[]);
    console.log("PASS Settings redirect, profile save/error/cancel, keyboard, owner/guest permissions, public-profile separation; only two mocked profile POSTs.");
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
