/* ============================================================
   comments.js — template comment threads, backed by Postgres.
   ============================================================ */
const db = require("./db");

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

/* `viewer` decides only what the UI is allowed to offer. Every mutation
   re-checks ownership on the server, so a forged canEdit changes nothing. */
function toComment(row, viewer) {
  const mine = !!(viewer && viewer.id && row.author_id && viewer.id === row.author_id);
  const admin = !!(viewer && (viewer.role === "admin" || viewer.role === "super_admin"));
  return {
    id: row.id,
    parentId: row.parent_id || null,
    authorName: row.author_name,
    authorHandle: row.author_handle,
    authorId: row.author_id || null,
    authorVerified: row.author_verified === true || String(row.author_handle || "").replace(/^@/, "") === "shortscraft",
    authorAvatarUrl: row.author_has_avatar && row.author_id ? `/api/users/${encodeURIComponent(row.author_id)}/avatar` : "",
    text: row.text,
    time: relativeTime(row.created_at),
    // A second of slack: the insert sets both stamps and they can differ by
    // microseconds, which is not an edit.
    edited: !!(row.updated_at && new Date(row.updated_at) - new Date(row.created_at) > 1000),
    likes: row.likes,
    canEdit: mine,
    canDelete: mine || admin
  };
}

async function getComments(tplId, viewer) {
  const { rows } = await db.query(
    `select c.*, u.verified as author_verified,
            (u.avatar_bytes is not null) as author_has_avatar
       from public.template_comments c
       left join public.users u on u.id = c.author_id
      where c.tpl_id = $1 and c.status = 'visible'
      order by c.created_at asc`,
    [tplId]
  );
  return rows.map((row) => toComment(row, viewer));
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

  /* A reply has to point at a real comment on the same template, or it is
     stored as a top-level comment rather than orphaned under an id that
     does not exist. Only one level: a reply to a reply attaches to the same
     parent, which keeps the thread readable. */
  let parentId = null;
  const wantedParent = String(commentData.parentId || "").trim();
  if (wantedParent) {
    const { rows: p } = await db.query(
      `select id, parent_id from public.template_comments
        where id = $1 and tpl_id = $2 and status = 'visible'`,
      [wantedParent, tplId]
    );
    if (p[0]) parentId = p[0].parent_id || p[0].id;
  }

  const { rows } = await db.query(
    `insert into public.template_comments
       (id, tpl_id, author_id, author_name, author_handle, text, likes, status, parent_id)
     values ($1, $2, $3, $4, $5, $6, 0, 'visible', $7)
     returning *`,
    [id, tplId, user.id, name, handle, text, parentId]
  );
  return toComment(rows[0], user);
}

/* Editing and deleting are scoped by author_id in the WHERE clause, so a
   comment id belonging to someone else simply matches no row. */
async function editComment(id, user, rawText) {
  if (!user || !user.id) return { error: "Please log in first.", status: 401 };
  const text = String(rawText || "").trim().slice(0, 500);
  if (!text) return { error: "A comment cannot be empty.", status: 400 };
  const { rows } = await db.query(
    `update public.template_comments
        set text = $1, updated_at = now()
      where id = $2 and author_id = $3 and status = 'visible'
      returning *`,
    [text, String(id || ""), user.id]
  );
  if (!rows[0]) return { error: "That comment is not yours to edit.", status: 403 };
  return { success: true, comment: toComment(rows[0], user) };
}

async function deleteComment(id, user) {
  if (!user || !user.id) return { error: "Please log in first.", status: 401 };
  const admin = user.role === "admin" || user.role === "super_admin";
  const { rows } = await db.query(
    `update public.template_comments
        set status = 'removed', updated_at = now()
      where id = $1 and status = 'visible' and ($3::boolean or author_id = $2)
      returning id, parent_id`,
    [String(id || ""), user.id, admin]
  );
  if (!rows[0]) return { error: "That comment is not yours to delete.", status: 403 };
  // Deleting a parent takes its replies with it, or they hang under nothing.
  await db.query(
    `update public.template_comments set status = 'removed', updated_at = now()
      where parent_id = $1 and status = 'visible'`,
    [rows[0].id]
  );
  return { success: true };
}

module.exports = { getComments, addComment, editComment, deleteComment };
