/* ============================================================
   skills.js — creator tutorials on the community page.

   A creator submits a link to a video they already published, on their own
   channel, that teaches something. ShortsCraft never stores the video: the
   creator is here for reach, and reach only counts where their audience is.

   Everything arrives as a URL typed by a person, so the URL is the only thing
   this module really validates. Once parsed, a submission is two strings and a
   status — and a tutorial is published the moment it is shared. Review here is
   a takedown, not a gate: that is what separates a tutorial from a template.
   ============================================================ */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const permissions = require("./permissions");
const notify = require("./notify");
const verified = require("./verified");

const MAX_TITLE = 90;
const MAX_SUMMARY = 220;

/* Read from the engine itself, the way community.js does, because a tutorial's
   template id becomes a link into the Studio. An id nobody checked is a link
   that opens nothing, and the person who clicks it blames the tutorial. */
const VALID_TPL_IDS = (function () {
  try {
    const src = fs.readFileSync(path.join(__dirname, "public", "templates-v2.js"), "utf8");
    const ids = new Set();
    const re = /T\["([\w-]+)"\]\s*=/g;
    let m;
    while ((m = re.exec(src))) ids.add(m[1]);
    ids.delete("blank");
    ids.delete("lottie"); // renders uploads; a tutorial cannot "cover" it
    return ids;
  } catch {
    return new Set();
  }
})();

/* ── URL parsing ──────────────────────────────────────────
   The same video reaches us spelled several ways. Reducing each to
   {platform, key} before storage is what lets the unique index reject a
   duplicate that a string comparison would have missed. */
function parseVideoUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  // youtu.be/KEY
  if (host === "youtu.be" && segments[0]) {
    return youtube(segments[0]);
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    // watch?v=KEY
    const v = url.searchParams.get("v");
    if (v) return youtube(v);
    // shorts/KEY, embed/KEY, live/KEY, v/KEY
    if (["shorts", "embed", "live", "v"].includes(segments[0]) && segments[1]) {
      return youtube(segments[1]);
    }
    return null;
  }

  if (host === "instagram.com" || host === "instagr.am") {
    // reel/KEY, reels/KEY, p/KEY, tv/KEY
    if (["reel", "reels", "p", "tv"].includes(segments[0]) && segments[1]) {
      const key = segments[1];
      if (!/^[A-Za-z0-9_-]{5,40}$/.test(key)) return null;
      return {
        platform: "instagram",
        videoKey: key,
        // Store the canonical form, not what was pasted: a pasted link carries
        // tracking parameters, and one with ?igsh= identifies whoever shared it.
        url: `https://www.instagram.com/reel/${key}/`
      };
    }
    return null;
  }

  return null;
}

function youtube(key) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(key)) return null;
  return { platform: "youtube", videoKey: key, url: `https://www.youtube.com/watch?v=${key}` };
}

/* A YouTube still needs no API key and no request from the server; the browser
   fetches it directly. Instagram has no equivalent open endpoint, so those
   cards fall back to a drawn placeholder rather than a broken image. */
function thumbnailFor(platform, key) {
  return platform === "youtube" ? `https://i.ytimg.com/vi/${key}/hqdefault.jpg` : "";
}

function toSkill(row, viewer) {
  const mine = !!(viewer && viewer.id && row.author_id && viewer.id === row.author_id);
  const admin = permissions.can(viewer, "tutorials.moderate");
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || "",
    url: row.url,
    platform: row.platform,
    thumbnail: thumbnailFor(row.platform, row.video_key),
    // Checked on the way out as well as the way in, so a template that is
    // retired later stops being a link instead of becoming a dead one.
    templateId: row.template_id && VALID_TPL_IDS.has(row.template_id) ? row.template_id : null,
    status: row.status,
    reviewNote: row.review_note || "",
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      name: row.display_name || "Creator",
      handle: row.handle ? String(row.handle).replace(/^@/, "") : "",
      verified: row.verified === true,
      avatarUrl: row.author_has_avatar
        ? `/api/users/${encodeURIComponent(row.author_id)}/avatar`
        : ""
    },
    canDelete: mine || admin
  };
}

const SELECT = `
  select s.*, u.display_name, u.handle, ${verified.sql("u")} as verified,
         (u.avatar_bytes is not null) as author_has_avatar
    from public.creator_skills s
    join public.users u on u.id = s.author_id`;

/* ── Submission ───────────────────────────────────────── */
async function submit(user, data) {
  if (!user || !user.id) return { error: "Sign in to share a tutorial.", status: 401 };

  const title = String(data?.title || "").trim();
  if (title.length < 4) return { error: "Give the tutorial a title of at least 4 characters." };

  const video = parseVideoUrl(data?.url);
  if (!video) {
    return { error: "Paste a YouTube or Instagram link to a video — for example https://youtu.be/… or https://instagram.com/reel/…" };
  }

  const id = "skill_" + crypto.randomBytes(6).toString("hex");
  const summary = String(data?.summary || "").trim().slice(0, MAX_SUMMARY);
  const templateId = String(data?.templateId || "").trim().slice(0, 60) || null;
  if (templateId && VALID_TPL_IDS.size && !VALID_TPL_IDS.has(templateId)) {
    return { error: `There is no template called "${templateId}". Leave the field blank, or use the id shown on the template's own page — for example text-cascade.` };
  }

  try {
    const { rows } = await db.query(
      /* Tutorials go live on submit. Templates are the thing that gets
         reviewed — they are published artefacts other people then build on —
         while a tutorial is a link to a video that already exists on somebody
         else's channel, and holding those in a queue only means the page
         stays empty while the owner is asleep.

         The queue itself is kept: a submitted tutorial can still be rejected
         from the admin Tutorials tab, which is where a link that turns out to
         be someone else's video gets taken down. Review happens after the
         fact now rather than before it. */
      `insert into public.creator_skills
         (id, author_id, title, summary, url, platform, video_key, template_id, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'published')
       returning id`,
      [id, user.id, title.slice(0, MAX_TITLE), summary, video.url,
       video.platform, video.videoKey, templateId]
    );
    const created = await db.query(`${SELECT} where s.id = $1`, [rows[0].id]);
    return { success: true, skill: toSkill(created.rows[0], user) };
  } catch (err) {
    // The unique index is the authority on duplicates, so the friendly message
    // is written here rather than by checking first and racing.
    if (err.code === "23505") {
      return { error: "That video has already been shared here." };
    }
    throw err;
  }
}

/* ── Reads ────────────────────────────────────────────── */
async function listPublished(viewer, limit = 60) {
  const { rows } = await db.query(
    `${SELECT} where s.status = 'published'
      order by s.created_at desc limit $1`,
    [Math.min(Number(limit) || 60, 100)]
  );
  return { skills: rows.map((r) => toSkill(r, viewer)) };
}

/* An author sees their own submissions in every state, including a rejection
   and the reason for it. A queue you cannot see into is indistinguishable from
   one that lost your work. */
async function listMine(user) {
  if (!user || !user.id) return { error: "Sign in to see your tutorials.", status: 401 };
  const { rows } = await db.query(
    `${SELECT} where s.author_id = $1 order by s.created_at desc limit 100`,
    [user.id]
  );
  return { skills: rows.map((r) => toSkill(r, user)) };
}

/* Defaults to what is live, because that is now the list worth looking at:
   nothing waits in 'pending' unless an admin deliberately put it back there. */
async function listForReview(user, status = "published") {
  if (!isAdmin(user)) return { error: "Admin access required.", status: 403 };
  const wanted = ["pending", "published", "rejected"].includes(status) ? status : "published";
  const { rows } = await db.query(
    `${SELECT} where s.status = $1 order by s.created_at asc limit 200`,
    [wanted]
  );
  return { skills: rows.map((r) => toSkill(r, user)) };
}

/* ── Moderation ───────────────────────────────────────── */
function isAdmin(user) {
  return permissions.can(user, "tutorials.moderate");
}

async function review(user, id, status, note) {
  if (!isAdmin(user)) return { error: "Admin access required.", status: 403 };
  if (!["published", "rejected", "pending"].includes(status)) {
    return { error: "A review sets the state to published, rejected or pending." };
  }
  const before = await db.query(`select status from public.creator_skills where id = $1`, [String(id)]);
  const { rows } = await db.query(
    `update public.creator_skills
        set status = $2, review_note = $3, reviewed_at = now(), reviewed_by = $4,
            updated_at = now()
      where id = $1
      returning id`,
    [String(id), status, String(note || "").slice(0, 300), user.id]
  );
  if (!rows.length) return { error: "That tutorial no longer exists.", status: 404 };
  const after = await db.query(`${SELECT} where s.id = $1`, [rows[0].id]);
  const skill = toSkill(after.rows[0], user);
  // The author is told when their video comes down, and why.
  await notify.tutorialReviewed(user, skill, before.rows[0] && before.rows[0].status);
  return { success: true, skill };
}

async function remove(user, id) {
  if (!user || !user.id) return { error: "Sign in first.", status: 401 };
  // An admin may remove anything; everyone else only their own row. Expressing
  // that in the WHERE clause means the check and the delete cannot disagree.
  const { rows } = await db.query(
    `delete from public.creator_skills
      where id = $1 and ($2::boolean or author_id = $3)
      returning id`,
    [String(id), isAdmin(user), user.id]
  );
  if (!rows.length) return { error: "That tutorial is not yours to remove.", status: 403 };
  return { success: true };
}

module.exports = {
  submit, listPublished, listMine, listForReview, review, remove,
  parseVideoUrl, thumbnailFor
};
