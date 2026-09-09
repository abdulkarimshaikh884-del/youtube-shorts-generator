/* ============================================================
   skills.js — creator tutorials on the community page.

   A creator submits a link to a video they already published, on their own
   channel, that teaches something. ShortsCraft never stores the video: the
   creator is here for reach, and reach only counts where their audience is.

   Everything arrives as a URL typed by a person, so the URL is the only thing
   this module really validates. Once parsed, a submission is two strings and a
   status, and the moderation queue does the rest.
   ============================================================ */
const crypto = require("crypto");
const db = require("./db");

const MAX_TITLE = 90;
const MAX_SUMMARY = 220;

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
  const admin = !!(viewer && (viewer.role === "admin" || viewer.role === "super_admin"));
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || "",
    url: row.url,
    platform: row.platform,
    thumbnail: thumbnailFor(row.platform, row.video_key),
    templateId: row.template_id || null,
    status: row.status,
    reviewNote: row.review_note || "",
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      name: row.display_name || "Creator",
      handle: row.handle ? String(row.handle).replace(/^@/, "") : "",
      verified: row.verified === true
    },
    canDelete: mine || admin
  };
}

const SELECT = `
  select s.*, u.display_name, u.handle, u.verified
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

  try {
    const { rows } = await db.query(
      `insert into public.creator_skills
         (id, author_id, title, summary, url, platform, video_key, template_id, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
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

async function listForReview(user, status = "pending") {
  if (!isAdmin(user)) return { error: "Admin access required.", status: 403 };
  const wanted = ["pending", "published", "rejected"].includes(status) ? status : "pending";
  const { rows } = await db.query(
    `${SELECT} where s.status = $1 order by s.created_at asc limit 200`,
    [wanted]
  );
  return { skills: rows.map((r) => toSkill(r, user)) };
}

/* ── Moderation ───────────────────────────────────────── */
function isAdmin(user) {
  return Boolean(user && (user.role === "admin" || user.role === "super_admin"));
}

async function review(user, id, status, note) {
  if (!isAdmin(user)) return { error: "Admin access required.", status: 403 };
  if (!["published", "rejected", "pending"].includes(status)) {
    return { error: "A review sets the state to published, rejected or pending." };
  }
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
  return { success: true, skill: toSkill(after.rows[0], user) };
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
