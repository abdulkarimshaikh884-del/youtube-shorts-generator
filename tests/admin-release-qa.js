"use strict";
// Browser-only API contracts; fixtures are never saved or sent to the database.
const puppeteer=require("./qa-browser");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base="http://127.0.0.1:3327";
const out=path.resolve(__dirname,"../audit_results/admin-release");
const hostile='<img src=x onerror="window.adminInjection=true">';
const templates=[{id:"comm_test",title:"Animation",category:"Kinetic Text",status:"review",sourceFormat:"shortscraft",authorName:hostile,authorHandle:"test",templateId:"kinetic-hook"},
 {id:"dt_test",title:"Design",category:"Thumbnail",status:"published",sourceFormat:"design_template",authorName:"Creator",authorHandle:"creator"}];
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await puppeteer.launch({headless:true,args:["--no-sandbox"]});
 const errors=[];let unavailable=false;const writes=[];
 try{const page=await browser.newPage();page.setDefaultTimeout(15000);page.on("pageerror",e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on("request",req=>{const u=new URL(req.url());if(u.protocol==="data:"||u.protocol==="about:")return req.continue();if(u.origin!==base)return req.abort();if(!u.pathname.startsWith("/api/"))return req.continue();
  if(req.method()!=="GET"){writes.push({path:u.pathname,body:req.postData()});return req.respond({status:403,contentType:"application/json",body:JSON.stringify({success:false,error:"Test writes not permitted"})});}
  if(unavailable&&u.pathname==="/api/admin/templates")return req.respond({status:503,contentType:"application/json",body:'{"success":false,"error":"Test database unavailable"}'});
  const data={success:true,user:{id:"admin-test",role:"super_admin",permissions:[],plan:"free",displayName:"Test Owner"},users:[{id:"member-test",displayName:hostile,handle:"member",role:"user",plan:"free",credits:0,earnedStars:7,withdrawnStars:2,withdrawableStars:5}],creators:[{id:"creator-test",displayName:hostile,handle:"creator",templatesCount:3,withdrawnStars:2,withdrawableStars:5}],templates,skills:[],reports:[],withdrawals:[],ledger:[],transactions:[],packs:[{id:"bad-price-test",label:hostile,price:"' onfocus='window.adminInjection=true",stars:10}],jobs:[],staff:[],permissions:[],presets:{},tickets:[],flags:[],logs:[],notifications:[],items:[],projects:[],stats:{},recentActivity:[{actor_name:hostile,action:"test_action",entity_type:"test",created_at:new Date().toISOString()}]};
  if(u.pathname==="/api/credits")Object.assign(data,{left:15,dailyLeft:5,bonusCredits:10,perDay:5,plan:"free",planLabel:"Free",cost:{export:1,animate:2}});
  return req.respond({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 let checks=0;
 for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]])for(const theme of ["light","dark"]){
  await page.setViewport({width,height,isMobile:width<900,hasTouch:width<900});
  await page.goto(base+"/admin",{waitUntil:"networkidle0"});await page.evaluate(t=>{localStorage.setItem("sc_theme",t);document.documentElement.dataset.theme=t;},theme);
  await page.waitForSelector("#adminApp:not([hidden])");
  const tabs=await page.$$eval("[data-admin-tab]",els=>els.filter(e=>!e.hidden).map(e=>e.dataset.adminTab));
  for(const tab of tabs){
   if(width<=900)await page.select("#adminMobileTabSelect",tab);else await page.click('[data-admin-tab="'+tab+'"]');
   await new Promise(r=>setTimeout(r,100));
   assert.equal(await page.$eval('[data-admin-panel="'+tab+'"]',e=>e.hidden),false,tab+" reachable");
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${tab} ${width} ${theme} overflow`);checks++;
  }
  if(width<=900)await page.select("#adminMobileTabSelect","users");else await page.click('[data-admin-tab="users"]');
  await page.waitForSelector("#adminUserList button");await page.click("#adminUserList button");
  await page.waitForSelector('.admin-modal-box[role="dialog"]');
  assert.match(await page.$eval('.admin-modal-box[role="dialog"]',e=>e.textContent),/Credits0/);
  assert.equal(await page.evaluate(()=>Boolean(window.adminInjection)),false,"account names render safely");
  assert.ok(await page.$eval('.admin-modal-box[role="dialog"]',e=>e.getBoundingClientRect().width)<=width,"modal fits viewport");
  await page.keyboard.press("Escape");assert.equal(await page.$('.admin-modal-box[role="dialog"]'),null,"Escape closes modal");
  if(width<=900)await page.select("#adminMobileTabSelect","content");else await page.click('[data-admin-tab="content"]');
  assert.deepEqual(await page.$$eval("#adminTemplateCategory option",els=>els.map(e=>e.textContent)),["All categories","Kinetic Text","Thumbnail"]);
  await page.select("#adminTemplateCategory","Thumbnail");await new Promise(r=>setTimeout(r,120));
  assert.equal(await page.$$eval("#adminTemplateList article",els=>els.length),1);
  assert.match(await page.$eval("#adminTemplateList",e=>e.textContent),/Design/);
  assert.equal(await page.evaluate(()=>Boolean(window.adminInjection)),false,"creator labels are not executed as HTML");
  await page.screenshot({path:path.join(out,`content-${width}-${theme}.png`)});
 }
 unavailable=true;await page.goto("about:blank");await page.goto(base+"/admin#content",{waitUntil:"networkidle0"});
 await page.waitForSelector(".admin-load-error");assert.match(await page.$eval(".admin-load-error",e=>e.textContent),/unavailable/);
 assert.equal(writes.length,0);assert.deepEqual(errors,[]);
 console.log(`PASS: ${checks} admin tab/layout checks, real category filtering, both themes, injection protection, visible outage state; isolated browser contracts only.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
