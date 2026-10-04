"use strict";
// DB-free failure/keyboard/image contracts. All API writes are intercepted.
const fs = require("node:fs"), path = require("node:path");
const {spawn} = require("node:child_process");
const puppeteer = require("puppeteer"), sharp = require("sharp");
const root = path.resolve(__dirname,".."), base = "http://127.0.0.1:3327";
const out = path.join(root,"audit_results/page-certification/interactions");
const results = [], errors = [], writes = [];
let fault = "", noteUrl = "/account", unread = 999;
const user = {id:"qa-free",handle:"qa_free",displayName:"QA Member",plan:"free",role:"user"};
const wait = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  fs.mkdirSync(out,{recursive:true});
  const preview = spawn(process.execPath,["tests/polish-preview-server.js"],{cwd:root,windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let browser;
  try {
    await new Promise((resolve,reject)=>{
      const t=setTimeout(()=>reject(Error("Preview startup timeout")),10000);
      preview.stdout.on("data",c=>{if(String(c).includes("database-free QA preview")){clearTimeout(t);resolve();}});
      preview.stderr.on("data",c=>process.stderr.write(c));
      preview.once("error",e=>{clearTimeout(t);reject(e);});
      preview.once("exit",code=>{clearTimeout(t);reject(Error("Preview exited "+code));});
    });
    browser=await puppeteer.launch({headless:true,args:["--no-sandbox"]});
    const page=await browser.newPage(); page.setDefaultTimeout(10000);
    page.on("pageerror",e=>errors.push(e.message));
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await page.setRequestInterception(true);
    page.on("request",req=>{
      const u=new URL(req.url());
      if(["data:","blob:","about:"].includes(u.protocol))return req.continue();
      if(u.origin!==base)return req.abort();
      if(!u.pathname.startsWith("/api/"))return req.continue();
      if(req.method()!=="GET") {
        writes.push({path:u.pathname,method:req.method()});
        if(u.pathname==="/api/notifications/read"&&fault==="read-success")return req.respond({status:200,contentType:"application/json",body:'{"success":true}'});
        return req.respond({status:503,contentType:"application/json",body:'{"success":false,"error":"QA unavailable"}'});
      }
      let data={success:true,templates:[],items:[],reactions:{},creations:[],projects:[],skills:[],tickets:[],notifications:[],balance:0,user};
      if(u.pathname==="/api/auth/me")data={success:true,user};
      if(u.pathname==="/api/credits"){
        if(fault==="credits-down")return req.respond({status:503,contentType:"application/json",body:'{"success":false}'});
        data={success:true,plan:"free",planLabel:"Free",left:fault==="bad-credits"?-1:5,perDay:5,cost:{export:1,animate:2}};
      }
      if(u.pathname.startsWith("/api/notifications")){
        if(fault==="notes-down")return req.respond({status:503,contentType:"application/json",body:'{"success":false}'});
        if(fault==="notes-malformed")return req.respond({status:200,contentType:"application/json",body:'{"success":true,"notifications":[],"unread":"unknown"}'});
        data={success:true,unread,total:1,notifications:[{id:"qa-note",message:"QA note",url:noteUrl,read:false,createdAt:"2026-10-02T00:00:00Z"}]};
      }
      return req.respond({status:200,contentType:"application/json",body:JSON.stringify(data)});
    });
    async function go(route,theme="light"){
      const init=await page.evaluateOnNewDocument(t=>{if(top!==window)return;localStorage.setItem("sc_theme",t);},theme);
      try{await page.goto(base+route,{waitUntil:"load"});}finally{await page.removeScriptToEvaluateOnNewDocument(init.identifier);}
      await wait(250);
    }
    async function check(id,fn){try{const value=await fn();results.push({id,status:value===true?"PASS":"FAIL",detail:String(value)});}catch(e){results.push({id,status:"FAIL",detail:e.message});}}
    async function file(selector, bytes, name="valid.png", type="image/png"){
      await page.$eval(selector,(el,{bytes,name,type})=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(bytes)],name,{type}));el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));},{bytes:[...bytes],name,type});
    }
    const png=await sharp({create:{width:16,height:12,channels:4,background:"#123456"}}).png().toBuffer();
    await go("/");
    await check("model/Arrow-Enter-focus-and-selection",async()=>{
      await page.focus("#qualityBtn");await page.keyboard.press("ArrowDown");await page.keyboard.press("Home");await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
      return page.evaluate(()=>document.querySelector("#qualitySelect").value==="pro"&&document.querySelector("#qualityMenu").hidden&&document.activeElement.id==="qualityBtn");
    });
    await check("model/ArrowUp-End-Space",async()=>{
      await page.keyboard.press("ArrowUp");await page.keyboard.press("End");await page.keyboard.press("Space");
      return page.$eval("#qualitySelect",e=>e.value==="max");
    });
    await check("model/Escape-restores-focus",async()=>{
      await page.keyboard.press("ArrowDown");await page.keyboard.press("Escape");return page.evaluate(()=>document.querySelector("#qualityMenu").hidden&&document.activeElement.id==="qualityBtn");
    });
    for(const route of ["/","/editor?tpl=original-chat-story"]){
      await go(route);
      if(route!=="/")await page.click("#edMobileAi");
      const input=route==="/"?"#composerImg":"#edImg",clear=route==="/"?"#composerImgClear":"#edImgClear",button=route==="/"?"#composerGo":"#edCreate";
      await check(route+"/image/valid-decoded",async()=>{
        await file(input,png);await page.waitForFunction(s=>!document.querySelector(s).disabled,{},button);
        return page.$eval(clear,e=>!e.hidden&&e.textContent.includes("valid.png"));
      });
      await check(route+"/image/cancel-preserves-valid",async()=>{
        await page.$eval(input,e=>{e.value="";e.dispatchEvent(new Event("change",{bubbles:true}));});await wait(100);return page.$eval(clear,e=>!e.hidden&&e.textContent.includes("valid.png"));
      });
      for(const [id,bytes,name,type]of[["corrupt",Buffer.from("not image"),"corrupt.png","image/png"],["unsupported",Buffer.from("<svg/>"),"bad.svg","image/svg+xml"],["oversized",Buffer.alloc(900*1024+1),"large.png","image/png"]]){
        await check(route+"/image/"+id+"-preserves-valid",async()=>{await file(input,bytes,name,type);await page.waitForFunction(s=>!document.querySelector(s).disabled,{},button);return page.$eval(clear,e=>!e.hidden&&e.textContent.includes("valid.png"));});
      }
      await check(route+"/image/remove-and-race-safe",async()=>{
        // Deliberately delay the shared reader to test stale promise handling.
        await page.evaluate(()=>{window.qaReader=window.SC_IMAGE_INPUT.read;window.SC_IMAGE_INPUT.read=f=>new Promise(r=>{window.qaImageResolve=()=>r({name:f.name,dataUrl:"data:image/png;base64,QA"});});});
        await file(input,png,"late.png");const busy=await page.$eval(button,e=>e.disabled);
        await page.click(clear);await page.evaluate(()=>{window.qaImageResolve();window.SC_IMAGE_INPUT.read=window.qaReader;});await wait(100);
        return busy&&await page.$eval(clear,e=>e.hidden)&&await page.$eval(button,e=>!e.disabled);
      });
    }
    for(const route of ["/","/contact","/account"]){
      for(fault of ["credits-down","bad-credits"]){
        await go(route);await check(route+"/"+fault+"/honest-balance",()=>page.$$eval(".sh-credit-balance,.sh-plan-credits",els=>els.length>0&&els.every(e=>e.textContent==="Unavailable")));
      }
      fault="";await go(route);await check(route+"/credits/reload-recovers",()=>page.$eval(".sh-credit-balance",e=>/^5\s+Credits$/i.test(e.textContent)));
    }
    for(fault of ["notes-down","notes-malformed"]){
      await go("/");await page.click("#notificationBtn");await page.waitForSelector("#notificationError");
      await check(fault+"/visible-error",()=>page.$eval("#notificationError",e=>/could not load/.test(e.textContent)));
      fault="";await page.click("#notificationError button");await page.waitForSelector(".sh-notification-item");
      await check("notifications/retry-recovery",()=>page.evaluate(()=>!document.querySelector("#notificationError")&&document.querySelector("#notificationCount").textContent==="99+"));
    }
    await check("notifications/read-all-failure-preserves-balance-and-title",async()=>{
      await page.click("#notificationsReadBtn");await page.waitForSelector("#notificationError");
      return page.evaluate(()=>document.querySelector("#notificationCount").textContent==="99+"&&document.title.startsWith("(99+)"));
    });
    await page.evaluate(()=>document.addEventListener("click",e=>{if(e.target.closest(".sh-notification-item"))e.preventDefault();},true));
    await check("notifications/single-read-failure-preserves-unread",async()=>{
      await page.click(".sh-notification-item");await wait(150);return page.$eval(".sh-notification-item",e=>e.dataset.read==="false");
    });
    fault="read-success";
    await check("notifications/single-read-99plus-not-zero",async()=>{
      await page.click(".sh-notification-item");await wait(150);return page.evaluate(()=>document.querySelector(".sh-notification-item").dataset.read==="true"&&document.querySelector("#notificationCount").textContent==="99+"&&document.title.startsWith("(99+)"));
    });
    fault="";
    for(noteUrl of ["//evil.example","/\\evil.example","javascript:alert(1)"]){
      await go("/");await page.click("#notificationBtn");await page.waitForSelector(".sh-notification-item");
      await check("notifications/link-safety/"+noteUrl,()=>page.$eval(".sh-notification-item",e=>new URL(e.href).origin===location.origin));
    }
    await go("/contact","dark");await page.screenshot({path:path.join(out,"feedback-dark-after.png"),fullPage:true});
    await go("/","dark");await page.screenshot({path:path.join(out,"home-dark-after.png"),fullPage:true});
    await page.screenshot({path:path.join(out,"home-dark-top-after.png")});
    results.push({id:"console/no-uncaught-errors",status:errors.length?"FAIL":"PASS",detail:JSON.stringify(errors)});
    fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({testedAt:new Date().toISOString(),scope:"Isolated browser UI fixtures, no real writes",results,errors,writes},null,2));
    const fails=results.filter(r=>r.status==="FAIL");console.log(JSON.stringify({checks:results.length,failures:fails,evidence:path.join(out,"evidence.json")},null,2));if(fails.length)process.exitCode=1;
  }finally{if(browser)await browser.close();preview.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
