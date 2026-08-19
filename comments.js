// ============================================================
// ShortsCraft — Comments Ledger Backend
// Manages real-time template comments and creator discussions
// ============================================================
const fs = require("fs");
const path = require("path");

// Overridable so the container can point it at the mounted volume — writing
// inside the image would lose every comment on each redeploy.
const COMMENTS_FILE = process.env.COMMENTS_FILE || path.join(__dirname, ".comments.json");

const SEED_COMMENTS = {
  "docu-red-string": [
    { id: "c_1", authorName: "Aryan Vlogs", authorHandle: "@aryan_edits", text: "This corkboard hook helped my crime short hit 180k views! The string connection animation is so smooth.", time: "2 hours ago", likes: 14 },
    { id: "c_2", authorName: "Rohan FX", authorHandle: "@rohan_motion", text: "Can we customize the text inside the polaroids in the editor?", time: "5 hours ago", likes: 8 },
    { id: "c_3", authorName: "Crime Chronicles", authorHandle: "@crime_vault", text: "Best investigation board template available online. 10/10.", time: "1 day ago", likes: 22 }
  ],
  "social-views-counter": [
    { id: "c_4", authorName: "Tech Trends", authorHandle: "@techtrends_in", text: "The milestone tick animation is perfect for subscriber growth reels.", time: "1 hour ago", likes: 19 },
    { id: "c_5", authorName: "Kabir", authorHandle: "@kabir_shorts", text: "Smooth 60fps counter! Looks very professional.", time: "4 hours ago", likes: 7 }
  ],
  "paper-torn-rip": [
    { id: "c_6", authorName: "Kunal Designs", authorHandle: "@kunal_fx", text: "The torn paper texture on cutting mat looks 100% like After Effects!", time: "3 hours ago", likes: 31 },
    { id: "c_7", authorName: "Ananya", authorHandle: "@ananya_motion", text: "Procedural deckle edges are crazy good 🔥", time: "6 hours ago", likes: 12 }
  ],
  "ui-google-search": [
    { id: "c_8", authorName: "Vikram Dev", authorHandle: "@vikram_dev", text: "The typing cursor and drop suggest animation is super engaging.", time: "30 mins ago", likes: 15 },
    { id: "c_9", authorName: "Shorts Guy", authorHandle: "@shorts_master", text: "Used this for an SEO tutorial short, worked like magic.", time: "2 days ago", likes: 9 }
  ]
};

let store = {};

function load() {
  try {
    if (fs.existsSync(COMMENTS_FILE)) {
      store = JSON.parse(fs.readFileSync(COMMENTS_FILE, "utf8"));
    } else {
      store = JSON.parse(JSON.stringify(SEED_COMMENTS));
      save();
    }
  } catch (e) {
    store = JSON.parse(JSON.stringify(SEED_COMMENTS));
  }
}

function save() {
  try {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    console.warn("[comments save skipped]", e.message);
  }
}

load();

function getComments(tplId) {
  load();
  if (store[tplId]) return store[tplId];
  // Generate generic initial comments for any template
  return [
    { id: "c_gen_1", authorName: "Motion Creator", authorHandle: "@motion_pro", text: "Stunning kinetic pacing and clean easing curves. Great template!", time: "4 hours ago", likes: 5 },
    { id: "c_gen_2", authorName: "Creator Hub", authorHandle: "@creator_daily", text: "Super easy to customize in the Studio editor.", time: "1 day ago", likes: 3 }
  ];
}

function addComment(tplId, commentData, user) {
  load();
  if (!store[tplId]) {
    store[tplId] = getComments(tplId);
  }
  const handle = (user && user.handle) || commentData.authorHandle || "@creator_" + Math.floor(Math.random() * 899 + 100);
  const name = (user && user.name) || commentData.authorName || "Creator";
  const newC = {
    id: "c_" + Date.now(),
    authorName: name,
    authorHandle: handle.startsWith("@") ? handle : "@" + handle,
    text: String(commentData.text || "").trim().slice(0, 500),
    time: "Just now",
    likes: 1
  };
  store[tplId].unshift(newC);
  save();
  return newC;
}

module.exports = {
  getComments,
  addComment
};
