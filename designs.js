/* ============================================================
   designs.js — ShortsCraft Design Projects & Template Store.
   Supports editable YouTube thumbnails, posters, logos, social posts,
   and AI-converted design templates.
   ============================================================ */
const crypto = require("crypto");
const designAssets = require("./design-assets");

let db = null;
try {
  db = require("./db");
} catch (e) {
  // db.js is optional in offline/test environments
}

const MAX_PROJECTS_PER_USER = 60;
const MAX_ELEMENTS = 100;
const MAX_BYTES = 512 * 1024; // 512 KB json document limit

const SAMPLE_TEMPLATES = [
  {
    id: "dt_heygen_trick",
    title: "Free & Unlimited HeyGen Trick!",
    description: "Viral AI tool tutorial thumbnail with high-CTR 3D badges, bold red headline, and creator cutout.",
    category: "youtube-thumbnail",
    design_type: "youtube-thumbnail",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1280, height: 720 },
    preview_url: "/storage/designs/templates/heygen-trick.webp",
    previewUrl: "/storage/designs/templates/heygen-trick.webp",
    likes: 0,
    uses: 342,
    elements: [
      {
        id: "bg_clean",
        name: "Clean Neon Green Backdrop",
        type: "image",
        role: "background",
        src: "/storage/designs/templates/heygen/bg_clean.webp",
        x: 0,
        y: 0,
        width: 1280,
        height: 720,
        zIndex: 0,
        locked: true
      },
      {
        id: "subject_character",
        name: "Anime Character Cutout",
        type: "image",
        role: "foreground",
        src: "/storage/designs/templates/heygen/character.webp",
        x: 680,
        y: 0,
        width: 600,
        height: 720,
        zIndex: 1
      },
      {
        id: "panel_headline_card",
        name: "3D White Headline Card",
        type: "image",
        role: "foreground",
        src: "/storage/designs/templates/heygen/headline_card.webp",
        x: 20,
        y: 15,
        width: 840,
        height: 340,
        zIndex: 2
      },
      {
        id: "txt_free_unlimited",
        name: 'Headline: "FREE & UNLIMITED"',
        type: "text",
        text: "FREE & UNLIMITED",
        x: 58,
        y: 54,
        width: 730,
        height: 80,
        fontSize: 82,
        fontWeight: 900,
        fontFamily: "Anton",
        fill: "#09090b",
        alignment: "left",
        zIndex: 3
      },
      {
        id: "txt_heygen_trick",
        name: 'Headline: "HeyGen Trick!"',
        type: "text",
        text: "HeyGen Trick!",
        x: 52,
        y: 140,
        width: 750,
        height: 110,
        fontSize: 114,
        fontWeight: 900,
        fontFamily: "Anton",
        fill: "#dc2626",
        stroke: "#ffffff",
        strokeWidth: 5,
        alignment: "left",
        zIndex: 4
      },
      {
        id: "pill_subtitle_box",
        name: "Subtitle Pill Badge",
        type: "shape",
        shape: "pill",
        x: 105,
        y: 260,
        width: 605,
        height: 46,
        fill: "#18181b",
        stroke: "#34d399",
        radius: 23,
        zIndex: 5
      },
      {
        id: "txt_subtitle",
        name: 'Subtitle: "NO CREDITS"',
        type: "text",
        text: "🤯 NO CREDITS, NO SUBSCRIPTION",
        x: 126,
        y: 270,
        width: 560,
        height: 28,
        fontSize: 25,
        fontWeight: 800,
        fontFamily: "Space Grotesk",
        fill: "#ffffff",
        alignment: "left",
        zIndex: 6
      },
      {
        id: "subject_heygen_device",
        name: "Hand & HeyGen 3D Device",
        type: "image",
        role: "foreground",
        src: "/storage/designs/templates/heygen/hand_card.webp",
        x: 140,
        y: 310,
        width: 480,
        height: 410,
        zIndex: 7
      },
      {
        id: "arrow_callout",
        name: "Orange 3D Callout Arrow",
        type: "image",
        role: "foreground",
        src: "/storage/designs/templates/heygen/arrow.webp",
        x: 560,
        y: 290,
        width: 230,
        height: 210,
        zIndex: 8
      },
      {
        id: "badge_yt",
        name: "YouTube Corner Badge",
        type: "image",
        role: "foreground",
        src: "/storage/designs/templates/heygen/yt_badge.webp",
        x: 1160,
        y: 640,
        width: 120,
        height: 80,
        zIndex: 9
      }
    ]
  },
  {
    id: "dt_growth_metrics",
    title: "Viral Creator Growth Thumbnail",
    description: "Modern vibrant YouTube thumbnail featuring dynamic growth curve, bold contrast text, and callout arrow.",
    category: "youtube-thumbnail",
    design_type: "youtube-thumbnail",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1280, height: 720 },
    preview_url: "/storage/designs/templates/growth-metrics.webp",
    previewUrl: "/storage/designs/templates/growth-metrics.webp",
    likes: 0,
    uses: 195,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1280, height: 720, fill: "#070b14", zIndex: 0 },
      { id: "card", type: "shape", shape: "roundedRectangle", x: 720, y: 100, width: 480, height: 520, fill: "#131b2e", radius: 24, stroke: "#2563eb", strokeWidth: 2, zIndex: 1 },
      { id: "tag", type: "shape", shape: "pill", x: 80, y: 90, width: 180, height: 40, fill: "#10b981", zIndex: 2 },
      { id: "tag_txt", type: "text", text: "CASE STUDY", x: 100, y: 100, fontSize: 18, fontWeight: 700, fontFamily: "Inter", fill: "#ffffff", zIndex: 3 },
      { id: "title1", type: "text", text: "FROM 0 TO", x: 80, y: 170, fontSize: 88, fontWeight: 900, fontFamily: "Anton", fill: "#ffffff", zIndex: 4 },
      { id: "title2", type: "text", text: "1,000,000", x: 80, y: 270, fontSize: 116, fontWeight: 900, fontFamily: "Anton", fill: "#38bdf8", stroke: "#0f172a", strokeWidth: 4, zIndex: 5 },
      { id: "sub", type: "text", text: "IN JUST 90 DAYS 🚀", x: 80, y: 400, fontSize: 32, fontWeight: 700, fontFamily: "Space Grotesk", fill: "#f59e0b", zIndex: 6 }
    ]
  },
  {
    id: "dt_vox_masterclass",
    title: "Vox-Style Documentary Thumbnail",
    description: "High retention dark documentary thumbnail with bold yellow punchline, investigation badge, and spotlight contrast.",
    category: "youtube-thumbnail",
    design_type: "youtube-thumbnail",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1280, height: 720 },
    preview_url: "/storage/designs/templates/vox-coverup.webp",
    previewUrl: "/storage/designs/templates/vox-coverup.webp",
    likes: 0,
    uses: 128,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1280, height: 720, fill: "#0a0a10", zIndex: 0 },
      { id: "badge", type: "shape", shape: "pill", x: 80, y: 80, width: 220, height: 48, fill: "#ef4444", zIndex: 1 },
      { id: "badge_txt", type: "text", text: "INVESTIGATION", x: 96, y: 92, fontSize: 20, fontWeight: 800, fontFamily: "Space Grotesk", fill: "#ffffff", zIndex: 2 },
      { id: "h1", type: "text", text: "THE $100M", x: 80, y: 160, fontSize: 88, fontWeight: 900, fontFamily: "Anton", fill: "#ffffff", stroke: "#000000", strokeWidth: 4, zIndex: 3 },
      { id: "h2", type: "text", text: "COVERUP", x: 80, y: 260, fontSize: 110, fontWeight: 900, fontFamily: "Anton", fill: "#facc15", stroke: "#000000", strokeWidth: 5, zIndex: 4 },
      { id: "sub", type: "text", text: "How one company deceived everyone.", x: 84, y: 400, fontSize: 32, fontWeight: 600, fontFamily: "Inter", fill: "#94a3b8", zIndex: 5 }
    ]
  },
  {
    id: "dt_neon_brand_logo",
    title: "Cyberpunk Glow Logo Mockup",
    description: "Minimalist neon geometry logo on dark textured background with customizable glowing emblem and typography.",
    category: "logo",
    design_type: "logo",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1080, height: 1080 },
    preview_url: "/storage/designs/templates/neon-logo.webp",
    previewUrl: "/storage/designs/templates/neon-logo.webp",
    likes: 0,
    uses: 154,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1080, height: 1080, fill: "#050811", zIndex: 0 },
      { id: "ring", type: "shape", shape: "circle", x: 340, y: 240, width: 400, height: 400, fill: "transparent", stroke: "#06b6d4", strokeWidth: 16, zIndex: 1 },
      { id: "brand_name", type: "text", text: "NEONIX", x: 290, y: 720, fontSize: 92, fontWeight: 900, fontFamily: "Space Grotesk", fill: "#ffffff", letterSpacing: 8, zIndex: 2 },
      { id: "brand_tag", type: "text", text: "STUDIOS // 2026", x: 380, y: 840, fontSize: 24, fontWeight: 600, fontFamily: "IBM Plex Mono", fill: "#06b6d4", zIndex: 3 }
    ]
  },
  {
    id: "dt_minimal_brand_logo",
    title: "Apex Venture Geometric Logo",
    description: "Clean modern geometric triangle vector emblem with balanced modern typography.",
    category: "logo",
    design_type: "logo",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1080, height: 1080 },
    preview_url: "/storage/designs/templates/minimal-logo.webp",
    previewUrl: "/storage/designs/templates/minimal-logo.webp",
    likes: 0,
    uses: 98,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1080, height: 1080, fill: "#0f172a", zIndex: 0 },
      { id: "brand_name", type: "text", text: "APEX", x: 340, y: 740, fontSize: 88, fontWeight: 900, fontFamily: "Space Grotesk", fill: "#ffffff", zIndex: 1 },
      { id: "brand_sub", type: "text", text: "VENTURE LABS", x: 380, y: 820, fontSize: 24, fontWeight: 700, fontFamily: "Inter", fill: "#f59e0b", zIndex: 2 }
    ]
  },
  {
    id: "dt_event_poster",
    title: "Futuristic Conference Poster",
    description: "Vertical event poster template with clean typographic hierarchy, date stamp, and modern grid cards.",
    category: "poster",
    design_type: "poster",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1080, height: 1920 },
    preview_url: "/storage/designs/templates/event-poster.webp",
    previewUrl: "/storage/designs/templates/event-poster.webp",
    likes: 0,
    uses: 112,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1080, height: 1920, fill: "#090d16", zIndex: 0 },
      { id: "banner_t", type: "text", text: "GLOBAL SUMMIT 2026", x: 140, y: 178, fontSize: 22, fontWeight: 700, fontFamily: "Space Grotesk", fill: "#ffffff", zIndex: 1 },
      { id: "title", type: "text", text: "AI DESIGN\nFUTURE", x: 120, y: 340, fontSize: 140, fontWeight: 900, fontFamily: "Anton", fill: "#ffffff", zIndex: 2 }
    ]
  },
  {
    id: "dt_social_carousel",
    title: "Shorts Creator Hook Playbook Post",
    description: "Square social post for Instagram and Twitter with bold headline hook and viral save call-to-action.",
    category: "social-post",
    design_type: "social-post",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1080, height: 1080 },
    preview_url: "/storage/designs/templates/social-post.webp",
    previewUrl: "/storage/designs/templates/social-post.webp",
    likes: 0,
    uses: 230,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1080, height: 1080, fill: "#111827", zIndex: 0 },
      { id: "h1", type: "text", text: "3 SECONDS TO HOOK\nYOUR AUDIENCE.", x: 160, y: 440, fontSize: 72, fontWeight: 900, fontFamily: "Anton", fill: "#ffffff", zIndex: 1 }
    ]
  }
];

// In-memory cache for fast access & offline/local fallback
const memoryTemplates = new Map();
SAMPLE_TEMPLATES.forEach(t => memoryTemplates.set(t.id, { ...t, status: "published" }));
const memoryProjects = new Map();

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL && db && typeof db.query === "function");
}

// Ensure tables exist on boot
let initPromise = null;
async function ensureTables() {
  if (!hasDatabase()) return true;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await db.query(`
        create table if not exists public.design_projects (
          id text primary key,
          user_id uuid not null references public.users(id) on delete cascade,
          name text not null default 'Untitled Design',
          design_type text not null default 'youtube-thumbnail',
          canvas jsonb not null default '{"width": 1280, "height": 720}'::jsonb,
          source jsonb not null default '{"type": "scratch"}'::jsonb,
          elements jsonb not null default '[]'::jsonb,
          preview_url text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create index if not exists design_projects_user_updated_idx
          on public.design_projects(user_id, updated_at desc);

        create table if not exists public.design_templates (
          id text primary key,
          author_id uuid references public.users(id) on delete set null,
          author_name text not null default 'ShortsCraft Official',
          author_handle text not null default '@shortscraft',
          title text not null,
          description text default '',
          category text not null default 'youtube-thumbnail',
          design_type text not null default 'youtube-thumbnail',
          source_type text not null default 'shortscraft_official',
          parent_template_id text,
          canvas jsonb not null default '{"width": 1280, "height": 720}'::jsonb,
          elements jsonb not null default '[]'::jsonb,
          preview_url text,
          likes integer not null default 0,
          uses integer not null default 0,
          status text not null default 'published',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create index if not exists design_templates_cat_status_idx
          on public.design_templates(category, status, created_at desc);

        create table if not exists public.design_conversion_jobs (
          id text primary key,
          user_id uuid references public.users(id) on delete cascade,
          status text not null default 'queued',
          progress integer not null default 0,
          design_type text not null default 'youtube-thumbnail',
          source_image_name text not null,
          source_asset_path text,
          result_project_id text references public.design_projects(id) on delete set null,
          result_project jsonb,
          error_message text,
          created_at timestamptz not null default now(),
          completed_at timestamptz
        );
      `);
      await seedOfficialTemplates();
    } catch (err) {
      console.warn("[designs.js] Table init notice (running with memory cache):", err.message);
    }
  })();
  return initPromise;
}

function publicProject(row) {
  return {
    id: row.id,
    userId: row.user_id || row.userId,
    name: row.name,
    title: row.name,
    designType: row.design_type || row.designType,
    canvas: row.canvas || { width: 1280, height: 720 },
    source: row.source || { type: "scratch" },
    elements: Array.isArray(row.elements) ? row.elements : [],
    previewUrl: row.preview_url || row.previewUrl || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
  };
}

function publicTemplate(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    category: row.category,
    designType: row.design_type || row.designType,
    sourceType: row.source_type || row.sourceType, // 'shortscraft_official', 'creator_original', 'creator_ai_converted', 'image'
    authorName: row.author_name || row.authorName || "Creator",
    authorHandle: row.author_handle || row.authorHandle || "@creator",
    authorId: row.author_id || row.authorId,
    canvas: row.canvas || { width: 1280, height: 720 },
    elements: Array.isArray(row.elements) ? row.elements : [],
    previewUrl: row.preview_url || row.previewUrl || "",
    likes: Number(row.likes) || 0,
    uses: Number(row.uses) || 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function cleanElements(elements) {
  if (!Array.isArray(elements)) return [];
  return elements.slice(0, MAX_ELEMENTS).map((el) => {
    if (!el || typeof el !== "object") return null;
    const type = String(el.type || "").toLowerCase();
    if (!["text", "image", "shape", "background"].includes(type)) return null;
    return el;
  }).filter(Boolean);
}

function getUserId(user) {
  if (!user) return null;
  if (typeof user === "string") return user.trim();
  return (user.id || user.userId || "").trim();
}

// ── User Design Projects ──────────────────────────────────────
async function listProjects(user) {
  const uid = getUserId(user);
  if (!uid) return { error: "Please log in first.", status: 401 };

  if (hasDatabase()) {
    try {
      await ensureTables();
      const { rows } = await db.query(
        `select * from public.design_projects where user_id = $1 order by updated_at desc limit $2`,
        [uid, MAX_PROJECTS_PER_USER]
      );
      return { success: true, projects: rows.map(publicProject) };
    } catch (e) {
      console.warn("[designs.js] listProjects storage unavailable:", e.message);
      return { error: "Projects could not be loaded. Please try again.", status: 503 };
    }
  }

  const list = [];
  for (const p of memoryProjects.values()) {
    if (p.userId === uid) list.push(publicProject(p));
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return { success: true, projects: list.slice(0, MAX_PROJECTS_PER_USER) };
}

async function getProject(userOrId, optionalId) {
  const isDirectId = typeof userOrId === "string" && !optionalId;
  const id = isDirectId ? userOrId : String(optionalId || "");
  const uid = isDirectId ? null : getUserId(userOrId);

  if (!id) return { error: "Project ID required.", status: 400 };

  if (hasDatabase()) {
    try {
      await ensureTables();
      const query = uid
        ? `select * from public.design_projects where id = $1 and user_id = $2`
        : `select * from public.design_projects where id = $1`;
      const params = uid ? [id, uid] : [id];
      const { rows } = await db.query(query, params);
      if (rows[0]) return { success: true, project: publicProject(rows[0]) };
    } catch (e) {
      console.warn("[designs.js] getProject storage unavailable:", e.message);
      return { error: "Your project could not be loaded. Please try again.", status: 503 };
    }
  }

  const p = memoryProjects.get(id);
  if (!p || (uid && p.userId !== uid)) {
    return { error: "Design project not found.", status: 404 };
  }
  return { success: true, project: publicProject(p) };
}

async function saveProject(userOrBody, idOrBody, optionalBody) {
  let user = null;
  let id = null;
  let body = null;

  if (optionalBody) {
    user = userOrBody;
    id = idOrBody;
    body = optionalBody;
  } else if (idOrBody && typeof idOrBody === "object") {
    user = userOrBody;
    body = idOrBody;
    id = body.id;
  } else if (typeof userOrBody === "object" && userOrBody.elements) {
    body = userOrBody;
    id = body.id;
    user = body.userId || "anonymous";
  }

  const uid = getUserId(user);
  if (!uid || uid === "anonymous") return { error: "Please log in first.", status: 401 };
  const requestedId = String(id || body?.id || "").trim();
  const projectId = !requestedId || requestedId === "new" ? `dp_${crypto.randomBytes(12).toString("hex")}` : requestedId;
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(projectId)) {
    return { error: "Invalid project ID.", status: 400 };
  }

  const name = String(body?.name || body?.title || "Untitled Design").trim().slice(0, 100) || "Untitled Design";
  const designType = String(body?.designType || "youtube-thumbnail").slice(0, 40);
  const canvas = body?.canvas && typeof body.canvas === "object" ? body.canvas : { width: 1280, height: 720 };
  const source = body?.source && typeof body.source === "object" ? body.source : { type: "scratch" };
  const elements = cleanElements(body?.elements);
  const previewUrl = String(body?.previewUrl || "");
  if (Buffer.byteLength(previewUrl, "utf8") > 1024 * 1024) {
    return { error: "Design preview is too large to save.", status: 413 };
  }

  const payload = JSON.stringify(elements);
  if (Buffer.byteLength(payload, "utf8") > MAX_BYTES) {
    return { error: "Design project is too large to save.", status: 413 };
  }

  if (hasDatabase() && uid !== "anonymous") {
    try {
      await ensureTables();
      const { rows } = await db.query(
        `insert into public.design_projects (id, user_id, name, design_type, canvas, source, elements, preview_url, updated_at)
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, now())
         on conflict (id) do update
           set name = excluded.name,
               design_type = excluded.design_type,
               canvas = excluded.canvas,
               source = excluded.source,
               elements = excluded.elements,
               preview_url = coalesce(excluded.preview_url, public.design_projects.preview_url),
               updated_at = now()
           where public.design_projects.user_id = excluded.user_id
         returning *`,
        [projectId, uid, name, designType, JSON.stringify(canvas), JSON.stringify(source), payload, previewUrl]
      );
      if (rows[0]) return { success: true, project: publicProject(rows[0]) };
      return { error: "This project could not be updated by your account.", status: 403 };
    } catch (e) {
      console.warn("[designs.js] saveProject storage unavailable:", e.message);
      return { error: "Your design was not saved. Please try again when storage is available.", status: 503 };
    }
  }

  if (process.env.NODE_ENV === "production") return { error: "Project storage is unavailable.", status: 503 };
  const existingProject = memoryProjects.get(projectId);
  if (existingProject && existingProject.userId !== uid) return { error: "This project belongs to another account.", status: 403 };
  const projectRecord = {
    id: projectId,
    userId: uid,
    name,
    designType,
    canvas,
    source,
    elements,
    previewUrl,
    createdAt: memoryProjects.get(projectId)?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  memoryProjects.set(projectId, projectRecord);
  return { success: true, project: publicProject(projectRecord) };
}

async function removeProject(user, id) {
  const uid = getUserId(user);
  if (!uid) return { error: "Please log in first.", status: 401 };

  if (hasDatabase()) {
    try {
      await ensureTables();
      const { rowCount } = await db.query(
        `delete from public.design_projects where id = $1 and user_id = $2`,
        [String(id || ""), uid]
      );
      if (rowCount) return { success: true };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory removeProject:", e.message);
    }
  }

  const p = memoryProjects.get(id);
  if (p && p.userId === uid) {
    memoryProjects.delete(id);
    return { success: true };
  }
  return { error: "Project not found or unauthorized.", status: 404 };
}

// ── Design Templates (Public & Community) ──────────────────────
async function listTemplates(category) {
  if (hasDatabase()) {
    try {
      await ensureTables();
      let query = `select * from public.design_templates where status = 'published'`;
      const params = [];
      if (category && category !== "all") {
        params.push(category);
        query += ` and (category = $1 or design_type = $1)`;
      }
      query += ` order by uses desc, likes desc, created_at desc limit 40`;
      const { rows } = await db.query(query, params);
      if (rows && rows.length) return { success: true, templates: rows.map(publicTemplate) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory listTemplates:", e.message);
    }
  }

  const list = [];
  for (const t of memoryTemplates.values()) {
    if (t.status === "published") {
      if (!category || category === "all" || t.category === category || t.design_type === category) {
        list.push(publicTemplate(t));
      }
    }
  }
  list.sort((a, b) => (b.uses + b.likes) - (a.uses + a.likes));
  return { success: true, templates: list };
}

async function getTemplate(id) {
  const templateId = String(id || "");
  if (hasDatabase()) {
    try {
      await ensureTables();
      const { rows } = await db.query(
        `select * from public.design_templates where id = $1 and status = 'published'`,
        [templateId]
      );
      if (rows[0]) return { success: true, template: publicTemplate(rows[0]) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory getTemplate:", e.message);
    }
  }

  const t = memoryTemplates.get(templateId);
  if (!t || t.status !== "published") return { error: "Design template not found.", status: 404 };
  return { success: true, template: publicTemplate(t) };
}

async function cloneTemplate(userOrId, templateId) {
  const uid = getUserId(userOrId);
  if (!uid) return { error: "Please log in to use this template.", status: 401 };

  const tplRes = await getTemplate(templateId);
  if (!tplRes.success) return tplRes;
  const tpl = tplRes.template;

  // Increment usage count
  if (hasDatabase()) {
    db.query(`update public.design_templates set uses = uses + 1 where id = $1`, [tpl.id]).catch(() => {});
  }
  const cached = memoryTemplates.get(tpl.id);
  if (cached) cached.uses = (cached.uses || 0) + 1;

  const newProjectId = `dp_${crypto.randomBytes(6).toString("hex")}`;
  const sourceMeta = {
    type: "template_clone",
    parentTemplateId: tpl.id,
    sourceCreatorName: tpl.authorName,
    sourceCreatorHandle: tpl.authorHandle,
    sourceType: tpl.sourceType
  };

  return saveProject(userOrId, newProjectId, {
    name: `${tpl.title} (Copy)`,
    designType: tpl.designType,
    canvas: tpl.canvas,
    source: sourceMeta,
    elements: tpl.elements,
    previewUrl: tpl.previewUrl
  });
}

async function publishTemplate(user, body) {
  const uid = getUserId(user);
  if (!uid) return { error: "Please log in first.", status: 401 };

  const title = String(body.title || "").trim().slice(0, 100);
  if (!title) return { error: "Template title is required.", status: 400 };

  const projectId = String(body.projectId || "");
  const elements = cleanElements(body.elements);
  if (!elements.length) return { error: "Cannot publish an empty design template.", status: 400 };

  const designType = String(body.designType || "youtube-thumbnail");
  const category = String(body.category || designType);
  const description = String(body.description || "").slice(0, 300);
  const canvas = body.canvas && typeof body.canvas === "object" ? body.canvas : { width: 1280, height: 720 };
  const previewUrl = String(body.previewUrl || "");
  if (Buffer.byteLength(previewUrl, "utf8") > 1024 * 1024) {
    return { error: "Template preview is too large. Try a smaller canvas.", status: 413 };
  }

  const tplId = `dt_${crypto.randomBytes(6).toString("hex")}`;
  const authorName = String(user.displayName || user.name || "Creator").slice(0, 60);
  const authorHandle = String(user.handle || "@creator").slice(0, 40);

  if (hasDatabase()) {
    try {
      await ensureTables();
      const rows = await db.tx(async (client) => {
        await designAssets.makePublic(client, uid, elements);
        const inserted = await client.query(
        `insert into public.design_templates
          (id, author_id, author_name, author_handle, title, description, category, design_type,
           source_type, parent_template_id, canvas, elements, preview_url, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'creator_original', $9, $10::jsonb, $11::jsonb, $12, 'published')
         returning *`,
        [tplId, uid, authorName, authorHandle, title, description, category, designType,
         projectId, JSON.stringify(canvas), JSON.stringify(elements), previewUrl]
        );
        return inserted.rows;
      });
      if (rows[0]) return { success: true, template: publicTemplate(rows[0]) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory publishTemplate:", e.message);
      return { error: "Your template was not published. Please retry when storage is available.", status: 503 };
    }
  }

  if (process.env.NODE_ENV === "production") return { error: "Template storage is unavailable.", status: 503 };
  const tplRecord = {
    id: tplId,
    author_id: uid,
    author_name: authorName,
    author_handle: authorHandle,
    title,
    description,
    category,
    design_type: designType,
    source_type: "creator_original",
    parent_template_id: projectId,
    canvas,
    elements,
    preview_url: previewUrl,
    likes: 0,
    uses: 0,
    status: "published"
  };
  memoryTemplates.set(tplId, tplRecord);
  return { success: true, template: publicTemplate(tplRecord) };
}

async function seedOfficialTemplates() {
  if (!hasDatabase()) return;
  try {
    const { rows } = await db.query(`select count(*)::int as count from public.design_templates where source_type = 'shortscraft_official'`);
    if (rows[0]?.count > 0) return;

    for (const tpl of SAMPLE_TEMPLATES) {
      await db.query(
        `insert into public.design_templates
          (id, title, description, category, design_type, source_type, canvas, elements, status)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'published')
         on conflict (id) do nothing`,
        [tpl.id, tpl.title, tpl.description, tpl.category, tpl.design_type, tpl.source_type,
         JSON.stringify(tpl.canvas), JSON.stringify(tpl.elements)]
      ).catch(() => {});
    }
  } catch (e) {
    // Ignore seed warning in non-db environments
  }
}

module.exports = {
  ensureTables,
  listProjects,
  getProject,
  saveProject,
  removeProject,
  listTemplates,
  getTemplate,
  cloneTemplate,
  publishTemplate,
  publicProject,
  publicTemplate
};
