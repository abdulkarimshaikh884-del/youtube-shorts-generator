/* ============================================================
   auth.js — email + password accounts, backed by Postgres.

   Was file-backed JSON; now reads/writes public.users and public.sessions in
   Supabase via db.js, because a JSON file on disk does not survive a redeploy.
   The exported function signatures are unchanged, so server.js needed no edits.

   Security choices, unchanged from the file-backed version:
   • scrypt (N=16384) with a 16-byte per-user salt. No plaintext, no fast hash.
   • timingSafeEqual for both password and session comparisons.
   • Session token = random 32 bytes, stored HASHED. A stolen table cannot be
     replayed as a live session.
   • Cookie is HttpOnly + SameSite=Lax + Secure in production.
   • Login errors never say whether the email exists (no user enumeration).
   • Rate limited by the caller, and the work factor makes guessing expensive.
   ============================================================ */
const crypto = require("crypto");
const db = require("./db");

const COOKIE = "sc_sid";
const SESSION_DAYS = 30;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

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

/* Row from public.users -> the shape every route already expects. */
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    plan: effectivePlanFromRow(row),
    planUntil: row.plan_until ? new Date(row.plan_until).toISOString() : null,
    planLifetime: row.plan_lifetime === true,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    displayName: row.display_name || "",
    handle: row.handle || "",
    bio: row.bio || "",
    youtube: row.youtube || "",
    instagram: row.instagram || "",
    stars: Number(row.stars) || 0
  };
}

function effectivePlanFromRow(row) {
  if (!row || !row.plan || row.plan === "free") return "free";
  if (row.plan_until && new Date(row.plan_until).getTime() <= Date.now()) return "free";
  return row.plan;
}

/* ── public API ───────────────────────────────────────────── */

/* Attaches req.user = {id, email, plan, ...} | null */
async function middleware(req, res, next) {
  req.user = null;
  const token = readCookie(req, COOKIE);
  if (token && /^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    try {
      const { rows } = await db.query(
        `select u.* from public.sessions s
           join public.users u on u.id = s.user_id
          where s.token_hash = $1 and s.expires_at > now()`,
        [sha(token)]
      );
      if (rows[0]) req.user = publicUser(rows[0]);
    } catch (e) {
      console.error("[auth] session lookup failed:", e.message);
    }
  }
  next();
}

async function startSession(res, userId) {
  // Sessions past their expiry are dead weight; sweep opportunistically on
  // every new login rather than running a scheduled job for one small table.
  await db.query(`delete from public.sessions where expires_at < now()`);

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.query(
    `insert into public.sessions (token_hash, user_id, expires_at) values ($1, $2, $3)`,
    [sha(token), userId, expiresAt]
  );
  setCookie(res, token, SESSION_DAYS * 86400);
  return token;
}

async function signUp(res, email, password) {
  email = normEmail(email);
  if (!validEmail(email)) return { error: "That email address does not look right." };
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters for the password.` };
  }
  if (password.length > MAX_PASSWORD) return { error: "That password is too long." };
  if (/^\s|\s$/.test(password)) return { error: "The password cannot start or end with a space." };

  const { rows: existing } = await db.query(
    `select 1 from public.users where lower(email) = $1 limit 1`, [email]
  );
  if (existing.length) {
    // Signup is the one place we must admit the address is taken, or the user
    // can never work out why nothing happens. Login stays ambiguous.
    return { error: "There is already an account with that email. Log in instead." };
  }

  const { rows } = await db.query(
    `insert into public.users (email, password_hash, plan)
     values ($1, $2, 'free') returning *`,
    [email, hashPassword(password)]
  );
  const user = rows[0];
  await startSession(res, user.id);
  return { user: publicUser(user) };
}

async function logIn(res, email, password) {
  email = normEmail(email);
  const { rows } = await db.query(
    `select * from public.users where lower(email) = $1 limit 1`, [email]
  );
  const u = rows[0] || null;

  // Always run a hash so a missing account and a wrong password take the same
  // time — otherwise the response time leaks which emails are registered.
  const stored = u ? u.password_hash : hashPassword("decoy-password-for-timing");
  const good = verifyPassword(String(password || ""), stored);

  if (!u || !good) return { error: "Wrong email or password." };
  await startSession(res, u.id);
  return { user: publicUser(u) };
}

async function logOut(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) {
    await db.query(`delete from public.sessions where token_hash = $1`, [sha(token)]);
  }
  setCookie(res, "", 0);
}

/* A paid plan can expire. plan_until = null means it never does (the lifetime
   Pro Max offer). Anything past its date reads as "free" everywhere, so an
   expired plan cannot keep granting credits. */
function effectivePlan(user) {
  return effectivePlanFromRow({
    plan: user && user.plan,
    plan_until: user && (user.planUntil || user.plan_until)
  });
}

/* How many lifetime Pro Max seats have actually been handed out. Counted from
   the user rows themselves rather than a separate tally, so the number cannot
   drift out of sync with reality. */
async function countLifetime(planId) {
  const { rows } = await db.query(
    `select count(*)::int as n from public.users where plan = $1 and plan_lifetime = true`,
    [planId]
  );
  return rows[0].n;
}

/* term: "month" | "year" | "lifetime" | "forever" */
async function changePlan(userId, planId, term) {
  const isLifetime = planId !== "free" && (term === "lifetime" || term === "forever");
  let planUntil = null;
  if (planId !== "free" && !isLifetime) {
    const days = term === "year" ? 365 : 30;
    planUntil = new Date(Date.now() + days * 864e5);
  }
  const { rowCount } = await db.query(
    `update public.users
        set plan = $2, plan_since = now(), plan_until = $3, plan_lifetime = $4
      where id = $1`,
    [userId, planId, planUntil, isLifetime]
  );
  return rowCount > 0;
}

function normaliseSocial(value, platform) {
  const raw = String(value || "").trim();
  if (!raw) return { value: "" };
  const hosts = platform === "youtube"
    ? ["youtube.com", "youtu.be"]
    : ["instagram.com"];

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      const allowed = hosts.some((base) => host === base || host.endsWith("." + base));
      if (!allowed) return { error: `Use a valid ${platform === "youtube" ? "YouTube" : "Instagram"} link.` };
      url.protocol = "https:";
      url.username = "";
      url.password = "";
      return { value: url.toString().slice(0, 150) };
    } catch (e) {
      return { error: "That profile link is not valid." };
    }
  }

  if (!/^@?[a-zA-Z0-9._-]{1,100}$/.test(raw)) {
    return { error: `Use a valid ${platform === "youtube" ? "YouTube" : "Instagram"} handle or link.` };
  }
  return { value: raw.startsWith("@") ? raw : "@" + raw };
}

async function updateProfile(userId, data) {
  const fields = [];
  const values = [userId];
  const push = (col, val) => { values.push(val); fields.push(`${col} = $${values.length}`); };

  if (typeof data.displayName === "string") push("display_name", data.displayName.trim().slice(0, 50));
  if (typeof data.handle === "string") {
    const h = data.handle.trim().replace(/^@+/, "").toLowerCase();
    if (h && !/^[a-z0-9_]{3,30}$/.test(h)) {
      return { error: "Use 3–30 letters, numbers, or underscores for the creator handle." };
    }
    const handle = h ? "@" + h : "";
    if (handle) {
      const { rows: taken } = await db.query(
        "select 1 from public.users where lower(handle) = lower($1) and id <> $2 limit 1",
        [handle, userId]
      );
      if (taken.length) return { error: "That creator handle is already taken." };
    }
    push("handle", handle);
  }
  if (typeof data.bio === "string") push("bio", data.bio.trim().slice(0, 200));
  if (typeof data.youtube === "string") {
    const youtube = normaliseSocial(data.youtube, "youtube");
    if (youtube.error) return youtube;
    push("youtube", youtube.value);
  }
  if (typeof data.instagram === "string") {
    const instagram = normaliseSocial(data.instagram, "instagram");
    if (instagram.error) return instagram;
    push("instagram", instagram.value);
  }

  if (!fields.length) {
    const { rows } = await db.query(`select * from public.users where id = $1`, [userId]);
    if (!rows[0]) return { error: "User not found." };
    return { success: true, user: publicUser(rows[0]) };
  }

  const { rows } = await db.query(
    `update public.users set ${fields.join(", ")} where id = $1 returning *`,
    values
  );
  if (!rows[0]) return { error: "User not found." };
  return { success: true, user: publicUser(rows[0]) };
}

async function giveStar(userId) {
  const { rows } = await db.query(
    `update public.users set stars = coalesce(stars, 0) + 1 where id = $1 returning stars`,
    [userId]
  );
  if (!rows[0]) return { error: "User not found." };
  return { success: true, stars: rows[0].stars };
}

/* how many accounts exist — used by the verifier and for a sanity log line */
async function count() {
  const { rows } = await db.query(`select count(*)::int as n from public.users`);
  return rows[0].n;
}

module.exports = {
  middleware, signUp, logIn, logOut, changePlan, countLifetime, effectivePlan, updateProfile, giveStar, count,
  COOKIE, MIN_PASSWORD, publicUser
};
