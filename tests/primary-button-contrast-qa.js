"use strict";
// Shared primary buttons: opaque, flat-background, enabled controls only.
// This is a targeted contrast test, NOT full WCAG certification.
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process"),puppeteer=require("./qa-browser");
const root=path.resolve(__dirname,".."),base="http://127.0.0.1:3327",out=path.join(root,"audit_results/page-certification");
const routes=["/","/animations","/designs","/community","/drafts","/uploads","/settings","/pricing","/tutorials","/account","/contact","/about","/privacy","/terms","/login","/signup","/forgot-password","/reset-password","/creator?handle=shortscraft","/template?id=original-chat-story","/404"];
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const preview=spawn(process.execPath,["tests/polish-preview-server.js"],{cwd:root,windowsHide:true,stdio:["ignore","pipe","pipe"]});let browser;const results=[],errors=[];
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Preview timeout")),10000);preview.stdout.on("data",c=>{if(String(c).includes("database-free QA preview")){clearTimeout(timer);resolve();}});preview.stderr.on("data",c=>process.stderr.write(c));preview.once("exit",code=>{clearTimeout(timer);reject(Error("Preview exited "+code));});preview.once("error",e=>{clearTimeout(timer);reject(e);});});
    browser=await puppeteer.launch({headless:true,args:["--no-sandbox"]});const page=await browser.newPage();page.on("pageerror",e=>errors.push(e.message));await page.setRequestInterception(true);
    page.on("request",req=>{const u=new URL(req.url());if(["data:","blob:","about:"].includes(u.protocol))return req.continue();if(u.origin!==base)return req.abort();if(!u.pathname.startsWith("/api/"))return req.continue();
      const data=u.pathname==="/api/auth/me"?{success:true,user:null}:u.pathname==="/api/credits"?{success:true,plan:"free",planLabel:"Free",left:5,perDay:5,cost:{export:1,animate:2}}:u.pathname==="/api/auth/google/config"?{enabled:false}:{success:true,templates:[],items:[],skills:[],notifications:[],reactions:{},tickets:[],projects:[],creations:[]};
      return req.respond({status:req.method()==="GET"?200:403,contentType:"application/json",body:JSON.stringify(req.method()==="GET"?data:{success:false,error:"QA writes disabled"})});
    });
    for(const width of[390,1440])for(const theme of["light","dark"])for(const route of routes){
      await page.setViewport({width,height:844,isMobile:width===390,hasTouch:width===390});const init=await page.evaluateOnNewDocument(t=>{if(window!==top)return;try{localStorage.setItem("sc_theme",t);}catch{}},theme);
      try{await page.goto(base+route,{waitUntil:"load"});}finally{await page.removeScriptToEvaluateOnNewDocument(init.identifier);}
      await new Promise(r=>setTimeout(r,100));
      const controls=await page.evaluate(()=>[...document.querySelectorAll(".pg-bw,.sh-bw,.sh-cgo,.sh-ge-primary,.ig-btn-primary,.sh-hcta-primary,.sh-mfill,.pg-calc-cta,.sk-share-btn,.st-btn-primary,.sh-tupload-btn")].flatMap(e=>{
        const s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height||e.closest("[hidden]")||e.disabled||s.visibility==="hidden"||Number(s.opacity)<1||s.backgroundImage!=="none")return [];
        const parse=v=>(v.match(/[\d.]+/g)||[]).map(Number),foreground=parse(s.color),background=parse(s.backgroundColor);if(foreground.length<3||background.length<3||(foreground[3]??1)!==1||(background[3]??1)!==1)return [];
        const lum=v=>v.slice(0,3).reduce((sum,n,i)=>{n/=255;return sum+[.2126,.7152,.0722][i]*(n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4));},0);
        const a=lum(foreground),b=lum(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(s.fontSize),threshold=size>=24||(size>=18.66&&Number(s.fontWeight)>=700)?3:4.5;
        return [{id:e.id||null,label:e.textContent.trim().slice(0,80),ratio,threshold,foreground:s.color,background:s.backgroundColor,status:ratio>=threshold?"PASS":"FAIL"}];
      }));results.push({route,width,theme,controls,status:controls.some(c=>c.status==="FAIL")?"FAIL":controls.length?"PASS":"NOT_TESTED"});
      const first=controls.find(c=>c.status==="FAIL");if(first&&width===390){
        await page.evaluate(label=>{const e=[...document.querySelectorAll("button,a")].find(e=>e.textContent.trim()===label&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&!e.closest("[hidden]"));if(e)e.scrollIntoView({block:"center"});},first.label);
        await new Promise(r=>setTimeout(r,250));
        await page.screenshot({path:path.join(out,(route.split("?")[0].replace(/\W/g,"")||"home")+"-primary-dark.png")});
      }
    }
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"primary-button-contrast.json"),JSON.stringify({testedAt:new Date().toISOString(),scope:"DB-free guest fixture; flat opaque primary controls; no guarantee about all text, child overrides, image/gradient backgrounds or disabled controls",results,errors},null,2));
    const fails=results.flatMap(r=>r.controls.filter(c=>c.status==="FAIL").map(c=>({route:r.route,width:r.width,theme:r.theme,...c})));
    console.log(JSON.stringify({pageStates:results.length,controls:results.reduce((n,r)=>n+r.controls.length,0),failedControls:fails.length,affectedRoutes:[...new Set(fails.map(r=>r.route))],sampleFailures:fails.slice(0,5),errors:errors.slice(0,5)},null,2));if(fails.length||errors.length)process.exitCode=1;
  }finally{if(browser)await browser.close();preview.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
