"use strict";
// Isolated browser fixtures: never reaches production, payment, email or a real account.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const browserTools = require("./qa-browser");
const base = "http://127.0.0.1:3327", out = path.resolve("audit_results/desktop-polish");
let guest = false, noteFault = false, historyFault = false, saveFault = false, unread = 12, delayReactions = false;
let user = {id:"qa-user",email:"qa@example.test",handle:"@shortscraft",displayName:"ShortsCraft QA Creator",role:"super_admin",plan:"free",bio:"Isolated browser preview",location:"Mumbai, India",avatarUrl:"/favicon.svg",createdAt:"2026-10-01",creatorDetails:{niche:"Motion design",languages:"Hindi, English"}};
const templates = Array.from({length:8},(_,i)=>({id:"qa_design_"+i,title:i%2?"Finance growth thumbnail":"AI creator thumbnail",description:"Editable test fixture",category:i%2?"Finance":"Tech",authorName:i%2?"Community Creator":"ShortsCraft Official",authorHandle:i%2?"@community":"@shortscraft",authorAvatarUrl:"/favicon.svg",authorVerified:!(i%2),isPremium:i%3===0,starPrice:1,editable:true,canvas:{width:1280,height:720},previewUrl:i%2?"/storage/designs/templates/vox-coverup.webp":"/storage/designs/templates/heygen-trick.webp"}));
const skills = [{id:"qa-skill-1",title:"Learn kinetic motion",summary:"Typography",platform:"YouTube",url:"https://www.youtube.com/watch?v=qa",thumbnail:"/storage/designs/templates/neon-logo.webp",createdAt:"2026-10-01",author:{id:"qa-user",displayName:"QA educator",handle:"@teacher"}},{id:"qa-skill-2",title:"Thumbnail design basics",platform:"YouTube",url:"https://www.youtube.com/watch?v=qb",author:{displayName:"Designer",handle:"@designer"}}];
const mutations = [], results = [], errors = [], reactions = {};
async function run() {
  fs.mkdirSync(out,{recursive:true}); const browser = await browserTools.launch({headless:true});
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    page.on("pageerror",e=>errors.push(e.message));
    await page.evaluateOnNewDocument(()=>{
      if (top !== window) return;
      window.__qaCopies = 0;
      Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{window.__qaCopies++;}}});
      let permission = "default", subscription = null;
      const sub = {endpoint:"https://push.example.test/fixture",options:{},toJSON:()=>({endpoint:"https://push.example.test/fixture",keys:{p256dh:"fixture",auth:"fixture"}}),unsubscribe:async()=>{subscription=null;return true;}};
      const registration = {pushManager:{getSubscription:async()=>subscription,subscribe:async()=>{subscription=sub;return sub;}}};
      Object.defineProperty(Notification,"permission",{get:()=>permission}); Notification.requestPermission=async()=>{permission="granted";return permission;};
      Object.defineProperty(navigator,"serviceWorker",{value:{getRegistration:async()=>registration,register:async()=>registration,ready:Promise.resolve(registration),addEventListener:()=>{}}});
    });
    await page.setRequestInterception(true);
    page.on("request",req=>{
      const url = new URL(req.url());
      if (["data:","blob:","about:"].includes(url.protocol)) return req.continue();
      if (url.origin !== base) return req.abort();
      if (!url.pathname.startsWith("/api/")) return req.continue();
      const p=url.pathname; let status=200,j={success:true,templates:[],creations:[],items:[],projects:[],tickets:[],users:[],followers:[],following:[],reactions:{},notifications:[],unread:0,balance:0};
      if (req.method() !== "GET") mutations.push({path:p,method:req.method(),body:req.postData()});
      if (p==="/api/auth/me") j={success:true,user:guest?null:user};
      if (p==="/api/creator") j={success:true,creator:user,communityTemplates:[]};
      if (p==="/api/credits") j={success:true,plan:"free",planLabel:"Free",left:5,perDay:5,cost:{export:1,animate:2}};
      if (p==="/api/auth/google/config") j={enabled:false};
      if (p==="/api/referrals") j={success:true,enabled:false};
      if (p==="/api/designs/templates") j={success:true,templates};
      if (p==="/api/skills") j={success:true,skills};
      if (p==="/api/template-reactions") j={success:true,reactions};
      if (p.endsWith("/like")) { const id="design:"+p.split("/")[4]; const active=JSON.parse(req.postData()).active; reactions[id]={like:active,likeCount:active?1:0}; j={success:true,active,count:active?1:0}; }
      if (p==="/api/auth/profile") { if(saveFault){status=503;j={success:false,error:"QA save unavailable"};}else{user={...user,...JSON.parse(req.postData())};j={success:true,user};} }
      if (p==="/api/notifications/read") unread=0;
      if (p==="/api/notifications"||p==="/api/notifications/unread") {
        if(noteFault){status=503;j={success:false};}
        else { const notes=Array.from({length:12},(_,i)=>({id:"note"+i,message:"sent notification "+i,url:"/account",read:unread===0,createdAt:"2026-10-08T11:00:00Z",actor:{displayName:"QA Creator",handle:"@teacher"}})); j={success:true,unread,total:12,notifications:notes.slice(0,Number(url.searchParams.get("limit"))||10),latest:notes[0]}; }
      }
      if (p==="/api/push/key") j={success:true,publicKey:"AQID"};
      if (p==="/api/stars/wallet") j={success:true,availableStars:0,availableINR:0,canWithdraw:false,monetizationEnabled:false,history:[]};
      if (p==="/api/account/transactions") { if(historyFault){status=503;j={success:false};}else j={success:true,transactions:[{id:"credit:qa",kind:"export",amount:-1,unit:"credits",status:"recorded",createdAt:"2026-10-08T11:00:00Z"}],hasMore:false,nextOffset:25}; }
      const response={status,contentType:"application/json",body:JSON.stringify(j)};
      if (delayReactions && p==="/api/template-reactions") return setTimeout(()=>req.respond(response).catch(()=>{}),900);
      req.respond(response);
    });
    async function go(route) { await page.goto(base+route,{waitUntil:"networkidle2"}); }
    async function check(name,fn) { try { await fn(); results.push({name,status:"PASS"}); } catch(e) { results.push({name,status:"FAIL",error:e.message}); } }
    async function shot(name) {
      await page.evaluate(()=>document.querySelectorAll('.sc-toast').forEach(e=>e.remove()));
      await page.screenshot({path:path.join(out,name+".png"),fullPage:true});
      if (page.viewport().width===1440) await page.screenshot({path:path.join(out,name+"-viewport.png")});
    }
    await page.setViewport({width:1440,height:1000});
    await go("/designs");
    await check("Design search and combined filter",async()=>{
      assert.equal(await page.$$(".ds-card").then(a=>a.length),8);
      await page.select("#designFilter","free"); assert.equal(await page.$$(".ds-card").then(a=>a.length),5);
      await page.$eval("#designSearch",e=>{e.value="finance";e.dispatchEvent(new Event("input"));}); assert.equal(await page.$$(".ds-card").then(a=>a.length),3);
      await page.select("#designFilter","official"); assert(await page.$(".ds-empty"));
      await page.$eval("#designSearch",e=>{e.value="";e.dispatchEvent(new Event("input"));}); await page.select("#designFilter","all");
      assert.equal(await page.$eval('#designFilter option[value="premium"]',e=>e.disabled),false);
      await page.select("#designFilter","category:Finance"); assert.equal(await page.$$(".ds-card").then(a=>a.length),4); await page.select("#designFilter","all");
    });
    await check("Like persists on reload and unlike is functional",async()=>{
      await page.click(".ds-card-like"); await page.waitForFunction(()=>document.querySelector(".ds-card-like").getAttribute("aria-pressed")==="true");
      await page.reload({waitUntil:"networkidle2"}); assert.equal(await page.$eval(".ds-card-like",e=>e.getAttribute("aria-pressed")),"true");
      await page.click(".ds-card-like"); await page.waitForFunction(()=>document.querySelector(".ds-card-like").getAttribute("aria-pressed")==="false");
    });
    await check("Delayed reaction read cannot overwrite a newer Like",async()=>{
      delayReactions=true; await page.goto(base+"/designs",{waitUntil:"domcontentloaded"}); await page.waitForSelector(".ds-card-like");
      await page.click(".ds-card-like"); await page.waitForFunction(()=>document.querySelector(".ds-card-like").getAttribute("aria-pressed")==="true");
      await page.waitForNetworkIdle({idleTime:100,concurrency:2}); assert.equal(await page.$eval(".ds-card-like",e=>e.getAttribute("aria-pressed")),"true");
      delayReactions=false; await page.click(".ds-card-like"); await page.waitForFunction(()=>document.querySelector(".ds-card-like").getAttribute("aria-pressed")==="false");
    });
    await check("Design preview publisher logo and handle",async()=>{await page.click(".ds-card-open"); assert(await page.$(".ds-preview-dialog .ds-card-author img")); assert((await page.$eval(".ds-preview-dialog footer",e=>e.textContent)).includes("@shortscraft")); await page.keyboard.press("Escape");});
    await check("Share opens options without copying; explicit copy and Escape",async()=>{
      await page.click(".ds-card-menu-trigger"); await page.click('[data-action="share"]');
      assert.equal(await page.evaluate(()=>window.__qaCopies),0); assert.equal(await page.$$("#scShareDialog a").then(a=>a.length),4); await shot("share-desktop-light");
      await page.click("#scShareDialog [data-copy]"); assert.equal(await page.evaluate(()=>window.__qaCopies),1); await page.keyboard.press("Escape"); await page.waitForFunction(()=>!document.getElementById("scShareDialog"));
    });
    await shot("designs-desktop-light");
    await go("/");
    await check("Home cards: same menus, likes, compact premium badges",async()=>{assert.equal(await page.$$("#homeDesignsGrid .ds-card-menu-trigger").then(a=>a.length),8);assert.equal(await page.$$("#homeDesignsGrid .ds-card-like").then(a=>a.length),8);assert(await page.$eval(".ds-card-prem-badge",e=>e.offsetWidth<e.closest(".ds-card").offsetWidth/2));});
    await page.$eval("#homeDesigns",e=>e.scrollIntoView()); await page.screenshot({path:path.join(out,"home-cards-desktop.png")});
    await go("/animations");
    await check("Animation search at heading + popup controls all visible",async()=>{
      assert(await page.$(".pg-head #tplSearch"));
      await page.click(".sh-tile"); await page.waitForSelector("#modalReportBtn");
      assert.equal(await page.$("#modalReplayBtn"),null);
      assert(await page.$eval("#modalReportBtn",e=>{const r=e.getBoundingClientRect(),p=e.closest(".sh-modal-left").getBoundingClientRect();return r.right<=p.right+1;}));
      await shot("animation-popup-desktop");
      await page.click("#modalShareBtn"); assert(await page.$("#scShareDialog")); await page.keyboard.press("Escape"); await page.click("#modalClose");
    });
    await shot("animations-desktop-light");
    await go("/community");
    await check("Tutorial search by title and author + empty state",async()=>{
      await page.$eval("#tutorialSearch",e=>{e.value="teacher";e.dispatchEvent(new Event("input"));}); assert.equal(await page.$$(".sk-card").then(a=>a.length),1);
      await page.$eval("#tutorialSearch",e=>{e.value="absent";e.dispatchEvent(new Event("input"));}); assert.equal(await page.$$(".sk-card").then(a=>a.length),0);
      await page.$eval("#tutorialSearch",e=>{e.value="";e.dispatchEvent(new Event("input"));}); assert.equal(await page.$$(".sk-card").then(a=>a.length),2);
    });
    await shot("tutorials-desktop-light");
    await go("/account");
    await check("Settings merged + inline actions last + profile share",async()=>{
      assert.equal(await page.$('[data-settings-link="stars"]'),null); assert((await page.$eval('[data-settings-link="account"]',e=>e.textContent)).includes("Account & Earnings"));
      assert.deepEqual(await page.$$eval(".pf-settings-list > *",a=>a.slice(-2).map(e=>e.dataset.settingsGroup)),["appearance","logout"]);
      await page.click("#shareProfileBtn"); assert(await page.$("#scShareDialog")); assert.equal(await page.evaluate(()=>window.__qaCopies),0); await page.keyboard.press("Escape");
      const before=await page.evaluate(()=>document.documentElement.dataset.theme); await page.click('#igPaneSettings [data-theme-toggle]'); assert.notEqual(await page.evaluate(()=>document.documentElement.dataset.theme),before);
      await page.click("#accLogout"); assert(await page.$(".sc-dlg")); assert.equal(mutations.filter(r=>r.path==="/api/auth/logout").length,0); await page.keyboard.press("Escape");
    }); await shot("settings-desktop");
    await go("/account/credits");
    await check("Account overview -> earnings -> actual history",async()=>{assert(await page.$eval("#igPaneAccount",e=>e.getBoundingClientRect().height>0));assert(await page.$eval("#igPaneStars",e=>e.getBoundingClientRect().height>0));assert((await page.$eval("#accountTransactionList",e=>e.textContent)).includes("export"));assert.equal(await page.$eval("#requestPayoutBtn",e=>e.disabled),true);}); await shot("account-earnings-desktop");
    historyFault=true; await go("/account/credits"); await check("History failure is not fake empty; retry works",async()=>{assert(await page.$("#accountTransactionList [role=alert]"));historyFault=false;await page.click("#accountTransactionList button");await page.waitForSelector(".pf-transaction-row");});
    await go("/account/earnings"); await check("Legacy earnings redirects to merged page",async()=>assert.equal(new URL(page.url()).pathname,"/account/credits"));
    await go("/account/notifications");
    await check("Full-page notifications match bell + load more + mark read",async()=>{
      assert.equal(await page.$$("#accountNotificationList .sh-notification-item").then(a=>a.length),10);
      await page.click("#accountNotificationMore"); await page.waitForFunction(()=>document.querySelectorAll("#accountNotificationList .sh-notification-item").length===12);
      await page.click("#accountNotificationsRead"); await page.waitForFunction(()=>document.querySelector("#notificationCount").hidden); assert.equal(await page.$eval("#accountNotificationList .sh-notification-item",e=>e.dataset.read),"true");
    });
    await check("Turn on succeeds and hides both on/off buttons",async()=>{await page.click("#pushSettingsBtn");await page.waitForFunction(()=>document.querySelector("#pushSettingsBtn").hidden);assert((await page.$eval("#pushSettingsText",e=>e.textContent)).includes("Notifications are on"));assert.equal(await page.$eval("#pushPanelBtn",e=>e.hidden),true);}); await shot("notifications-desktop");
    noteFault=true;await go("/account/notifications");await check("Notification load failure and retry",async()=>{assert(await page.$("#accountNotificationList [role=alert]"));noteFault=false;await page.click("#accountNotificationList button");await page.waitForSelector("#accountNotificationList .sh-notification-item");});
    await go("/account/edit-profile");
    await check("Creator fields persist and failure preserves inputs",async()=>{
      assert.equal(await page.$$("[data-creator-detail]").then(a=>a.length),9);
      await page.$eval("#pageNiche",e=>e.value="Gaming and motion"); await page.click("#pageSaveProfileBtn");await page.waitForFunction(()=>document.querySelector("#pageProfileMsg").textContent.includes("successfully"));
      await page.reload({waitUntil:"networkidle2"});assert.equal(await page.$eval("#pageNiche",e=>e.value),"Gaming and motion");
      saveFault=true;await page.$eval("#pageNiche",e=>e.value="Unsaved niche");await page.click("#pageSaveProfileBtn");await page.waitForFunction(()=>document.querySelector("#pageProfileMsg").textContent.includes("unavailable"));assert.equal(await page.$eval("#pageNiche",e=>e.value),"Unsaved niche");saveFault=false;
      assert(await page.evaluate(()=>{const a=document.querySelector("#pageCancelProfileBtn").getBoundingClientRect(),b=document.querySelector("#pageSaveProfileBtn").getBoundingClientRect();return b.left-a.right<20;}));
    }); await shot("profile-edit-desktop");
    await go("/creator?handle=shortscraft");
    await check("Saved optional creator details appear on public profile",async()=>assert((await page.$eval(".cp-extra-details",e=>e.textContent)).includes("Gaming and motion")));
    await go("/account/creations");await shot("creations-desktop");
    for(const width of [390,1440]) for(const theme of ["light","dark"]) {
      await page.setViewport({width,height:900,isMobile:width<600,hasTouch:width<600});
      await page.evaluate(t=>localStorage.setItem("sc_theme",t),theme);
      for(const route of ["/designs","/animations","/community","/account","/account/edit-profile","/account/credits","/account/notifications","/account/creations"]) {
        await go(route); await check(`${route}/${width}/${theme}/no horizontal overflow`,async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)));
        if(width===390)await shot(route.replace(/\//g,"-")+"-"+width+"-"+theme);
      }
    }
    guest=true;await go("/account");await check("Guest appearance is a separate control",async()=>{assert(await page.$("#accountGuest .pf-guest-appearance [data-theme-toggle]"));assert.equal(await page.$eval("#accountGuest",e=>e.hidden),false);});
    assert.deepEqual(errors,[],"No browser page errors");
  } finally {
    await browser.close(); fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({scope:"Local fixture UI only, not production",results,errors,mutations},null,2));
    const previews=[['Design filters, cards and likes','designs-desktop-light-viewport'],['Share options','share-desktop-light-viewport'],['Home thumbnail cards','home-cards-desktop'],['Animations search','animations-desktop-light-viewport'],['Animation Like / Share / Report','animation-popup-desktop-viewport'],['Tutorial search','tutorials-desktop-light-viewport'],['Settings and inline actions','settings-desktop'],['Account overview, earnings and history','account-earnings-desktop'],['Notifications feed','notifications-desktop'],['Complete creator profile','profile-edit-desktop'],['Compact creations','creations-desktop-viewport'],['Mobile basic fit','-designs-390-light']];
    fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ShortsCraft desktop changes preview</title><style>body{font:16px system-ui;margin:0;background:#f6f6f8;color:#151515}header,main{max-width:1180px;margin:auto;padding:24px}header{background:white}nav{display:flex;gap:10px;flex-wrap:wrap}a{color:#303060}article{margin:30px 0;background:white;border:1px solid #ddd;border-radius:14px;padding:18px}img{max-width:100%;height:auto;border:1px solid #ddd}h2{font-size:20px}.notice{color:#555}details img{max-height:none}</style><header><h1>ShortsCraft desktop changes</h1><p class="notice">Local QA screenshots with isolated test data. Not the live site. No payments, real emails or production writes.</p><p>'+results.filter(r=>r.status==='PASS').length+'/'+results.length+' UI checks passed. Full mobile, Referral and Admin revisions are deferred.</p><nav>'+previews.map(([title],i)=>'<a href="#p'+i+'">'+title+'</a>').join('')+'</nav></header><main>'+previews.map(([title,file],i)=>'<article id="p'+i+'"><h2>'+title+'</h2><a href="'+file+'.png"><img loading="lazy" src="'+file+'.png" alt="'+title+'"></a></article>').join('')+'</main></html>');
  }
  console.log(JSON.stringify(results.filter(r=>r.status==="FAIL"),null,2));console.log(results.filter(r=>r.status==="PASS").length+" / "+results.length+" PASS");
  if(results.some(r=>r.status==="FAIL"))process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
