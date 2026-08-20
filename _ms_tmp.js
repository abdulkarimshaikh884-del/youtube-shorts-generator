const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await p.goto(BASE+"/template?id=docu-red-string",{waitUntil:"networkidle2"});
await new Promise(r=>setTimeout(r,3000));
await p.screenshot({path:"./_shots/mobile_template.png",fullPage:false});
console.log(JSON.stringify(await p.evaluate(()=>{
 const L=document.querySelector(".sh-modal-left"),S=document.querySelector(".sh-modal-stage");
 const g=e=>e?{w:Math.round(e.getBoundingClientRect().width),left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)}:null;
 const wrap=document.querySelector(".sh-modal-wrap,.sh-modal-body,.sh-modal");
 return {vw:innerWidth,left:g(L),stage:g(S),wrap:wrap?{cls:wrap.className,disp:getComputedStyle(wrap).display,gtc:getComputedStyle(wrap).gridTemplateColumns}:null};
}),null,1));
await b.close();})();
