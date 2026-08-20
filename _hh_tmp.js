const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
for(const url of ["/","/template?id=docu-red-string","/creator?handle=crimedocu"]){
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await p.goto(BASE+url,{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,1500));
 console.log(url, JSON.stringify(await p.evaluate(()=>{
  const nav=document.querySelector("header,.sh-nav,nav");
  const burger=document.querySelector("#navBurger");
  const g=e=>e?{cls:String(e.className).slice(0,30),w:Math.round(e.getBoundingClientRect().width),left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)}:null;
  const off=[...document.querySelectorAll("header *, .sh-nav *")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-2||r.right>window.innerWidth+2);}).slice(0,4).map(e=>(e.tagName+"."+String(e.className).split(" ")[0]).slice(0,32)+" L"+Math.round(e.getBoundingClientRect().left)+" R"+Math.round(e.getBoundingClientRect().right));
  return {nav:g(nav), burgerVisible: burger? getComputedStyle(burger).display!=="none":"absent", offscreen:off};
 })));
 await p.close();
}
await b.close();})();
