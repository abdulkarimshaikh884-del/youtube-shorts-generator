"use strict";
// Static production pages/assets + unauthorized GET checks. No credentials,
// API credit state, signup, writes, AI, rendering, payments or deployment.
const fs=require("node:fs"), path=require("node:path"), crypto=require("node:crypto");
const origin="https://shortscraft.online",root=path.resolve(__dirname,".."),out=path.join(root,"audit_results/page-certification");
const routes=["/","/animations","/designs","/community","/drafts","/uploads","/settings","/pricing","/tutorials","/help","/account","/contact","/about","/privacy","/terms","/login","/signup","/forgot-password","/reset-password","/creator?handle=shortscraft","/template?id=original-chat-story","/editor","/design-editor","/admin","/robots.txt","/sitemap.xml"];
const results=[],assets=[];let html="";
async function get(route){
  try{const response=await fetch(origin+route,{signal:AbortSignal.timeout(45000),headers:{"User-Agent":"ShortsCraft-ReadOnly-QA/1.0"}});const body=await response.text();
    return {route,status:response.status,url:response.url,title:body.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||null,body,headers:{contentType:response.headers.get("content-type"),csp:response.headers.get("content-security-policy"),cacheControl:response.headers.get("cache-control"),hsts:response.headers.get("strict-transport-security")}};
  }catch(err){return{route,status:null,error:err.message};}
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  for(let i=0;i<routes.length;i+=3){const batch=await Promise.all(routes.slice(i,i+3).map(get));for(const r of batch){if(r.route==="/")html=r.body||"";const{body,...safe}=r;results.push({...safe,result:r.status===200?"PASS":"FAIL",boundary:"HTTP availability only; NOT functional certification"});}console.log("Production availability: "+Math.min(i+3,routes.length)+"/"+routes.length);}
  const manifest=html.match(/<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)/i)?.[1];
  if(manifest?.startsWith("/")&&!manifest.startsWith("//")){const r=await get(manifest);const{body,...safe}=r;results.push({...safe,result:r.status===200?"PASS":"FAIL",boundary:"Actual linked manifest availability only"});}
  {const r=await get("/qa-readonly-missing-page-20261001");const{body,...safe}=r;results.push({...safe,result:r.status===404?"PASS":"FAIL",boundary:"Unknown route must return HTTP 404, not a successful 200 soft-404"});}
  const refs=[...html.matchAll(/(?:src|href)=["'](\/[^"']+\.(?:js|css|svg)(?:\?[^"']*)?)["']/g)].map(m=>m[1]);
  for(const ref of [...new Set(refs)]){const r=await get(ref),local=path.join(root,"public",ref.split("?")[0].slice(1));const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
    assets.push({route:ref,status:r.status,result:r.status===200?"PASS":"FAIL",matchesLocal:r.status===200&&fs.existsSync(local)?hash(r.body.replace(/\r\n/g,"\n"))===hash(fs.readFileSync(local,"utf8").replace(/\r\n/g,"\n")):null});}
  for(const route of ["/api/admin/dashboard","/api/admin/users","/api/admin/templates","/api/admin/withdrawals"]){const r=await get(route);results.push({route,status:r.status,result:[401,403].includes(r.status)?"PASS":r.status===404?"NOT_AVAILABLE":"FAIL",boundary:"Guest denial of GET only; a 404 is not permission proof or an authorization leak"});}
  const report={testedAt:new Date().toISOString(),origin,mode:"Production static GET/unauthorized GET; no API /credits call, no mutations",results,assets,homepage:{h1Count:(html.match(/<h1(?:\s|>)/g)||[]).length,canonical:html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)/)?.[1]||null,containsLocalURL:/https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(html),containsPrivateKey:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(html)}};
  report.hardening={cspContainsDevelopmentOrigin:results.some(r=>/https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(r.headers?.csp||""))};
  fs.writeFileSync(path.join(out,"production-readonly.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:results.length,failed:results.filter(r=>r.result==="FAIL"),assets:assets.length,failedAssets:assets.filter(r=>r.result==="FAIL"),changedAssets:assets.filter(r=>r.matchesLocal===false).map(r=>r.route),homepage:report.homepage},null,2));
  if(results.some(r=>r.result==="FAIL")||assets.some(r=>r.result==="FAIL"))process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1;});
