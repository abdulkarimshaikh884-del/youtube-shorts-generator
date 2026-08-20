const puppeteer = require("puppeteer");
const BASE = process.env.B || "http://localhost:3000";
const log = (a,m) => console.log(`[${a}] ${m}`);
const vis = `(el)=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"}`;

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push("JS:" + e.message.slice(0,150)));
  page.on("console", m => { if (m.type()==="error" && !/google-analytics|favicon/.test(m.text())) errs.push("C:"+m.text().slice(0,160)); });
  page.on("response", r => { if (r.status()>=400 && r.url().startsWith(BASE)) errs.push("HTTP"+r.status()+" "+r.url().replace(BASE,"")); });

  await page.goto(BASE + "/signup", { waitUntil: "networkidle2" });
  await page.evaluate(async () => {
    await fetch("/api/auth/signup", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ email:"deep"+Date.now()+"@example.com", password:"TestPass123!" })});
  });

  await page.goto(BASE + "/", { waitUntil: "networkidle2" });
  await new Promise(r=>setTimeout(r,2500));

  const count = () => page.evaluate((v)=>{const V=eval(v);return [...document.querySelectorAll("#gallery > *")].filter(V).length;}, vis);
  log("home", "visible cards = " + await count());

  // filters
  const fnames = await page.evaluate(()=>[...document.querySelectorAll("#filters button")].map(b=>b.textContent.trim()));
  for (const f of fnames) {
    await page.evaluate((f)=>{[...document.querySelectorAll("#filters button")].find(b=>b.textContent.trim()===f)?.click();}, f);
    await new Promise(r=>setTimeout(r,600));
    log("filter", `${f} = ${await count()}`);
  }
  await page.evaluate(()=>{[...document.querySelectorAll("#filters button")][0]?.click();});
  await new Promise(r=>setTimeout(r,700));

  // search
  for (const q of ["money","zzzqqq","paper"]) {
    await page.evaluate((q)=>{const i=document.getElementById("tplSearch"); i.value=q; i.dispatchEvent(new Event("input",{bubbles:true}));}, q);
    await new Promise(r=>setTimeout(r,800));
    log("search", `"${q}" = ${await count()} visible`);
  }
  await page.evaluate(()=>{const i=document.getElementById("tplSearch"); i.value=""; i.dispatchEvent(new Event("input",{bubbles:true}));});
  await new Promise(r=>setTimeout(r,700));

  // preview iframes actually animating?
  const paint = await page.evaluate(()=>{
    const fr=[...document.querySelectorAll("#gallery iframe")].slice(0,4);
    return { total: document.querySelectorAll("#gallery iframe").length,
      info: fr.map(f=>({ srcdoc: !!f.getAttribute("srcdoc"), len:(f.getAttribute("srcdoc")||f.src||"").length, h: f.getBoundingClientRect().height|0 })) };
  });
  log("previews", JSON.stringify(paint));

  // click a card -> modal
  await page.evaluate(()=>{ const c=document.querySelector("#gallery > *"); (c.querySelector("a,button")||c).click(); });
  await new Promise(r=>setTimeout(r,1800));
  const modal = await page.evaluate((v)=>{const V=eval(v);
    const cand=[...document.querySelectorAll("[class*=modal],[id*=odal],dialog,[class*=sheet],[class*=overlay]")].filter(V);
    return { url: location.pathname+location.search, n: cand.length,
      first: cand[0]? {id:cand[0].id, cls:cand[0].className.slice(0,60), txt:cand[0].innerText.replace(/\n/g," | ").slice(0,200)} : null };}, vis);
  log("cardclick", JSON.stringify(modal));

  // buttons inside modal
  const mbtns = await page.evaluate((v)=>{const V=eval(v);
    return [...document.querySelectorAll("[class*=modal] button,[class*=modal] a,[id*=odal] button,[id*=odal] a")].filter(V).map(b=>b.textContent.trim().slice(0,30)).filter(Boolean);}, vis);
  log("modal.buttons", JSON.stringify(mbtns));

  console.log("\n--- ERRORS ---\n" + ([...new Set(errs)].join("\n")||"(none)"));
  await browser.close();
})().catch(e=>{console.error("FATAL",e);process.exit(1);});
