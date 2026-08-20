const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
const R=["/","/editor","/community","/account","/pricing","/seo-tools","/about","/contact","/template?id=docu-red-string"];
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
for(const w of [390,768]){
 const p=await b.newPage();await p.setViewport({width:w,height:844,isMobile:w<500,hasTouch:w<500});
 for(const r of R){
  try{await p.goto(BASE+r,{waitUntil:"networkidle2",timeout:30000});}catch(e){console.log(w,r,"NAV FAIL");continue;}
  await new Promise(x=>setTimeout(x,1500));
  const o=await p.evaluate(()=>{
    const over=document.documentElement.scrollWidth-window.innerWidth;
    const wide=[...document.querySelectorAll("body *")].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.right>window.innerWidth+2&&getComputedStyle(el).position!=="fixed";}).slice(0,3).map(el=>(el.tagName+"."+String(el.className).split(" ")[0]).slice(0,40)+" +"+Math.round(el.getBoundingClientRect().right-window.innerWidth)+"px");
    const tiny=[...document.querySelectorAll("button,a")].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0&&b.height<28&&el.innerText.trim();}).length;
    return {over:over>1?over:0,wide,tiny};
  });
  if(o.over||o.wide.length) console.log(`${w}px ${r}: overflow=${o.over}px  ${o.wide.join(" ; ")}`);
 }
 await p.close();
}
await b.close();})();
