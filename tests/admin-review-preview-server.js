"use strict";

// LOCAL PRESENTATION FIXTURE ONLY. No dotenv, production server, database,
// credentials, AI, push, payment or network writes. A few fixed synthetic
// submissions can change status IN MEMORY so the real admin UI can be reviewed.
const express = require("express");
const path = require("node:path");
const {PERMISSIONS, ROLE_PRESETS} = require("../permissions");
const publicRoot = path.resolve(__dirname, "../public");
const port = Number(process.argv[2] || 3402);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error("Invalid loopback preview port");
const stamp = "2026-10-25T09:00:00.000Z";
const boundary = "Synthetic local Admin review fixture; status writes are in memory only; no production, DB, payment or provider access";
const owner = {id:"review-owner",displayName:"Review Owner",display_name:"Review Owner",handle:"review_owner",profileHandle:"review_owner",email:"owner@example.invalid",role:"super_admin",permissions:[],plan:"free",verified:true};
const users = [
  {id:"review-creator",displayName:"Maya — Motion Designer",handle:"@review_creator",profileHandle:"review_creator",email:"maya@example.invalid",role:"user",plan:"free",verified:false,credits:5,totalStars:0,earnedStars:0,withdrawnStars:0,templateCount:3,createdAt:stamp},
  {id:"review-new-user",displayName:"New Creator With A Long Display Name",handle:"@new_creator",profileHandle:"new_creator",email:"new@example.invalid",role:"user",plan:"free",verified:false,credits:5,totalStars:0,earnedStars:0,withdrawnStars:0,templateCount:0,createdAt:stamp},
  {id:"review-no-handle",displayName:"Account without a public handle",handle:"@user_review",profileHandle:"",email:"no-handle@example.invalid",role:"user",plan:"free",verified:false,credits:5,totalStars:0,earnedStars:0,withdrawnStars:0,templateCount:0,createdAt:stamp}
];
const templates = [
  {id:"comm_review_motion",title:"Launch day — kinetic headline",templateId:"text-vox-impact",tpl:"text-vox-impact",category:"text",status:"review",sourceFormat:"shortscraft_preset",lines:["MAKE YOUR", "NEXT IDEA", "MOVE"],props:{},aspect:"9:16",accent:"#2563eb",font:"inter",dur:5000},
  {id:"dt_review_design",title:"Midnight product launch poster",templateId:"poster",category:"Poster",status:"review",sourceFormat:"design_template"},
  {id:"comm_review_landscape",title:"Landscape chart review",templateId:"charts-bar-race",tpl:"charts-bar-race",category:"charts",status:"published",sourceFormat:"shortscraft_preset",lines:["REAL GROWTH", "1K TO 100K", "SAMPLE DATA"],props:{},aspect:"16:9",accent:"#16a34a",font:"inter",dur:5000},
  {id:"comm_review_broken_lottie",title:"Missing uploaded Lottie document",templateId:"lottie",tpl:"lottie",category:"text",status:"review",sourceFormat:"lottie_json",lines:[],props:{doc:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},aspect:"9:16",accent:"#2563eb",font:"inter",dur:5000},
  {id:"comm_review_unsupported",title:"Unavailable source must be explained",templateId:"removed-template-for-qa",tpl:"removed-template-for-qa",category:"text",status:"review",sourceFormat:"shortscraft_preset",lines:["Unsupported fixture"],props:{},aspect:"9:16",accent:"#2563eb",font:"inter",dur:5000}
].map(t=>({...t,authorId:users[0].id,authorName:users[0].displayName,authorHandle:users[0].handle,profileHandle:users[0].profileHandle,createdAt:stamp,likes:0,comments:0,exports:0,reviewNote:""}));
const design = {id:"dt_review_design",title:"Midnight product launch poster",status:"review",canvas:{width:1280,height:720},backgroundColor:"#101828",elements:[
  {id:"bg",type:"shape",shape:"rectangle",x:0,y:0,width:1280,height:720,fill:"#101828",zIndex:0},
  {id:"accent",type:"shape",shape:"circle",x:890,y:100,width:270,height:270,fill:"#6366f1",zIndex:1},
  {id:"headline",type:"text",text:"MEET YOUR\nNEXT FAVORITE",x:75,y:140,width:970,height:270,fontSize:92,fontWeight:800,fontFamily:"Inter",fill:"#ffffff",zIndex:2},
  {id:"caption",type:"text",text:"A SYNTHETIC LOCAL DESIGN FOR MODERATION REVIEW",x:80,y:555,width:1080,height:100,fontSize:26,fontWeight:500,fontFamily:"Inter",fill:"#a5b4fc",zIndex:3}
]};
const skills = [{id:"review-tutorial",title:"Build a clean motion title in five steps",url:"https://www.youtube.com/watch?v=aqz-KE-bpKQ",platform:"YouTube",videoId:"aqz-KE-bpKQ",status:"pending",summary:"Synthetic tutorial listing for local moderation UI review; external video is a public sample.",author:{id:users[0].id,displayName:users[0].displayName,handle:users[0].handle,profileHandle:users[0].profileHandle},createdAt:stamp,reviewNote:""}];
const activity = [];
const app = express();
const json = (res,data,status=200)=>res.status(status).json({success:status<400,fixture:true,evidenceBoundary:boundary,...data});
const isGuest = req=>/(?:^|;\s*)sc_admin_review=guest(?:;|$)/.test(req.headers.cookie||"");
app.disable("x-powered-by");
app.use((_req,res,next)=>{res.set({"Cache-Control":"no-store","X-ShortsCraft-Preview":"synthetic-local-admin-review","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"});next();});
app.use(express.json({limit:"20kb"}));
app.get("/preview-info",(_req,res)=>json(res,{label:"READ-ONLY FIXTURE METADATA · synthetic in-memory review state",metadataReadOnly:true,bind:"127.0.0.1",port,templates:templates.map(({id,status,reviewNote})=>({id,status,reviewNote})),skills:skills.map(({id,status})=>({id,status})),activity}));
app.get("/preview-guest",(_req,res)=>{res.setHeader("Set-Cookie","sc_admin_review=guest; Path=/; HttpOnly; SameSite=Strict");res.redirect("/admin");});
app.get("/preview-owner",(_req,res)=>{res.setHeader("Set-Cookie","sc_admin_review=owner; Path=/; HttpOnly; SameSite=Strict");res.redirect("/admin");});
app.use("/api/admin",(req,res,next)=>isGuest(req)?json(res,{error:"Synthetic guest has no admin access."},403):next());
app.patch("/api/admin/templates/:id",(req,res)=>{
  const t=templates.find(t=>t.id===req.params.id);
  if(!t)return json(res,{error:"Unknown local fixture submission."},404);
  if(!["published","review","rejected","archived"].includes(req.body.status))return json(res,{error:"Choose a valid status."},400);
  if(req.body.status==="rejected"&&!String(req.body.reviewNote||"").trim())return json(res,{error:"Rejection reason is mandatory."},400);
  t.status=req.body.status;t.reviewNote=String(req.body.reviewNote||"").trim();
  if(t.id===design.id)design.status=t.status;
  activity.push({action:"local_fixture_moderation",entity_type:"template",entity_id:t.id,status:t.status,created_at:new Date().toISOString()});
  return json(res,{template:{id:t.id,status:t.status,reviewNote:t.reviewNote}});
});
app.patch("/api/admin/skills/:id",(req,res)=>{
  const s=skills.find(s=>s.id===req.params.id);
  if(!s)return json(res,{error:"Unknown local tutorial."},404);
  if(!["pending","published","rejected"].includes(req.body.status))return json(res,{error:"Choose a valid tutorial status."},400);
  if(req.body.status==="rejected"&&!String(req.body.note||"").trim())return json(res,{error:"Rejection note is mandatory."},400);
  s.status=req.body.status;s.reviewNote=String(req.body.note||"").trim();
  activity.push({action:"local_fixture_tutorial_moderation",entity_type:"tutorial",entity_id:s.id,status:s.status,created_at:new Date().toISOString()});
  return json(res,{skill:s});
});
// Refuse every other API mutation before any fallback; no request is forwarded.
app.use("/api",(req,res,next)=>["GET","HEAD"].includes(req.method)?next():json(res,{error:"Only fixed local fixture moderation can change in-memory state. All other writes are disabled."},405));
app.get("/api/*",(req,res)=>{
  const route=req.path;
  if(route==="/api/auth/me")return json(res,{user:isGuest(req)?null:owner});
  if(route==="/api/credits")return json(res,{plan:"free",planLabel:"Free",left:5,dailyLeft:5,perDay:5,bonusCredits:0,maxHeight:480,cost:{animate:2,export:1}});
  if(route==="/api/auth/google/config")return json(res,{enabled:false});
  if(route==="/api/config")return json(res,{release:{monetizationEnabled:false},services:{ai:false,auth:false,payments:false},plans:[],gaId:""});
  if(route==="/api/stars")return json(res,{balance:0,received:0,sent:0,allowance:0,monetizationEnabled:false});
  if(route==="/api/notifications"||route==="/api/notifications/unread")return json(res,{notifications:[],unread:0,total:0});
  if(route==="/api/push/key")return json(res,{enabled:false,publicKey:""});
  // The Back to site destination is the actual Home document. Its discovery
  // widgets remain local-only and must never reveal pending review fixtures.
  if(route==="/api/designs/templates")return json(res,{templates:templates.filter(t=>t.sourceFormat==="design_template"&&t.status==="published").map(t=>({...design,...t}))});
  if(route==="/api/skills")return json(res,{skills:skills.filter(s=>s.status==="published")});
  if(route==="/api/admin/dashboard")return json(res,{stats:{users:users.length,new_users_30d:users.length,creators_count:1,pending_templates:templates.filter(t=>t.status==="review").length,published_templates:templates.filter(t=>t.status==="published").length,pro_users:0,pending_withdrawals:0,ai_jobs_today:0,ai_jobs_failed_30d:0,open_tickets:0,open_reports:0,starPackGrossINR:null,platformFeeINR:null},recentActivity:activity.slice(-8).reverse(),newUsers:users,recentUsers:users});
  if(route==="/api/admin/users"){
    const q=String(req.query.q||"").toLowerCase();
    return json(res,{users:users.filter(u=>(u.displayName+u.handle+u.email).toLowerCase().includes(q))});
  }
  if(route==="/api/admin/creators")return json(res,{creators:users.filter(u=>u.templateCount).map(u=>({...u,templatesCount:u.templateCount,starsEarned:0,starsWithdrawn:0}))});
  if(route==="/api/admin/templates")return json(res,{templates});
  if(route==="/api/admin/skills")return json(res,{skills:skills.filter(s=>!req.query.status||req.query.status==="all"||req.query.status===s.status)});
  const animationMatch=route.match(/^\/api\/admin\/animation-templates\/([^/]+)\/preview$/);
  if(animationMatch){const t=templates.find(t=>t.id===animationMatch[1]&&t.sourceFormat!=="design_template");return t?json(res,{template:t}):json(res,{error:"Local animation unavailable."},404);}
  if(route==="/api/admin/design-templates/"+design.id+"/preview")return json(res,{template:design});
  if(route==="/api/admin/staff")return json(res,{staff:[owner],permissions:PERMISSIONS,presets:ROLE_PRESETS});
  if(route==="/api/creator"){
    const handle=String(req.query.handle||"").replace(/^@/,"");const u=users.find(u=>u.profileHandle===handle);
    return u?json(res,{creator:{id:u.id,name:u.displayName,handle:u.profileHandle,initials:"MC",bio:"Synthetic local creator for profile navigation review.",verified:false,followers:2,following:1,stars:0,avatarUrl:"",creatorDetails:{}},communityTemplates:templates.filter(t=>t.authorId===u.id&&t.status==="published"&&t.sourceFormat!=="design_template")}):json(res,{error:"Creator not found in local fixture."},404);
  }
  if(/^\/api\/admin\/(?:reports|withdrawals|stars\/ledger|star-packs|ai-jobs|support\/tickets|feature-flags|audit-logs)$/.test(route))return json(res,{reports:[],withdrawals:[],transactions:[],packs:[],jobs:[],tickets:[],flags:[],logs:activity});
  if(["/api/template-metrics","/api/template-reactions","/api/community-templates"].includes(route))return json(res,{metrics:{},reactions:{},templates:[]});
  return json(res,{error:"This read is outside the synthetic Admin review fixture."},404);
});
app.get("/",(_req,res)=>res.sendFile(path.join(publicRoot,"index.html")));
app.use(express.static(publicRoot,{dotfiles:"deny",extensions:["html"],etag:false,maxAge:0}));
app.use((_req,res)=>res.status(404).end("Local Admin review fixture: not found"));
if(require.main===module){
  const server=app.listen(port,"127.0.0.1",()=>console.log("LOCAL SYNTHETIC ADMIN REVIEW: http://127.0.0.1:"+port+"/admin — "+boundary));
  process.once("SIGTERM",()=>server.close());process.once("SIGINT",()=>server.close());
}
module.exports={app,templates,users,skills,activity,boundary};
