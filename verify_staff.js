/* ============================================================
   verify_staff.js — limited admins get exactly what they were given.

   The owner can appoint an admin and tick what that person may do. This
   checks the server side of that promise over real HTTP:

   - a staff member reaches only the admin routes their permissions name,
     and never the owner's powers (appointing staff, feature flags);
   - they cannot appoint anyone, including themselves, or talk their way
     up through the profile endpoint;
   - account emails stay hidden from them;
   - the owner's appoint and remove path changes the role, writes the audit
     log and tells the person, and refuses to touch the owner's own row;
   - new feedback lands in the bell of whoever answers support.

   Fixture accounts, tickets, notifications and audit rows made by this run
   are removed at the end.

   Usage: node verify_staff.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
require("dotenv").config();
const crypto = require("node:crypto");
const auth = require("./auth");
const db = require("./db");
const admin = require("./admin");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;
const users = [];
const tickets = [];

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

async function fixture(label) {
  const suffix = crypto.randomBytes(6).toString("hex");
  const headers = {};
  const res = { getHeader: (k) => headers[k.toLowerCase()], setHeader: (k, v) => { headers[k.toLowerCase()] = v; } };
  const out = await auth.signUp(res, `staff-${suffix}@example.invalid`, "Staff-test-password-23", `stf_${suffix}`);
  if (!out.user) throw new Error(out.error || "signup failed");
  const user = { ...out.user, label, cookie: String(headers["set-cookie"]).split(";")[0] };
  users.push(user);
  return user;
}

async function call(user, method, route, body) {
  const r = await fetch(BASE + route, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Cookie: user.cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000)
  });
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  return { status: r.status, data };
}

const refused = (s) => s === 401 || s === 403;

(async () => {
  try {
    const staff = await fixture("staff");
    const member = await fixture("member");

    console.log("\n---- an admin with one permission: support ----");
    await db.query(
      "update public.users set role = 'moderator', staff_permissions = '{support.reply}' where id = $1",
      [staff.id]
    );
    const me = await call(staff, "GET", "/api/auth/me");
    ok(JSON.stringify(me.data.user.permissions) === JSON.stringify(["support.reply"]),
      "their session reports exactly the permission they hold", JSON.stringify(me.data.user.permissions));
    ok((await call(staff, "GET", "/api/admin/support/tickets")).status === 200, "support queue opens");
    for (const [method, route, body] of [
      ["GET", "/api/admin/dashboard"],
      ["GET", "/api/admin/users"],
      ["GET", "/api/admin/templates"],
      ["PATCH", "/api/admin/templates/does-not-exist", { status: "published" }],
      ["GET", "/api/admin/skills"],
      ["GET", "/api/admin/feature-flags"],
      ["PATCH", "/api/admin/feature-flags/paid_ai_models", { enabled: true }],
      ["GET", "/api/admin/staff"]
    ]) {
      const r = await call(staff, method, route, body);
      ok(refused(r.status), `${method} ${route.replace("/api/admin", "")} is refused`, r.status);
    }

    console.log("\n---- they cannot hand out access ----");
    let r = await call(staff, "PATCH", `/api/admin/users/${member.id}/staff`, { permissions: ["users.view"] });
    ok(refused(r.status), "cannot appoint another account", r.status);
    r = await call(staff, "PATCH", `/api/admin/users/${staff.id}/staff`, { permissions: ["overview.view", "users.view", "templates.moderate"] });
    ok(refused(r.status), "cannot widen their own access", r.status);
    await call(staff, "POST", "/api/auth/profile", { role: "super_admin", permissions: ["users.view"], staff_permissions: ["users.view"] });
    const after = await db.query("select role, staff_permissions from public.users where id = $1", [staff.id]);
    ok(after.rows[0].role === "moderator" && after.rows[0].staff_permissions.join() === "support.reply",
      "the profile endpoint changes neither role nor permissions", `${after.rows[0].role} ${after.rows[0].staff_permissions}`);
    r = await call(member, "PATCH", `/api/admin/users/${member.id}/staff`, { permissions: ["support.reply"] });
    ok(refused(r.status), "an ordinary account cannot appoint itself", r.status);

    console.log("\n---- users.view shows accounts but not emails ----");
    await db.query("update public.users set staff_permissions = '{support.reply,users.view}' where id = $1", [staff.id]);
    r = await call(staff, "GET", "/api/admin/users");
    ok(r.status === 200, "the account list opens once granted", r.status);
    ok(r.data && r.data.users.length > 0 && r.data.users.every((u) => u.email === ""), "every email is blank for staff");
    ok(r.data && r.data.canManageStaff === false, "the list does not offer access management to staff");

    console.log("\n---- new feedback reaches whoever answers support ----");
    const made = await call(null, "POST", "/api/feedback", {
      name: "Staff QA", email: `guest-${Date.now()}@example.invalid`, subject: "Staff notification check",
      message: "This is a test message from verify_staff.js."
    });
    ok(made.status === 201, "a signed-out visitor can send feedback", made.status);
    if (made.data && made.data.ticket) {
      tickets.push(made.data.ticket.id);
      const bell = await call(staff, "GET", "/api/notifications");
      ok(bell.data.notifications.some((n) => n.entityId === made.data.ticket.id && n.entityType === "support_ticket"),
        "the support admin gets a notification for it");
      const memberBell = await call(member, "GET", "/api/notifications");
      ok(!memberBell.data.notifications.some((n) => n.entityId === made.data.ticket.id),
        "an ordinary account does not");
    }

    console.log("\n---- removing every permission removes access ----");
    await db.query("update public.users set staff_permissions = '{}' where id = $1", [staff.id]);
    ok(refused((await call(staff, "GET", "/api/admin/support/tickets")).status), "support queue is refused again");
    const gone = await call(staff, "GET", "/api/auth/me");
    ok(Array.isArray(gone.data.user.permissions) && gone.data.user.permissions.length === 0, "their session reports no permissions");

    console.log("\n---- the owner's appoint and remove path ----");
    // The owner's powers are checked on the role in the user object. A
    // stand-in owner object keeps the real owner account untouched; the
    // database role of this fixture stays 'user' throughout.
    const standIn = { id: member.id, role: "super_admin" };
    let out = await admin.setStaff(standIn, staff.id, { permissions: ["tutorials.moderate", "bogus.power", "tutorials.moderate"] });
    ok(out.success && out.user.role === "moderator" && out.user.permissions.join() === "tutorials.moderate",
      "appointing stores the role and only known permissions, once", out.user && `${out.user.role} ${out.user.permissions}`);
    const audit = await db.query(
      "select count(*)::int as n from public.admin_audit_log where action = 'staff_update' and entity_id = $1", [staff.id]);
    ok(audit.rows[0].n >= 1, "the change is in the audit log", audit.rows[0].n);
    const told = await db.query(
      "select message from public.notifications where user_id = $1 and entity_type = 'admin' order by created_at desc limit 1", [staff.id]);
    ok(told.rows[0] && /admin access/i.test(told.rows[0].message), "the new admin is told", told.rows[0] && told.rows[0].message);
    ok((await call(staff, "GET", "/api/admin/skills")).status === 200, "and can use what was granted");
    ok(refused((await call(staff, "GET", "/api/admin/support/tickets")).status), "but not what was not");

    out = await admin.setStaff(standIn, staff.id, { permissions: [] });
    const demoted = await db.query("select role, staff_permissions from public.users where id = $1", [staff.id]);
    ok(out.success && demoted.rows[0].role === "user" && demoted.rows[0].staff_permissions.length === 0,
      "removing access returns them to an ordinary account", demoted.rows[0].role);

    const { rows: owners } = await db.query("select id from public.users where role = 'super_admin' limit 1");
    if (owners[0]) {
      out = await admin.setStaff(standIn, owners[0].id, { permissions: ["support.reply"] });
      ok(out.error && out.status === 400, "the owner's own row cannot be changed", out.error);
      const still = await db.query("select role from public.users where id = $1", [owners[0].id]);
      ok(still.rows[0].role === "super_admin", "and the owner is still the owner");
    }
    out = await admin.setStaff(standIn, member.id, { permissions: ["support.reply"] });
    ok(out.error && out.status === 400, "nobody changes their own access", out.error);
    out = await admin.setStaff({ id: staff.id, role: "moderator", staff_permissions: ["users.view"] }, member.id, { permissions: ["users.view"] });
    ok(out.error && out.status === 403, "a non-owner is refused inside the function too", out.status);
  } catch (err) {
    failures++;
    console.error("HARNESS FAIL:", err.stack || err.message);
  } finally {
    const ids = users.map((u) => u.id);
    await db.tx(async (c) => {
      if (tickets.length) {
        await c.query("delete from public.notifications where entity_type = 'support_ticket' and entity_id = any($1::text[])", [tickets]);
        await c.query("delete from public.admin_audit_log where entity_type = 'support_ticket' and entity_id = any($1::text[])", [tickets]);
        await c.query("delete from public.support_tickets where id = any($1::uuid[])", [tickets]);
      }
      if (ids.length) {
        await c.query("delete from public.admin_audit_log where action = 'staff_update' and entity_id = any($1::text[])", [ids]);
        await c.query("delete from public.notifications where user_id = any($1::uuid[])", [ids]);
        await c.query("delete from public.sessions where user_id = any($1::uuid[])", [ids]);
        await c.query("delete from public.users where id = any($1::uuid[])", [ids]);
      }
    }).catch((e) => console.error("cleanup failed:", e.message));
    await db.getPool().end().catch(() => {});
    console.log(`\nSTAFF=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
    process.exit(failures === 0 ? 0 : 1);
  }
})();
