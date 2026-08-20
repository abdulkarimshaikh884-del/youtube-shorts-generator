const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
const p=await b.newPage();await p.setViewport({width:1440,height:900});
const errs=[],api=[];
p.on("pageerror",e=>errs.push("JS:"+e.message.slice(0,140)));
p.on("console",m=>{if(m.type()==="error")errs.push("C:"+m.text().slice(0,150));});
p.on("response",async r=>{if(r.url().includes("/api/")){let t="";try{t=(await r.text()).slice(0,300);}catch(e){}api.push(r.status()+" "+r.url().replace(BASE,"")+" -> "+t);}});
await p.goto(BASE+"/seo-tools",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,1500));
await p.type("#seoTopic","how to grow on youtube shorts");
await p.evaluate(()=>{const btn=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Generate");btn.click();});
await new Promise(r=>setTimeout(r,20000));
console.log(JSON.stringify(await p.evaluate(()=>{
  const out=document.querySelector("[id*=out],[id*=result],[class*=out],[class*=result]");
  return {outId:out?.id,outCls:out?.className,outText:(out?.innerText||"").replace(/\n+/g," | ").slice(0,500),
    btn:[...document.querySelectorAll("button")].find(b=>/generat/i.test(b.textContent))?.textContent.trim()};
}),null,1));
console.log("API:\n"+api.join("\n"));
console.log("ERRS:",[...new Set(errs)].join(" || ")||"(none)");
await b.close();})();
