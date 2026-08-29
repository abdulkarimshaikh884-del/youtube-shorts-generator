/* ============================================================
   comments.js — template comment threads, backed by Postgres.
   ============================================================ */
const db = require("./db");

/* A template with no comments yet still needs to look alive. This is not
   persisted until someone actually comments — it is a display fallback, the
   same behaviour the file-backed version had. */
const GENERIC_FALLBACK = [
  { id: "c_gen_1", authorName: "Motion Creator", authorHandle: "@motion_pro", text: "Stunning kinetic pacing and clean easing curves. Great template!", time: "4 hours ago", likes: 5 },
  { id: "c_gen_2", authorName: "Creator Hub", authorHandle: "@creator_daily", text: "Super easy to customize in the Studio editor.", time: "1 day ago", likes: 3 }
];

function relativeTime(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return min + (min === 1 ? " minute ago" : " minutes ago");
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + (hr === 1 ? " hour ago" : " hours ago");
  const day = Math.floor(hr / 24);
  return day + (day === 1 ? " day ago" : " days ago");
}

function toComment(row) {
  return {
    id: row.id,
    authorName: row.author_name,
    authorHandle: row.author_handle,
    text: row.text,
    time: relativeTime(row.created_at),
    likes: row.likes
  };
}

async function getComments(tplId) {
  const { rows } = await db.query(
    `select * from public.template_comments where tpl_id = $1 order by created_at desc`,
    [tplId]
  );
  if (rows.length) return rows.map(toComment);
  return GENERIC_FALLBACK;
}

async function addComment(tplId, commentData, user) {
  if (!user || !user.id) throw new Error("Authentication required to comment");
  const fallbackHandle = user.email ? user.email.split("@")[0] : "creator";
  const handleBase = String(user.handle || fallbackHandle)
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30) || "creator";
  const handle = "@" + handleBase;
  const name = String(user.displayName || fallbackHandle || "Creator").trim().slice(0, 50) || "Creator";
  const text = String(commentData.text || "").trim().slice(0, 500);
  if (!text) throw new Error("Comment text is required");
  const id = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const { rows } = await db.query(
    `insert into public.template_comments (id, tpl_id, author_name, author_handle, text, likes)
     values ($1, $2, $3, $4, $5, 1)
     returning *`,
    [
      id, tplId,
      name,
      handle,
      text
    ]
  );
  return toComment(rows[0]);
}

module.exports = { getComments, addComment };
