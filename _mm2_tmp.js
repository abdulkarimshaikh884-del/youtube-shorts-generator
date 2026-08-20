const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await p.goto(BASE+"/template?id=docu-red-string",{waitUntil:"networkidle2"});
await new Promise(r=>setTimeout(r,2000));
console.log(JSON.stringify(await p.evaluate(()=>{
 const L=document.querySelector(".sh-modal-left");
 const card=document.querySelector(".sh-modal-card");
 const kids=[...card.children].map(e=>({cls:e.className.slice(0,40),w:Math.round(e.getBoundingClientRect().width)}));
 // find widest descendants of left
 const wide=[...L.querySelectorAll("*")].map(e=>({cls:(e.tagName+"."+String(e.className).split(" ")[0]).slice(0,42),w:Math.round(e.getBoundingClientRect().width),ws:getComputedStyle(e).whiteSpace,fx:getComputedStyle(e).flex,disp:getComputedStyle(e).display}))
   .filter(x=>x.w>360).sort((a,b)=>b.w-a.w).slice(0,10);
 return {cardKids:kids, wideInLeft:wide, leftHTMLstart:L.innerHTML.slice(0,300)};
}),null,1));
await b.close();})();
