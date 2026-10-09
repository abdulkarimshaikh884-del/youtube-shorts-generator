"use strict";
// The browser receives source assets and mock contracts only. No server, DB,
// production account, email, payment, or moderation write is contacted.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const qa = require("./qa-browser");
const permissions = require("../permissions");
const origin = "http://admin-qa.invalid";
const publicRoot = path.resolve(__dirname, "../public");
const output = path.resolve(__dirname, "../audit_results/admin-navigation");
const sections = ["overview","users","creators","content","skills","reports","withdrawals","stars_ledger","star_packs","ai_jobs","broadcast","team","support","system"];
const fixtureUser = {id:"11111111-1111-4111-8111-111111111111",role:"banned",handle:"member",displayName:"Fixture Member",credits:0,plan:"free"};
let viewer = {id:"fixture-owner",role:"super_admin",permissions:[],displayName:"Fixture Owner",plan:"free"};
let templateUnavailable = false;
let accessUnavailable = false;
let holdTimeout = false;
let heldOldRequest;
let oldRequested;
const writes = [], forbiddenReads = [], errors = [];
const routePermission = {dashboard:"overview.view",users:"users.view",creators:"users.view",templates:"templates.moderate","design-templates":"templates.moderate",skills:"tutorials.moderate",reports:"reports.review",withdrawals:"withdrawals.manage",stars:"stars.view","star-packs":"star_packs.manage","ai-jobs":"ai_jobs.view",staff:"owner",support:"support.reply","feature-flags":"flags.manage","audit-logs":"audit.view"};
function allowed(permission) { return viewer.role === "super_admin" || viewer.permissions.includes(permission); }
function data(url) {
  const response = {success:true,user:viewer,stats:{},recentActivity:[],users:[fixtureUser],creators:[{...fixtureUser,templatesCount:2}],templates:[{id:"dt_fixture",title:"Private design",category:"Thumbnail",status:"review",sourceFormat:"design_template"}],skills:[],reports:[],withdrawals:[{id:"fixture-payout",status:"pending"}],transactions:[],packs:[],jobs:[],staff:[],tickets:[],flags:[{key:"legacy_flag",enabled:true,runtimeSupported:false,readOnlyReason:"Read-only: not connected to the running service."}],logs:[],notifications:[],items:[],projects:[],services:{},release:{monetizationEnabled:false},monetizationEnabled:false};
  response.packs=[{id:"fixture-pack",label:"Stored pack",price:49,stars:10,popular:true}];
  response.staff=[{id:fixtureUser.id,role:"sub_admin",handle:"staff",displayName:"Staff",permissions:["users.view"]}];
  response.permissions=permissions.PERMISSIONS;response.presets=permissions.ROLE_PRESETS;
  if (url.pathname === "/api/credits") Object.assign(response,{left:5,dailyLeft:5,bonusCredits:0,perDay:5,plan:"free",planLabel:"Free",cost:{export:1,animate:2}});
  if (url.pathname === "/api/admin/users" && url.searchParams.get("q")) response.users = [{...fixtureUser,displayName:url.searchParams.get("q")}];
  if (url.pathname.endsWith("/preview")) response.template = {id:"dt_fixture",title:"Private design",status:"review",canvas:{width:1280,height:720},elements:[{id:"text",type:"text",text:"Protected draft",x:80,y:80,width:1000,height:100,fontSize:64}]};
  return response;
}
async function boot(page, user, hash="overview") {
  viewer = user;
  viewer.handle = viewer.handle || "fixture";
  await page.goto("about:blank");
  await page.goto(origin+"/admin#"+hash,{waitUntil:"networkidle0"});
  await page.waitForFunction(()=>document.querySelector("#adminApp:not([hidden])") && document.querySelector('[data-admin-panel]:not([hidden])[aria-busy="false"]'));
}
async function select(page, section, width) {
  if (width<=900) await page.select("#adminMobileTabSelect",section);
  else await page.click('[data-admin-tab="'+section+'"]');
  await page.waitForSelector('[data-admin-panel="'+section+'"]:not([hidden])[aria-busy="false"]');
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser = await qa.launch({headless:true,args:["--no-sandbox"]});
  let checks = 0;
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    await page.evaluateOnNewDocument(()=>{
      const fetchOriginal=window.fetch.bind(window), timeoutOriginal=window.setTimeout.bind(window);
      window.fetch=(url,options)=>{
        if (String(url).includes("/api/admin/users?q=older")) {
          const copy={...options}; delete copy.signal;
          return fetchOriginal(url,copy).then(response=>{const json=response.json.bind(response);response.json=()=>json().then(value=>{window.qaOldResponseParsed=true;return value;});return response;});
        }
        return fetchOriginal(url,options);
      };
      window.setTimeout=(fn,delay,...args)=>timeoutOriginal(fn,window.qaFastTimeout && delay===20000?100:delay,...args);
    });
    page.on("pageerror",error=>errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request",async request=>{
      try {
        const url = new URL(request.url());
        if (url.origin!==origin) return request.abort();
        if (url.pathname.startsWith("/api/")) {
          if (request.method()!=="GET") { writes.push({path:url.pathname,body:request.postData()}); return request.respond({status:403,contentType:"application/json",body:'{"success":false,"error":"Fixture writes forbidden"}'}); }
          if (url.pathname==="/api/auth/me" && accessUnavailable) return request.respond({status:503,contentType:"application/json",body:'{"success":false,"error":"Fixture connection unavailable"}'});
          const permission=url.pathname.startsWith("/api/admin/")?routePermission[url.pathname.split("/")[3]]:null;
          if (permission && !allowed(permission)) { forbiddenReads.push(url.pathname); return request.respond({status:403,contentType:"application/json",body:'{"success":false,"error":"Permission denied"}'}); }
          if (url.pathname==="/api/admin/templates" && holdTimeout) return;
          if (url.pathname==="/api/admin/users" && url.searchParams.get("q")==="older") { heldOldRequest=request; oldRequested(); return; }
          if (url.pathname==="/api/admin/templates" && templateUnavailable) return request.respond({status:503,contentType:"application/json",body:'{"success":false,"error":"Fixture database unavailable"}'});
          return request.respond({status:200,contentType:"application/json",body:JSON.stringify(data(url))});
        }
        const asset=path.resolve(publicRoot,"."+(url.pathname==="/admin"?"/admin.html":url.pathname));
        if (!asset.startsWith(publicRoot+path.sep) || !fs.existsSync(asset) || !fs.statSync(asset).isFile()) return request.respond({status:404,body:""});
        const type={".html":"text/html",".css":"text/css",".js":"application/javascript",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json"}[path.extname(asset)] || "application/octet-stream";
        return request.respond({status:200,contentType:type,body:fs.readFileSync(asset)});
      } catch(error) { if (!/already handled|closed|Target closed/.test(error.message)) errors.push(error.message); }
    });
    for (const width of [320,390,900,1440,1920]) for (const theme of ["light","dark"]) {
      await page.setViewport({width,height:900,isMobile:width<=900,hasTouch:width<=900});
      await boot(page,{id:"fixture-owner",role:"super_admin",permissions:[],displayName:"Fixture Owner",plan:"free"});
      await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem("sc_theme",theme);},theme);
      assert.equal(await page.$$eval('[data-admin-tab]:not([hidden])',nodes=>nodes.length),14);
      for (const section of sections) { await select(page,section,width); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),section+" overflow "+width);checks++; }
      if (width>900) assert.ok(await page.$eval("#adminTabNav",element=>element.scrollWidth<=element.clientWidth+1),"No hidden horizontal navigation");
      await select(page,"system",width);assert.equal(await page.$eval("#adminFlagList input",node=>node.disabled),true,"Unwired runtime controls are read-only");
      await page.$eval("#adminFlagList input",node=>{node.checked=false;node.dispatchEvent(new Event("change"));});assert.equal(await page.$eval("#adminFlagList input",node=>node.checked),true,"Unwired synthetic toggle does not write");
      await select(page,"star_packs",width);assert.equal(await page.$$eval("#adminStarPacksList input",nodes=>nodes.every(node=>node.disabled)),true,"Money configuration stays read-only");
      await select(page,"team",width);await page.click("#adminTeamList button");assert.equal(await page.$eval(".admin-access select",node=>node.value),"sub_admin","Granular permissions do not silently change staff role");await page.$eval(".admin-access-actions button:last-child",node=>node.click());
      await select(page,"withdrawals",width);assert.match(await page.$eval("#adminWithdrawalList",node=>node.textContent),/Coming Soon/);
      await select(page,"content",width);await page.click('[data-admin-design-preview="dt_fixture"]');await page.waitForSelector(".admin-design-preview svg");assert.match(await page.$eval(".admin-design-preview",node=>node.textContent),/Protected draft/);await page.keyboard.press("Escape");
      if (width===390||width===1440) await page.screenshot({path:path.join(output,"admin-"+width+"-"+theme+".png")});
    }
    await page.setViewport({width:1440,height:900});
    await select(page,"users",1440);await select(page,"creators",1440);await page.goBack();await page.waitForSelector('[data-admin-panel="users"]:not([hidden])');assert.equal(await page.$eval('#adminSectionTitle',node=>node.textContent),"Users","Browser Back restores the active section");
    const auditor={id:"auditor",role:"sub_admin",permissions:["overview.view","audit.view"],displayName:"Auditor",plan:"free"};
    await boot(page,auditor,"system");
    assert.deepEqual(await page.$$eval('[data-admin-tab]:not([hidden])',nodes=>nodes.map(node=>node.dataset.adminTab)),["overview","system"]);
    assert.equal(await page.$eval('[data-admin-permission="flags.manage"]',node=>node.hidden),true);
    assert.equal(await page.$eval('[data-admin-permission="audit.view"]',node=>node.hidden),false);
    await page.evaluate(()=>{location.hash="withdrawals";});await page.waitForSelector('[data-admin-panel="overview"]:not([hidden])[aria-busy="false"]');
    assert.equal(await page.$$eval('[data-admin-jump]:not([hidden])',nodes=>nodes.length),0);
    await page.$eval('[data-admin-jump="withdrawals"]',node=>node.click());assert.equal(await page.$$eval('[data-admin-panel]:not([hidden])',nodes=>nodes.length),1);
    await boot(page,{id:"view-only",role:"moderator",permissions:["users.view"],displayName:"Viewer",plan:"free"},"users");
    await page.click("#adminUserList button");
    assert.equal(await page.$$eval(".admin-modal-body button",nodes=>nodes.filter(node=>node.getClientRects().length).length),0,"View-only staff get no write actions");await page.keyboard.press("Escape");
    await boot(page,{id:"moderator",role:"moderator",permissions:permissions.ROLE_PRESETS.moderator,displayName:"Moderator",plan:"free"});
    await select(page,"users",1440);await page.click("#adminUserList button");
    assert.match(await page.$eval(".admin-modal-body",node=>node.textContent),/Restore Account/);assert.equal(await page.$$eval(".admin-modal-body button",nodes=>nodes.filter(node=>node.getClientRects().length&&/Apply Adjustment|Grant Verified/.test(node.textContent)).length),0);await page.keyboard.press("Escape");
    const oldReady=new Promise(resolve=>{oldRequested=resolve;});
    await page.evaluate(()=>{const input=document.querySelector("#adminUserSearch");input.value="older";input.dispatchEvent(new Event("input"));});await oldReady;
    await page.evaluate(()=>{const input=document.querySelector("#adminUserSearch");input.value="latest";input.dispatchEvent(new Event("input"));});await page.waitForFunction(()=>document.querySelector("#adminUserList").textContent.includes("latest"));
    await heldOldRequest.respond({status:200,contentType:"application/json",body:JSON.stringify({success:true,users:[{...fixtureUser,displayName:"older"}]})});
    await page.waitForFunction(()=>window.qaOldResponseParsed===true);assert.match(await page.$eval("#adminUserList",node=>node.textContent),/latest/);assert.doesNotMatch(await page.$eval("#adminUserList",node=>node.textContent),/older/);
    templateUnavailable=true;await select(page,"content",1440);await page.waitForSelector(".admin-load-error button");templateUnavailable=false;await page.click(".admin-load-error button");await page.waitForSelector('[data-admin-design-preview="dt_fixture"]');
    holdTimeout=true;await page.evaluate(()=>{window.qaFastTimeout=true;});await page.click('[data-admin-refresh="content"]');await page.waitForFunction(()=>document.querySelector(".admin-load-error")?.textContent.includes("timed out"));assert.equal(await page.$eval('[data-admin-panel="content"]',node=>node.getAttribute("aria-busy")),"false");holdTimeout=false;
    accessUnavailable=true;await page.goto("about:blank");await page.goto(origin+"/admin",{waitUntil:"networkidle0"});await page.waitForFunction(()=>document.querySelector("#adminGate").textContent.includes("could not be checked"));assert.doesNotMatch(await page.$eval("#adminGate",node=>node.textContent),/Admin access required/);accessUnavailable=false;await page.click("#adminGate button");await page.waitForSelector("#adminApp:not([hidden])");
    assert.deepEqual(writes,[]);assert.deepEqual(forbiddenReads,[]);assert.deepEqual(errors,[]);
    const evidence={success:true,checks,viewports:[320,390,900,1440,1920],themes:["light","dark"],roles:["owner","auditor","view-only","moderator"],staleResponseIgnored:true,timeoutVisible:true,accessOutageRetry:true,privateDesignPreview:true,unauthorizedQuickJumpSafe:true,browserHistory:true,explicitStaffRole:true,financialFeaturesDisabled:true,writes:0,productionCalls:0};
    fs.writeFileSync(path.join(output,"evidence.json"),JSON.stringify(evidence,null,2));console.log("PASS:",JSON.stringify(evidence));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
