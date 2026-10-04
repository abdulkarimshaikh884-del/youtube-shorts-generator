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
let role = "user", saveFails = false;
let user = {id:"qa-profile",email:"preview@example.test",handle:"preview_creator",displayName:"Preview Creator",plan:"free",role:"user",createdAt:"2026-10-01",followers:0,following:0};
const mutations = [], errors = [];
function fixture(url, request) {
  if (url.pathname === "/api/auth/me") return {success:true,user:role ? {...user,role} : null};
  if (url.pathname === "/api/credits") return {success:true,plan:"free",planLabel:"Free",left:5,dailyLeft:5,perDay:5,bonusCredits:0,cost:{export:1,animate:2}};
  if (url.pathname === "/api/referrals") return {success:true,enabled:false};
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
    const visible = selector => page.$eval(selector,e=>!!e.getClientRects().length);
    for (const width of [320,390,768,1440]) {
      await page.setViewport({width,height:900,isMobile:width<600,hasTouch:width<600});
      for (const theme of ["light","dark"]) {
        await go("/account");
        await page.evaluate(t=>localStorage.setItem("sc_theme",t),theme);
        await go("/account#settings");
        assert(await visible(".ig-header"));
        assert(await visible("#igPaneSettings"));
        assert.equal(await visible("#igPaneCreations"),false);
        assert.deepEqual(await page.$$eval(".ig-tabs [role=tab]",els=>els.map(e=>e.textContent.trim())),["Creations","Settings"]);
        assert.equal(await page.$eval("#igTabSettings",e=>e.getAttribute("aria-selected")),"true");
        assert.equal(await page.$$eval("[id]",els=>{const ids=els.map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i).length;}),0);
        assert.equal(await page.$$eval("#navMobile a",els=>els.filter(e=>e.textContent.trim()==="Settings").length),1);
        assert.equal(await visible(".pf-admin-link"),false);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        if ([390,1440].includes(width)) {
          await page.screenshot({path:`${out}/preview-profile-${theme}-${width}.png`,fullPage:true});
          await page.evaluate(()=>document.querySelector("#igPaneSettings").scrollIntoView({block:"center"}));
          await page.screenshot({path:`${out}/preview-settings-${theme}-${width}.png`});
        }
        await page.click("#igTabCreations");
        assert(await visible("#igPaneCreations"));
        await page.click("#igTabSettings");
        await page.click("[data-theme-toggle]");
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme==="light"?"dark":"light");
        await page.reload({waitUntil:"networkidle2"});
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme==="light"?"dark":"light");
        for (const [hash,name] of [["edit-profile","edit"],["account","account"],["stars","stars"],["support","support"]]) {
          await go("/account#"+hash);
          assert(await visible("#igPaneSettings"));
          assert(await page.$eval(`[data-settings-group="${name}"]`,e=>e.open));
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        }
        console.log(`PASS profile/settings ${width}px ${theme}: tabs, grouped panels, legacy deep links, theme persistence, privacy, no overflow`);
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
    await page.evaluate(()=>document.querySelector("#igTabCreations").focus());
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(()=>document.activeElement.id),"igTabSettings");
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
