/* ============================================================
   designs.js — ShortsCraft Design Projects & Template Store.
   Supports editable YouTube thumbnails, posters, logos, social posts,
   and AI-converted design templates.
   ============================================================ */
const crypto = require("crypto");
const designAssets = require("./design-assets");
const verified = require("./verified");

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
    canvas: { width: 1024, height: 576 },
    preview_url: "/storage/designs/templates/heygen-trick.jpg",
    previewUrl: "/storage/designs/templates/heygen-trick.jpg",
    likes: 0,
    uses: 0,
    elements: [
      {
        id: "layer_background",
        name: "Clean Neon Green Backdrop",
        type: "image",
        role: "background",
        src: "/storage/designs/templates/heygen/bg_clean.webp",
        x: 0,
        y: 0,
        width: 1024,
        height: 576,
        zIndex: 0,
        locked: true
      },
      {
        id: "character",
        name: "Anime Character Cutout",
        type: "image",
        role: "foreground-object",
        src: "/storage/designs/templates/heygen/character.webp",
        x: 0,
        y: 0,
        width: 1024,
        height: 576,
        zIndex: 1
      },
      {
        id: "hand_back",
        name: "Hand (Palm & Thumb Behind)",
        type: "image",
        role: "foreground-object",
        src: "/storage/designs/templates/heygen/hand_back.webp",
        x: 0,
        y: 0,
        width: 1024,
        height: 576,
        zIndex: 2
      },
      {
        id: "product_card_base",
        name: "Product Card Base (Inpainted Blank)",
        type: "image",
        role: "card-surface",
        src: "/storage/designs/templates/heygen/product_card_base.webp",
        x: 0,
        y: 0,
        width: 1024,
        height: 576,
        zIndex: 3
      },
      {
        id: "product_logo",
        name: "Product Logo (Replaceable)",
        type: "image",
        role: "replaceable-image",
        replaceable: true,
        src: "/storage/designs/templates/heygen/product_logo.webp",
        x: 265,
        y: 293,
        width: 134,
        height: 152,
        zIndex: 4
      },
      {
        id: "product_name",
        name: "Product Name",
        type: "text",
        role: "product-name",
        text: "HeyGen",
        x: 245,
        y: 450,
        width: 200,
        height: 55,
        fontSize: 42,
        fontWeight: 800,
        fontFamily: "Montserrat",
        fill: "#18181b",
        alignment: "center",
        autoFit: true,
        zIndex: 5
      },
      {
        id: "hand_front",
        name: "Hand (Foreground Fingers)",
        type: "image",
        role: "foreground-object",
        src: "/storage/designs/templates/heygen/hand_front.webp",
        x: 0,
        y: 0,
        width: 1024,
        height: 576,
        zIndex: 6
      },
      {
        id: "arrow",
        name: "Orange Curved Arrow",
        type: "image",
        role: "foreground-object",
        src: "/storage/designs/templates/heygen/arrow.webp",
        x: 0,
        y: 0,
        width: 1024,
        height: 576,
        zIndex: 7
      },
      {
        id: "youtube_icon",
        name: "YouTube Corner Icon",
        type: "image",
        role: "foreground-object",
        src: "/storage/designs/templates/heygen/youtube_icon.webp",
        x: 0,
        y: 0,
        width: 1024,
        height: 576,
        zIndex: 8
      },
      {
        id: "shape_1",
        name: "Subtitle Pill Badge",
        type: "shape",
        shape: "pill",
        x: 82,
        y: 207,
        width: 532,
        height: 40,
        fill: "#18181b",
        stroke: "#34d399",
        strokeWidth: 2,
        radius: 20,
        zIndex: 9
      },
      {
        id: "text_1",
        name: 'Headline: "FREE & UNLIMITED"',
        type: "text",
        text: "FREE & UNLIMITED",
        x: 41,
        y: 29,
        width: 594,
        height: 69,
        fontFamily: "Space Grotesk",
        fontSize: 71,
        fontWeight: 800,
        fill: "#09090b",
        alignment: "center",
        zIndex: 10
      },
      {
        id: "text_2",
        name: 'Main Title: "HeyGen Trick!"',
        type: "text",
        text: "HeyGen Trick!",
        x: 41,
        y: 105,
        width: 635,
        height: 104,
        fontFamily: "Montserrat",
        fontSize: 88,
        fontWeight: 900,
        fill: "#dc2626",
        stroke: "#ffffff",
        strokeWidth: 5,
        shadow: {
          color: "rgba(0,0,0,0.85)",
          blur: 6,
          offsetX: 0,
          offsetY: 4
        },
        alignment: "center",
        zIndex: 11
      },
      {
        id: "text_3_icon",
        name: "Subtitle Icon",
        type: "text",
        text: "🤯",
        x: 96,
        y: 224,
        width: 24,
        height: 22,
        fontFamily: "Space Grotesk",
        fontSize: 18,
        fontWeight: 800,
        fill: "#ffffff",
        alignment: "center",
        zIndex: 12
      },
      {
        id: "text_3",
        name: 'Subtitle: "NO CREDITS, NO SUB"',
        type: "text",
        text: "NO CREDITS, NO SUBSCRIPTION",
        x: 124,
        y: 225,
        width: 474,
        height: 20,
        fontFamily: "Space Grotesk",
        fontSize: 18,
        fontWeight: 800,
        fill: "#ffffff",
        alignment: "left",
        zIndex: 13
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
    uses: 0,
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
    uses: 0,
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
    uses: 0,
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
    uses: 0,
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
    uses: 0,
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
    uses: 0,
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
      console.warn("[designs.js] Schema bootstrap unavailable; existing tables will be queried, and failed writes will return an error:", err.message);
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
  const canvas = row.canvas && typeof row.canvas === "object" ? row.canvas : { width: 1280, height: 720 };
  const isPremium = row.category === "premium" || canvas.isPremium === true;
  const starPrice = (canvas && Number(canvas.starPrice)) || (isPremium ? 1 : 0);
  const handle = row.author_handle || row.authorHandle || "@creator";
  const name = row.author_name || row.authorName || "Creator";
  const verifiedStatus = row.author_verified === true || row.authorVerified === true || String(handle).replace(/^@/, "").toLowerCase() === "shortscraft";
  const avatarUrl = row.author_has_avatar && (row.account_id || row.author_id)
    ? `/api/users/${encodeURIComponent(row.account_id || row.author_id)}/avatar`
    : (row.author_avatar_url || row.authorAvatarUrl || "");

  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    category: row.category,
    isPremium,
    starPrice,
    remixOf: (canvas && canvas.remixOf) || null,
    designType: row.design_type || row.designType,
    sourceType: row.source_type || row.sourceType, // 'shortscraft_official', 'creator_original', 'creator_ai_converted', 'image'
    authorName: name,
    authorHandle: handle,
    authorId: row.author_id || row.authorId,
    authorVerified: verifiedStatus,
    authorAvatarUrl: avatarUrl,
    canvas,
    elements: Array.isArray(row.elements) ? row.elements : [],
    previewUrl: row.preview_url || row.previewUrl || "",
    likes: Number(row.likes) || 0,
    uses: Number(row.uses) || 0,
    status: row.status || "published",
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
  if (!p || (uid && p.userId !== uid && p.userId !== "guest_creator")) {
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
      let query = `select dt.*, ${verified.sql("u")} as author_verified, u.id as account_id,
                   coalesce(u.display_name, dt.author_name, 'Creator') as author_name,
                   coalesce(u.handle, dt.author_handle, '@creator') as author_handle,
                   (u.avatar_bytes is not null) as author_has_avatar
                   from public.design_templates dt
                   left join public.users u on u.id = coalesce(dt.author_id, (select o.id from public.users o
                                             where lower(replace(dt.author_handle, '@', '')) = 'shortscraft'
                                               and lower(replace(o.handle, '@', '')) = 'shortscraft' limit 1))
                   where dt.status = 'published'`;
      const params = [];
      if (category && category !== "all") {
        params.push(category);
        query += ` and (dt.category = $1 or dt.design_type = $1)`;
      }
      query += ` order by dt.uses desc, dt.likes desc, dt.created_at desc limit 40`;
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
        `select dt.*, ${verified.sql("u")} as author_verified, u.id as account_id,
                coalesce(u.display_name, dt.author_name, 'Creator') as author_name,
                coalesce(u.handle, dt.author_handle, '@creator') as author_handle,
                (u.avatar_bytes is not null) as author_has_avatar
         from public.design_templates dt
         left join public.users u on u.id = coalesce(dt.author_id, (select o.id from public.users o
                                   where lower(replace(dt.author_handle, '@', '')) = 'shortscraft'
                                     and lower(replace(o.handle, '@', '')) = 'shortscraft' limit 1))
         where dt.id = $1 and dt.status = 'published'`,
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

  if (tpl.isPremium) {
    const isOwner = tpl.authorId === uid;
    if (!isOwner) {
      const social = require("./social");
      const access = await social.checkTemplateAccess({ id: uid }, tpl.id, "design");
      if (!access.unlocked) {
        return {
          error: `This is a Premium Template. Please unlock it with ${tpl.starPrice} Stars to remix or customize.`,
          status: 402,
          needUnlock: true,
          starPrice: tpl.starPrice,
          templateId: tpl.id
        };
      }
    }
  }

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
  if (tpl.isPremium) {
    sourceMeta.remixOf = {
      parentTemplateId: tpl.id,
      parentTitle: tpl.title,
      authorName: tpl.authorName,
      authorHandle: tpl.authorHandle
    };
  }

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
  const parentTemplateId = (typeof body.parentTemplateId === "string" && body.parentTemplateId.startsWith("dt_"))
    ? body.parentTemplateId
    : ((typeof body.remixOf === "string" && body.remixOf.startsWith("dt_")) ? body.remixOf : null);
  const elements = cleanElements(body.elements);
  if (!elements.length) return { error: "Cannot publish an empty design template.", status: 400 };

  const isPremium = String(body.category) === "premium" || body.isPremium === true;
  let starPrice = 0;
  if (isPremium) {
    starPrice = Math.max(1, parseInt(body.starPrice, 10) || 1);
  }
  const status = isPremium ? "review" : "published";

  const designType = String(body.designType || "youtube-thumbnail");
  const category = isPremium ? "premium" : String(body.category || designType);
  const description = String(body.description || "").slice(0, 300);
  const canvas = body.canvas && typeof body.canvas === "object" ? { ...body.canvas } : { width: 1280, height: 720 };
  if (isPremium) {
    canvas.isPremium = true;
    canvas.starPrice = starPrice;
  }
  if (body.remixOf && typeof body.remixOf === "object") {
    canvas.remixOf = body.remixOf;
  }

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
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'creator_original', $9, $10::jsonb, $11::jsonb, $12, $13)
         returning *`,
        [tplId, uid, authorName, authorHandle, title, description, category, designType,
         parentTemplateId, JSON.stringify(canvas), JSON.stringify(elements), previewUrl, status]
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
    parent_template_id: parentTemplateId,
    canvas,
    elements,
    preview_url: previewUrl,
    likes: 0,
    uses: 0,
    status: status,
    created_at: Date.now(),
    updated_at: Date.now()
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
