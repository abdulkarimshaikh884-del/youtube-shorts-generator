const puppeteer=require("puppeteer");const fs=require("fs");
const BASE=process.env.B||"http://localhost:3000";
const OUT="./_shots"; if(!fs.existsSync(OUT))fs.mkdirSync(OUT);
(async()=>{
  const b=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
  const p=await b.newPage();
  await p.setViewport({width:1200,height:900,deviceScaleFactor:1});
  await p.goto(BASE+"/",{waitUntil:"networkidle2"});
  await new Promise(r=>setTimeout(r,2500));
  const list=await p.evaluate(()=>SC_TPL2.list().map(t=>({id:t.id,cat:t.cat,name:t.name||t.label||t.title})));
  fs.writeFileSync("./_shots/list.json",JSON.stringify(list,null,1));
  console.log("categories:",[...new Set(list.map(t=>t.cat))].join(", "));

  // build a page that renders N templates in a grid of iframes
  const chunk=(a,n)=>a.reduce((r,v,i)=>(i%n?r[r.length-1].push(v):r.push([v]),r),[]);
  const groups=chunk(list,12);
  for(let gi=0;gi<groups.length;gi++){
    const g=groups[gi];
    await p.evaluate((ids)=>{
      document.body.innerHTML="";
      document.body.style.cssText="background:#0a0a0f;margin:0;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px;font:11px system-ui";
      ids.forEach(t=>{
        const wrap=document.createElement("div");
        wrap.style.cssText="position:relative";
        const f=document.createElement("iframe");
        f.style.cssText="width:100%;aspect-ratio:9/16;border:0;background:#000;display:block";
        f.setAttribute("sandbox","allow-scripts");
        f.srcdoc=SC_TPL2.build(t.id,{aspect:"9:16"});
        const lab=document.createElement("div");
        lab.textContent=t.id; lab.style.cssText="position:absolute;bottom:0;left:0;right:0;background:#000c;color:#0f0;font:10px monospace;padding:2px";
        wrap.appendChild(f);wrap.appendChild(lab);document.body.appendChild(wrap);
      });
    }, g);
    await new Promise(r=>setTimeout(r,3500));
    await p.screenshot({path:`${OUT}/sheet_${String(gi).padStart(2,"0")}.png`,fullPage:true});
    console.log("sheet",gi,"->",g.map(t=>t.id).join(","));
  }
  await b.close();
})().catch(e=>{console.error("FATAL",e.message);process.exit(1)});
