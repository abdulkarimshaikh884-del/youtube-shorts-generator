"use strict";
// Run tests/polish-preview-server.js first. API writes are intercepted.
// External fonts are deliberately blocked: this also verifies usable fallbacks.
const assert = require("node:assert/strict");
const puppeteer = require("./qa-browser");
const fs = require("node:fs");
const base = 'http://127.0.0.1:3327';
(async () => {
  const browser = await puppeteer.launch({headless:true});
  try {
    const page = await browser.newPage();
    const errors = [];
    const savedProjects = new Map();
    let revision = 0;
    page.on("pageerror", e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on("request", req => {
      const url = new URL(req.url());
      if(['data:','blob:','about:'].includes(url.protocol)) return req.continue();
      if(url.origin!==base) return req.abort();
      if(url.pathname.startsWith('/api/designs/projects/') && req.method()==='POST') {
        const project=JSON.parse(req.postData());
        project.revision='qa-revision-'+(++revision);
        savedProjects.set(project.id,project);
        return req.respond({status:200,contentType:'application/json',body:JSON.stringify({success:true,project})});
      }
      if(url.pathname.startsWith('/api/')) return req.respond({status:200,contentType:'application/json',body:JSON.stringify({success:true,user:{id:'mobile-qa',email:'qa@example.test',handle:'qa'},project:{}})});
      if(!['GET','HEAD'].includes(req.method())) return req.abort();
      req.continue();
    });
    fs.mkdirSync('audit_results/mobile-layout',{recursive:true});
    for(const [width,height] of [[320,568],[390,844],[390,440],[768,1024],[844,390],[1440,900]]) {
      await page.setViewport({width,height,isMobile:width<=1024,hasTouch:width<=1024});
      await page.goto(base+'/design-editor',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!!window.SC_STUDIO);
      if(width===390 && height===844) await page.screenshot({path:'audit_results/mobile-layout/after-design-clean-390.png'});
      const mobile=width<=1024;
      for(const id of ['btnPublish','btnExport','btnUndo','btnRedo','zoomSelect']) {
        assert(await page.$eval('#'+id,el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight;}),`${id} fits ${width}`);
      }
      for(const tab of ['text','images','shapes','background','layers']) {
        await page.click(`${mobile?'.de-mob-btn':'.de-tool-btn'}[data-tab="${tab}"]`);
        const selector='#flyout'+tab[0].toUpperCase()+tab.slice(1);
        assert(await page.$eval(selector,el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}),`${tab} opens ${width}`);
      }
      await page.click(`${mobile?'.de-mob-btn':'.de-tool-btn'}[data-tab="text"]`);
      await page.click('#btnAddHeading');
      await page.waitForFunction(()=>document.querySelector('#propTextContent').getBoundingClientRect().height>0);
      await page.$eval('#propTextContent',el=>{el.value='Edited on a phone';el.dispatchEvent(new Event('input',{bubbles:true}));});
      assert(await page.evaluate(()=>SC_STUDIO.project.elements.some(e=>e.text==='Edited on a phone')),'Text edit updates actual project');
      // Keep the QA-added heading separate from the default template text.
      await page.evaluate(()=>{const el=SC_STUDIO.project.elements.find(e=>e.text==='Edited on a phone');el.y=440;SC_STUDIO.render();});
      if(width===390 && height===844) await page.screenshot({path:'audit_results/mobile-layout/after-design-inspector-390.png'});
      if(mobile) {
        assert(await page.$eval('#designCanvas',el=>{const r=el.getBoundingClientRect();return r.width>30&&r.height>30&&r.left>=0&&r.right<=innerWidth+1;}),'Canvas still visible while editing');
        await page.$eval('#btnDeleteLayer',el=>el.scrollIntoView({block:'center'}));
        assert(await page.$eval('#btnDeleteLayer',el=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el.contains(at);}), 'Last inspector button can be tapped');
        await page.click('#deInspector .de-panel-close');
      }
      // Verify the real export button creates a PNG download, without writing a file.
      await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){window.__download={href:this.href,name:this.download};};});
      await page.click('#btnExport');
      assert(await page.evaluate(()=>window.__download?.href.startsWith('data:image/png;base64,')&&window.__download.name.endsWith('.png')),'Export button produces PNG');
      await page.evaluate(()=>{window.SC_AUTH_USER={id:'mobile-qa'};});
      // Use the normal publish UI; never submit it to a real backend.
      await page.click('#btnPublish');
      assert(await page.$eval('#publishDesignModal',el=>getComputedStyle(el).display!=='none'),'Publish button opens modal');
      {
        await page.$eval('#cancelPublishDesign',el=>el.scrollIntoView({block:'center'}));
        assert(await page.$eval('#cancelPublishDesign',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight;}),'Final publish controls are reachable');
        await page.click('#cancelPublishDesign');
        assert(await page.$eval('#publishDesignModal',el=>getComputedStyle(el).display==='none'),'Publish modal closes');
      }
      if(width===390 && height===844) await page.screenshot({path:'audit_results/mobile-layout/after-design-editor-390.png'});
      // A real acknowledgement includes a revision. Verify the saved edit and
      // drain pending writes before navigating; do not dismiss an unsaved-work guard.
      await page.evaluate(()=>SC_STUDIO.saveNow());
      assert.equal(await page.$eval('#saveStatus',el=>el.textContent),'Saved to cloud');
      const projectId=await page.evaluate(()=>SC_STUDIO.project.id);
      assert(savedProjects.get(projectId)?.elements.some(el=>el.text==='Edited on a phone'),'Autosave fixture acknowledges the actual edited project');
      console.log(`PASS design editor ${width}x${height}: tool panels, editing, preview, export`);
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
