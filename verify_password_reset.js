/* ============================================================
   verify_password_reset.js
   End-to-end contract for secure account recovery.

   Development deliberately returns a one-time reset URL so this suite can
   exercise the complete flow without an email provider. Production never
   exposes that URL and requires Resend configuration instead.
   ============================================================ */
require("dotenv").config();
const crypto = require("crypto");
const db = require("./db");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const email = `reset-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}@example.com`;
const oldPassword = "original-password-42";
const newPassword = "renewed-password-84";
let failures = 0;

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra === undefined ? "" : `  (${extra})`}`);
}

function jar() {
  const cookies = {};
  return {
    get header() {
      const value = Object.entries(cookies).map(([key, val]) => `${key}=${val}`).join("; ");
      return value ? { Cookie: value } : {};
    },
    absorb(response) {
      const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      const lines = raw.length ? raw : (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")] : []);
      for (const line of lines) {
        const [pair] = line.split(";");
        const index = pair.indexOf("=");
        const key = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value) cookies[key] = value; else delete cookies[key];
      }
    },
    get(key) { return cookies[key]; }
  };
}

async function api(cookieJar, route, body) {
  const response = await fetch(BASE + route, {
    method: body === undefined ? "GET" : "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...cookieJar.header },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  cookieJar.absorb(response);
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

function tokenFrom(data) {
  try { return new URL(data.devResetUrl).searchParams.get("token") || ""; }
  catch (e) { return ""; }
}

async function cleanup() {
  await db.tx(async (client) => {
    await client.query(
      `delete from public.sessions
        where user_id in (select id from public.users where lower(email) = $1)`,
      [email]
    );
    await client.query(
      `delete from public.password_reset_tokens
        where user_id in (select id from public.users where lower(email) = $1)`,
      [email]
    );
    await client.query(`delete from public.users where lower(email) = $1`, [email]);
  });
}

(async () => {
  const original = jar();
  const resetJar = jar();
  const anonymous = jar();

  console.log("\n---- recovery pages ----");
  const loginHtml = await (await fetch(BASE + "/login")).text();
  const forgotHtml = await (await fetch(BASE + "/forgot-password")).text();
  const resetHtml = await (await fetch(BASE + "/reset-password?token=invalid")).text();
  ok(/href="\/forgot-password"/.test(loginHtml), "login exposes Forgot password");
  ok((forgotHtml.match(/<h1\b/g) || []).length === 1 && /id="forgotForm"/.test(forgotHtml),
    "forgot-password page has one clear form");
  ok((resetHtml.match(/<h1\b/g) || []).length === 1 && /id="resetForm"/.test(resetHtml),
    "reset-password page has one clear form");

  console.log("\n---- issue a reset link ----");
  let response = await api(original, "/api/auth/signup", { email, password: oldPassword });
  ok(response.status === 200 && response.data.success, "temporary account created", response.status);
  const oldSession = original.get("sc_sid");
  ok(Boolean(oldSession), "original session exists");

  response = await api(anonymous, "/api/auth/forgot", { email });
  const firstMessage = response.data && response.data.message;
  const firstToken = tokenFrom(response.data || {});
  ok(response.status === 200 && response.data.success, "forgot request is accepted", response.status);
  ok(/^[A-Za-z0-9_-]{40,64}$/.test(firstToken), "development returns a test-only reset link");

  const unknown = await api(jar(), "/api/auth/forgot", { email: `missing-${email}` });
  ok(unknown.status === 200 && unknown.data.message === firstMessage,
    "unknown emails receive the same public response", unknown.status);
  ok(!unknown.data.devResetUrl, "unknown emails do not receive a reset URL");

  const firstHash = crypto.createHash("sha256").update(firstToken).digest("hex");
  const stored = await db.query(
    `select token_hash, expires_at, used_at
       from public.password_reset_tokens r
       join public.users u on u.id = r.user_id
      where lower(u.email) = $1`,
    [email]
  );
  ok(stored.rows.length === 1 && stored.rows[0].token_hash === firstHash,
    "only the SHA-256 reset-token hash is stored", stored.rows.length);
  ok(!JSON.stringify(stored.rows).includes(firstToken), "raw reset token is absent from the database");
  const minutesLeft = stored.rows[0] ? (new Date(stored.rows[0].expires_at).getTime() - Date.now()) / 60000 : 0;
  ok(minutesLeft > 28 && minutesLeft <= 30.2, "reset link expires after about 30 minutes", minutesLeft.toFixed(1));

  console.log("\n---- replace and consume the link ----");
  response = await api(anonymous, "/api/auth/forgot", { email });
  const secondToken = tokenFrom(response.data || {});
  ok(secondToken && secondToken !== firstToken, "a newer request creates a fresh token");

  const concurrent = await Promise.all([
    api(jar(), "/api/auth/forgot", { email }),
    api(jar(), "/api/auth/forgot", { email })
  ]);
  const concurrentTokens = concurrent.map((item) => tokenFrom(item.data || {}));
  const currentRows = await db.query(
    `select token_hash from public.password_reset_tokens r
      join public.users u on u.id = r.user_id
     where lower(u.email) = $1`,
    [email]
  );
  const activeToken = concurrentTokens.find((token) =>
    crypto.createHash("sha256").update(token).digest("hex") === (currentRows.rows[0] || {}).token_hash
  );
  ok(concurrent.every((item) => item.status === 200) && currentRows.rows.length === 1 && Boolean(activeToken),
    "simultaneous requests leave exactly one active token", currentRows.rows.length);

  response = await api(resetJar, "/api/auth/reset", { token: firstToken, password: newPassword });
  ok(response.status === 400, "the older reset link is invalidated", response.status);
  response = await api(resetJar, "/api/auth/reset", { token: secondToken, password: newPassword });
  ok(response.status === 400, "a concurrent request also invalidates the previous link", response.status);
  response = await api(resetJar, "/api/auth/reset", { token: activeToken, password: "short" });
  ok(response.status === 400 && /8 characters/i.test(response.data.error || ""),
    "a short new password is rejected", response.status);
  response = await api(resetJar, "/api/auth/reset", { token: activeToken, password: newPassword });
  ok(response.status === 200 && response.data.success, "the fresh link resets the password", response.status);
  ok(Boolean(resetJar.get("sc_sid")), "reset signs the user into a fresh session");

  response = await api(jar(), "/api/auth/reset", { token: activeToken, password: newPassword });
  ok(response.status === 400, "the reset link is single-use", response.status);

  console.log("\n---- session and password security ----");
  const stale = await fetch(BASE + "/api/auth/me", { headers: { Cookie: `sc_sid=${oldSession}` } });
  const staleData = await stale.json();
  ok(staleData.user === null, "all pre-reset sessions are revoked");
  response = await api(jar(), "/api/auth/login", { email, password: oldPassword });
  ok(response.status === 401, "the old password no longer works", response.status);
  response = await api(jar(), "/api/auth/login", { email, password: newPassword });
  ok(response.status === 200 && response.data.success, "the new password works", response.status);

  const remaining = await db.query(
    `select count(*)::int as count
       from public.password_reset_tokens r
       join public.users u on u.id = r.user_id
      where lower(u.email) = $1`,
    [email]
  );
  ok(remaining.rows[0].count === 0, "consumed reset tokens are removed", remaining.rows[0].count);

  await cleanup();
  ok(true, "temporary reset account is removed");
  console.log(`\nAUTH_RESET=${failures === 0 ? "PASS" : `FAIL (${failures} failing)`}`);
  await db.getPool().end();
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (error) => {
  console.error("HARNESS FAIL:", error.stack || error.message);
  try { await cleanup(); } catch (cleanupError) { console.error("CLEANUP FAIL:", cleanupError.message); }
  try { await db.getPool().end(); } catch (e) {}
  process.exit(1);
});
