const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const fs = require('fs');
(async()=>{
 const templates=(await require('../designs').listTemplates()).templates;
 const browser=await puppeteer.launch({headless:true});
 try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const project={canvas:{width:600,height:400},elements:Array.from({length:12},(_,i)=>({id:'text_'+i,type:'text',text:'Layer '+i,x:20,y:i*30,width:400,height:30,fontSize:22,fill:'#eeeeee'}))};
  await page.setRequestInterception(true);
  page.on('request',r=>{
   const u=new URL(r.url());
   if(u.pathname==='/api/designs/convert')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({success:true,project,warning:'Review the approximate background repair.'})});
   if(u.pathname==='/api/credits')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({success:true,plan:'free',left:5,perDay:5,cost:{export:1,animate:2}})});
   if(u.pathname==='/api/designs/templates')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({success:true,templates})});
   if(u.pathname.startsWith('/api/'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({success:true,user:{id:'qa',email:'qa@example.com',plan:'free'},templates:[],notifications:[],items:[]})});
   if(!['GET','HEAD'].includes(r.method()))return r.abort();
   r.continue();
  });
  fs.mkdirSync('audit_results/designs',{recursive:true});
  for(const width of [390,1440])for(const theme of ['light','dark']){
   await page.setViewport({width,height:950});
   await page.goto('http://127.0.0.1:3327/designs',{waitUntil:'networkidle2'});
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await page.$$('.ds-page-container .ds-workflow,.ds-page-container .ds-conversion-note,.ds-card-desc,.ds-card-meta,.ds-card-actions').then(a=>a.length),0);
   assert.equal(await page.$eval('.ds-card',e=>Array.from(e.querySelectorAll('.ds-card-thumb,.ds-card-title,.ds-card-author')).map(x=>x.className).join('|')),'ds-card-thumb|ds-card-title|ds-card-author');
   assert(await page.$('.ds-card-open[aria-label^="Edit "]'));
   assert.equal(await page.$$('.ds-card-like').then(a=>a.length),0);
   const heights=await page.$$eval('.ds-card-thumb',els=>els.map(e=>e.getBoundingClientRect().height));
   assert(heights.length>0);assert(heights.every(h=>Math.abs(h-heights[0])<1));
   await page.type('#designSearch','no_such_design');assert.equal(await page.$$('.ds-card').then(a=>a.length),0);
   await page.$eval('#designSearch',e=>{e.value='';e.dispatchEvent(new Event('input'));});
   await page.screenshot({path:`audit_results/designs/${theme}-${width}.png`});
   await page.click('.js-open-design-upload');await page.waitForFunction(()=>!document.querySelector('#designUploadModal').hidden);
   await page.keyboard.press('Escape');assert(await page.$eval('#designUploadModal',e=>e.hidden));
   console.log(`PASS Designs ${width} ${theme}: search, equal previews, no fake likes, upload modal and Escape`);
  }
  await page.click('.js-open-design-upload');await page.waitForFunction(()=>!document.querySelector('#designUploadModal').hidden);
  await (await page.$('#designFileInput')).uploadFile(require('path').resolve('public/storage/designs/templates/heygen-trick.webp'));
  await page.waitForFunction(()=>!document.querySelector('#modalStep2').hidden);
  await page.click('#btnConvertEditable');await page.waitForFunction(()=>!document.querySelector('#modalStep4').hidden);
  assert.equal(await page.$$('#reviewReconstructedStage foreignObject').then(a=>a.length),12);
  assert.match(await page.$eval('#designReviewWarning',e=>e.textContent),/approximate/);
  await page.click('.ds-review-del');assert.equal(await page.$$('.ds-review-item').then(a=>a.length),11);
  console.log('PASS upload → review, all 12 layers visible, warning and layer removal (mocked API).');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
