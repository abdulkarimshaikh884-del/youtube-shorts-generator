/* ============================================================
   projects.js — account-side projects.

   Drafts were browser-local, which the drafts page said plainly. The
   account page, meanwhile, promised that "Drafts and settings follow you
   to any device", and the master plan (§11) requires projects to reach the
   account so they cross devices. This is that store.

   Everything here is scoped by the signed-in account. A project id is
   supplied by the client (drafts already carry one) but is only ever
   written alongside the owner's id, and every read filters on it — so an
   id guessed from another account cannot be read, changed or deleted.
   ============================================================ */
const db = require("./db");

const MAX_PER_USER = 60;      // a project list, not an archive
const MAX_NAME = 60;
const MAX_CLIPS = 40;
const MAX_BYTES = 256 * 1024; // one project document

function publicProject(row) {
  return {
    id: row.id,
    name: row.name,
    aspect: row.aspect,
    clips: row.clips || [],
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null
  };
}

/* The client sends whatever the editor is holding, so nothing here trusts
   its shape: a clip is a template id and a bag of props, and anything else
   is dropped rather than stored and served back to a browser later. */
function cleanClips(value) {
  if (!Array.isArray(value)) return null;
  const clips = value.slice(0, MAX_CLIPS).map((clip) => {
    if (!clip || typeof clip !== "object") return null;
    const tpl = String(clip.tpl || clip.id || "").slice(0, 80);
    if (!tpl) return null;
    const out = { tpl, dur: Math.max(0, Math.min(60000, Number(clip.dur) || 0)) };
    if (clip.props && typeof clip.props === "object" && !Array.isArray(clip.props)) {
      out.props = clip.props;
    }
    if (clip.spec && typeof clip.spec === "object") out.spec = clip.spec;
    if (clip.accent) out.accent = String(clip.accent).slice(0, 40);
    if (clip.font) out.font = String(clip.font).slice(0, 40);
    return out;
  }).filter(Boolean);
  return clips.length ? clips : null;
}

async function list(user) {
  if (!user?.id) return { error: "Please log in first.", status: 401 };
  const { rows } = await db.query(
    `select * from public.projects where user_id = $1 order by updated_at desc limit $2`,
    [user.id, MAX_PER_USER]
  );
  return { success: true, projects: rows.map(publicProject) };
}

async function get(user, id) {
  if (!user?.id) return { error: "Please log in first.", status: 401 };
  const { rows } = await db.query(
    `select * from public.projects where id = $1 and user_id = $2`,
    [String(id || ""), user.id]
  );
  if (!rows[0]) return { error: "Project not found.", status: 404 };
  return { success: true, project: publicProject(rows[0]) };
}

async function save(user, id, body) {
  if (!user?.id) return { error: "Please log in first.", status: 401 };

  const projectId = String(id || body?.id || "").trim().slice(0, 64);
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(projectId)) {
    return { error: "That project id is not valid.", status: 400 };
  }

  const clips = cleanClips(body?.clips);
  if (!clips) return { error: "A project needs at least one clip.", status: 400 };

  const name = String(body?.name || "Untitled animation").trim().slice(0, MAX_NAME) || "Untitled animation";
  const aspect = ["9:16", "16:9", "1:1", "4:5"].includes(body?.aspect) ? body.aspect : "9:16";

  const payload = JSON.stringify(clips);
  if (Buffer.byteLength(payload, "utf8") > MAX_BYTES) {
    return { error: "That project is too large to sync.", status: 413 };
  }

  return db.tx(async (client) => {
    /* The owner is pinned in the WHERE clause of the update half, so a
       project id belonging to someone else cannot be taken over by
       claiming it: the insert would violate the primary key instead. */
    const { rows } = await client.query(
      `insert into public.projects (id, user_id, name, aspect, clips)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (id) do update
         set name = excluded.name,
             aspect = excluded.aspect,
             clips = excluded.clips,
             updated_at = now()
         where public.projects.user_id = $2
       returning *`,
      [projectId, user.id, name, aspect, payload]
    );
    if (!rows[0]) return { error: "That project belongs to another account.", status: 403 };

    // Keep the list bounded, oldest first, so an autosave never evicts the
    // project someone is working on right now.
    await client.query(
      `delete from public.projects
        where user_id = $1
          and id not in (
            select id from public.projects where user_id = $1
             order by updated_at desc limit $2
          )`,
      [user.id, MAX_PER_USER]
    );
    return { success: true, project: publicProject(rows[0]) };
  });
}

async function remove(user, id) {
  if (!user?.id) return { error: "Please log in first.", status: 401 };
  const { rowCount } = await db.query(
    `delete from public.projects where id = $1 and user_id = $2`,
    [String(id || ""), user.id]
  );
  if (!rowCount) return { error: "Project not found.", status: 404 };
  return { success: true };
}

/* Called once when a browser that already holds local drafts signs in, so
   work started before logging in is not stranded on that device. Existing
   server projects always win: the local copy is the older story. */
async function adopt(user, drafts) {
  if (!user?.id) return { error: "Please log in first.", status: 401 };
  if (!Array.isArray(drafts) || !drafts.length) return { success: true, adopted: 0 };

  let adopted = 0;
  for (const draft of drafts.slice(0, MAX_PER_USER)) {
    const clips = cleanClips(draft?.clips);
    const projectId = String(draft?.id || "").trim().slice(0, 64);
    if (!clips || !/^[A-Za-z0-9_-]{3,64}$/.test(projectId)) continue;
    const { rowCount } = await db.query(
      `insert into public.projects (id, user_id, name, aspect, clips)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (id) do nothing`,
      [
        projectId, user.id,
        String(draft.name || "Untitled animation").slice(0, MAX_NAME) || "Untitled animation",
        ["9:16", "16:9", "1:1", "4:5"].includes(draft.aspect) ? draft.aspect : "9:16",
        JSON.stringify(clips)
      ]
    );
    if (rowCount) adopted++;
  }
  return { success: true, adopted };
}

module.exports = { list, get, save, remove, adopt, MAX_PER_USER };
