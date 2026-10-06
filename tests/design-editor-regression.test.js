"use strict";
// Database-free browser regression: real template definitions, assets, storage
// module and UI; only HTTP/auth transport and AI provider are isolated fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
assert(!process.env.DATABASE_URL, "Never run this fixture against a database");
const designs = require("../designs");
(async () => {
  const templates = (await designs.listTemplates()).templates;
  const canonical = templates.find(t => t.id === "dt_heygen_trick");
  const restored = designs.publicTemplate({id:canonical.id,title:canonical.title,source_type:"shortscraft_official",canvas:{width:1280,height:720},elements:[]});
  const browser = await puppeteer.launch({headless:true});
  try {
    const page = await browser.newPage(), errors = [], saves = [];
    let imageFailures = 0;
    page.on("pageerror", e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on("request", async req => {
      const u = new URL(req.url());
      const respond = (data,status=200) => req.respond({status,contentType:"application/json",body:JSON.stringify(data)});
      if (u.pathname === "/missing-test.webp") { imageFailures++; return req.respond({status:404,body:"not found"}); }
      if (u.pathname === "/api/designs/templates") return respond({success:true,templates:[restored]});
      if (u.pathname.endsWith("/clone")) {
        const result = await designs.cloneTemplate("qa",canonical.id); return respond(result,result.status||200);
      }
      if (u.pathname.startsWith("/api/designs/projects/")) {
        const id = u.pathname.split("/").pop();
        if (id === "not-found") return respond({success:false,error:"Design not found."},404);
        if (id === "broken-image") return respond({success:true,project:{id,canvas:{width:640,height:360},elements:[{id:"image",type:"image",src:"/missing-test.webp",x:0,y:0,width:640,height:360}]}});
        if (req.method() === "POST") {
          const payload = JSON.parse(req.postData()); saves.push(payload);
          return respond(await designs.saveProject("qa",id,payload));
        }
        return respond(await designs.getProject("qa",id));
      }
      if (u.pathname.startsWith("/api/")) return respond({success:true,user:{id:"qa",handle:"qa",plan:"free"},notifications:[],items:[]});
      req.continue();
    });
    fs.mkdirSync("audit_results/designs",{recursive:true});
    for (const width of [1440,390]) {
      console.log(`Checking ${width}px gallery → menu`);
      await page.setViewport({width,height:900,isMobile:width<1000,hasTouch:width<1000});
      await page.goto("http://127.0.0.1:3327/designs",{waitUntil:"networkidle2"});
      await page.click(".ds-card-menu-trigger");
      await page.click('.ds-design-menu [data-action="edit"]');
      console.log('Waiting for loaded copy');
      await page.waitForFunction(()=>location.pathname==="/design-editor"&&window.SC_STUDIO?.project.elements.length>10);
      await page.waitForFunction(()=>{const c=document.querySelector("canvas"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let colors=new Set();for(let i=0;i<d.length;i+=400)colors.add(d[i]+","+d[i+1]+","+d[i+2]);return colors.size>100;},{timeout:10000});
      assert.equal(await page.evaluate(()=>SC_STUDIO.project.canvas.width),1024);
      assert.equal(await page.evaluate(()=>SC_STUDIO.project.source.parentTemplateId),canonical.id);
      // Inspect actual rendered pixels, rather than accepting a nonempty array.
      assert(await page.evaluate(()=>{const c=document.querySelector("canvas"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let colors=new Set();for(let i=0;i<d.length;i+=400)colors.add(d[i]+","+d[i+1]+","+d[i+2]);return colors.size>100;}),"HeyGen assets and native text actually render");
      const mobile = width < 1000;
      await page.click(`${mobile?'.de-mob-btn':'.de-tool-btn'}[data-tab="layers"]`);
      console.log('Selecting headline from Layers');
      const layer = await page.$$('.de-layer-item');
      for (const item of layer) if ((await item.evaluate(e=>e.textContent)).includes('HeyGen Trick')) { await item.click(); break; }
      await page.waitForFunction(()=>document.querySelector('#propTextContent').getBoundingClientRect().height>0);
      console.log('Editing and saving headline');
      await page.$eval('#propTextContent',el=>{el.value='ACTUALLY EDITED';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
      await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent==='Saved to cloud');
      assert(saves.at(-1).elements.some(e=>e.text==='ACTUALLY EDITED'));
      assert.equal(saves.at(-1).source.parentTemplateId,canonical.id,'Autosave retains clone provenance');
      await page.click('#btnUndo');
      assert(await page.evaluate(()=>!SC_STUDIO.project.elements.some(e=>e.text==='ACTUALLY EDITED')),'Undo changes real exposed project');
      await page.click('#btnRedo');
      assert(await page.evaluate(()=>SC_STUDIO.project.elements.some(e=>e.text==='ACTUALLY EDITED')),'Redo restores actual project');
      await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent==='Saved to cloud');
      await page.screenshot({path:`audit_results/designs/editor-working-${width}.png`});
      await page.reload({waitUntil:"networkidle2"});
      assert(await page.evaluate(()=>SC_STUDIO.project.elements.some(e=>e.text==='ACTUALLY EDITED')),'Edit survives storage roundtrip and reload');
      await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){window.__download={href:this.href,name:this.download};};});
      await page.click('#btnExport');
      assert(await page.evaluate(()=>window.__download?.href.startsWith('data:image/png;base64,')),'Real layered canvas exports PNG');
      console.log(`PASS real HeyGen layers/assets, menu → clone → edit → autosave → reopen → export (${width}px); isolated storage.`);
    }
    await page.goto('http://127.0.0.1:3327/design-editor?id=not-found',{waitUntil:'networkidle2'});
    assert.match(await page.$eval('#designLoadNotice',e=>e.textContent),/Design not found/);
    assert.equal(await page.$eval('#saveStatus',e=>e.textContent),'Could not open design');
    assert(await page.$eval('.de-top-right',e=>e.inert),'Failed load must not export/publish a blank replacement');
    await page.goto('http://127.0.0.1:3327/design-editor?id=broken-image',{waitUntil:'networkidle2'});
    assert.match(await page.$eval('#designLoadNotice',e=>e.textContent),/could not be loaded/);
    await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){window.__download=this.href;};SC_STUDIO.render();SC_STUDIO.render();});
    await page.click('#btnExport'); assert.equal(await page.evaluate(()=>window.__download),undefined);
    assert.equal(imageFailures,1,'Failed image must not trigger an endless re-request loop');
    assert.deepEqual(errors,[]);
    console.log('PASS missing project and image failures are visible, export fails safely, no retry loop.');
  } catch (err) {
    console.error('Browser regression failed:',err);
    throw err;
  } finally { await browser.close().catch(err=>console.warn('QA browser cleanup:',err.message)); }
})().catch(err=>{console.error(err);process.exitCode=1;});
