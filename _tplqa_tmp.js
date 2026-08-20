const puppeteer=require("puppeteer");const fs=require("fs");
const BASE="http://localhost:3000";
(async()=>{
  const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
  const p=await b.newPage();
  await p.setViewport({width:420,height:760});
  await p.goto(BASE+"/",{waitUntil:"networkidle2"});
  await new Promise(r=>setTimeout(r,2500));
  const list=await p.evaluate(()=>SC_TPL2.list().map(t=>t.id));
  const results=[];
  for(const id of list){
    const html=await p.evaluate((id)=>SC_TPL2.build(id,{aspect:"9:16"}),id);
    const q=await b.newPage();
    await q.setViewport({width:405,height:720});
    const errs=[];
    q.on("pageerror",e=>errs.push(e.message.slice(0,120)));
    q.on("console",m=>{if(m.type()==="error")errs.push("C:"+m.text().slice(0,120));});
    await q.setContent(html,{waitUntil:"domcontentloaded"});
    const samples=[];
    for(const t of [600,1800,3200,4400]){
      await new Promise(r=>setTimeout(r, t===600?600:t-samples.reduce((a,b)=>a,0)));
      break;
    }
    // sample at 3 moments
    const snap=async()=>q.evaluate(()=>{
      const vp=document.querySelector(".vp")||document.body;
      const R=vp.getBoundingClientRect();
      const out={overflow:[],textLen:0,visEls:0,texts:[]};
      document.querySelectorAll(".cv *").forEach(el=>{
        const r=el.getBoundingClientRect();const s=getComputedStyle(el);
        if(r.width<1||r.height<1||s.visibility==="hidden"||s.display==="none"||parseFloat(s.opacity)<0.05)return;
        out.visEls++;
        const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(" ").trim();
        if(own) out.texts.push(own.slice(0,60));
        const over = Math.max(R.left-r.left, r.right-R.right, R.top-r.top, r.bottom-R.bottom);
        if(over>4 && own) out.overflow.push({t:own.slice(0,32),px:Math.round(over)});
      });
      out.textLen=(document.querySelector(".cv")||document.body).innerText.trim().length;
      return out;
    });
    const s1=await snap();
    await new Promise(r=>setTimeout(r,1600)); const s2=await snap();
    await new Promise(r=>setTimeout(r,1600)); const s3=await snap();
    const all=[s1,s2,s3];
    const maxOver=all.flatMap(s=>s.overflow).sort((a,b)=>b.px-a.px)[0]||null;
    const bestText=Math.max(...all.map(s=>s.textLen));
    const bestEls=Math.max(...all.map(s=>s.visEls));
    const allTexts=[...new Set(all.flatMap(s=>s.texts))];
    const placeholder=allTexts.filter(t=>/^(main )?text ?\d*$/i.test(t)||/lorem|placeholder|your text here/i.test(t));
    // duplicate text (same string appearing twice in one snapshot)
    const dup=[];
    for(const s of all){const c={};s.texts.forEach(t=>{if(t.length>6)c[t]=(c[t]||0)+1;});Object.entries(c).forEach(([k,v])=>{if(v>1&&!dup.includes(k))dup.push(k+" x"+v);});}
    results.push({id,maxOver,bestText,bestEls,placeholder,dup,errs:[...new Set(errs)]});
    await q.close();
  }
  fs.writeFileSync("./_shots/tplqa.json",JSON.stringify(results,null,1));
  console.log("=== TEMPLATE QA ===");
  for(const r of results){
    const bits=[];
    if(r.bestEls<3||r.bestText<3) bits.push(`BLANK (els=${r.bestEls} text=${r.bestText})`);
    if(r.maxOver&&r.maxOver.px>8) bits.push(`OVERFLOW ${r.maxOver.px}px "${r.maxOver.t}"`);
    if(r.placeholder.length) bits.push(`PLACEHOLDER ${JSON.stringify(r.placeholder)}`);
    if(r.dup.length) bits.push(`DUP ${JSON.stringify(r.dup.slice(0,2))}`);
    if(r.errs.length) bits.push(`ERR ${JSON.stringify(r.errs.slice(0,2))}`);
    if(bits.length) console.log(r.id.padEnd(26)+bits.join(" | "));
  }
  await b.close();
})().catch(e=>{console.error("FATAL",e);process.exit(1)});
