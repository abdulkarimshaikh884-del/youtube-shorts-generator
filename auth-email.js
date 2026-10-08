"use strict";
const crypto = require("crypto");
const db = require("./db");
const events = require("./email-events");
const COOKIE = "sc_device";
function browserLabel(agent) {
  const ua = String(agent || "").slice(0, 500);
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown device";
  return browser + " on " + os;
}
async function rememberBrowser(req,res,user,{baseline=false}={}) {
  if (!events.enabled() || !user?.id) return;
  try {
    let token = String(req.headers.cookie || "").split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || "")) token = crypto.randomBytes(32).toString("base64url");
    const deviceHash = crypto.createHash("sha256").update(token).digest("hex");
    const browser = browserLabel(req.headers["user-agent"]);
    await db.tx(async client=>{
      const inserted=await client.query(`insert into public.account_devices(user_id,device_hash,browser_label)
        values($1,$2,$3) on conflict(user_id,device_hash) do nothing returning user_id`,[user.id,deviceHash,browser]);
      await client.query("update public.account_devices set last_seen_at=now() where user_id=$1 and device_hash=$2",[user.id,deviceHash]);
      if (inserted.rows.length && !baseline) await events.enqueueSafe({userId:user.id,kind:"new_device",eventKey:deviceHash,data:{browser,time:new Date().toISOString()}},client);
    });
    res.append("Set-Cookie",`${COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${process.env.NODE_ENV==='production'?'; Secure':''}`);
    events.schedule();
  } catch(err) {
    // A device-alert outage must never undo a valid login. No credentials/UA logged.
    console.warn("[auth-email] browser tracking unavailable");
  }
}
module.exports={rememberBrowser,browserLabel};
