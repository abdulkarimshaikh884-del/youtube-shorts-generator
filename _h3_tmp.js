const puppeteer=require("puppeteer");const BASE="http://localhost:3000";
(async()=>{const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const band=()=>p.evaluate(()=>{const out=[];document.querySelectorAll("header.sh-topbar *").forEach(e=>{
 const r=e.getBoundingClientRect();const s=getComputedStyle(e);
 if(r.width>4&&s.display!=="none"&&s.visibility!=="hidden"){const t=(e.innerText||"").trim().slice(0,20);
  out.push((e.tagName+(t?":"+t:""))+" ["+Math.round(r.left)+".."+Math.round(r.right)+"]");}});
 return {vw:innerWidth,items:out};});
for(const u of ["/","/template?id=docu-red-string"]){
 await p.goto(BASE+u,{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,1200));
 console.log("GUEST",u,JSON.stringify(await band()));
}
// sign in and check mobile menu contents
await p.evaluate(async()=>{await fetch("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"mob"+Date.now()+"@example.com",password:"TestPass123!"})});});
await p.goto(BASE+"/",{waitUntil:"networkidle2"});await new Promise(r=>setTimeout(r,1800));
console.log("LOGGEDIN topbar",JSON.stringify(await band()));
await p.evaluate(()=>document.getElementById("navBurger").click());
await new Promise(r=>setTimeout(r,700));
console.log("MOBILE MENU",JSON.stringify(await p.evaluate(()=>{
 const m=document.getElementById("navMobile");
 return {open:!m.hidden, items:[...m.children].filter(e=>!e.hidden&&getComputedStyle(e).display!=="none").map(e=>e.textContent.trim())};})));
await b.close();})();
