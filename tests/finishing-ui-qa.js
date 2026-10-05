"use strict";
// Isolated preview only. All API calls are browser fixtures, no DB writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
const base = "http://127.0.0.1:3327";
(async () => {
  for (const file of fs.readdirSync("public").filter(f=>f.endsWith(".html"))) {
    const html=fs.readFileSync("public/"+file,"utf8");
    if (/sh-body|ed-body|de-app/.test(html)) {
      assert(html.includes('/finishing.css?v=2026100503'),file+" loads accents");
      assert(html.includes('/finishing.js?v=2026100503'),file+" loads activity feedback");
    }
  }
  fs.mkdirSync("audit_results/finishing",{recursive:true});
  const browser=await puppeteer.launch({headless:true});
  try {
    const page=await browser.newPage(), errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on("request",r=>{
      const u=new URL(r.url());
      if(u.origin!==base && !["data:","blob:","about:"].includes(u.protocol)) return r.abort();
      if(!u.pathname.startsWith("/api/")) return r.continue();
      const fixture=u.pathname==="/api/auth/me"?{success:true,user:null}:
        u.pathname==="/api/auth/google/config"?{enabled:false}:
        u.pathname==="/api/credits"?{success:true,left:5,perDay:5,plan:"free",planLabel:"Free",cost:{export:1,animate:2}}:
        {success:true,templates:[],items:[],metrics:{},notifications:[],tickets:[]};
      const delay=u.pathname.includes("qa-slow-two")?1100:u.pathname.includes("qa-slow")?650:
        u.pathname==="/api/designs/templates"?400:u.pathname==="/api/feedback"?600:0;
      setTimeout(()=>r.respond({status:u.pathname.includes("qa-slow-error")?503:200,contentType:"application/json",body:JSON.stringify(fixture)}).catch(()=>{}),delay);
    });
    for(const width of [390,1440]) for(const theme of ["light","dark"]) {
      await page.setViewport({width,height:900});
      await page.evaluateOnNewDocument(t=>{if(window.top===window) {try {localStorage.setItem("sc_theme",t);} catch (_) {}}},theme);
      for(const route of ["/","/pricing","/contact","/designs","/account/appearance","/editor?tpl=text-cascade","/design-editor"]) {
        await page.goto(base+route,{waitUntil:"networkidle2"});
        await page.waitForFunction(()=>window.SC_FINISHING===true);
        assert.equal(await page.evaluate(()=>document.querySelectorAll(".sc-load-track").length),1,"one indicator");
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+" no horizontal overflow "+width);
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme,"theme preserved "+route);
        if(route==="/") {
          const colours=await page.evaluate(()=>({canvas:getComputedStyle(document.body).backgroundColor,accent:getComputedStyle(document.querySelector(".sh-pp-pop-badge")).color}));
          assert.equal(colours.canvas,theme==="dark"?"rgb(16, 16, 16)":"rgb(250, 250, 250)");
          assert.equal(colours.accent,theme==="dark"?"rgb(94, 234, 212)":"rgb(15, 118, 110)");
          await page.$eval("#homePricing",e=>e.scrollIntoView({block:"start"}));
          await new Promise(r=>setTimeout(r,400));
          await page.screenshot({path:`audit_results/finishing/preview-home-pricing-${theme}-${width}.png`});
        }
      }
      console.log(`PASS neutral themes, accents and layout: ${width}px ${theme}, seven surfaces`);
    }
    await page.setViewport({width:320,height:720});
    await page.goto(base+"/editor?tpl=text-cascade",{waitUntil:"networkidle2"});
    await page.$eval("#edExport",e=>e.setAttribute("aria-busy","true"));
    assert(await page.$eval("#edExport",e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),"busy export fits 320px");
    assert.equal(await page.$eval("#edExport",e=>getComputedStyle(e,"::after").position),"static","spinner does not inherit old decorative overlay");
    await page.goto(base+"/contact",{waitUntil:"networkidle2"});
    await page.evaluate(()=>{window.qaRequests=Promise.all([fetch("/api/qa-slow-one"),fetch("/api/qa-slow-two")]);});
    await page.waitForFunction(()=>!document.querySelector(".sc-load-track").hidden);
    assert.equal(await page.$eval(".sc-load-track",e=>getComputedStyle(e).pointerEvents),"none");
    await new Promise(r=>setTimeout(r,550));
    assert.equal(await page.$eval(".sc-load-track",e=>e.hidden),false,"still pending second request");
    await page.evaluate(()=>window.qaRequests);
    await page.waitForFunction(()=>document.querySelector(".sc-load-track").hidden);
    await page.evaluate(()=>{window.qaAbort=new AbortController();window.qaRequests=fetch("/api/qa-slow-abort",{signal:qaAbort.signal}).catch(e=>e.name);});
    await page.waitForFunction(()=>!document.querySelector(".sc-load-track").hidden);
    await page.evaluate(()=>qaAbort.abort());
    assert.equal(await page.evaluate(()=>window.qaRequests),"AbortError","signal and rejection preserved");
    await page.waitForFunction(()=>document.querySelector(".sc-load-track").hidden);
    await page.evaluate(()=>{window.qaRequests=fetch("/api/qa-slow-error").then(r=>r.status);});
    await page.waitForFunction(()=>!document.querySelector(".sc-load-track").hidden);
    assert.equal(await page.evaluate(()=>window.qaRequests),503,"HTTP error preserved");
    await page.waitForFunction(()=>document.querySelector(".sc-load-track").hidden);
    await page.evaluate(()=>fetch("/api/qa-fast"));
    assert(await page.$eval(".sc-load-track",e=>e.hidden),"fast requests do not flash");
    await page.type("#fbName","Preview User");
    await page.type("#fbEmail","preview@example.test");
    await page.type("#fbMessage","Test fixture feedback only; not sent to a real server.");
    await page.click("#fbSend");
    assert.equal(await page.$eval("#fbSend",e=>e.getAttribute("aria-busy")),"true","submit spinner");
    await page.waitForFunction(()=>!document.querySelector("#fbSend").disabled);
    assert.equal(await page.$eval("#fbSend",e=>e.hasAttribute("aria-busy")),false,"spinner clears");
    await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
    await page.goto(base+"/",{waitUntil:"networkidle2"});
    assert.equal(await page.evaluate(()=>document.querySelectorAll(".sc-enter").length),0,"reduced motion no scroll animations");
    await page.evaluate(()=>{window.qaRequests=fetch("/api/qa-slow-one");});
    await page.waitForFunction(()=>!document.querySelector(".sc-load-track").hidden);
    assert.equal(await page.$eval(".sc-load-track",e=>getComputedStyle(e,"::after").animationName),"none","static reduced-motion indicator");
    await page.evaluate(()=>window.qaRequests);
    assert.deepEqual(errors,[]);
    console.log("PASS actual pending/concurrent/fast/aborted/error requests, form busy lifecycle, reduced motion. Zero live API writes.");
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
