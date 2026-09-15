/* ============================================================
   verify_notifications.js — notifications that reach people.

   - Real events create them: a welcome, a moderation outcome for a
     template and for a tutorial, a reply to a comment, a device test.
   - Test accounts (.invalid) are never announced to the owner.
   - Every notification carries the link it opens.
   - The bell's live endpoint reports the unread count and newest item.
   - Device subscriptions: login required, only real push services are
     accepted (no server-side request forgery), removable.
   - Delivery sends each new notification once to the person's devices,
     with the right title, text and link, and drops subscriptions the push
     service reports gone. The push service itself is stubbed.

   Fixtures made by this run are removed at the end.

   Usage: node verify_notifications.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
require("dotenv").config();
const crypto = require("node:crypto");
const auth = require("./auth");
const db = require("./db");
const notify = require("./notify");
const admin = require("./admin");
const skills = require("./skills");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;
const users = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

async function fixture(label) {
  const suffix = crypto.randomBytes(6).toString("hex");
  const headers = {};
  const res = { getHeader: (k) => headers[k.toLowerCase()], setHeader: (k, v) => { headers[k.toLowerCase()] = v; } };
  const out = await auth.signUp(res, `notify-${suffix}@example.invalid`, "Notify-test-password-23", `ntf_${suffix}`);
  if (!out.user) throw new Error(out.error || "signup failed");
  const user = { ...out.user, label, cookie: String(headers["set-cookie"]).split(";")[0] };
  users.push(user);
  return user;
}

async function call(user, method, route, body) {
  const r = await fetch(BASE + route, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE, ...(user ? { Cookie: user.cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000)
  });
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  return { status: r.status, data, headers: r.headers };
}

const bell = (userId, extra = "") => db.query(
  `select * from public.notifications where user_id = $1 ${extra} order by created_at desc`, [userId]
).then((r) => r.rows);

// A plausible browser subscription: a P-256 public point and a 16-byte secret.
function fakeKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") };
}

(async () => {
  const author = await fixture("author");
  const replier = await fixture("replier");
  let signupId = null;
  try {
    console.log("\n---- a new account ----");
    const email = `notify-signup-${crypto.randomBytes(5).toString("hex")}@example.invalid`;
    const signup = await call(null, "POST", "/api/auth/signup", { email, password: "Notify-test-password-23", handle: "nts" + Date.now().toString().slice(-8) });
    ok(signup.status === 200 && signup.data.user, "signup succeeds", signup.status);
    if (signup.data && signup.data.user) {
      signupId = signup.data.user.id;
      users.push({ id: signupId });
      await wait(800);
      const mine = await bell(signupId);
      ok(mine.some((n) => n.entity_type === "welcome"), "the new account gets a welcome");
      const told = await db.query(`select count(*)::int as n from public.notifications where entity_type = 'new_user' and entity_id = $1`, [signupId]);
      ok(told.rows[0].n === 0, "a test account is not announced to the owner", told.rows[0].n);
    }

    console.log("\n---- a moderation outcome reaches the creator ----");
    const made = await call(author, "POST", "/api/community-templates", {
      title: "Notify check template", category: "text", tpl: "text-cascade", lines: ["A", "B", ""], visibility: "private", aspect: "9:16", dur: 4600
    });
    const tplId = made.data && made.data.template && made.data.template.id;
    ok(made.status === 200 && tplId, "a private template is saved", made.status);
    const stand = { id: replier.id, role: "super_admin" };
    if (tplId) {
      const alerted = await db.query(`select count(*)::int as n from public.notifications where entity_type = 'template_review' and entity_id = $1`, [tplId]);
      ok(alerted.rows[0].n === 0, "a private draft alerts nobody", alerted.rows[0].n);
      await admin.updateContent(stand, tplId, { status: "rejected", reviewNote: "Text runs off the frame" });
      const outcome = (await bell(author.id)).find((n) => n.type === "template_status" && n.entity_id === tplId);
      ok(outcome && /not approved: Text runs off the frame/.test(outcome.message), "the creator is told it was not approved, with the note", outcome && outcome.message);
      ok(outcome && notify.urlFor(outcome) === "/account", "and it opens their creations", outcome && notify.urlFor(outcome));
      await admin.updateContent(stand, tplId, { status: "rejected", reviewNote: "again" });
      const twice = (await bell(author.id)).filter((n) => n.type === "template_status" && n.entity_id === tplId);
      ok(twice.length === 1, "saving the same status again does not repeat it", twice.length);
    }

    console.log("\n---- a tutorial taken down ----");
    const videoKey = crypto.randomBytes(8).toString("base64url").replace(/[^A-Za-z0-9]/g, "a").slice(0, 11).padEnd(11, "x");
    const shared = await call(author, "POST", "/api/skills", { title: "Notify check tutorial", url: `https://youtu.be/${videoKey}` });
    const skillId = shared.data && shared.data.skill && shared.data.skill.id;
    ok(shared.status === 200 && skillId, "a tutorial is shared", shared.status);
    if (skillId) {
      const alerted = await db.query(`select count(*)::int as n from public.notifications where entity_type = 'tutorial_review' and entity_id = $1`, [skillId]);
      ok(alerted.rows[0].n === 0, "a test account's tutorial is not announced to the owner", alerted.rows[0].n);
      await skills.review(stand, skillId, "rejected", "Not your video");
      const down = (await bell(author.id)).find((n) => n.entity_type === "tutorial" && n.entity_id === skillId);
      ok(down && /taken down: Not your video/.test(down.message), "the author is told it came down, and why", down && down.message);
    }

    console.log("\n---- a reply to a comment ----");
    const first = await call(author, "POST", "/api/comments", { tpl: "ui-toggle", text: "Where is the colour setting?" });
    const parentId = first.data && first.data.comment && first.data.comment.id;
    ok(first.status === 200 && parentId, "a comment is posted", first.status);
    if (parentId) {
      const reply = await call(replier, "POST", "/api/comments", { tpl: "ui-toggle", text: "Under Style, top right.", parentId });
      ok(reply.status === 200, "a reply is posted", reply.status);
      const heard = (await bell(author.id)).find((n) => n.type === "comment" && /replied to your comment/.test(n.message));
      ok(heard && heard.actor_id === replier.id, "the person replied to hears about it", heard && heard.message);
      ok(heard && notify.urlFor(heard) === "/template?id=ui-toggle", "and it opens the template", heard && notify.urlFor(heard));
      const self = await call(author, "POST", "/api/comments", { tpl: "ui-toggle", text: "Found it, thanks", parentId });
      const selfTold = (await bell(author.id)).filter((n) => /replied to your comment/.test(n.message));
      ok(self.status === 200 && selfTold.length === 1, "replying in your own thread does not notify yourself", selfTold.length);
    }

    console.log("\n---- the bell ----");
    const unread = await call(author, "GET", "/api/notifications/unread");
    ok(unread.status === 200 && unread.data.unread >= 3 && unread.data.latest && unread.data.latest.url, "the live endpoint reports unread and the newest item with its link", unread.data && `${unread.data.unread} ${unread.data.latest && unread.data.latest.url}`);
    const listed = await call(author, "GET", "/api/notifications?limit=10");
    ok(listed.data.notifications.every((n) => typeof n.url === "string" && n.url.startsWith("/")), "every listed notification carries its link");
    ok((await call(null, "GET", "/api/notifications/unread")).status === 401, "the live endpoint needs a login");

    console.log("\n---- device subscriptions ----");
    const key = await call(null, "GET", "/api/push/key");
    ok(key.status === 200 && /^[A-Za-z0-9_-]{80,100}$/.test(key.data.publicKey), "the server publishes a Web Push key", key.status);
    const keys = fakeKeys();
    const good = `https://fcm.googleapis.com/fcm/send/${crypto.randomBytes(20).toString("base64url")}`;
    ok((await call(null, "POST", "/api/push/subscribe", { endpoint: good, keys })).status === 401, "subscribing needs a login");
    for (const bad of ["https://evil.example/push", "http://fcm.googleapis.com/fcm/send/x", "https://localhost/push", "https://127.0.0.1/push", "https://fcm.googleapis.com.evil.example/x", "https://fcm.googleapis.com:8443/x"]) {
      const r = await call(author, "POST", "/api/push/subscribe", { endpoint: bad, keys });
      ok(r.status === 400, `refuses a non-push endpoint: ${bad}`, r.status);
    }
    ok((await call(author, "POST", "/api/push/subscribe", { endpoint: good, keys: { p256dh: "short", auth: "x" } })).status === 400, "refuses incomplete keys");
    let r = await call(author, "POST", "/api/push/subscribe", { endpoint: good, keys });
    ok(r.status === 200, "a real push service endpoint is stored", r.status);
    const gone = `https://updates.push.services.mozilla.com/wpush/v2/${crypto.randomBytes(20).toString("base64url")}`;
    r = await call(author, "POST", "/api/push/subscribe", { endpoint: gone, keys: fakeKeys() });
    ok(r.status === 200, "a second device is stored", r.status);
    const subs = await db.query(`select endpoint from public.push_subscriptions where user_id = $1`, [author.id]);
    ok(subs.rows.length === 2, "both devices belong to the account", subs.rows.length);
    const count = await call(author, "GET", "/api/push/key");
    ok(count.data.devices === 2, "the key endpoint reports the account's devices", count.data.devices);

    console.log("\n---- delivery ----");
    // Let any flush the server scheduled after those requests finish first.
    await wait(1500);
    await db.query(`update public.notifications set pushed_at = now() where user_id = any($1::uuid[]) and pushed_at is null`, [users.map((u) => u.id)]);
    const sent = [];
    notify._setSender(async (subscription, payload, options) => {
      sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload), options });
      if (subscription.endpoint === gone) { const e = new Error("Gone"); e.statusCode = 410; throw e; }
      return { statusCode: 201 };
    });
    await notify.toUser(null, author.id, { actorId: replier.id, type: "follow", entityType: "creator", entityId: replier.id, message: "started following you" });
    await notify.flush();
    const toGood = sent.filter((s) => s.endpoint === good);
    ok(toGood.length === 1, "the notification is sent to the device once", toGood.length);
    if (toGood[0]) {
      const p = toGood[0].payload;
      const expectedTitle = replier.displayName || "@" + String(replier.handle).replace(/^@/, "");
      ok(p.body === "started following you" && p.title === expectedTitle, "the title is the person and the body what they did", `${p.title} · ${p.body}`);
      ok(p.url === "/creator?handle=" + encodeURIComponent(String(replier.handle).replace(/^@/, "")), "it opens their profile", p.url);
      ok(toGood[0].options.vapidDetails && /^https:\/\//.test(toGood[0].options.vapidDetails.subject), "it is signed with the server's VAPID identity");
    }
    const after = await db.query(`select endpoint from public.push_subscriptions where user_id = $1`, [author.id]);
    ok(after.rows.length === 1 && after.rows[0].endpoint === good, "a device the push service reports gone is removed", after.rows.length);
    sent.length = 0;
    await notify.flush();
    ok(sent.length === 0, "a second sweep sends nothing again", sent.length);

    const stale = await db.query(
      `insert into public.notifications (user_id, type, entity_type, message, created_at)
       values ($1, 'system', 'welcome', 'old news', now() - interval '2 hours') returning id`, [author.id]);
    await notify.flush();
    ok(sent.length === 0, "a notification older than fifteen minutes stays in the bell but does not buzz the phone", sent.length);
    const staleRow = await db.query(`select pushed_at from public.notifications where id = $1`, [stale.rows[0].id]);
    ok(staleRow.rows[0].pushed_at !== null, "and it is marked handled");

    console.log("\n---- device test and sign-out ----");
    r = await call(author, "POST", "/api/push/test");
    ok(r.status === 200, "the device test is accepted", r.status);
    ok((await bell(author.id)).some((n) => n.entity_type === "device"), "and lands in the bell");
    r = await call(author, "DELETE", "/api/push/subscribe", { endpoint: good });
    const left = await db.query(`select count(*)::int as n from public.push_subscriptions where user_id = $1`, [author.id]);
    ok(r.status === 200 && left.rows[0].n === 0, "forgetting the device removes it", left.rows[0].n);
    const other = await call(replier, "DELETE", "/api/push/subscribe", { endpoint: gone });
    ok(other.status === 200, "removing a device you do not own is a harmless no-op", other.status);

    const sw = await fetch(BASE + "/sw.js");
    ok(sw.status === 200 && /javascript/.test(sw.headers.get("content-type") || "") && /no-cache/.test(sw.headers.get("cache-control") || ""), "the service worker is served fresh", `${sw.status} ${sw.headers.get("cache-control")}`);
  } catch (err) {
    failures++;
    console.error("HARNESS FAIL:", err.stack || err.message);
  } finally {
    const ids = users.map((u) => u.id).filter(Boolean);
    await db.tx(async (c) => {
      await c.query(`delete from public.template_comments where author_id = any($1::uuid[])`, [ids]);
      await c.query(`delete from public.creator_skills where author_id = any($1::uuid[])`, [ids]);
      await c.query(`delete from public.admin_audit_log where entity_type = 'template' and entity_id in (select id from public.community_templates where author_id = any($1::uuid[]))`, [ids]);
      await c.query(`delete from public.community_templates where author_id = any($1::uuid[])`, [ids]);
      await c.query(`delete from public.notifications where user_id = any($1::uuid[]) or actor_id = any($1::uuid[])`, [ids]);
      await c.query(`delete from public.sessions where user_id = any($1::uuid[])`, [ids]);
      await c.query(`delete from public.users where id = any($1::uuid[])`, [ids]);
    }).catch((e) => console.error("cleanup failed:", e.message));
    await db.getPool().end().catch(() => {});
    console.log(`\nNOTIFICATIONS=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
    process.exit(failures === 0 ? 0 : 1);
  }
})();
