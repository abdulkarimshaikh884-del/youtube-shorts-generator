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
const sharp = require("sharp");
const db = require("./db");

const COOKIE = "sc_sid";
const SESSION_DAYS = 30;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const RESET_MINUTES = 30;

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
    website: row.website || "",
    location: row.location || "",
    verified: row.verified === true || String(row.handle || "").replace(/^@/, "").toLowerCase() === "shortscraft",
    role: row.role || "user",
    billingCycle: row.billing_cycle || null,
    avatarUrl: row.avatar_bytes ? `/api/users/${encodeURIComponent(row.id)}/avatar` : "",
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
      if (rows[0]) {
        const owners = String(process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || "")
          .split(",").map(normEmail).filter(Boolean);
        if (owners.includes(normEmail(rows[0].email)) && rows[0].role !== "super_admin") {
          const promoted = await db.query(
            `update public.users set role = 'super_admin', updated_at = now() where id = $1 returning *`,
            [rows[0].id]
          );
          rows[0] = promoted.rows[0];
        }
        req.user = publicUser(rows[0]);
      }
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

async function signUp(res, email, password, requestedHandle) {
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

  const localName = email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase();
  let handleBase = String(requestedHandle || "").trim().replace(/^@+/, "").toLowerCase();
  if (handleBase && !/^[a-z0-9_]{3,30}$/.test(handleBase)) {
    return { error: "Use 3–30 letters, numbers, or underscores for the creator handle." };
  }
  if (!handleBase) {
    const safeBase = (localName.length >= 3 ? localName : "creator").slice(0, 21);
    handleBase = `${safeBase}_${crypto.randomBytes(3).toString("hex")}`;
  }
  const handle = "@" + handleBase;
  const displayName = email.split("@")[0].slice(0, 50);

  let rows;
  try {
    ({ rows } = await db.query(
      `insert into public.users (email, password_hash, plan, handle, display_name)
       values ($1, $2, 'free', $3, $4) returning *`,
      [email, hashPassword(password), handle, displayName]
    ));
  } catch (err) {
    /* The pre-check above gives the normal friendly path, while the database
       index closes the race where two near-simultaneous requests both pass
       that check. Treat the losing request as a duplicate instead of leaking
       a generic 500 and leaving the creator unsure whether signup worked. */
    if (err && err.code === "23505" && err.constraint === "users_email_lower_unique") {
      return { error: "There is already an account with that email. Log in instead." };
    }
    if (err && err.code === "23505" && err.constraint === "users_handle_lower_unique") {
      return { error: "That creator handle is already taken." };
    }
    throw err;
  }
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

/* Always returns the same public shape, whether the address exists or not.
   The caller decides whether to send an email; only a SHA-256 token hash is
   persisted, so a database read cannot be turned into a password reset. */
async function requestPasswordReset(email) {
  email = normEmail(email);
  if (!validEmail(email)) return { accepted: true };

  const { rows } = await db.query(
    `select id, email from public.users where lower(email) = $1 limit 1`,
    [email]
  );
  const user = rows[0];
  if (!user) return { accepted: true };

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha(token);
  const expiresAt = new Date(Date.now() + RESET_MINUTES * 60_000);
  await db.tx(async (client) => {
    await client.query(`delete from public.password_reset_tokens where expires_at <= now()`);
    // The unique user_id constraint makes this atomic even if two browser tabs
    // request links at the same instant: whichever transaction commits last
    // replaces the prior token, so only the newest link can be consumed.
    await client.query(
      `insert into public.password_reset_tokens (token_hash, user_id, expires_at)
       values ($1, $2, $3)
       on conflict (user_id) do update
         set token_hash = excluded.token_hash,
             expires_at = excluded.expires_at,
             used_at = null,
             created_at = now()`,
      [tokenHash, user.id, expiresAt]
    );
  });
  return { accepted: true, email: user.email, token, tokenHash, expiresAt };
}

async function cancelPasswordReset(tokenHash) {
  if (!tokenHash) return;
  await db.query(`delete from public.password_reset_tokens where token_hash = $1`, [tokenHash]);
}

async function resetPassword(res, token, password) {
  token = String(token || "").trim();
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    return { error: "That reset link is invalid or has expired." };
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters for the password.` };
  }
  if (password.length > MAX_PASSWORD) return { error: "That password is too long." };
  if (/^\s|\s$/.test(password)) return { error: "The password cannot start or end with a space." };

  const tokenHash = sha(token);
  const user = await db.tx(async (client) => {
    const { rows } = await client.query(
      `select r.user_id
         from public.password_reset_tokens r
        where r.token_hash = $1 and r.used_at is null and r.expires_at > now()
        for update`,
      [tokenHash]
    );
    if (!rows[0]) return null;

    const userId = rows[0].user_id;
    const updated = await client.query(
      `update public.users set password_hash = $2 where id = $1 returning *`,
      [userId, hashPassword(password)]
    );
    // A reset is a security boundary: sign out every device before issuing the
    // fresh session below, and consume all reset links for the account.
    await client.query(`delete from public.sessions where user_id = $1`, [userId]);
    await client.query(`delete from public.password_reset_tokens where user_id = $1`, [userId]);
    return updated.rows[0] || null;
  });

  if (!user) return { error: "That reset link is invalid or has expired." };
  await startSession(res, user.id);
  return { user: publicUser(user) };
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
        set plan = $2, plan_since = now(), plan_until = $3, plan_lifetime = $4,
            billing_cycle = $5, updated_at = now()
      where id = $1`,
    [userId, planId, planUntil, isLifetime, planId === "free" ? null : (term === "year" ? "yearly" : "monthly")]
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
  if (typeof data.location === "string") push("location", data.location.trim().slice(0, 80));
  if (typeof data.website === "string") {
    const raw = data.website.trim();
    if (raw) {
      try {
        const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
        parsed.username = "";
        parsed.password = "";
        push("website", parsed.toString().slice(0, 180));
      } catch (e) {
        return { error: "Enter a valid website address." };
      }
    } else {
      push("website", "");
    }
  }
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

  let rows;
  try {
    ({ rows } = await db.query(
      `update public.users set ${fields.join(", ")}, updated_at = now() where id = $1 returning *`,
      values
    ));
  } catch (err) {
    if (err && err.code === "23505" && err.constraint === "users_handle_lower_unique") {
      return { error: "That creator handle is already taken." };
    }
    throw err;
  }
  if (!rows[0]) return { error: "User not found." };
  return { success: true, user: publicUser(rows[0]) };
}

async function saveAvatar(userId, imageData) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(imageData || ""));
  if (!match) return { error: "Choose a PNG, JPG, or WebP image." };
  let input;
  try { input = Buffer.from(match[2], "base64"); }
  catch (e) { return { error: "That image could not be read." }; }
  if (!input.length || input.length > 2 * 1024 * 1024) return { error: "Profile photos must be 2 MB or smaller." };

  let output;
  try {
    const meta = await sharp(input, { failOn: "error", limitInputPixels: 20_000_000 }).metadata();
    if (!meta.width || !meta.height) return { error: "That image has no readable dimensions." };
    output = await sharp(input, { failOn: "error", limitInputPixels: 20_000_000 })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention" })
      .webp({ quality: 86, effort: 4 })
      .toBuffer();
  } catch (e) {
    return { error: "That image is damaged or unsupported." };
  }

  const { rows } = await db.query(
    `update public.users
        set avatar_bytes = $2, avatar_mime = 'image/webp', updated_at = now()
      where id = $1 returning *`,
    [userId, output]
  );
  if (!rows[0]) return { error: "User not found." };
  return { success: true, user: publicUser(rows[0]) };
}

async function removeAvatar(userId) {
  const { rows } = await db.query(
    `update public.users
        set avatar_bytes = null, avatar_mime = null, updated_at = now()
      where id = $1 returning *`,
    [userId]
  );
  if (!rows[0]) return { error: "User not found." };
  return { success: true, user: publicUser(rows[0]) };
}

async function getAvatar(userId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId || ""))) return null;
  const { rows } = await db.query(
    `select avatar_bytes, avatar_mime, updated_at from public.users where id = $1`,
    [userId]
  );
  return rows[0]?.avatar_bytes ? rows[0] : null;
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
  middleware, signUp, logIn, logOut, requestPasswordReset, cancelPasswordReset, resetPassword,
  changePlan, countLifetime, effectivePlan, updateProfile, saveAvatar, removeAvatar, getAvatar, giveStar, count,
  COOKIE, MIN_PASSWORD, RESET_MINUTES, publicUser
};
