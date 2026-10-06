"use strict";
// Local browser fixtures only. No production API, credits or database writes.
const assert = require("node:assert/strict");
const path = require("node:path");
const puppeteer = require("puppeteer");
(async () => {
 const browser = await puppeteer.launch({headless:true});
 try {
  const page = await browser.newPage();
  const errors = [], dialogs = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", async d => { dialogs.push(d.message()); await d.dismiss(); });
  let mode = "success", saveSuccess = false, conversions = 0, clones = 0, saves = 0;
  const project = {id:"qa-layer-project",title:"QA layers",canvas:{width:600,height:400},elements:[{id:"t",type:"text",text:"Editable heading",x:20,y:20,width:480,height:90,fontSize:36}]};
  const template = {id:"qa-template",title:"A long design title that must not overflow this card with a very long unbroken suffix abcdefghijklmnopqrstuvwxyz",authorName:"Real fixture publisher",authorHandle:"fixture_publisher",authorAvatarUrl:"/missing-avatar.webp",previewUrl:"/missing-preview.webp",canvas:project.canvas,elements:project.elements};
  await page.setRequestInterception(true);
  page.on("request", async r => {
   const u = new URL(r.url());
   if (u.pathname.startsWith("/api/")) {
    let status=200, data={success:true,user:{id:"qa",handle:"qa",email:"qa@example.test",plan:"free"},notifications:[],templates:[],items:[]};
    if(u.pathname==="/api/designs/templates")data={success:true,templates:[template,template,{...template,id:"different-id",authorName:null,authorHandle:null,authorAvatarUrl:null,previewUrl:"javascript:alert(1)"}]};
    if(u.pathname.endsWith("/clone")){clones++; await new Promise(resolve=>setTimeout(resolve,250));status=503;data={success:false,error:"QA clone unavailable"};}
    if(u.pathname==="/api/designs/convert"){
     conversions++; assert.equal(JSON.parse(r.postData()).useAsImage,false);
     await new Promise(resolve=>setTimeout(resolve,250));
     status=mode==="failure"?502:200;
     data=mode==="failure"?{success:false,error:"QA analysis unavailable"}:{success:true,project,requiresReview:true,warning:"QA approximate repair: inspect layers."};
    }
    if(u.pathname.startsWith("/api/designs/projects/")&&r.method()==="POST"){
     saves++;assert.equal(JSON.parse(r.postData()).elements[0].text,"Editable heading");
     status=saveSuccess?200:503;data=saveSuccess?{success:true,project}:{success:false,error:"QA save unavailable"};
    }
    return r.respond({status,contentType:"application/json",body:JSON.stringify(data)});
   }
   if(u.origin!=="http://127.0.0.1:3327") return r.abort();
   if(!["GET","HEAD"].includes(r.method()))return r.abort();
   r.continue();
  });
  const file=path.resolve("public/storage/designs/templates/heygen-trick.webp");
  for(const route of ["/designs","/"]) {
   await page.setViewport({width:390,height:844});
   await page.goto("http://127.0.0.1:3327"+route,{waitUntil:"networkidle2"});
   const dedicated=route==="/designs";
   if(dedicated){
    assert.equal((await page.$$(".ds-card")).length,2,"Deduplicate IDs, not reused previews");
    assert.equal(await page.$eval(".ds-card-thumb .ds-template-preview",e=>e.tagName.toLowerCase()),"svg","Broken preview falls back to actual layers");
    assert.equal(await page.$eval(".ds-card-author .sh-tcreator-avatar",e=>e.textContent),"RE");
    assert.equal(await page.$eval(".ds-card:nth-child(2) .ds-card-author",e=>e.hasAttribute("href")),false);
    await page.$eval("#designSearch",e=>{e.value="fixture_publisher";e.dispatchEvent(new Event("input"));});
    assert.equal((await page.$$(".ds-card")).length,1);
    await page.click(".ds-card-open");
    await page.waitForFunction(()=>document.querySelector(".ds-card").dataset.opening);
    assert.equal(await page.$eval(".ds-card-open",e=>e.textContent),"");
    await page.$eval(".ds-card-open",e=>e.click());
    await page.waitForFunction(()=>!document.querySelector(".ds-card-open").disabled);
    assert.equal(clones,1,"One clone per pending click");
   }
   if(!dedicated) { await page.click("#navBurger"); await page.waitForFunction(()=>!document.querySelector("#navMobile").hidden); }
   await page.click(dedicated?"#topbarUploadBtn":".sh-m-upload-btn");
   const modal=dedicated?"#designUploadModal":"#publishTemplateModal";
   await page.waitForFunction(s=>!document.querySelector(s).hidden,{},modal);
   mode="failure";
   await (await page.$(dedicated?"#designFileInput":"#uploadFile")).uploadFile(file);
   await page.waitForSelector(dedicated?"#modalStepError:not([hidden])":"#authDesignRetry");
   mode="success";
   await page.click(dedicated?"#btnErrorTryAgain":"#authDesignRetry");
   await page.waitForSelector(dedicated?"#modalStep4:not([hidden])":"#authReviewLayers svg");
   assert.equal((await page.$$(dedicated?"#reviewReconstructedStage foreignObject":"#authReviewLayers foreignObject")).length,1);
   if(!dedicated) {
    await page.click("#authToggleOrig");assert.equal(await page.$eval("#authReviewLayers",e=>e.hidden),true);
    await page.click("#authToggleEdit");assert.equal(await page.$eval("#authReviewLayers",e=>e.hidden),false);
   }
   await page.click(dedicated?"#btnOpenEditor":"#authReviewOpenBtn");
   await page.waitForFunction(sel=>!document.querySelector(sel).disabled,{},dedicated?"#btnOpenEditor":"#authReviewOpenBtn");
   assert.equal(new URL(page.url()).pathname,route,"Failed save must retain review, not silently redirect");
   assert.equal(await page.evaluate(()=>sessionStorage.getItem("sc_pending_design")),null);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.keyboard.press("Escape");
   assert(await page.$eval(modal,e=>e.hidden));
   assert.notEqual(await page.evaluate(()=>document.body.style.overflow),"hidden");
   console.log("PASS "+route+": automatic image analysis, honest failure/retry, reconstructed preview, failed-save retention, modal cleanup (mocked APIs)");
  }
  await page.goto("http://127.0.0.1:3327/designs",{waitUntil:"networkidle2"});
  await page.click("#topbarUploadBtn");await page.waitForFunction(()=>!document.querySelector("#designUploadModal").hidden);
  await (await page.$("#designFileInput")).uploadFile(file);
  await page.waitForSelector("#modalStep4:not([hidden])");
  saveSuccess=true;
  await Promise.all([page.waitForNavigation({waitUntil:"domcontentloaded"}),page.click("#btnOpenEditor")]);
  assert.equal(new URL(page.url()).pathname,"/design-editor");
  assert.equal(new URL(page.url()).searchParams.get("id"),project.id);
  assert.equal(conversions,5);assert.equal(saves,3);assert.deepEqual(errors,[]);
  console.log("PASS successful save sends actual layers and opens the persisted project ID (mocked API)");
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
