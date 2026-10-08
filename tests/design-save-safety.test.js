"use strict";
// Real browser + application storage module; private in-memory fixtures only.
// Own ephemeral port. Never import server.js, dotenv, or a live database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const express = require("express");
const sharp = require("sharp");
const puppeteer = require("puppeteer");
assert(!process.env.DATABASE_URL, "Never run this fixture against a database");
const designs = require("../designs");

(async () => {
  let browser, server;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "shortscraft-save-safety-"));
  const checks = [];
  let mode = "normal", requests = 0, active = 0, maxActive = 0;
  const initialImage = await sharp(Buffer.from('<svg width="320" height="180"><rect width="320" height="180" fill="#e87934"/></svg>')).webp().toBuffer();
  const created = await designs.saveProject("qa", "new", {
    name:"Save safety QA", designType:"youtube-thumbnail", canvas:{width:640,height:360},
    elements:[{id:"image",type:"image",src:"data:image/webp;base64,"+initialImage.toString("base64"),x:0,y:0,width:320,height:180},
      {id:"text",type:"text",text:"ORIGINAL",x:20,y:210,width:500,height:70,fontSize:38,fill:"#fff"}]
  });
  const id = created.project.id;
  const app = express(); app.use(express.json({limit:"2mb"}));
  app.get("/api/designs/projects/:id", async(req,res)=>{
    const result = await designs.getProject("qa", req.params.id); res.status(result.status||200).json(result);
  });
  app.post("/api/designs/projects/:id", async(req,res)=>{
    requests++; active++; maxActive=Math.max(maxActive,active);
    try {
      if(mode==="unavailable") return res.status(503).json({success:false,error:"QA database temporarily unavailable. Retry save when connection returns."});
      if(mode==="serial") await new Promise(r=>setTimeout(r,requests===1?1800:50));
      const result = await designs.saveProject("qa",req.params.id,req.body);
      res.status(result.status||200).json(result);
    } finally {active--;}
  });
  app.post("/api/designs/publish", async(req,res)=>{
    const result = await designs.publishTemplate({id:"qa",handle:"@qa",displayName:"QA"},req.body);
    res.status(result.status||200).json(result);
  });
  app.use("/api",(req,res)=>res.json({success:true,user:{id:"qa",handle:"@qa",plan:"free"},notifications:[],items:[]}));
  app.get("/design-editor",(req,res)=>res.sendFile(path.resolve(__dirname,"../public/design-editor.html")));
  app.use(express.static(path.resolve(__dirname,"../public")));
  server = app.listen(0,"127.0.0.1"); await new Promise(r=>server.once("listening",r));
  const url="http://127.0.0.1:"+server.address().port+"/design-editor?id="+id;
  const check=(label, fn)=>{fn();checks.push(label);console.log("PASS "+label);};
  try {
    assert.equal((await designs.getProject(null,id)).status,401);
    assert.equal((await designs.getProject(id)).status,401);
    assert.equal((await designs.getProject("other",id)).status,404);
    check("private Designs require authenticated owner, including legacy direct-ID calls",()=>{});
    assert.equal((await designs.saveProject("qa",id,{...created.project,name:"blind overwrite"})).status,409);
    const accepted = await designs.saveProject("qa",id,{...created.project,name:"Versioned",expectedRevision:created.project.revision});
    assert(accepted.success);
    assert.equal((await designs.saveProject("qa",id,{...created.project,expectedRevision:created.project.revision})).status,409);
    check("backend rejects missing/stale revisions and accepts exact current revision",()=>assert.notEqual(accepted.project.revision,created.project.revision));

    browser=await puppeteer.launch({headless:true});
    const page=await browser.newPage(), errors=[];
    page.on("pageerror",e=>errors.push(e.message)); page.on("dialog",d=>d.accept());
    await page.goto(url,{waitUntil:"networkidle2"});
    await page.waitForFunction(()=>window.SC_STUDIO?.project.elements.length===2);
    mode="serial"; requests=0; active=0; maxActive=0;
    await page.evaluate(()=>{SC_STUDIO.updateText("text","OLDER EDIT");SC_STUDIO.saveNow().catch(()=>{});});
    await page.waitForFunction(()=>document.querySelector("#saveStatus").textContent==="Saving...");
    await new Promise(r=>setTimeout(r,200));
    await page.evaluate(()=>SC_STUDIO.updateText("text","LATEST EDIT"));
    await page.waitForFunction(()=>document.querySelector("#saveStatus").textContent==="Saved to cloud");
    check("autosave serializes slow requests and drains latest edit before declaring saved",()=>{assert.equal(maxActive,1);assert.equal(requests,2);});
    assert.equal((await designs.getProject("qa",id)).project.elements.find(e=>e.id==="text").text,"LATEST EDIT");
    await page.reload({waitUntil:"networkidle2"});
    check("latest edit survives reload after delayed saves",()=>{});
    assert.equal(await page.evaluate(()=>SC_STUDIO.project.elements.find(e=>e.id==="text").text),"LATEST EDIT");

    mode="normal";
    const stale=await browser.newPage(); stale.on("dialog",d=>d.accept());
    await stale.goto(url,{waitUntil:"networkidle2"});
    await page.evaluate(()=>{SC_STUDIO.updateText("text","FIRST TAB EDIT");SC_STUDIO.saveNow().catch(()=>{});});
    await page.waitForFunction(()=>document.querySelector("#saveStatus").textContent==="Saved to cloud");
    await stale.evaluate(()=>{SC_STUDIO.updateText("text","STALE TAB EDIT");SC_STUDIO.saveNow().catch(()=>{});});
    await stale.waitForFunction(()=>document.querySelector("#saveStatus").textContent==="Not saved · conflict");
    check("stale second tab cannot overwrite newer cloud content",()=>assert.equal((requests>0),true));
    assert.equal((await designs.getProject("qa",id)).project.elements.find(e=>e.id==="text").text,"FIRST TAB EDIT");
    assert.equal(await stale.evaluate(()=>SC_STUDIO.project.elements.find(e=>e.id==="text").text),"STALE TAB EDIT");
    assert.match(await stale.$eval("#designSaveNotice",e=>e.textContent),/cloud version was not overwritten/);
    await stale.close();

    const image=await sharp(crypto.randomBytes(640*360*3),{raw:{width:640,height:360,channels:3}}).png().toBuffer();
    assert(image.length>512*1024);
    assert.equal(await page.evaluate(src=>SC_STUDIO.replaceImage("image",src,"Large valid photo.png"),"data:image/png;base64,"+image.toString("base64")),true);
    await page.waitForFunction(()=>document.querySelector("#saveStatus").textContent==="Saved to cloud");
    const project=(await designs.getProject("qa",id)).project;
    check("large valid PNG is normalized into one savable WebP source",()=>{
      const layer=project.elements.find(e=>e.id==="image");assert(layer.src.startsWith("data:image/webp;base64,"));assert.equal(layer.dataSrc,undefined);
      assert(Buffer.byteLength(JSON.stringify(project.elements))<512*1024);
    });
    await page.reload({waitUntil:"networkidle2"});
    await page.waitForFunction(()=>document.querySelector("canvas").getContext("2d").getImageData(5,5,1,1).data[3]>0);
    const imagePath=path.join(temp,"qa-large.png");fs.writeFileSync(imagePath,image);
    const input=await page.$("#imageLayerFileInput");await input.uploadFile(imagePath);
    await page.waitForFunction(()=>SC_STUDIO.project.elements.length===3);
    await page.waitForFunction(()=>document.querySelector("#saveStatus").textContent==="Saved to cloud");
    check("normal Add Image file input also normalizes and saves without accepting oversized documents",()=>{});

    mode="unavailable";
    await page.evaluate(()=>{SC_STUDIO.updateText("text","KEPT DURING OUTAGE");SC_STUDIO.saveNow().catch(()=>{});});
    await page.waitForFunction(()=>document.querySelector("#saveStatus").textContent==="Not saved");
    assert.match(await page.$eval("#designSaveNotice",e=>e.textContent),/QA database temporarily unavailable/);
    assert.equal(await page.evaluate(()=>SC_STUDIO.project.elements.find(e=>e.id==="text").text),"KEPT DURING OUTAGE");
    mode="normal"; await page.click("#designSaveNotice button");
    await page.waitForFunction(()=>document.querySelector("#saveStatus").textContent==="Saved to cloud");
    check("actionable save failures retain edits; explicit retry succeeds",()=>{});

    await page.click("#btnPublish");
    assert.equal(await page.$eval("#pubDesignCategory",e=>e.value),"youtube-thumbnail");
    assert.equal(await page.$("#pubDesignCategory option[value=premium]"),null);
    assert.equal(await page.$("#pubDesignStarPrice"),null);
    await page.click("#submitPublishDesign");
    await page.waitForFunction(()=>/published in the community/.test(document.querySelector("#pubDesignMsg").textContent));
    check("free publishing defaults correctly, has no earnings controls, and succeeds",()=>{});
    assert.equal((await designs.publishTemplate({id:"qa"},{title:"Paid blocked",category:"premium",elements:project.elements,canvas:project.canvas})).status,503);
    check("direct paid publishing is blocked server-side in this free release",()=>{});
    assert.deepEqual(errors,[]);
    fs.mkdirSync(path.resolve(__dirname,"../audit_results/designs"),{recursive:true});
    fs.writeFileSync(path.resolve(__dirname,"../audit_results/designs/save-safety-evidence.json"),JSON.stringify({testedAt:new Date().toISOString(),checks,boundary:"Real browser, image codec, application module and isolated memory transport; not production SQL/provider writes."},null,2));
  } finally {
    if(browser)await browser.close(); if(server)await new Promise(r=>server.close(r));
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
