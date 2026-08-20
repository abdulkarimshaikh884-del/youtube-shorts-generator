const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
const p=await b.newPage();await p.setViewport({width:1440,height:900});
const errs=[];p.on("pageerror",e=>errs.push("JS:"+e.message.slice(0,140)));
p.on("console",m=>{if(m.type()==="error")errs.push("C:"+m.text().slice(0,150));});
p.on("response",r=>{if(r.status()>=400)errs.push("HTTP"+r.status()+" "+r.url().replace(BASE,""));});
await p.goto(BASE+"/community",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,3000));
console.log(JSON.stringify(await p.evaluate(()=>{
  const grid=document.querySelector("[id*=grid],[class*=grid],[id*=gallery]");
  return {gridId:grid?.id, gridCls:grid?.className, kids:grid?.children.length,
    iframes:document.querySelectorAll("iframe").length,
    bodyText:document.body.innerText.replace(/\n+/g," | ").slice(0,700)};
}),null,1));
console.log("ERRS:",[...new Set(errs)].join(" || ")||"(none)");
await b.close();})();
