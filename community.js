/* ============================================================
   community.js — Community Templates & Creator Publishing Ledger
   Allows creators to publish their customized animations as templates
   for the community to browse, like, and edit in the Studio.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = process.env.COMMUNITY_FILE || path.join(__dirname, ".community.json");

const SEED_TEMPLATES = [
  {
    id: "comm_neon_counter",
    title: "Cyberpunk Subscriber Counter",
    description: "High energy glowing subscriber milestone counter with neon green ring and pulse.",
    category: "charts",
    tpl: "ring-counter",
    lines: ["Subscribers", "100K", "Milestone Reached"],
    accent: "#37e0c8",
    font: "grotesk",
    dur: 4600,
    authorName: "Aman Motion FX",
    authorHandle: "aman_fx",
    likes: 142,
    downloads: 389,
    createdAt: "2026-08-10T10:00:00.000Z"
  },
  {
    id: "comm_apple_event",
    title: "Apple Keynote Lock Screen Alert",
    description: "Clean iOS notification spring for product launch drops and new video releases.",
    category: "ui",
    tpl: "ios-notify",
    lines: ["YouTube", "New Short is trending #1", "Tap to view analytics"],
    accent: "#5b8cff",
    font: "inter",
    dur: 4600,
    authorName: "Sarah Creative",
    authorHandle: "sarah_motion",
    likes: 218,
    downloads: 512,
    createdAt: "2026-08-11T14:20:00.000Z"
  },
  {
    id: "comm_viral_hook",
    title: "Viral Retention Punch Hook",
    description: "High speed typography cascade designed to stop the scroll in first 2 seconds.",
    category: "text",
    tpl: "type-cascade",
    lines: ["Stop scrolling", "Watch this trick", "To grow 10x faster"],
    accent: "#ffd166",
    font: "grotesk",
    dur: 4200,
    authorName: "Vikram Shorts",
    authorHandle: "vikram_creations",
    likes: 305,
    downloads: 870,
    createdAt: "2026-08-12T09:15:00.000Z"
  },
  {
    id: "comm_revenue_stack",
    title: "Passive Income Revenue Growth",
    description: "Animated money stack with rising revenue counter for faceless finance channels.",
    category: "money",
    tpl: "cash-stack",
    lines: ["Monthly AdSense", "$14,500", "Consistent growth"],
    accent: "#3ddc84",
    font: "inter",
    dur: 4800,
    authorName: "Finance Pulse",
    authorHandle: "finance_pulse",
    likes: 174,
    downloads: 420,
    createdAt: "2026-08-12T16:40:00.000Z"
  },
  {
    id: "comm_dark_mode_toggle",
    title: "Feature Switch / Pro Mode",
    description: "iOS style toggle switch flipping on to showcase a new product feature or mode.",
    category: "ui",
    tpl: "toggle-ui",
    lines: ["STANDARD", "PRO AI", "Unlock full 4K rendering"],
    accent: "#34d17a",
    font: "inter",
    dur: 4600,
    authorName: "Dev Studio",
    authorHandle: "dev_designer",
    likes: 96,
    downloads: 240,
    createdAt: "2026-08-13T11:00:00.000Z"
  },
  {
    id: "comm_brand_reveal",
    title: "Minimal Monogram Logo Drawing",
    description: "Stroke-dash animation drawing your brand logo before revealing the channel name.",
    category: "logos",
    tpl: "logo-draw",
    lines: ["Vault Media", "Shorts & Reels Production", ""],
    accent: "#ffffff",
    font: "grotesk",
    dur: 4400,
    authorName: "Kabir Designs",
    authorHandle: "kabir_motion",
    likes: 163,
    downloads: 395,
    createdAt: "2026-08-13T18:30:00.000Z"
  }
];

let cache = null;
let cacheMtime = 0;

function load() {
  let mtime = 0;
  try { mtime = fs.statSync(FILE).mtimeMs; } catch (e) { mtime = 0; }
  if (cache && mtime === cacheMtime) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!cache || !Array.isArray(cache.templates)) {
      cache = { templates: SEED_TEMPLATES.slice() };
      save();
    }
  } catch (e) {
    cache = { templates: SEED_TEMPLATES.slice() };
    save();
  }
  cacheMtime = mtime;
  return cache;
}

function save() {
  const db = cache || { templates: SEED_TEMPLATES.slice() };
  try {
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, FILE);
    cacheMtime = fs.statSync(FILE).mtimeMs;
  } catch (e) {
    console.warn("[community] could not persist:", e.message);
  }
}

function list(category) {
  const db = load();
  let list = db.templates || [];
  if (category && category !== "all") {
    list = list.filter(t => t.category === category || t.tpl === category);
  }
  // Sort by newest first
  return list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function get(id) {
  const db = load();
  return (db.templates || []).find(t => t.id === id) || null;
}

function publish(data, user) {
  if (!data || !data.title || !data.tpl) {
    return { error: "Template title and type are required." };
  }

  const db = load();
  const id = "comm_" + crypto.randomBytes(6).toString("hex");

  const authorName = user?.email
    ? user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "")
    : (data.authorName || "Creator");

  const authorHandle = (data.authorHandle || authorName).toLowerCase().replace(/[^a-z0-9_]/g, "");

  const template = {
    id,
    title: String(data.title).trim().slice(0, 80),
    description: String(data.description || "").trim().slice(0, 300),
    category: data.category || "text",
    tpl: data.tpl,
    lines: Array.isArray(data.lines) ? data.lines.map(l => String(l || "").slice(0, 120)) : ["", "", ""],
    accent: data.accent || "#ffffff",
    font: data.font || "inter",
    dur: Number(data.dur) || 4600,
    authorName: authorName || "Creator",
    authorHandle: authorHandle || "creator",
    authorId: user?.id || null,
    likes: 1,
    downloads: 1,
    createdAt: new Date().toISOString()
  };

  db.templates.unshift(template);
  save();

  return { success: true, template };
}

function like(id) {
  const db = load();
  const t = (db.templates || []).find(x => x.id === id);
  if (!t) return { error: "Template not found" };
  t.likes = (t.likes || 0) + 1;
  save();
  return { success: true, likes: t.likes };
}

function listByAuthor(userId, userHandle) {
  const db = load();
  let list = db.templates || [];
  if (userId) {
    const byId = list.filter(t => t.authorId === userId);
    if (byId.length > 0) return byId;
  }
  if (userHandle) {
    const handleNorm = userHandle.toLowerCase().replace(/^@/, "");
    const byHandle = list.filter(t => String(t.authorHandle || "").toLowerCase() === handleNorm || String(t.authorName || "").toLowerCase() === handleNorm);
    if (byHandle.length > 0) return byHandle;
  }
  // If user has not published custom items yet, return a curated starter set of creator templates
  return list.slice(0, 3);
}

function remove(id, user) {
  const db = load();
  const idx = (db.templates || []).findIndex(t => t.id === id);
  if (idx === -1) return { error: "Template not found" };
  const t = db.templates[idx];
  if (user && t.authorId && t.authorId !== user.id) {
    return { error: "Unauthorized to delete this template" };
  }
  db.templates.splice(idx, 1);
  save();
  return { success: true };
}

module.exports = { list, get, publish, like, listByAuthor, remove };
