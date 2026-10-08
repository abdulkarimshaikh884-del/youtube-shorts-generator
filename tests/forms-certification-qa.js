"use strict";
// Owns a DB-free preview. All API responses (including writes)
// are intercepted in this browser; no account, email or ticket is created.
const puppeteer=require("./qa-browser"),fs=require("node:fs"),path=require("node:path");
const base="http://127.0.0.1:3327",out=path.resolve(__dirname,"../audit_results/page-certification/forms");
const {spawn}=require("node:child_process");
const results=[],errors=[],writes=[];
let failure="unavailable";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const preview=spawn(process.execPath,["tests/polish-preview-server.js"],{cwd:path.resolve(__dirname,".."),windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let browser;
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error("DB-free preview startup timeout")),10000);
      preview.stdout.on("data",c=>{if(String(c).includes("database-free QA preview")){clearTimeout(timer);resolve();}});
      preview.stderr.on("data",c=>process.stderr.write(c));
      preview.once("error",e=>{clearTimeout(timer);reject(e);});
      preview.once("exit",code=>{clearTimeout(timer);reject(Error("Preview exited "+code));});
    });
    browser=await puppeteer.launch({headless:true,args:["--no-sandbox"]});
    const page=await browser.newPage();page.setDefaultTimeout(7000);
    page.on("pageerror",err=>errors.push(err.message));
    await page.setRequestInterception(true);
    page.on("request",async req=>{
      const url=new URL(req.url());
      if(["data:","blob:","about:"].includes(url.protocol))return req.continue();
      if(url.origin!==base)return req.abort();
      if(!url.pathname.startsWith("/api/"))return req.continue();
      if(req.method()!=="GET"){
        writes.push({path:url.pathname,method:req.method()}); // Never log passwords/body.
        await sleep(350);
        if(failure==="network")return req.abort("failed");
        return req.respond({status:503,contentType:"application/json",body:failure==="malformed"?"not-json":JSON.stringify({success:false,error:"QA service unavailable. Please retry."})});
      }
      const data=url.pathname==="/api/auth/me"?{success:true,user:null}:
        url.pathname==="/api/auth/google/config"?{enabled:false}:
        url.pathname==="/api/credits"?{success:true,plan:"free",left:5,perDay:5,cost:{export:1,animate:2}}:
        {success:true,items:[],templates:[],tickets:[],notifications:[],reactions:{},skills:[]};
      return req.respond({status:200,contentType:"application/json",body:JSON.stringify(data)});
    });
    async function check(id,fn){try{const detail=await fn();results.push({id,status:detail===true?"PASS":"FAIL",detail:String(detail)});}catch(e){results.push({id,status:"FAIL",detail:e.message});}}
    async function go(route,theme="light"){
      const init=await page.evaluateOnNewDocument(t=>{if(top!==window)return;try{localStorage.setItem("sc_theme",t);}catch{}},theme);
      try{await page.goto(base+route,{waitUntil:"load"});}finally{await page.removeScriptToEvaluateOnNewDocument(init.identifier);}
      await sleep(130);
    }
    async function set(selector,value){await page.$eval(selector,(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));},value);}
    const pages=["/login","/signup","/forgot-password","/reset-password","/contact"];
    for(const [width,height]of[[320,568],[390,844],[768,1024],[1440,900]])for(const theme of["light","dark"])for(const route of pages){
      await page.setViewport({width,height,isMobile:width<900,hasTouch:width<900});await go(route,theme);
      await check(`layout/${route}/${width}/${theme}`,()=>page.evaluate(t=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.dataset.theme===t,theme));
      if(route==="/contact")await check(`feedback/submit-contrast/${width}/${theme}`,()=>page.$eval("#fbSend",e=>{
        const s=getComputedStyle(e),rgb=v=>(v.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
        const luminance=v=>rgb(v).reduce((sum,n,i)=>{n/=255;return sum+[.2126,.7152,.0722][i]*(n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4));},0);
        const a=luminance(s.color),b=luminance(s.backgroundColor),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        return ratio>=4.5?true:JSON.stringify({foreground:s.color,background:s.backgroundColor,ratio});
      }));
      if(width===390)await page.screenshot({path:path.join(out,route.slice(1)+"-"+theme+".png"),fullPage:true});
    }
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    for(const route of["/login","/signup"]){
      await go(route+"?next=%2Fsettings");
      await check(route+"/invalid-email-no-request",async()=>{const n=writes.length;await set("#authEmail","invalid");await set("#authPassword","QaOnlyPassword123!");await page.click("#authSend");return writes.length===n&&await page.$eval("#authNote",e=>/email/i.test(e.textContent));});
      await check(route+"/next-preserved",()=>page.$eval(".pg-fine a",e=>new URL(e.href).searchParams.get("next")==="/settings"));
      await check(route+"/password-toggle-click",async()=>{await page.click("#authPasswordToggle");return page.$eval("#authPassword",e=>e.type==="text");});
      await check(route+"/password-toggle-keyboard-access",()=>page.$eval("#authPasswordToggle",e=>e.tabIndex>=0));
      await check(route+"/password-toggle-keyboard-Enter",async()=>{const n=writes.length;await page.focus("#authPasswordToggle");await page.keyboard.press("Enter");return n===writes.length&&await page.$eval("#authPassword",e=>e.type==="password");});
      await check(route+"/Google-unavailable-honest",async()=>await page.$eval("[data-google-signin]",e=>e.disabled)&&await page.$eval("[data-google-status]",e=>/not available/i.test(e.textContent)));
      if(route==="/signup"){
        await set("#authEmail","qa@example.test");await set("#authPassword","short");await set("#authHandle","qa_member");
        await check("signup/short-password-no-request",async()=>{const n=writes.length;await page.click("#authSend");return writes.length===n&&await page.$eval("#authNote",e=>/8 characters/.test(e.textContent));});
        await set("#authPassword","QaOnlyPassword123!");await set("#authHandle","bad user!");
        await check("signup/invalid-handle-no-request",async()=>{const n=writes.length;await page.click("#authSend");return writes.length===n&&await page.$eval("#authNote",e=>/username/.test(e.textContent));});
      }
      await go(route+"?next=https%3A%2F%2Fevil.example");
      await check(route+"/unsafe-next-not-carried",()=>page.$eval(".pg-fine a",e=>!new URL(e.href).searchParams.has("next")));
    }
    await go("/reset-password");
    await check("reset/absent-token-blocked",()=>page.$eval("#resetSend",e=>e.disabled));
    await go("/reset-password?token="+"q".repeat(48));await set("#resetPassword","QaOnlyPassword123!");await set("#resetConfirm","DifferentPassword123!");
    for(const target of ["#resetPassword","#resetConfirm"])await check("reset/keyboard-toggle/"+target,async()=>{const s='[data-password-toggle="'+target+'"]';const reachable=await page.$eval(s,e=>e.tabIndex>=0);await page.focus(s);await page.keyboard.press("Space");return reachable&&await page.$eval(target,e=>e.type==="text");});
    await check("reset/mismatch-no-request",async()=>{const n=writes.length;await page.click("#resetSend");return n===writes.length&&await page.$eval("#resetNote",e=>/match/.test(e.textContent));});
    await go("/forgot-password");await set("#forgotEmail","bad");
    await check("forgot/invalid-email-no-request",async()=>{const n=writes.length;await page.click("#forgotSend");return n===writes.length&&await page.$eval("#forgotNote",e=>/email/.test(e.textContent));});
    await go("/contact");
    await check("feedback/empty-no-request",async()=>{const n=writes.length;await page.click("#fbSend");return n===writes.length&&await page.$eval("#fbNote",e=>/name/.test(e.textContent));});
    const flows=[
      {id:"login",route:"/login",fields:{"#authEmail":"qa@example.test","#authPassword":"QaOnlyPassword123!"},button:"#authSend",note:"#authNote",form:"#authForm"},
      {id:"signup",route:"/signup",fields:{"#authEmail":"qa@example.test","#authPassword":"QaOnlyPassword123!","#authHandle":"qa_member"},button:"#authSend",note:"#authNote",form:"#authForm"},
      {id:"forgot",route:"/forgot-password",fields:{"#forgotEmail":"qa@example.test"},button:"#forgotSend",note:"#forgotNote",form:"#forgotForm"},
      {id:"reset",route:"/reset-password?token="+"q".repeat(48),fields:{"#resetPassword":"QaOnlyPassword123!","#resetConfirm":"QaOnlyPassword123!"},button:"#resetSend",note:"#resetNote",form:"#resetForm"},
      {id:"feedback",route:"/contact",fields:{"#fbName":"QA Tester","#fbEmail":"qa@example.test","#fbMessage":"QA: typed report must remain after failed submission."},button:"#fbSend",note:"#fbNote",form:"#fbForm"}
    ];
    for(const flow of flows)for(failure of["unavailable","network","malformed"]){
      await go(flow.route);for(const [key,value]of Object.entries(flow.fields))await set(key,value);
      await check(flow.id+"/"+failure+"/failure-recovery",async()=>{
        const n=writes.length;await page.$eval(flow.form,e=>e.requestSubmit());
        const busy=await page.$eval(flow.button,e=>e.disabled);await page.waitForFunction(s=>!document.querySelector(s).disabled,{},flow.button);
        const state=await page.$eval(flow.note,e=>({bad:e.hasAttribute("data-bad"),text:e.textContent}));
        let retained=true;for(const [key,value]of Object.entries(flow.fields))retained=retained&&await page.$eval(key,(e,v)=>e.value===v,value);
        return busy&&writes.length===n+1&&retained&&state.bad&&state.text.length>0&&page.url()===base+flow.route;
      });
    }
    results.push({id:"console/no-uncaught-errors",status:errors.length?"FAIL":"PASS",detail:JSON.stringify(errors.slice(0,10))});
    fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({testedAt:new Date().toISOString(),scope:"DB-free UI with API fixtures; local values only; no real authentication, email or support persistence",results,errors,writes},null,2));
    const fails=results.filter(r=>r.status==="FAIL");console.log(JSON.stringify({checks:results.length,failures:fails,evidence:path.join(out,"evidence.json")},null,2));if(fails.length)process.exitCode=1;
  }finally{if(browser)await browser.close();preview.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
