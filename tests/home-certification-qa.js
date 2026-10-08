"use strict";
// Page #1 evidence. API fixtures are browser-only, never production records.
// Owns a DB-free static preview. No real signup, upload, AI, payment or deploy.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const puppeteer = require("./qa-browser");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "audit_results/home-certification");
const base = "http://127.0.0.1:3327";
const sizes = [[1920,1080],[1536,864],[1440,900],[1366,768],[1280,720],[1180,820],[1024,768],[820,1180],[768,1024],[430,932],[412,915],[390,844],[375,812],[360,800],[320,568]];
const results = [], traffic = [], errors = [], assetFailures = [];
let scenario = "guest", fault = "", unread = 999;
const users = {
  guest: null,
  free: { id:"qa-free", handle:"qa_free", displayName:"QA Member", plan:"free", role:"user" },
  pro: { id:"qa-pro", handle:"qa_pro", displayName:"QA Pro", plan:"pro", role:"user" },
  promax: { id:"qa-promax", handle:"qa_promax", displayName:"QA Pro Max", plan:"promax", role:"user" },
  owner: { id:"qa-owner", handle:"qa_owner", displayName:"QA Owner", plan:"free", role:"super_admin", permissions:[] }
};
function record(id, ok, detail, scope = "isolated Home UI") { results.push({ id, status:ok ? "PASS" : "FAIL", detail, scope }); }
async function check(id, fn) { try { const result = await fn(); record(id, result === true || result?.ok === true, result?.detail || String(result)); } catch (err) { record(id, false, err.message); } }
async function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function dataFor(url) {
  const user = users[scenario], plan = user?.plan || "free", allowance = {free:5,pro:40,promax:100}[plan];
  if (url.pathname === "/api/auth/me") return { success:true, user };
  if (url.pathname === "/api/credits") return { success:true, plan, planLabel:{free:"Free",pro:"Pro",promax:"Pro Max"}[plan], perDay:allowance, left:fault === "zero" ? 0 : allowance, dailyLeft:fault === "zero" ? 0 : allowance, bonusCredits:0, cost:{export:1,animate:2,aiPro:5,aiAdvanced:8} };
  if (url.pathname.startsWith("/api/notifications")) return {success:true,unread,total:1,notifications:[{id:"qa-note",message:"QA notification <img src=x onerror=window.qaInjection=true>",url:"/account",createdAt:"2026-10-01T00:00:00Z",read:false}]};
  return {success:true,user,templates:[],skills:[],items:[],notifications:[],projects:[],reactions:{},creations:[],tickets:[],balance:0};
}
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const preview = spawn(process.execPath, ["tests/polish-preview-server.js"], {cwd:root,windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let browser;
  try {
    await new Promise((resolve,reject) => {
      const timer = setTimeout(()=>reject(Error("DB-free preview did not start")),10000);
      preview.stdout.on("data",chunk=>{if(String(chunk).includes("database-free QA preview")){clearTimeout(timer);resolve();}});
      preview.stderr.on("data",chunk=>process.stderr.write(chunk));
      preview.once("error",err=>{clearTimeout(timer);reject(err);});
      preview.once("exit",code=>{clearTimeout(timer);reject(Error("Preview exited "+code));});
    });
    browser = await puppeteer.launch({headless:true,args:["--no-sandbox"]});
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror",err=>{
      const existing=errors.find(e=>e.scenario===scenario&&e.fault===fault&&e.message===err.message);
      if(existing)existing.count++;else errors.push({scenario,fault,message:err.message,count:1});
    });
    page.on("response",response=>{const u=new URL(response.url());if(u.origin===base&&!u.pathname.startsWith("/api/")&&response.status()>=400)assetFailures.push({url:u.pathname,status:response.status()});});
    await page.setRequestInterception(true);
    page.on("request", req => {
      const u=new URL(req.url());
      if (["data:","blob:","about:"].includes(u.protocol)) return req.continue();
      if (u.origin !== base) return req.abort(); // External fonts blocked deliberately: fallback test.
      if (!u.pathname.startsWith("/api/")) return req.continue();
      traffic.push({scenario,fault,path:u.pathname,method:req.method()});
      if (req.method() !== "GET") return req.respond({status:403,contentType:"application/json",body:'{"success":false,"error":"QA: writes disabled"}'});
      if (fault === "api-down" && u.pathname !== "/api/auth/me") return req.respond({status:503,contentType:"application/json",body:'{"success":false,"error":"QA service unavailable"}'});
      if (fault === "malformed" && u.pathname.startsWith("/api/notifications")) return req.respond({status:200,contentType:"application/json",body:"not-json"});
      return req.respond({status:200,contentType:"application/json",body:JSON.stringify(dataFor(u))});
    });
    async function home(theme="light") {
      const init=await page.evaluateOnNewDocument(t=>{if(window.top!==window)return;try{localStorage.setItem("sc_theme",t);}catch{}},theme);
      try{await page.goto(base+"/",{waitUntil:"load"});}
      finally{await page.removeScriptToEvaluateOnNewDocument(init.identifier);}
      await page.waitForFunction(()=>document.querySelectorAll("#gallery .sh-tile").length===10,{polling:100});
      await wait(120);
    }
    for (scenario of Object.keys(users)) {
      for (const [width,height] of sizes) for (const theme of ["light","dark"]) {
        await page.setViewport({width,height,isMobile:width<900,hasTouch:width<900}); await home(theme);
        const info=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,
          h1:document.querySelectorAll("h1").length,tiles:document.querySelectorAll("#gallery .sh-tile").length,
          unique:new Set([...document.querySelectorAll("#gallery .sh-tile")].map(e=>e.dataset.reactionId)).size,
          signedIn:!document.querySelector("#logoutBtn").hidden,
          plan:document.querySelector(".sh-credit-plan").textContent,
          prompt:document.querySelector("#composer").getBoundingClientRect().toJSON(),templates:document.querySelector("#templates").getBoundingClientRect().toJSON()}));
        const expectedPlan={free:"Free",pro:"Pro",promax:"Pro Max"}[users[scenario]?.plan||"free"];
        record(`matrix/${scenario}/${width}x${height}/${theme}`,info.scroll<=info.width+1&&info.h1===1&&info.tiles===10&&info.unique===10&&info.signedIn===Boolean(users[scenario])&&info.plan===expectedPlan&&info.theme===theme&&info.prompt.bottom<=info.templates.top,
          JSON.stringify(info));
        if(scenario==="guest"&&[1440,1366,768,390,320].includes(width)) {
          await page.screenshot({path:path.join(out,`${width}-${theme}-full.png`),fullPage:true});
          await page.screenshot({path:path.join(out,`${width}-${theme}-top.png`)});
        }
      }
      console.log("Home matrix completed: "+scenario+" (15 viewports x 2 themes)");
    }
    scenario="free"; await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true}); await home();
    await check("prompt/Unicode-and-counter",async()=>{
      const text="Hindi नमस्ते 👋\nLine 2 & <script>";
      await page.$eval("#composerPrompt",(el,value)=>{el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));},text);
      return await page.$eval("#composerCount",el=>el.textContent)===text.length+"/500";
    });
    await check("prompt/empty-no-navigation",async()=>{
      await page.$eval("#composerPrompt",el=>{el.value="   ";el.dispatchEvent(new Event("input",{bubbles:true}));});
      await page.click("#composerGo");return page.url()===base+"/";
    });
    await check("model/select-and-persist",async()=>{
      await page.click("#qualityBtn");await page.click('[data-val="pro"]');
      return await page.$eval("#qualitySelect",el=>el.value)==="pro"&&await page.$eval("#qualityVal",el=>el.textContent)==="Detailed";
    });
    await check("model/keyboard-Escape",async()=>{
      await page.click("#qualityBtn");await page.focus("#qualityBtn");await page.keyboard.press("Escape");
      return await page.$eval("#qualityMenu",el=>el.hidden);
    });
    await page.click("h1");
    await check("model/keyboard-option-access",()=>page.$$eval('#qualityMenu [role="option"]',els=>els.every(el=>el.tagName==="BUTTON"||el.tabIndex>=0)));
    await check("image/corrupt-and-unsupported-rejected",async()=>{
      await page.$eval("#composerImg",el=>{const dt=new DataTransfer();dt.items.add(new File(["not an image"],"corrupt.png",{type:"image/png"}));el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));});
      await wait(250);return await page.$eval("#composerImgClear",el=>el.hidden);
    });
    if(!await page.$eval("#composerImgClear",el=>el.hidden))await page.click("#composerImgClear");
    await check("notifications/open-inside-viewport",async()=>{
      await page.click("#notificationBtn");await wait(150);
      await page.screenshot({path:path.join(out,"390-notification-open.png")});
      return page.$eval("#notificationPanel",el=>{const r=el.getBoundingClientRect();return !el.hidden&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
    });
    await check("notifications/Escape",async()=>{await page.focus("#notificationBtn");await page.keyboard.press("Escape");return page.$eval("#notificationPanel",el=>el.hidden);});
    await page.click("h1");
    await check("notifications/99plus-and-XSS",async()=>{
      const badge=await page.$eval("#notificationCount",el=>el.textContent);
      return badge==="99+"&&await page.evaluate(()=>!window.qaInjection);
    });
    await check("navigation/mobile-menu-Escape",async()=>{
      await page.click("#navBurger");const opened=await page.$eval("#navMobile",el=>!el.hidden);await page.keyboard.press("Escape");return opened&&await page.$eval("#navMobile",el=>el.hidden);
    });
    await check("theme/persists-route-and-reload",async()=>{
      await page.evaluate(()=>{localStorage.setItem("sc_theme","dark");});
      await page.goto(base+"/contact",{waitUntil:"load"});await page.reload({waitUntil:"load"});
      return await page.evaluate(()=>document.documentElement.dataset.theme==="dark");
    });
    for (const f of ["zero","api-down","malformed"]) {
      fault=f;await home();await wait(350);await page.screenshot({path:path.join(out,`390-${f}.png`)});
      record("failure/"+f+"/usable",await page.$eval("#composerPrompt",el=>!el.disabled&&el.getBoundingClientRect().width>0),"Prompt remains reachable; does NOT certify honest error messages or backend recovery.");
      if(f==="api-down")record("failure/credits/honest-unavailable",await page.$eval(".sh-credit-balance",el=>!/\d/.test(el.textContent)),await page.$eval(".sh-credit-balance",el=>el.textContent));
    }
    record("console/no-uncaught-errors",errors.length===0,JSON.stringify({unique:errors.length,total:errors.reduce((n,e)=>n+e.count,0),first:errors.slice(0,5)}));
    record("assets/no-local-404-or-5xx",assetFailures.length===0,JSON.stringify(assetFailures));
    const snapshot=await page.evaluate(()=>({anchors:[...document.querySelectorAll('a[href]')].map(el=>({text:el.textContent.trim().slice(0,80),href:el.getAttribute('href')})),sections:[...document.querySelectorAll('main section,.sh-content section')].map(el=>el.id)}));
    fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({testedAt:new Date().toISOString(),environment:"DB-free preview; intercepted API fixtures; external fonts intentionally blocked",results,errors,assetFailures,traffic,snapshot,
      notVerified:["Native browser zoom", "Real phone/Safari/Firefox/Edge", "Real AI and credit billing", "Real login/logout/notifications persistence", "Real file picker on phone", "Real payments", "30-minute soak", "Core Web Vitals field data", "All checklist phases / production-rendered final certification"]},null,2));
    const failed=results.filter(r=>r.status==="FAIL");
    console.log(JSON.stringify({checks:results.length,failures:failed.map(r=>({...r,detail:String(r.detail).slice(0,1000)})),evidence:path.join(out,"evidence.json")},null,2));
    if(failed.length)process.exitCode=1;
  } finally { if(browser)await browser.close();preview.kill(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
