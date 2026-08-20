const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await p.goto(BASE+"/template?id=docu-red-string",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,1500));
console.log(JSON.stringify(await p.evaluate(()=>{
 // everything visible in the top 70px band
 const out=[];
 document.querySelectorAll("body *").forEach(e=>{
  const r=e.getBoundingClientRect();const s=getComputedStyle(e);
  if(r.top<70&&r.bottom>0&&r.width>10&&r.height>8&&s.display!=="none"&&s.visibility!=="hidden"&&parseFloat(s.opacity)>0.1){
   const txt=(e.innerText||"").trim().replace(/\n/g," ").slice(0,26);
   if(txt) out.push({t:e.tagName+"."+String(e.className).split(" ")[0].slice(0,22),L:Math.round(r.left),R:Math.round(r.right),txt,pos:s.position});
  }});
 return {vw:innerWidth, band:out.slice(0,16)};
}),null,1));
await b.close();})();
