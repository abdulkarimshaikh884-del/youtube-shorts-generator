"use strict";
// Real isolated preview server; public catalog GETs and browser rendering only.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),browserTools=require("./qa-browser");
const base="http://127.0.0.1:3341",out=path.resolve("audit_results/preview-catalog");
(async()=>{
  const designs=await (await fetch(base+"/api/designs/templates")).json(), tutorials=await (await fetch(base+"/api/skills?limit=100")).json();
  assert(designs.templates.length>3); assert(tutorials.skills.length>0);
  assert(designs.templates.every(t=>t.title!=="Local real Design QA"));
  console.log("PASS public catalog snapshot",designs.templates.length,"designs",tutorials.skills.length,"tutorials");
  fs.mkdirSync(out,{recursive:true}); const browser=await browserTools.launch({headless:true});
  try{
    const page=await browser.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setViewport({width:1536,height:1000});
    await page.setRequestInterception(true);page.on("request",r=>{
      const u=new URL(r.url());
      if(["data:","blob:","about:"].includes(u.protocol))return r.continue();
      if(!["GET","HEAD"].includes(r.method()))return r.abort();
      if(u.origin===base||["shortscraft.online","i.ytimg.com","fonts.googleapis.com","fonts.gstatic.com"].includes(u.hostname))return r.continue();
      r.abort();
    });
    await page.goto(base,{waitUntil:"networkidle2"});
    await page.waitForSelector("#homeDesignsGrid .ds-card");await page.waitForSelector("#homeTutList .sh-tut-card");
    await page.$eval("#homeDesigns",e=>e.scrollIntoView());
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#homeDesignsGrid img.ds-template-preview')).some(i=>i.complete&&i.naturalWidth>0));
    await page.screenshot({path:path.join(out,"home-designs.png")});
    assert.equal(await page.$eval("#howItWorks",e=>getComputedStyle(e).borderTopWidth),"0px");
    await page.$eval("#homeTutList",e=>e.scrollIntoView({block:"center"}));
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#homeTutList img')).some(i=>i.complete&&i.naturalWidth>0));
    await page.screenshot({path:path.join(out,"home-tutorials.png")});
    await page.goto(base+"/designs",{waitUntil:"networkidle2"});
    assert.equal(await page.$$(".ds-card").then(a=>a.length),designs.templates.length);
    await page.select("#designFilter","free");assert((await page.$$(".ds-card")).length>0);
    await page.goto(base+"/community",{waitUntil:"networkidle2"});
    assert.equal(await page.$$(".sk-card").then(a=>a.length),tutorials.skills.length);
    const title=tutorials.skills[0].title;
    await page.$eval("#tutorialSearch",(e,title)=>{e.value=title;e.dispatchEvent(new Event("input"));},title);
    assert((await page.$$(".sk-card")).length>0);
    const creator=tutorials.skills[0].author.name;
    assert(creator);
    await page.$eval("#tutorialSearch",(e,name)=>{e.value=name;e.dispatchEvent(new Event("input"));},creator);
    assert.equal((await page.$$(".sk-card")).length,tutorials.skills.filter(s=>[s.title,s.summary,s.description,s.platform,s.author && (s.author.displayName || s.author.name),s.author && s.author.handle].join(" ").toLowerCase().includes(creator.toLowerCase())).length);
    assert.deepEqual(errors,[]);
    console.log("PASS real catalog cards, decoded design/tutorial images, filter/search and removed workflow border; no browser page errors");
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
