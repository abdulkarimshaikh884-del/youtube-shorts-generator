const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await p.goto(BASE+"/template?id=docu-red-string",{waitUntil:"networkidle2"});
await new Promise(r=>setTimeout(r,2500));
console.log(JSON.stringify(await p.evaluate(()=>{
 const info=(sel)=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();const s=getComputedStyle(e);
  return {sel,w:Math.round(r.width),left:Math.round(r.left),pos:s.position,disp:s.display,gtc:s.gridTemplateColumns,maxW:s.maxWidth,width:s.width,parent:e.parentElement?e.parentElement.className||e.parentElement.tagName:null};};
 return {vw:innerWidth, hasViewportMeta:!!document.querySelector('meta[name=viewport]'),
   vpContent:(document.querySelector('meta[name=viewport]')||{}).content,
   chain:[".sh-modal-overlay",".sh-modal-card",".sh-modal-left",".sh-modal-stage"].map(info),
   sheets:[...document.styleSheets].map(s=>s.href||"inline").slice(0,10)};
}),null,1));
await b.close();})();
