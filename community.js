/* ============================================================
   community.js — Community Templates & Creator Publishing Ledger
   Allows creators to publish their customized animations as templates
   for the community to browse, like, and edit in the Studio.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = process.env.COMMUNITY_FILE || path.join(__dirname, ".community.json");const SEED_TEMPLATES = [
  {
    "id": "comm_paper_torn",
    "title": "Torn Paper on Cutting Mat",
    "description": "Procedural torn paper cutout slamming onto studio green grid cutting mat with deckle edges and heavy drop shadow",
    "category": "paper",
    "tpl": "paper-torn-rip",
    "lines": ["CONFIDENTIAL", "UNCOVER THE TRUTH", ""],
    "accent": "#d32f2f",
    "font": "grotesk",
    "dur": 4600,
    "authorName": "Aman Motion FX",
    "authorHandle": "aman_fx",
    "likes": 348,
    "downloads": 890,
    "createdAt": "2026-08-15T12:00:00.000Z"
  },
  {
    "id": "comm_cork_board",
    "title": "Red String Investigation Board",
    "description": "Photorealistic dark corkboard bulletin with connected evidence polaroids and red yarn thread",
    "category": "docu",
    "tpl": "docu-red-string",
    "lines": ["Suspect Alpha", "Shell Company", "The Coverup"],
    "accent": "#ef4444",
    "font": "mono",
    "dur": 5000,
    "authorName": "Crime Stories",
    "authorHandle": "crimedocu",
    "likes": 420,
    "downloads": 1150,
    "createdAt": "2026-08-15T14:30:00.000Z"
  },
  {
    "id": "comm_glow_toggle",
    "title": "Neon Vibe Toggle Switch",
    "description": "3D glowing toggle switch with smooth spring translation, glowing ambient aura, and tactile status toggle",
    "category": "ui",
    "tpl": "ui-toggle",
    "lines": ["The vibe is just.", "PRO ACTIVE // 60 FPS", ""],
    "accent": "#00ffaa",
    "font": "inter",
    "dur": 4400,
    "authorName": "Sarah Creative",
    "authorHandle": "sarah_motion",
    "likes": 295,
    "downloads": 730,
    "createdAt": "2026-08-15T16:20:00.000Z"
  },
  {
    "id": "comm_google_search",
    "title": "Interactive 3D Google Search",
    "description": "Clean search bar with real-time autocompleting query, blinking cursor and animated suggestions",
    "category": "ui",
    "tpl": "ui-google-search",
    "lines": ["How to go viral on YouTube Shorts", "ShortsCraft AI Studio", ""],
    "accent": "#4285f4",
    "font": "inter",
    "dur": 4800,
    "authorName": "Dev Studio",
    "authorHandle": "dev_designer",
    "likes": 312,
    "downloads": 840,
    "createdAt": "2026-08-15T18:00:00.000Z"
  },
  {
    "id": "comm_crypto_card",
    "title": "Titanium Card & Crypto Surge",
    "description": "Floating titanium card swipe with glowing chart spikes and net revenue counter",
    "category": "money",
    "tpl": "money-titanium-card",
    "lines": ["BLACK CARD", "Unlimited Growth", "4.8% Cashback"],
    "accent": "#a855f7",
    "font": "grotesk",
    "dur": 4600,
    "authorName": "Finance Pulse",
    "authorHandle": "finance_pulse",
    "likes": 188,
    "downloads": 520,
    "createdAt": "2026-08-16T11:40:00.000Z"
  },
  {
    "id": "comm_viral_views",
    "title": "Live Views Counter Ticker",
    "description": "Fast spinning views milestone odometer with trending badge and particle bursts",
    "category": "social",
    "tpl": "social-views-counter",
    "lines": ["TOTAL VIEWS", "1,000,000", "Trending #1 in India"],
    "accent": "#ff0055",
    "font": "grotesk",
    "dur": 4200,
    "authorName": "Vikram Shorts",
    "authorHandle": "vikram_creations",
    "likes": 380,
    "downloads": 990,
    "createdAt": "2026-08-16T14:10:00.000Z"
  },
  {
    "id": "comm_neon_ring",
    "title": "Cyberpunk Ring Milestone",
    "description": "Circular SVG ring progress sweep with central large percentage and glowing radar sweep",
    "category": "charts",
    "tpl": "charts-ring",
    "lines": ["RETENTION RATE", "87%", "Above 99% of Channels"],
    "accent": "#37e0c8",
    "font": "grotesk",
    "dur": 4600,
    "authorName": "Kabir Motion",
    "authorHandle": "kabir_motion",
    "likes": 215,
    "downloads": 640,
    "createdAt": "2026-08-16T16:00:00.000Z"
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
