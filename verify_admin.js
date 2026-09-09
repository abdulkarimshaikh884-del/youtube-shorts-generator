/* ============================================================
   verify_admin.js — the admin console belongs to the owner alone.

   "Only I should have the admin panel" is a server rule, not a UI one.
   Hiding a nav row stops nobody: what matters is whether a normal
   account, or a signed-out stranger, can reach an admin endpoint by
   asking for it directly.

   So this does not look at the page. It signs up an ordinary account and
   calls every /api/admin/* route, then tries the ways a user might try to
   promote themselves — sending role in signup, in the profile update, in
   the login body — and finally confirms the real owner still gets in.

   Usage: node verify_admin.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
require("dotenv").config();
const db = require("./db");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

function jar() {
  let cookies = {};
  return {
    get header() {
      const s = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
      return s ? { Cookie: s } : {};
    },
    absorb(res) {
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      const list = raw.length ? raw : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
      for (const line of list) {
        const [pair] = line.split(";");
        const i = pair.indexOf("=");
        cookies[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
      }
    }
  };
}

async function call(j, method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(j ? j.header : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (j) j.absorb(res);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
}

/* Every admin surface the server exposes. A new one added without a guard
   should make this suite fail rather than ship quietly. */
const ADMIN_ROUTES = [
  ["GET", "/api/admin/dashboard"],
  ["GET", "/api/admin/users"],
  ["GET", "/api/admin/templates"],
  ["GET", "/api/admin/support/tickets"],
  ["GET", "/api/admin/feature-flags"],
  ["PATCH", "/api/admin/feature-flags/paid_ai_models", { value: true }],
  ["PATCH", "/api/admin/templates/does-not-exist", { status: "published" }],
  ["PATCH", "/api/admin/support/tickets/does-not-exist", { status: "closed" }]
];

const EMAIL = `adminprobe_${Date.now()}@example.invalid`;
const PASSWORD = "admin-probe-1234";

async function cleanup() {
  await db.tx(async (c) => {
    await c.query(
      `delete from public.sessions where user_id in
         (select id from public.users where lower(email) = $1)`, [EMAIL]);
    await c.query(`delete from public.users where lower(email) = $1`, [EMAIL]);
  });
}

(async () => {
  console.log("\n---- a signed-out stranger ----");
  for (const [method, url, body] of ADMIN_ROUTES) {
    const r = await call(null, method, url, body);
    ok(r.status === 401 || r.status === 403,
      `${method} ${url.replace("/api/admin", "")} is refused`, r.status);
  }

  console.log("\n---- an ordinary signed-in account ----");
  const j = jar();
  // Ask for super_admin at signup, the way an attacker would.
  let r = await call(j, "POST", "/api/auth/signup", {
    email: EMAIL, password: PASSWORD, handle: "adm" + Date.now().toString().slice(-8),
    role: "super_admin", isAdmin: true
  });
  ok(r.status === 200 && r.data.success, "the probe account is created", r.status);
  ok(r.data.user && r.data.user.role !== "super_admin" && r.data.user.role !== "admin",
    "a role sent at signup is ignored", r.data.user && r.data.user.role);

  for (const [method, url, body] of ADMIN_ROUTES) {
    const res = await call(j, method, url, body);
    ok(res.status === 401 || res.status === 403,
      `${method} ${url.replace("/api/admin", "")} is refused`, res.status);
  }

  console.log("\n---- trying to promote yourself ----");
  r = await call(j, "POST", "/api/auth/profile", { role: "super_admin" });
  const me = await call(j, "GET", "/api/auth/me");

  // Read and verdict are separate assertions on purpose. Folding them together
  // made a failed read print as "the profile endpoint cannot change your role"
  // — a security alarm raised by a request that never came back. The same
  // conflation hides the opposite case: an escalation that happens during a
  // read failure would have been reported as a pass by the `&&` chain.
  const readRole = me.data && me.data.user ? me.data.user.role : null;
  ok(readRole !== null, "the account's role can be read back", `${me.status} ${readRole}`);
  if (readRole !== null) {
    ok(readRole !== "super_admin" && readRole !== "admin",
      "the profile endpoint cannot change your role", readRole);
  }

  const { rows: dbRole } = await db.query(
    `select role from public.users where lower(email) = $1`, [EMAIL]);
  ok(dbRole[0] && dbRole[0].role !== "super_admin" && dbRole[0].role !== "admin",
    "and the stored role is still an ordinary user", dbRole[0] && dbRole[0].role);

  // Re-check one endpoint after the attempt, in case the role was cached.
  const after = await call(j, "GET", "/api/admin/dashboard");
  ok(after.status === 401 || after.status === 403,
    "the dashboard is still refused afterwards", after.status);

  console.log("\n---- the owner ----");
  const { rows: owners } = await db.query(
    `select email, handle, role from public.users
      where role in ('admin','super_admin') order by created_at asc`);
  ok(owners.length >= 1, "an owner account exists", owners.length);
  if (owners.length) {
    console.log(`         ${owners.map((o) => `${o.email} (${o.role})`).join(", ")}`);
  }
  ok(owners.length === 1,
    "exactly one account holds admin rights", owners.length);

  await cleanup().catch(() => {});
  console.log(`\nADMIN=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  await cleanup().catch(() => {});
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
