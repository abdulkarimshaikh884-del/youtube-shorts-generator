"use strict";
// Authorization-code flow: credentials and Google access tokens stay server-side.
const crypto = require("node:crypto");
const COOKIE = "sc_google_flow";
const sign = (value, secret) => crypto.createHmac("sha256", secret).update("google-flow:" + value).digest("base64url");
function safeNext(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return "/";
  const url = new URL(value, "https://shortscraft.invalid");
  return url.origin === "https://shortscraft.invalid" ? url.pathname + url.search + url.hash : "/";
}
function pack(data, secret) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return body + "." + sign(body, secret);
}
function unpack(value, secret) {
  try {
    const [body, signature] = String(value).split(".");
    const expected = sign(body, secret);
    if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(body, "base64url"));
    return data.expires > Date.now() ? data : null;
  } catch { return null; }
}
function register(app, { auth, rateLimit, publicSiteUrl, fetchImpl = fetch }) {
  const config = () => ({ id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET });
  const configured = () => Boolean(config().id && config().secret);
  const cookie = (res, value, age) => res.append("Set-Cookie", `${COOKIE}=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  app.get("/api/auth/google/config", (req, res) => res.set("Cache-Control", "no-store").json({ enabled: configured() }));
  app.get("/api/auth/google", rateLimit({ windowMs: 600_000, max: 20 }), (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!configured()) return res.redirect("/login?google_error=unavailable");
    const state = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const flow = { state, verifier, expires: Date.now() + 600_000, next: safeNext(req.query.next), userId: req.user?.id || null };
    cookie(res, pack(flow, config().secret), 600);
    const params = new URLSearchParams({ client_id: config().id, redirect_uri: publicSiteUrl() + "/api/auth/google/callback", response_type: "code", scope: "openid email profile", state, prompt: "select_account", code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
    return res.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params);
  });
  app.get("/api/auth/google/callback", rateLimit({ windowMs: 600_000, max: 30 }), async (req, res) => {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const raw = (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(COOKIE + "="));
    cookie(res, "", 0);
    const fail = (reason) => res.redirect("/login?google_error=" + reason);
    if (!configured()) return fail("unavailable");
    const flow = unpack(raw?.slice(COOKIE.length + 1), config().secret);
    if (!flow || typeof req.query.state !== "string" || req.query.state !== flow.state || (req.user?.id || null) !== flow.userId) return fail("expired");
    if (req.query.error) return fail("cancelled");
    if (typeof req.query.code !== "string" || req.query.code.length > 4096) return fail("failed");
    try {
      const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: req.query.code, client_id: config().id, client_secret: config().secret, redirect_uri: publicSiteUrl() + "/api/auth/google/callback", grant_type: "authorization_code", code_verifier: flow.verifier }), signal: AbortSignal.timeout(15_000) });
      if (!tokenRes.ok) return fail("failed");
      const token = await tokenRes.json();
      if (typeof token.access_token !== "string") return fail("failed");
      const infoRes = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + token.access_token }, signal: AbortSignal.timeout(15_000) });
      if (!infoRes.ok) return fail("failed");
      const info = await infoRes.json();
      const out = await auth.googleAccount(res, info, flow.userId);
      if (out.error) return fail(out.error);
      return res.redirect(safeNext(flow.next));
    } catch {
      // Never log authorization codes, access tokens or provider responses.
      console.error("[google-auth] Sign-in failed; check OAuth configuration and database migration.");
      return fail("failed");
    }
  });
}
module.exports = { register, safeNext, pack, unpack };
