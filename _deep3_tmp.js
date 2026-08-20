const puppeteer=require("puppeteer");
const BASE=process.env.B||"http://localhost:3000";
const log=(a,m)=>console.log(`[${a}] ${typeof m==="string"?m:JSON.stringify(m)}`);
const VIS=`(el)=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"}`;
(async()=>{
  const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
  const p=await b.newPage();await p.setViewport({width:1440,height:900});
  const errs=[];
  p.on("pageerror",e=>errs.push("JS:"+e.message.slice(0,140)));
  p.on("console",m=>{if(m.type()==="error"&&!/google-analytics|favicon/.test(m.text()))errs.push("C:"+m.text().slice(0,150));});
  p.on("response",r=>{if(r.status()>=400&&r.url().startsWith(BASE))errs.push("HTTP"+r.status()+" "+r.url().replace(BASE,""));});

  await p.goto(BASE+"/",{waitUntil:"networkidle2"});
  const em="deep"+Date.now()+"@example.com";
  await p.evaluate(async(em)=>{await fetch("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em,password:"TestPass123!"})});},em);

  // ============ SEO TOOLS ============
  await p.goto(BASE+"/seo-tools",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,1800));
  log("seo.dom", await p.evaluate((v)=>{const V=eval(v);return{
    inputs:[...document.querySelectorAll("input,textarea")].filter(V).map(i=>i.id||i.name||i.placeholder?.slice(0,25)),
    buttons:[...document.querySelectorAll("button")].filter(V).map(x=>x.textContent.trim().slice(0,24)).filter(Boolean),
    tabs:[...document.querySelectorAll("[role=tab],[class*=tab]")].filter(V).map(x=>x.textContent.trim().slice(0,20)).filter(Boolean).slice(0,12)};},VIS));
  // try to run a generation
  const seoRun=await p.evaluate(async()=>{
    const ta=document.querySelector("textarea,input[type=text]"); if(!ta) return "no input";
    ta.value="how to grow on youtube shorts"; ta.dispatchEvent(new Event("input",{bubbles:true}));
    const btn=[...document.querySelectorAll("button")].find(b=>/generate|create|run|write/i.test(b.textContent));
    if(!btn) return "no generate button";
    btn.click(); return "clicked: "+btn.textContent.trim().slice(0,30);
  });
  log("seo.run",seoRun);
  await new Promise(r=>setTimeout(r,9000));
  log("seo.result", await p.evaluate(()=>{const t=document.body.innerText;return {len:t.length, tail:t.slice(-260).replace(/\n+/g," | ")};}));

  // ============ COMMUNITY ============
  await p.goto(BASE+"/community",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,2000));
  log("community", await p.evaluate((v)=>{const V=eval(v);const cards=[...document.querySelectorAll("[class*=card],[class*=tile],article")].filter(V);
    return {cards:cards.length, first:cards[0]?cards[0].innerText.replace(/\n/g," | ").slice(0,120):null,
      buttons:[...document.querySelectorAll("button")].filter(V).map(x=>x.textContent.trim().slice(0,22)).filter(Boolean).slice(0,12)};},VIS));

  // ============ ACCOUNT ============
  await p.goto(BASE+"/account",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,2000));
  log("account", await p.evaluate((v)=>{const V=eval(v);return{
    inputs:[...document.querySelectorAll("input,textarea")].filter(V).map(i=>({id:i.id,val:(i.value||"").slice(0,25)})),
    buttons:[...document.querySelectorAll("button")].filter(V).map(x=>x.textContent.trim().slice(0,24)).filter(Boolean),
    text:document.body.innerText.replace(/\n+/g," | ").slice(0,300)};},VIS));
  // save profile
  const save=await p.evaluate(async()=>{
    const n=document.querySelector("#displayName,#acName,input[name=displayName]"); if(n){n.value="Audit Tester";n.dispatchEvent(new Event("input",{bubbles:true}));}
    const btn=[...document.querySelectorAll("button")].find(b=>/save|update/i.test(b.textContent));
    if(!btn)return "no save button"; btn.click(); return "clicked "+btn.textContent.trim();
  });
  log("account.save",save); await new Promise(r=>setTimeout(r,2500));
  log("account.after", await p.evaluate(()=>document.body.innerText.replace(/\n+/g," | ").slice(0,220)));

  // ============ PRICING ============
  await p.goto(BASE+"/pricing",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,1800));
  log("pricing", await p.evaluate((v)=>{const V=eval(v);return{
    buttons:[...document.querySelectorAll("button,a[class*=btn],a[class*=cta]")].filter(V).map(x=>x.textContent.trim().slice(0,30)).filter(Boolean),
    prices:[...document.body.innerText.matchAll(/₹[\d,]+/g)].map(m=>m[0])};},VIS));
  const buy=await p.evaluate(()=>{const btn=[...document.querySelectorAll("button,a")].find(b=>/upgrade|buy|get pro|reserve/i.test(b.textContent));if(!btn)return "no buy btn";btn.click();return "clicked "+btn.textContent.trim().slice(0,30);});
  log("pricing.buy",buy); await new Promise(r=>setTimeout(r,2500));
  log("pricing.after", await p.evaluate((v)=>{const V=eval(v);const m=[...document.querySelectorAll("[class*=modal],[id*=odal]")].filter(V);
    return {url:location.pathname, modal:m[0]?m[0].innerText.replace(/\n+/g," | ").slice(0,220):null};},VIS));

  // ============ CONTACT/FEEDBACK ============
  await p.goto(BASE+"/contact",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,1500));
  const fb=await p.evaluate(async()=>{
    const ta=document.querySelector("textarea"); if(ta){ta.value="Audit feedback test";ta.dispatchEvent(new Event("input",{bubbles:true}));}
    const em=document.querySelector("input[type=email]"); if(em){em.value="audit@example.com";em.dispatchEvent(new Event("input",{bubbles:true}));}
    const btn=[...document.querySelectorAll("button")].find(b=>/send|submit/i.test(b.textContent));
    if(!btn)return "no send btn"; btn.click(); return "clicked "+btn.textContent.trim();
  });
  log("contact.send",fb); await new Promise(r=>setTimeout(r,2500));
  log("contact.after", await p.evaluate(()=>document.body.innerText.replace(/\n+/g," | ").slice(-220)));

  console.log("\n--- ERRORS ---\n"+([...new Set(errs)].join("\n")||"(none)"));
  await b.close();
})().catch(e=>{console.error("FATAL",e);process.exit(1)});
