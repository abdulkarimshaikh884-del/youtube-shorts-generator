"use strict";
// Reproducible, offline previews. No real tokens, users or provider calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {pathToFileURL} = require("node:url");
const puppeteer = require("puppeteer");
process.env.PUBLIC_SITE_URL = "https://shortscraft.online";
process.env.AUTH_FROM_EMAIL = "ShortsCraft <noreply@mail.shortscraft.online>";
const mailer = require("../mailer");
const samples = [
  ["Password reset", "Live reset flow", mailer.passwordResetPayload({to:"preview@example.test",resetUrl:"https://shortscraft.online/reset-password?token=PREVIEW-NOT-A-REAL-TOKEN"})],
  ["Email verification", "Referral activation pending", mailer.verificationPayload({to:"preview@example.test",verificationUrl:"https://shortscraft.online/verify-email?token=PREVIEW-NOT-A-REAL-TOKEN"})],
  ...[
    ["welcome", "Signup welcome", "Account email", {displayName:"Karim"}],
    ["new_device", "New browser login", "Security email", {browser:"Chrome on Android",time:"8 October 2026, 20:30 IST"}],
    ["password_changed", "Password changed", "Security email", {}],
    ["google_linked", "Google connected", "Security email", {}],
    ["referral_reward", "10-credit referral reward", "Referral activation pending", {credits:10}],
    ["support_reply", "Support reply", "Account email", {reference:"PREVIEW-TICKET"}],
    ["template_status", "Creation status", "Account email", {status:"published",title:"My first thumbnail"}],
    ["purchase_receipt", "Purchase confirmation", "Future only · payments disabled", {amountPaise:4900,reference:"PREVIEW-PURCHASE",product:"Credit pack"}],
    ["withdrawal_requested", "Withdrawal requested", "Future only · withdrawals disabled", {amountPaise:50000,reference:"PREVIEW-WITHDRAWAL"}],
    ["withdrawal_processed", "Withdrawal processed", "Future only · withdrawals disabled", {amountPaise:50000,reference:"PREVIEW-WITHDRAWAL"}],
    ["withdrawal_rejected", "Withdrawal not approved", "Future only · withdrawals disabled", {reference:"PREVIEW-WITHDRAWAL"}],
  ].map(([kind,title,status,data])=>[title,status,mailer.transactionalPayload({to:"preview@example.test",kind,data})])
];
const escape = s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const directory=path.resolve(__dirname,"../shots/email-templates");
fs.mkdirSync(directory,{recursive:true});
const logo="data:image/png;base64,"+fs.readFileSync(path.resolve(__dirname,"../public/favicon-192.png")).toString("base64");
const localHtml = payload=>payload.html.replace("https://shortscraft.online/favicon-192.png",logo);
for (const [, ,payload] of samples) {
  assert(payload.html.includes('alt="ShortsCraft logo"'));
  assert(payload.html.includes("https://shortscraft.online/favicon-192.png"));
  assert(payload.text && payload.subject);
  assert(!payload.html.includes("<script"));
}
const hostile=mailer.transactionalPayload({to:"preview@example.test",kind:"welcome",data:{displayName:'<script>alert(1)</script>'}});
assert(hostile.html.includes("&lt;script&gt;"));
const gallery='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ShortsCraft — all email previews</title><style>body{margin:0;background:#eeeeF4;color:#161620;font:15px Arial,sans-serif}header{padding:24px;max-width:1200px;margin:auto}h1{margin:0 0 12px}p{line-height:1.6}button{padding:10px 16px;border-radius:8px;border:1px solid #bbb;cursor:pointer}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:24px;max-width:1200px;padding:0 16px 24px;margin:auto}article{border:1px solid #ddd;border-radius:12px;background:white;overflow:hidden}h2{font-size:18px;margin:16px}small{display:block;margin:0 16px 16px;color:#665588}iframe{display:block;width:100%;height:660px;border:0;background:#07070b;margin:auto}body.mobile iframe{max-width:360px}body.mobile article{background:#dadae6}</style><header><h1>ShortsCraft email previews · 13 templates</h1><p>These are the actual server templates with sample details. Preview links are disabled, no email is sent. The logo is embedded locally for offline preview; sent emails use the public HTTPS image. Payment/withdrawal and referral previews do not enable those features.</p><button onclick="document.body.classList.toggle(\'mobile\')">Switch mobile / desktop width</button></header><main>'+samples.map(([title,status,payload])=>'<article><h2>'+escape(title)+'</h2><small>'+escape(status)+' · Subject: '+escape(payload.subject)+'</small><iframe title="'+escape(title)+'" sandbox srcdoc="'+escape(localHtml(payload))+'"></iframe></article>').join('')+'</main></html>';
const galleryPath=path.join(directory,"index.html");
fs.writeFileSync(galleryPath,gallery);
(async()=>{
  const browser=await puppeteer.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request",request=>/^(data:|file:|about:)/.test(request.url())?request.continue():request.abort());
    let count=0;
    for(const width of [320,390,640]){
      await page.setViewport({width,height:760});
      for(const [title,,payload] of samples){
        await page.setContent(localHtml(payload));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),title+" overflow at "+width);
        assert(await page.$eval("img",img=>img.complete&&img.naturalWidth>0),title+" missing logo");
        count++;
      }
    }
    await page.setViewport({width:640,height:660});
    await page.setContent(localHtml(samples[0][2]));
    await page.screenshot({path:path.join(directory,"password-reset-desktop.png")});
    await page.setViewport({width:390,height:760});
    await page.setContent(localHtml(samples[2][2]));
    await page.screenshot({path:path.join(directory,"welcome-mobile.png")});
    await page.setViewport({width:1260,height:960});
    await page.goto(pathToFileURL(galleryPath).href);
    await page.screenshot({path:path.join(directory,"gallery.png")});
    console.log(`PASS ${samples.length} actual templates, ${count} responsive renders, logo and HTML escaping. Preview: ${galleryPath}`);
  } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
