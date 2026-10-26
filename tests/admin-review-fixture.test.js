"use strict";
// Verifies the local UI-fixture guardrails. These are not production API tests.
const test=require("node:test");
const assert=require("node:assert/strict");
const {app,templates,activity}=require("./admin-review-preview-server");

test("local Admin fixture serves real files, separates guest and owner, and refuses non-fixture writes",async()=>{
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  const origin="http://127.0.0.1:"+server.address().port;
  async function request(route,options){const r=await fetch(origin+route,options);return {status:r.status,headers:r.headers,body:await r.json()};}
  try{
    assert.equal(server.address().address,"127.0.0.1");
    const page=await fetch(origin+"/admin");assert.equal(page.status,200);assert.match(await page.text(),/admin-console\.js/);
    const home=await fetch(origin+"/",{redirect:"manual"});
    assert.equal(home.status,200,"Back to site must open Home instead of redirecting to Admin");
    assert.equal(home.headers.get("location"),null);
    assert.match(await home.text(),/What do you want to animate here\?/);
    const publicDesigns=await request("/api/designs/templates");
    assert.equal(publicDesigns.status,200);
    assert.equal(publicDesigns.body.templates.some(t=>t.id==="dt_review_design"),false,"Home cannot expose a pending design just to populate the preview");
    const payload=await request("/api/admin/animation-templates/comm_review_motion/preview");
    assert.equal(payload.status,200);assert.equal(payload.body.template.status,"review");assert.equal(payload.body.template.tpl,"text-vox-impact");
    assert.match(payload.body.evidenceBoundary,/Synthetic local/);
    const lottie=await request("/api/admin/animation-templates/comm_review_broken_lottie/preview");
    assert.equal(lottie.status,200);assert.equal(lottie.body.template.tpl,"lottie");
    assert.equal(lottie.body.template.props.doc,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const absentDoc=await request("/api/lottie/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert.equal(absentDoc.status,404,"Missing source stays unavailable; fixture never proxies an external API");
    const metadata=await request("/preview-info");assert.equal(metadata.body.metadataReadOnly,true);
    const pendingSkills=await request("/api/admin/skills?status=pending");
    assert.equal(pendingSkills.body.skills.length,1);assert.equal(pendingSkills.body.skills[0].status,"pending");
    const skillPatch=status=>({method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
    assert.equal((await request("/api/admin/skills/review-tutorial",skillPatch("review"))).status,400);
    assert.equal((await request("/api/admin/skills/review-tutorial",skillPatch("published"))).status,200);
    assert.equal((await request("/api/admin/animation-templates/comm_review_motion/preview",{headers:{Cookie:"sc_admin_review=guest"}})).status,403);
    assert.equal((await request("/api/admin/design-templates/dt_review_design/preview",{headers:{Cookie:"sc_admin_review=guest"}})).status,403);
    for(const route of ["/api/payments/create","/api/admin/users/review-creator/staff","/api/auth/login","/api/designs/projects/new"]){
      assert.equal((await request(route,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).status,405);
    }
    const change={method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"rejected",reviewNote:""})};
    assert.equal((await request("/api/admin/templates/comm_review_motion",change)).status,400);
    change.body=JSON.stringify({status:"rejected",reviewNote:"Synthetic review reason"});
    assert.equal((await request("/api/admin/templates/comm_review_motion",change)).status,200);
    assert.equal(templates.find(t=>t.id==="comm_review_motion").status,"rejected");assert.equal(activity.length,2);
    assert.equal((await request("/api/admin/templates/comm_review_motion",{...change,headers:{...change.headers,Cookie:"sc_admin_review=guest"}})).status,403);
    assert.equal((await request("/api/admin/templates/not-a-fixed-local-id",change)).status,404);
    const missing=await request("/api/admin/animation-templates/missing/preview");assert.equal(missing.status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
