// Database-free regression checks. No real accounts, uploads or writes.
const puppeteer=require('puppeteer'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await puppeteer.launch({headless:true});
 try{
 const page=await browser.newPage();let role=null;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',r=>{
  const u=new URL(r.url());
  if(!['GET','HEAD'].includes(r.method()))return r.abort();
  if(u.pathname.startsWith('/api/')){
   let data={success:true,templates:[],skills:[],items:[],notifications:[],creations:[],projects:[]};
   if(u.pathname==='/api/auth/me')data={success:true,user:role?{id:'qa-isolated',email:'qa@example.test',handle:'qa_user',displayName:'QA fixture',role}:null};
   if(u.pathname==='/api/credits')data={success:true,plan:'free',planLabel:'Free',left:5,perDay:5,cost:{export:1,animate:2}};
   return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }r.continue();
 });
 fs.mkdirSync('audit_results/settings',{recursive:true});
 for(const width of [390,1440]){
  await page.setViewport({width,height:900,isMobile:width<600,hasTouch:width<600});
  for(role of [null,'user','super_admin']){
   await page.goto('http://127.0.0.1:3327/settings',{waitUntil:'networkidle2'});
   await page.waitForFunction(expected=>location.pathname==='/account' && document.querySelector('#accountBox').hidden===!expected,{},!!role);
   const themeSelector=role?'#igPaneSettings [data-theme-toggle]':'#accountGuest [data-theme-toggle]';
   const visible=await page.$eval('main a[href="/admin"]',e=>!e.hidden);
   assert.equal(visible,role==='super_admin','Admin shortcut follows existing permissions');
   assert.equal(await page.$$eval('.sh-rail a[href="/admin"],#navMobile a[href="/admin"],.sh-rail [data-theme-toggle]',e=>e.length),0);
   assert.equal(await page.$$eval('a',e=>e.filter(a=>a.textContent.includes('Creator Studio')).length),0);
   assert(await page.$('main a[href="/tutorials"]'));assert(await page.$('main a[href="/contact"]'));
   if(role)await page.goto('http://127.0.0.1:3327/account/appearance',{waitUntil:'networkidle2'});
   await page.waitForFunction(()=>location.pathname==='/account' && document.querySelector('[data-theme-toggle]').hasAttribute('aria-pressed'));
   if(role)await page.goto('http://127.0.0.1:3327/account',{waitUntil:'networkidle2'});
   const before=await page.evaluate(()=>document.documentElement.dataset.theme);
   await page.$eval(themeSelector,e=>e.scrollIntoView({block:'center'}));
   await page.click(themeSelector);
   assert.notEqual(await page.evaluate(()=>document.documentElement.dataset.theme),before);
   await page.reload({waitUntil:'networkidle2'});
   assert.notEqual(await page.evaluate(()=>document.documentElement.dataset.theme),before,'Preference survives reload');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(role==='super_admin')await page.screenshot({path:`audit_results/settings/settings-${width}.png`});
  }
  role='user';
  await page.goto('http://127.0.0.1:3327/drafts',{waitUntil:'networkidle2'});
  assert(await page.$('#draftGrid'));assert(await page.$('#userCreationsGrid'));
  assert(await page.$eval('#accountBox',e=>!e.hidden),'Template management accessible');
  assert.equal(await page.$$eval('[id]',els=>{const ids=els.map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i).length}),0,'No duplicated IDs after merging');
  await page.screenshot({path:`audit_results/settings/projects-${width}.png`});
  for(const theme of ['light','dark']){
   await page.evaluate(t=>localStorage.setItem('sc_theme',t),theme);
   await page.goto('http://127.0.0.1:3327/',{waitUntil:'networkidle2'});
   const colors=await page.$eval('#composerGo',el=>({bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color}));
   assert.notEqual(colors.bg,colors.fg,'Primary action remains readable');
   const rgb=colors.bg.match(/\d+/g).slice(0,3);assert.equal(new Set(rgb).size,1,'Neutral primary colour');
   await page.screenshot({path:`audit_results/settings/home-${theme}-${width}.png`});
  }
  await page.goto('http://127.0.0.1:3327/uploads',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>location.pathname==='/drafts');
  console.log(`PASS ${width}: settings, roles, theme persistence, merged projects, legacy URL`);
 }
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
