const puppeteer = require("puppeteer");
const BASE = process.env.B || "http://localhost:3000";
const log = (a,m) => console.log(`[${a}] ${m}`);
const VIS = `(el)=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"}`;

(async () => {
  const browser = await puppeteer.launch({ headless:"new", args:["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width:1440, height:900 });
  const errs=[];
  page.on("pageerror",e=>errs.push("JS:"+e.message.slice(0,150)));
  page.on("console",m=>{if(m.type()==="error"&&!/google-analytics|favicon/.test(m.text()))errs.push("C:"+m.text().slice(0,160));});
  page.on("response",r=>{if(r.status()>=400&&r.url().startsWith(BASE))errs.push("HTTP"+r.status()+" "+r.url().replace(BASE,""));});

  await page.goto(BASE+"/", {waitUntil:"networkidle2"});
  await page.evaluate(async()=>{await fetch("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"deep"+Date.now()+"@example.com",password:"TestPass123!"})});});

  // ================= EDITOR =================
  await page.goto(BASE+"/editor?tpl=docu-red-string", {waitUntil:"networkidle2"});
  await new Promise(r=>setTimeout(r,3000));
  log("editor", JSON.stringify(await page.evaluate(()=>({
    stageFrame: !!document.querySelector("#edFrame iframe, #edFrame canvas, #edFrame > *"),
    frameChildren: (document.getElementById("edFrame")||{}).children?.length,
    tplOptions: document.querySelectorAll("#edTpl option").length,
    fontOptions: document.querySelectorAll("#edFont option").length,
    aspectOptions: document.querySelectorAll("#edAspect option").length,
    fields: document.querySelectorAll("#edFields input, #edFields textarea").length,
    clips: document.querySelectorAll("#edClips > *").length,
    creditsN: (document.getElementById("edCreditsN")||{}).textContent,
    status: (document.getElementById("edStatus")||{}).textContent,
    swatches: document.querySelectorAll("#edSwatches > *").length,
  }))));

  // play/pause
  await page.evaluate(()=>document.getElementById("edPlay")?.click());
  await new Promise(r=>setTimeout(r,800));
  const t1 = await page.evaluate(()=>document.getElementById("edNow")?.textContent);
  await page.evaluate(()=>document.getElementById("edPlay")?.click());
  await new Promise(r=>setTimeout(r,1500));
  const t2 = await page.evaluate(()=>document.getElementById("edNow")?.textContent);
  log("editor.play", `after toggle t1=${t1} t2=${t2} (should differ if playing)`);

  // edit a text field -> does preview update?
  const fieldEdit = await page.evaluate(()=>{
    const f = document.querySelector("#edFields input[type=text], #edFields textarea");
    if(!f) return "no fields";
    f.value = "AUDIT TEST LINE"; f.dispatchEvent(new Event("input",{bubbles:true}));
    return "typed into " + (f.id||f.name||"field");
  });
  await new Promise(r=>setTimeout(r,1500));
  log("editor.field", fieldEdit);

  // aspect switch
  await page.evaluate(()=>{const s=document.getElementById("edAspect"); if(s&&s.options.length>1){s.selectedIndex=1;s.dispatchEvent(new Event("change",{bubbles:true}));}});
  await new Promise(r=>setTimeout(r,1200));
  log("editor.aspect", await page.evaluate(()=>{const f=document.getElementById("edFrame");return f?getComputedStyle(f).getPropertyValue("--arw")+":"+getComputedStyle(f).getPropertyValue("--arh"):"?";}));

  // template switch
  await page.evaluate(()=>{const s=document.getElementById("edTpl"); if(s&&s.options.length>3){s.selectedIndex=3;s.dispatchEvent(new Event("change",{bubbles:true}));}});
  await new Promise(r=>setTimeout(r,1800));
  log("editor.tplswitch", await page.evaluate(()=>({tpl:document.getElementById("edTpl")?.value, fields:document.querySelectorAll("#edFields input,#edFields textarea").length, frameKids:document.getElementById("edFrame")?.children.length})));

  // export modal
  await page.evaluate(()=>document.getElementById("edExport")?.click());
  await new Promise(r=>setTimeout(r,900));
  log("editor.exportmodal", await page.evaluate((v)=>{const V=eval(v);const m=document.getElementById("exportModal");return {open: m?V(m):false, res:document.querySelectorAll("#edRes option").length, fps:document.querySelectorAll("#edFps option").length};},VIS));
  await page.evaluate(()=>document.getElementById("exportCancel")?.click());

  // publish modal
  await page.evaluate(()=>document.getElementById("edPublishOpen")?.click());
  await new Promise(r=>setTimeout(r,700));
  log("editor.publishmodal", await page.evaluate((v)=>{const V=eval(v);const m=document.getElementById("publishModal");return m?V(m):false;},VIS));
  await page.evaluate(()=>document.getElementById("publishCancel")?.click());

  console.log("\n--- EDITOR ERRORS ---\n"+([...new Set(errs)].join("\n")||"(none)"));
  await browser.close();
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
