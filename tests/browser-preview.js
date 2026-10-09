"use strict";
// Interactive LOCAL preview of the real app. Never uses production credentials.
const path = require("node:path");
process.env.SC_QA_PORTABLE_PG = "C:\\Users\\karim\\AppData\\Local\\Temp\\shortscraft-launch-pg-0207ebcf79d340e085413573c2e20c73";
require("./helpers/isolated-postgres").assertIsolatedPostgres();
Object.assign(process.env, {
  DATABASE_URL:"postgresql://shortscraft_app:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa?sslmode=disable",
  PORT:"3341", BASE_URL:"http://127.0.0.1:3341", PUBLIC_SITE_URL:"http://127.0.0.1:3341",
  NODE_ENV:"development", CREDITS_SECRET:"isolated-browser-preview-secret-not-production",
  SC_ISOLATED_POSTGRES_QA:"true", REFERRALS_ENABLED:"true"
});
for (const key of ["NVIDIA_API_KEY","GEMINI_API_KEY","GROQ_API_KEY","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","RESEND_API_KEY","AUTH_FROM_EMAIL","SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_KEY","VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","SUPER_ADMIN_EMAILS","GA_ID"])
  process.env[key] = "";
// Read only the same public discovery endpoints a signed-out visitor sees.
// No production database connection, cookies, private records or write requests.
async function publicCatalog() {
  const origin = "https://shortscraft.online";
  async function read(route) {
    const r = await fetch(origin+route,{method:"GET",redirect:"error",signal:AbortSignal.timeout(45000)});
    if (!r.ok) throw Error("Public catalog unavailable ("+r.status+")");
    const j = await r.json(); if (!j.success) throw Error("Public catalog unavailable"); return j;
  }
  const [designsData,tutorialsData] = await Promise.all([read("/api/designs/templates"),read("/api/skills?limit=100")]);
  // Relative public media must resolve on the source site, not the local DB.
  function media(value) {
    if (Array.isArray(value)) return value.map(media);
    if (!value || typeof value!=="object") return value;
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,
      ["src","url","previewUrl","authorAvatarUrl","avatarUrl","imageUrl"].includes(k) && typeof v==="string" && /^\/[^/]/.test(v)
        ? origin+v : media(v)]));
  }
  const templates=media(designsData.templates || []), tutorials=media(tutorialsData.skills || []);
  const designs=require("../designs"), skills=require("../skills");
  const originalGet=designs.getTemplate, originalClone=designs.cloneTemplate;
  designs.listTemplates=async category=>({success:true,templates:templates.filter(t=>!category||category==="all"||t.category===category||t.designType===category)});
  designs.getTemplate=async id=>templates.some(t=>t.id===id)?{success:true,template:templates.find(t=>t.id===id)}:originalGet(id);
  designs.cloneTemplate=async (user,id)=>{
    const t=templates.find(t=>t.id===id); if(!t)return originalClone(user,id);
    if(!user?.id)return {error:"Please log in to use this template.",status:401};
    if(t.isPremium)return {error:"Paid template unlocks are Coming Soon.",status:402,starPrice:t.starPrice};
    if(!t.elements?.length)return {error:"This published design has no editable layers.",status:409};
    return designs.saveProject(user,"dp_"+require("node:crypto").randomBytes(6).toString("hex"),{
      name:t.title+" (Copy)",designType:t.designType,canvas:t.canvas,elements:t.elements,
      source:{type:"template_clone",parentTemplateId:id,sourceCreatorName:t.authorName,sourceCreatorHandle:t.authorHandle,previewCatalogCopy:true},previewUrl:t.previewUrl
    });
  };
  skills.listPublished=async (_viewer,limit)=>({skills:tutorials.slice(0,Math.min(100,Math.max(1,Number(limit)||40))).map(t=>({...t,canDelete:false}))});
  console.log("Public read-only catalog loaded:",templates.length,"designs,",tutorials.length,"tutorials. Preview Likes/edits stay in the local DB.");
}
publicCatalog().then(()=>{
  require(path.join(__dirname,"helpers/qa-local-only.js"));
  // The interactive wrapper's argv is not server.js, so disable workers here
  // explicitly too: local QA push senders must own notification delivery.
  const notify = require("../notify"); notify.start=()=>{}; notify.schedule=()=>{};
  console.log("LOCAL BROWSER PREVIEW: http://127.0.0.1:3341 — public catalog snapshot + isolated local account data; external AI/email/payment providers disabled.");
  require("../server.js");
}).catch(e=>{console.error("Local preview not started:",e.message);process.exitCode=1;});
