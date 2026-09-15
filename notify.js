/* Notifications that reach people.

   public.notifications is the bell. This module adds three things to it:

   - Staff alerts. The owner, and staff holding the matching permission, hear
     about new feedback, accounts, templates and tutorials.
   - The link each notification opens, decided once here and used by both
     the bell and device notifications.
   - Device delivery (Web Push). Every new row is sent to the browsers and
     phones its owner switched notifications on for. Delivery reads the table
     (pushed_at), so every place that inserts a notification is delivered
     without calling anything here. `schedule()` runs it right after a
     request that may have created one; a timer catches anything else. */
const webpush = require("web-push");
const db = require("./db");

/* Accounts on the reserved .invalid domain cannot receive mail, so no real
   person owns one; the test suites use them. Their activity is never
   announced to the owner. */
const TEST_EMAIL = "%.invalid";

/* Push services the server is willing to call. A subscription endpoint is a
   URL the browser hands us; accepting any URL would let an account make this
   server send requests wherever it liked. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/
];

function validEndpoint(endpoint) {
  try {
    const url = new URL(String(endpoint || ""));
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch (err) {
    return false;
  }
}

/* ── Links ───────────────────────────────────────────────── */
/* `row` is a notifications row, optionally joined with the community
   template it points at (tpl) and the actor's handle (actor_handle). */
function urlFor(row) {
  const type = row.type;
  const entity = row.entity_type;
  const id = String(row.entity_id || "");
  if (type === "support_reply") return "/contact?ticket=" + encodeURIComponent(id) + "#supportHistory";
  if (entity === "support_ticket") return "/admin#support";
  if (entity === "template_review") return "/admin#content";
  if (entity === "tutorial_review") return "/admin#skills";
  if (entity === "new_user") return "/admin#users";
  if (entity === "admin") return "/admin";
  if (entity === "tutorial") return "/community";
  if (entity === "welcome") return "/";
  if (type === "template_status") return "/account";
  if (entity === "creator" && row.actor_handle) {
    return "/creator?handle=" + encodeURIComponent(String(row.actor_handle).replace(/^@/, ""));
  }
  if (entity === "template") {
    if (row.tpl) return "/template?id=" + encodeURIComponent(row.tpl) + "&comm=1&commId=" + encodeURIComponent(id);
    if (id && !id.startsWith("comm_")) return "/template?id=" + encodeURIComponent(id);
    return "/account";
  }
  return "/account";
}

/* ── Creating notifications ──────────────────────────────── */
async function toUser(client, userId, { actorId = null, type = "system", entityType = null, entityId = "", message }) {
  if (!userId || (actorId && userId === actorId) || !message) return;
  await (client || db).query(
    `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
     values ($1, $2, $3, $4, $5, $6)`,
    [userId, actorId, type, entityType, String(entityId || ""), String(message).slice(0, 240)]
  );
}

/* The owner, plus staff who hold `permission`. The person who caused it is
   never told about their own action. */
async function toStaff(client, permission, { actorId = null, entityType, entityId = "", message }) {
  if (!message) return;
  await (client || db).query(
    `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
     select u.id, $1, 'system', $2, $3, $4
       from public.users u
      where (u.role = 'super_admin'
             or (u.role in ('moderator', 'admin') and $5 = any(u.staff_permissions)))
        and u.id is distinct from $1
        and not exists (select 1 from public.users a where a.id = $1 and a.email like '${TEST_EMAIL}')`,
    [actorId, entityType, String(entityId || ""), String(message).slice(0, 240), permission]
  );
}

const quote = (s) => "“" + String(s || "Untitled").slice(0, 80) + "”";
const handleOf = (user) => (user && user.handle ? "@" + String(user.handle).replace(/^@/, "") : "A creator");

async function welcome(user) {
  if (!user || !user.id) return;
  await toUser(null, user.id, {
    type: "system", entityType: "welcome",
    message: "Welcome to ShortsCraft. Pick a template, change the words, and export your first Short."
  });
  if (!/\.invalid$/i.test(String(user.email || ""))) {
    await toStaff(null, "users.view", {
      actorId: user.id, entityType: "new_user", entityId: user.id,
      message: `New account: ${handleOf(user)}`
    });
  }
}

async function templatePublished(user, template) {
  if (!template || !["published", "scheduled"].includes(template.status)) return;
  await toStaff(null, "templates.moderate", {
    actorId: user.id, entityType: "template_review", entityId: template.id,
    message: `${handleOf(user)} ${template.status === "scheduled" ? "scheduled" : "published"} a template: ${quote(template.title)}`
  });
}

async function tutorialShared(user, skill) {
  if (!skill) return;
  await toStaff(null, "tutorials.moderate", {
    actorId: user.id, entityType: "tutorial_review", entityId: skill.id,
    message: `${handleOf(user)} shared a tutorial: ${quote(skill.title)}`
  });
}

const TEMPLATE_OUTCOME = {
  published: (t) => `Your template ${quote(t)} is published.`,
  rejected: (t, note) => `Your template ${quote(t)} was not approved${note ? ": " + note : "."}`,
  archived: (t, note) => `Your template ${quote(t)} was taken down${note ? ": " + note : "."}`,
  review: (t) => `Your template ${quote(t)} is back in review.`
};

async function templateModerated(moderator, before, after) {
  if (!before || !after || !after.author_id || before.status === after.status) return;
  const say = TEMPLATE_OUTCOME[after.status];
  if (!say) return;
  await toUser(null, after.author_id, {
    actorId: moderator.id, type: "template_status", entityType: "template", entityId: after.id,
    message: say(after.title, String(after.review_note || "").slice(0, 120))
  });
}

const TUTORIAL_OUTCOME = {
  published: (t) => `Your tutorial ${quote(t)} is live again.`,
  rejected: (t, note) => `Your tutorial ${quote(t)} was taken down${note ? ": " + note : "."}`,
  pending: (t) => `Your tutorial ${quote(t)} is held for review.`
};

async function tutorialReviewed(moderator, skill, previousStatus) {
  if (!skill || !skill.author || !skill.author.id || previousStatus === skill.status) return;
  const say = TUTORIAL_OUTCOME[skill.status];
  if (!say) return;
  await toUser(null, skill.author.id, {
    actorId: moderator.id, type: "template_status", entityType: "tutorial", entityId: skill.id,
    message: say(skill.title, String(skill.reviewNote || "").slice(0, 120))
  });
}

/* A reply tells the person replied to. The template's author already hears
   about every comment, so they are not told twice. */
async function commentReplied(user, comment, templateId) {
  if (!comment || !comment.parentId) return;
  const { rows } = await db.query(
    `select c.author_id,
            (select author_id from public.community_templates where id = $2) as template_author
       from public.template_comments c where c.id = $1`,
    [comment.parentId, templateId]
  );
  const parent = rows[0];
  if (!parent || !parent.author_id || parent.author_id === parent.template_author) return;
  await toUser(null, parent.author_id, {
    actorId: user.id, type: "comment", entityType: "template", entityId: templateId,
    message: `replied to your comment: ${String(comment.text || "").slice(0, 80)}`
  });
}

/* ── Device delivery ─────────────────────────────────────── */
let keysPromise = null;
function vapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return Promise.resolve({ publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY });
  }
  if (!keysPromise) {
    keysPromise = (async () => {
      const fresh = webpush.generateVAPIDKeys();
      // Two instances starting together agree on whichever pair landed first.
      await db.query(
        `insert into public.app_keys (name, value) values ('vapid_public', $1), ('vapid_private', $2)
         on conflict (name) do nothing`,
        [fresh.publicKey, fresh.privateKey]
      );
      const { rows } = await db.query(
        `select name, value from public.app_keys where name in ('vapid_public', 'vapid_private')`
      );
      const map = Object.fromEntries(rows.map((r) => [r.name, r.value]));
      if (!map.vapid_public || !map.vapid_private) throw new Error("VAPID keys unavailable");
      return { publicKey: map.vapid_public, privateKey: map.vapid_private };
    })().catch((err) => { keysPromise = null; throw err; });
  }
  return keysPromise;
}

function subject() {
  const site = String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://shortscraft.online").trim();
  return /^https:\/\//.test(site) ? site.replace(/\/$/, "") : "https://shortscraft.online";
}

async function subscribe(user, data, userAgent) {
  if (!user || !user.id) return { error: "Please log in first.", status: 401 };
  const endpoint = String(data?.endpoint || "");
  const p256dh = String(data?.keys?.p256dh || "");
  const authKey = String(data?.keys?.auth || "");
  if (!validEndpoint(endpoint) || endpoint.length > 1000) return { error: "This browser's notification service is not supported.", status: 400 };
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(authKey)) {
    return { error: "The browser sent an incomplete subscription.", status: 400 };
  }
  // A device belongs to whoever is signed in on it now.
  await db.query(
    `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update
       set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
           user_agent = excluded.user_agent`,
    [user.id, endpoint, p256dh, authKey, String(userAgent || "").slice(0, 300)]
  );
  return { success: true };
}

async function unsubscribe(user, data) {
  if (!user || !user.id) return { error: "Please log in first.", status: 401 };
  await db.query(
    `delete from public.push_subscriptions where user_id = $1 and endpoint = $2`,
    [user.id, String(data?.endpoint || "")]
  );
  return { success: true };
}

async function deviceCount(user) {
  if (!user || !user.id) return 0;
  const { rows } = await db.query(
    `select count(*)::int as n from public.push_subscriptions where user_id = $1`, [user.id]
  );
  return rows[0].n;
}

// Replaceable by the tests, which must not call a real push service.
let send = (subscription, payload, options) => webpush.sendNotification(subscription, payload, options);

let flushing = false;
let pending = false;

async function flush() {
  if (flushing) { pending = true; return { sent: 0 }; }
  flushing = true;
  let sent = 0;
  try {
    do {
      pending = false;
      // Claim a batch. Rows older than fifteen minutes are not worth a phone
      // buzz any more (the server may have been asleep); they stay in the bell.
      const { rows } = await db.query(
        `with batch as (
           select id from public.notifications
            where pushed_at is null
            order by created_at
            limit 50
            for update skip locked
         )
         update public.notifications n set pushed_at = now()
           from batch where n.id = batch.id
         returning n.id, n.user_id, n.actor_id, n.type, n.entity_type, n.entity_id, n.message,
                   (n.created_at > now() - interval '15 minutes') as fresh`
      );
      if (!rows.length) break;
      if (rows.length === 50) pending = true;
      const fresh = rows.filter((r) => r.fresh);
      if (!fresh.length) continue;

      const userIds = [...new Set(fresh.map((r) => r.user_id))];
      const { rows: subs } = await db.query(
        `select id, user_id, endpoint, p256dh, auth from public.push_subscriptions where user_id = any($1::uuid[])`,
        [userIds]
      );
      if (!subs.length) continue;

      const actorIds = [...new Set(fresh.map((r) => r.actor_id).filter(Boolean))];
      const templateIds = [...new Set(fresh.filter((r) => r.entity_type === "template").map((r) => r.entity_id))];
      const [{ rows: actors }, { rows: templates }] = await Promise.all([
        actorIds.length
          ? db.query(`select id, display_name, handle from public.users where id = any($1::uuid[])`, [actorIds])
          : { rows: [] },
        templateIds.length
          ? db.query(`select id, tpl from public.community_templates where id = any($1::text[])`, [templateIds])
          : { rows: [] }
      ]);
      const actorById = new Map(actors.map((a) => [a.id, a]));
      const tplById = new Map(templates.map((t) => [t.id, t.tpl]));
      const keys = await vapidKeys();
      const options = { vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 * 60 * 24 };

      const jobs = [];
      for (const n of fresh) {
        const actor = n.actor_id ? actorById.get(n.actor_id) : null;
        const actorName = actor ? (actor.display_name || (actor.handle ? "@" + String(actor.handle).replace(/^@/, "") : "")) : "";
        // "Aman · started following you" reads as a person; outcomes and
        // alerts come from ShortsCraft itself.
        const personal = actorName && n.type !== "system" && n.type !== "template_status";
        const payload = JSON.stringify({
          id: n.id,
          title: personal ? actorName : "ShortsCraft",
          body: n.message,
          url: urlFor({ ...n, actor_handle: actor && actor.handle, tpl: tplById.get(n.entity_id) }),
          tag: n.id
        });
        for (const s of subs.filter((x) => x.user_id === n.user_id)) {
          jobs.push(
            send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options)
              .then(() => { sent++; return db.query(`update public.push_subscriptions set last_success_at = now() where id = $1`, [s.id]); })
              .catch((err) => {
                // 404 and 410 mean the browser threw the subscription away.
                if (err && (err.statusCode === 404 || err.statusCode === 410)) {
                  return db.query(`delete from public.push_subscriptions where id = $1`, [s.id]);
                }
                console.error("[push] delivery failed:", err && (err.statusCode || err.message));
              })
          );
        }
      }
      await Promise.allSettled(jobs);
    } while (pending);
  } catch (err) {
    console.error("[push]", err.message);
  } finally {
    flushing = false;
  }
  return { sent };
}

let timer = null;
function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, 400);
  if (timer.unref) timer.unref();
}

function start() {
  const every = setInterval(flush, 60_000);
  if (every.unref) every.unref();
}

module.exports = {
  urlFor, toUser, toStaff, welcome, templatePublished, tutorialShared, templateModerated,
  tutorialReviewed, commentReplied,
  vapidKeys, subscribe, unsubscribe, deviceCount, validEndpoint, flush, schedule, start,
  _setSender(fn) { send = fn; }
};
