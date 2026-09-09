/* Creator tutorials, end to end: URL parsing, the review queue, who can see
   what, and who can remove what. Every fixture is created by this run and
   removed in finally. */
require("dotenv").config();
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const auth = require("./auth");
const db = require("./db");
const skills = require("./skills");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const users = [];
const rows = [];
let failures = 0;

function ok(condition, label, detail) {
  if (condition) console.log(`  PASS  ${label}${detail !== undefined ? "  (" + detail + ")" : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail !== undefined ? "  (" + detail + ")" : ""}`); }
}

async function fixture(label) {
  const suffix = crypto.randomBytes(6).toString("hex");
  const headers = {};
  const res = {
    getHeader: (k) => headers[k.toLowerCase()],
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; }
  };
  const out = await auth.signUp(res, `skills-${suffix}@example.invalid`,
    "Skills-test-password-23", `skl_${suffix}`);
  assert.ok(out.user, out.error);
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
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

// A key that is real-shaped but cannot collide with a previous run's row,
// because the table refuses a duplicate video by design.
function fakeYouTubeKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let out = "";
  for (let i = 0; i < 11; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

(async () => {
  try {
    console.log("\n---- link parsing ----");
    const key = fakeYouTubeKey();
    const spellings = [
      `https://youtu.be/${key}`,
      `https://www.youtube.com/watch?v=${key}&t=42s`,
      `https://youtube.com/shorts/${key}`,
      `https://m.youtube.com/watch?v=${key}`
    ].map((u) => skills.parseVideoUrl(u));
    ok(spellings.every((p) => p && p.platform === "youtube" && p.videoKey === key),
      "every YouTube spelling reduces to the same video",
      spellings.map((p) => (p ? p.videoKey : "null")).join(" "));

    const ig = skills.parseVideoUrl("https://www.instagram.com/reel/Cx1AbCdEfGh/?igsh=trackme");
    ok(ig && ig.platform === "instagram" && !/igsh/.test(ig.url),
      "an Instagram link is stored without its sharer-identifying parameter",
      ig && ig.url);

    ok(["https://vimeo.com/1", "hello", "https://youtube.com/watch?v=tooshort", ""]
      .every((u) => skills.parseVideoUrl(u) === null),
      "anything that is not a YouTube or Instagram video is refused");

    console.log("\n---- submitting ----");
    const author = await fixture("author");
    const other = await fixture("other");
    const staff = await fixture("staff");
    await db.query("update public.users set role = 'admin' where id = $1", [staff.id]);

    const guest = await call(null, "POST", "/api/skills",
      { url: `https://youtu.be/${key}`, title: "Guest attempt" });
    ok(guest.status === 401, "a signed-out visitor cannot submit", guest.status);

    const bad = await call(author, "POST", "/api/skills",
      { url: "https://vimeo.com/12345", title: "Wrong platform" });
    ok(bad.status === 400 && /youtube|instagram/i.test(bad.data.error || ""),
      "an unsupported link is refused with a message naming what works",
      (bad.data.error || "").slice(0, 46));

    const shortTitle = await call(author, "POST", "/api/skills",
      { url: `https://youtu.be/${key}`, title: "ab" });
    ok(shortTitle.status === 400, "a title of two characters is refused", shortTitle.status);

    const made = await call(author, "POST", "/api/skills", {
      url: `https://www.youtube.com/watch?v=${key}&feature=share`,
      title: "How I built the cascade title",
      summary: "Timing, easing and the two lines that carry the hook.",
      templateId: "text-cascade"
    });
    ok(made.status === 200 && made.data.success, "a real submission is accepted", made.status);
    const id = made.data.skill && made.data.skill.id;
    if (id) rows.push(id);
    ok(made.data.skill && made.data.skill.status === "pending",
      "a new submission waits for review", made.data.skill && made.data.skill.status);
    ok(made.data.skill && made.data.skill.url === `https://www.youtube.com/watch?v=${key}`,
      "the stored link is the canonical one, not what was pasted",
      made.data.skill && made.data.skill.url);

    // The same video under a different spelling is the case the unique index
    // exists for — a string comparison would have let this through.
    const dupe = await call(other, "POST", "/api/skills",
      { url: `https://youtube.com/shorts/${key}`, title: "Same video, different URL" });
    ok(dupe.status === 400 && /already/i.test(dupe.data.error || ""),
      "the same video cannot be submitted twice under another spelling",
      (dupe.data.error || "").slice(0, 40));

    console.log("\n---- what the public sees ----");
    const publicBefore = await call(null, "GET", "/api/skills");
    ok(publicBefore.status === 200 &&
       !(publicBefore.data.skills || []).some((s) => s.id === id),
      "a pending tutorial is not public");

    const mine = await call(author, "GET", "/api/skills/mine");
    ok(mine.status === 200 && (mine.data.skills || []).some((s) => s.id === id),
      "the author sees their own pending submission");

    const notMine = await call(other, "GET", "/api/skills/mine");
    ok(!(notMine.data.skills || []).some((s) => s.id === id),
      "another account does not see it in theirs");

    console.log("\n---- moderation ----");
    const queueAsUser = await call(author, "GET", "/api/admin/skills");
    ok(queueAsUser.status === 403, "an ordinary account cannot read the queue", queueAsUser.status);

    const reviewAsUser = await call(other, "PATCH", `/api/admin/skills/${id}`, { status: "published" });
    ok(reviewAsUser.status === 403, "an ordinary account cannot approve", reviewAsUser.status);

    const queue = await call(staff, "GET", "/api/admin/skills?status=pending");
    ok(queue.status === 200 && (queue.data.skills || []).some((s) => s.id === id),
      "an admin sees it in the pending queue");

    const rejected = await call(staff, "PATCH", `/api/admin/skills/${id}`,
      { status: "rejected", note: "Audio is inaudible for the first minute." });
    ok(rejected.status === 200 && rejected.data.skill.status === "rejected",
      "an admin can reject with a reason");

    const afterReject = await call(author, "GET", "/api/skills/mine");
    const row = (afterReject.data.skills || []).find((s) => s.id === id);
    ok(row && /inaudible/.test(row.reviewNote || ""),
      "the author can read why it was rejected", row && row.reviewNote);

    const approved = await call(staff, "PATCH", `/api/admin/skills/${id}`, { status: "published" });
    ok(approved.status === 200 && approved.data.skill.status === "published",
      "an admin can publish it");

    const publicAfter = await call(null, "GET", "/api/skills");
    const live = (publicAfter.data.skills || []).find((s) => s.id === id);
    ok(!!live, "an approved tutorial is public");
    ok(live && live.author && live.author.handle === String(author.handle || "").replace(/^@/, ""),
      "the card credits the creator who submitted it", live && live.author && live.author.handle);
    ok(live && /^https:\/\/i\.ytimg\.com\//.test(live.thumbnail || ""),
      "a YouTube card has a thumbnail without any API key", live && live.thumbnail);
    ok(live && live.templateId === "text-cascade",
      "the tutorial points back at the template it teaches", live && live.templateId);

    console.log("\n---- removal ----");
    const strangerDelete = await call(other, "DELETE", `/api/skills/${id}`);
    ok(strangerDelete.status === 403, "another account cannot remove it", strangerDelete.status);

    const stillThere = await call(null, "GET", "/api/skills");
    ok((stillThere.data.skills || []).some((s) => s.id === id),
      "the refused delete did not remove it anyway");

    const ownDelete = await call(author, "DELETE", `/api/skills/${id}`);
    ok(ownDelete.status === 200, "the author can remove their own", ownDelete.status);

    const gone = await call(null, "GET", "/api/skills");
    ok(!(gone.data.skills || []).some((s) => s.id === id), "and it leaves the public page");
  } catch (err) {
    failures++;
    console.error("HARNESS FAIL:", err.message);
  } finally {
    // Only the rows and accounts this run created.
    try {
      if (rows.length) {
        await db.query("delete from public.creator_skills where id = any($1::text[])", [rows]);
      }
      for (const u of users) {
        await db.tx(async (c) => {
          await c.query("delete from public.creator_skills where author_id = $1", [u.id]);
          await c.query("delete from public.sessions where user_id = $1", [u.id]);
          await c.query("delete from public.users where id = $1", [u.id]);
        });
      }
      await db.getPool().end();
    } catch (err) {
      console.error("cleanup failed:", err.message);
    }
  }

  console.log(`\nSKILLS=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})();
