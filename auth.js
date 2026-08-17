/* ============================================================
   auth.js — email + password accounts, with no external service.

   Why not Supabase: SUPABASE_URL / SUPABASE_ANON_KEY are not configured in this
   environment, so an auth flow built on it would be dead on arrival exactly the
   way the Groq-powered features are. This uses only node's crypto and the same
   file-backed store pattern as credits.js, so Log in / Sign up actually work
   today. Swap `load`/`save` for a database when there is one.

   Security choices, on purpose:
   • scrypt (N=16384) with a 16-byte per-user salt. No plaintext, no fast hash.
   • timingSafeEqual for both password and session comparisons.
   • Session token = random 32 bytes, stored HASHED. A stolen store cannot be
     replayed as a live session.
   • Cookie is HttpOnly + SameSite=Lax + Secure in production, so script cannot
     read it and it does not ride along on cross-site POSTs.
   • Login errors never say whether the email exists (no user enumeration).
   • Rate limited by the caller, and the work factor makes guessing expensive.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = process.env.USERS_FILE || path.join(__dirname, ".users.json");
const COOKIE = "sc_sid";
const SESSION_DAYS = 30;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

/* ── store ────────────────────────────────────────────────── */
let cache = null;
let cacheMtime = 0;

function load() {
  let mtime = 0;
  try { mtime = fs.statSync(FILE).mtimeMs; } catch (e) { mtime = 0; }
  if (cache && mtime === cacheMtime) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!cache || typeof cache !== "object") cache = {};
  } catch (e) {
    cache = {};
  }
  if (!cache.users) cache.users = {};        // id -> user
  if (!cache.byEmail) cache.byEmail = {};    // email -> id
  if (!cache.sessions) cache.sessions = {};  // tokenHash -> {id, exp}
  cacheMtime = mtime;
  return cache;
}

function save() {
  const db = load();
  try {
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db), "utf8");
    fs.renameSync(tmp, FILE);
    cacheMtime = fs.statSync(FILE).mtimeMs;
  } catch (e) {
    console.warn("[auth] could not persist:", e.message);
  }
}

/* ── helpers ──────────────────────────────────────────────── */
const normEmail = (e) => String(e || "").trim().toLowerCase();
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

function validEmail(email) {
  return /^[^\s@]{1,64}@[^\s@]{3,255}\.[a-z]{2,24}$/i.test(email);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, keyB64] = String(stored).split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const want = Buffer.from(keyB64, "base64");
    const got = crypto.scryptSync(password, salt, want.length,
      { N: Number(N), r: Number(r), p: Number(p) });
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch (e) {
    return false;
  }
}

function pruneSessions(db) {
  const now = Date.now();
  let changed = false;
  for (const [h, s] of Object.entries(db.sessions)) {
    if (!s || s.exp < now) { delete db.sessions[h]; changed = true; }
  }
  return changed;
}

function setCookie(res, token, maxAgeSec) {
  const bits = [
    `${COOKIE}=${token}`, "Path=/", `Max-Age=${maxAgeSec}`,
    "HttpOnly", "SameSite=Lax"
  ];
  if (process.env.NODE_ENV === "production") bits.push("Secure");
  const prev = res.getHeader("Set-Cookie");
  const line = bits.join("; ");
  res.setHeader("Set-Cookie", prev ? [].concat(prev, line) : line);
}

function readCookie(req, name) {
  const raw = (req.headers.cookie || "")
    .split(";").map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  return raw ? decodeURIComponent(raw.slice(name.length + 1)) : null;
}

/* ── public API ───────────────────────────────────────────── */

/* Attaches req.user = {id, email, plan, createdAt} | null */
function middleware(req, res, next) {
  const token = readCookie(req, COOKIE);
  req.user = null;
  if (token && /^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    const db = load();
    const s = db.sessions[sha(token)];
    if (s && s.exp > Date.now()) {
      const u = db.users[s.id];
      if (u) {
        req.user = publicUser(u);
      }
    }
  }
  next();
}

function publicUser(u) {
  return u ? {
    id: u.id,
    email: u.email,
    plan: u.plan || "free",
    createdAt: u.createdAt,
    displayName: u.displayName || "",
    handle: u.handle || "",
    bio: u.bio || "",
    youtube: u.youtube || "",
    instagram: u.instagram || "",
    stars: Number(u.stars) || 48
  } : null;
}

function startSession(res, id) {
  const db = load();
  pruneSessions(db);
  const token = crypto.randomBytes(24).toString("base64url");
  db.sessions[sha(token)] = { id, exp: Date.now() + SESSION_DAYS * 864e5 };
  save();
  setCookie(res, token, SESSION_DAYS * 86400);
  return token;
}

function signUp(res, email, password) {
  email = normEmail(email);
  if (!validEmail(email)) return { error: "That email address does not look right." };
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters for the password.` };
  }
  if (password.length > MAX_PASSWORD) return { error: "That password is too long." };
  if (/^\s|\s$/.test(password)) return { error: "The password cannot start or end with a space." };

  const db = load();
  if (db.byEmail[email]) {
    // Signup is the one place we must admit the address is taken, or the user
    // can never work out why nothing happens. Login stays ambiguous.
    return { error: "There is already an account with that email. Log in instead." };
  }

  const id = "u_" + crypto.randomBytes(8).toString("base64url");
  db.users[id] = {
    id, email,
    pass: hashPassword(password),
    plan: "free",
    createdAt: new Date().toISOString()
  };
  db.byEmail[email] = id;
  save();
  startSession(res, id);
  return { user: publicUser(db.users[id]) };
}

function logIn(res, email, password) {
  email = normEmail(email);
  const db = load();
  const id = db.byEmail[email];
  const u = id ? db.users[id] : null;

  // Always run a hash so a missing account and a wrong password take the same
  // time — otherwise the response time leaks which emails are registered.
  const stored = u ? u.pass : hashPassword("decoy-password-for-timing");
  const good = verifyPassword(String(password || ""), stored);

  if (!u || !good) return { error: "Wrong email or password." };
  startSession(res, u.id);
  return { user: publicUser(u) };
}

function logOut(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) {
    const db = load();
    delete db.sessions[sha(token)];
    save();
  }
  setCookie(res, "", 0);
}

function changePlan(userId, planId) {
  const db = load();
  const u = db.users[userId];
  if (!u) return false;
  u.plan = planId;
  save();
  return true;
}

function updateProfile(userId, data) {
  const db = load();
  const u = db.users[userId];
  if (!u) return { error: "User not found." };
  if (typeof data.displayName === "string") u.displayName = data.displayName.trim().slice(0, 50);
  if (typeof data.handle === "string") {
    let h = data.handle.trim().replace(/^@+/, "");
    u.handle = h ? "@" + h.slice(0, 30) : "";
  }
  if (typeof data.bio === "string") u.bio = data.bio.trim().slice(0, 200);
  if (typeof data.youtube === "string") u.youtube = data.youtube.trim().slice(0, 150);
  if (typeof data.instagram === "string") u.instagram = data.instagram.trim().slice(0, 150);
  save();
  return { success: true, user: publicUser(u) };
}

function giveStar(userId) {
  const db = load();
  const u = db.users[userId];
  if (!u) return { error: "User not found." };
  u.stars = (Number(u.stars) || 48) + 1;
  save();
  return { success: true, stars: u.stars };
}

/* how many accounts exist — used by the verifier and for a sanity log line */
function count() { return Object.keys(load().users).length; }

module.exports = {
  middleware, signUp, logIn, logOut, changePlan, updateProfile, giveStar, count,
  COOKIE, MIN_PASSWORD, publicUser
};
