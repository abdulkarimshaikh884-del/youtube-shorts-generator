// ============================================================
// ShortsCraft Server v2.0 — Production-Ready Express API
// ============================================================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ── Trust proxy (Render uses reverse proxy) ─────────────────
app.set("trust proxy", 1);


// www → non-www redirect
app.use((req, res, next) => {
  const host = req.headers.host || "";
  if (host.startsWith("www.")) {
    return res.redirect(301, "https://shortscraft.online" + req.originalUrl);
  }
  next();
});

// ── Security headers ────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // CSP — adjust as needed
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://*.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co https://api.groq.com https://integrate.api.nvidia.com https://*.razorpay.com https://www.google-analytics.com https://www.googletagmanager.com",
      // 'self' is required for the sandboxed srcdoc iframes that render
      // animation template previews on the landing page. Those frames are
      // sandboxed WITHOUT allow-same-origin, so they get a unique origin.
      "frame-src 'self' https://*.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ")
  );
  next();
});

// ── CORS ────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://shortscraft.online,http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      ) {
        return cb(null, true);
      }
      cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);

// ── Body parsing ────────────────────────────────────────────
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// ── Simple in-memory rate limiter (per IP) ──────────────────
const rateLimitStore = new Map();
function rateLimit({ windowMs = 60_000, max = 20 } = {}) {
  return (req, res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) {
      entry.count = 0;
      entry.reset = now + windowMs;
    }
    entry.count++;
    rateLimitStore.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down.",
        retryAfter: Math.ceil((entry.reset - now) / 1000),
      });
    }
    next();
  };
}

// Cleanup rate limit map every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitStore.entries()) {
    if (now > v.reset + 60_000) rateLimitStore.delete(k);
  }
}, 600_000);

// ── Static files (with cache control) ───────────────────────
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: NODE_ENV === "production" ? "7d" : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache, must-revalidate");
      if (/favicon|apple-touch-icon|android-chrome|site\.webmanifest/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  })
);

// ============================================================
// API ROUTES
// ============================================================

// ── Accounts ───────────────────────────────────────────────
// Real sign-up / log-in, backed by scrypt hashes and hashed session tokens in a
// local store. Auth runs BEFORE credits so a signed-in visitor is billed against
// their account instead of an anonymous cookie.
const auth = require("./auth");
app.use(auth.middleware);

app.post("/api/auth/signup", rateLimit({ windowMs: 3_600_000, max: 20 }), (req, res) => {
  const { email, password } = req.body || {};
  const out = auth.signUp(res, email, password);
  if (out.error) return res.status(400).json({ success: false, error: out.error });
  console.log("[auth] new account", out.user.email, "· total", auth.count());
  return res.json({ success: true, user: out.user });
});

app.post("/api/auth/login", rateLimit({ windowMs: 600_000, max: 20 }), (req, res) => {
  const { email, password } = req.body || {};
  const out = auth.logIn(res, email, password);
  // deliberately vague: never reveal whether the address exists
  if (out.error) return res.status(401).json({ success: false, error: out.error });
  return res.json({ success: true, user: out.user });
});

app.post("/api/auth/logout", (req, res) => {
  auth.logOut(req, res);
  return res.json({ success: true });
});

app.get("/api/auth/me", (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, user: req.user || null });
});

app.post("/api/auth/profile", (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, error: "Please log in first." });
  }
  const out = auth.updateProfile(req.user.id, req.body || {});
  if (out.error) return res.status(400).json({ success: false, error: out.error });
  return res.json({ success: true, user: out.user });
});

app.post("/api/auth/star", (req, res) => {
  const targetId = req.body?.userId || req.user?.id;
  if (!targetId) return res.status(400).json({ success: false, error: "Target creator is required." });
  const out = auth.giveStar(targetId);
  if (out.error) return res.status(400).json({ success: false, error: out.error });
  return res.json({ success: true, stars: out.stars });
});

// ── Credits ────────────────────────────────────────────────
// Runs after static so asset requests do not touch the ledger. Every page and
// API request gets (or reuses) a signed anonymous id, because charging has to
// happen on the server: the old browser-side counter reset with local storage.
const credits = require("./credits");
const community = require("./community");
app.use(credits.middleware);

app.get("/api/credits", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ success: true, ...credits.state(req) });
});

// ── Community Templates & Creator Publishing ─────────────────
app.get("/api/community-templates", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ success: true, templates: community.list(req.query.cat) });
});

app.get("/api/user/creations", (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.user?.id || null;
  const userHandle = req.user?.handle || (req.user?.email ? req.user.email.split("@")[0] : null);
  const items = community.listByAuthor(userId, userHandle);
  return res.json({ success: true, creations: items });
});

app.post("/api/community-templates", express.json(), (req, res) => {
  const result = community.publish(req.body, req.user);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  res.json(result);
});

app.delete("/api/community-templates/:id", (req, res) => {
  const result = community.remove(req.params.id, req.user);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  res.json({ success: true });
});

app.post("/api/community-templates/:id/like", (req, res) => {
  const result = community.like(req.params.id);
  if (result.error) return res.status(404).json({ success: false, error: result.error });
  res.json(result);
});

// AI Video-to-Template ("deconstruct a video into a template") is not a real
// feature yet - it had no analysis behind it and its ffprobe path took a raw
// client-supplied file path into a shell command (command injection). Removed
// until real video analysis is built; the UI tab for it is hidden (authui.js).

// ── Comments & Discussions API ──────────────────────────────
const comments = require("./comments");

app.get("/api/comments", (req, res) => {
  const tplId = String(req.query.tpl || "docu-red-string");
  res.json({ success: true, comments: comments.getComments(tplId) });
});

app.post("/api/comments", express.json(), (req, res) => {
  const tplId = req.body?.tpl;
  if (!tplId) return res.status(400).json({ success: false, error: "Template id is required." });
  const newC = comments.addComment(tplId, req.body, req.user);
  res.json({ success: true, comment: newC });
});

// ── Creator Profile API ─────────────────────────────────────
app.get("/api/creator", (req, res) => {
  const handle = String(req.query.handle || "").replace(/^@/, "").toLowerCase();
  const creatorProfiles = {
    crimedocu: {
      name: "Crime Stories",
      handle: "@crimedocu",
      initials: "CD",
      bio: "Creating high-retention dark documentary hooks, investigation evidence boards, and true crime storytelling templates for YouTube Shorts.",
      youtube: "https://youtube.com/@VaultGamer-in",
      instagram: "https://instagram.com/tech_vault_in",
      followers: "12.4k",
      likes: "48.2k",
      cat: "docu"
    },
    aman_fx: {
      name: "Aman Motion FX",
      handle: "@aman_fx",
      initials: "AF",
      bio: "Procedural paper craft, cutting mat collage textures, deckle edges and viral kinetic transitions.",
      youtube: "https://youtube.com/@VaultGamer-in",
      instagram: "https://instagram.com/tech_vault_in",
      followers: "8.9k",
      likes: "32.1k",
      cat: "paper"
    },
    sarah_motion: {
      name: "Sarah Creative",
      handle: "@sarah_motion",
      initials: "SC",
      bio: "Clean 3D UI toggles, iOS notifications, Google search widgets, and modern device mockups.",
      youtube: "https://youtube.com/@VaultGamer-in",
      instagram: "https://instagram.com/tech_vault_in",
      followers: "15.1k",
      likes: "54.0k",
      cat: "ui"
    },
    vikram_creations: {
      name: "Vikram Shorts",
      handle: "@vikram_creations",
      initials: "VS",
      bio: "Viral social counter animations, live views tickers, subscriber milestones, and engagement overlays.",
      youtube: "https://youtube.com/@VaultGamer-in",
      instagram: "https://instagram.com/tech_vault_in",
      followers: "19.3k",
      likes: "72.5k",
      cat: "social"
    },
    kabir_motion: {
      name: "Kabir Motion",
      handle: "@kabir_motion",
      initials: "KM",
      bio: "Cyberpunk neon rings, data visualizations, circular progress meters and futuristic HUD graphics.",
      youtube: "https://youtube.com/@VaultGamer-in",
      instagram: "https://instagram.com/tech_vault_in",
      followers: "6.2k",
      likes: "21.4k",
      cat: "charts"
    },
    finance_pulse: {
      name: "Finance Pulse",
      handle: "@finance_pulse",
      initials: "FP",
      bio: "Titanium cards, market candlestick charts, crypto surges, and luxury finance motion graphics.",
      youtube: "https://youtube.com/@VaultGamer-in",
      instagram: "https://instagram.com/tech_vault_in",
      followers: "11.7k",
      likes: "44.9k",
      cat: "money"
    },
    typography_pro: {
      name: "Kinetic Studio",
      handle: "@typography_pro",
      initials: "KS",
      bio: "High-impact kinetic text, word-by-word cascades, 3D typography and punchy dialogue animations.",
      youtube: "https://youtube.com/@VaultGamer-in",
      instagram: "https://instagram.com/tech_vault_in",
      followers: "14.8k",
      likes: "61.2k",
      cat: "text"
    },
    geo_explorer: {
      name: "Geo Explorer",
      handle: "@geo_explorer",
      initials: "GE",
      bio: "Tactical map route animations, radar pulses, satellite coordinates and geo-location documentary graphics.",
      youtube: "https://youtube.com/@VaultGamer-in",
      instagram: "https://instagram.com/tech_vault_in",
      followers: "9.5k",
      likes: "37.8k",
      cat: "maps"
    }
  };

  const prof = creatorProfiles[handle] || {
    name: handle ? (handle.charAt(0).toUpperCase() + handle.slice(1)) : "ShortsCraft Creator",
    handle: "@" + (handle || "creator"),
    initials: (handle ? handle.slice(0, 2).toUpperCase() : "SC"),
    bio: "Passionate motion designer crafting animated templates for YouTube Shorts and Instagram Reels on ShortsCraft.",
    youtube: "https://youtube.com/@VaultGamer-in",
    instagram: "https://instagram.com/tech_vault_in",
    followers: "4.5k",
    likes: "18.2k",
    cat: "all"
  };

  const commTemplates = community.listByAuthor(null, "@" + handle);
  res.json({ success: true, creator: prof, communityTemplates: commTemplates });
});

// ── Health check ────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ ok: true, version: "2.0.0", time: new Date().toISOString() });
});

// ── Public config (frontend reads this) ─────────────────────
app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
    proPriceInr: Number(process.env.PRO_PRICE_INR || 99),
    freeCreditsPerDay: credits.PLANS.free.perDay,
    plans: Object.values(credits.PLANS),
    cost: credits.COST,
    gaId: process.env.GA_ID || "",
    services: {
      ai: Boolean(process.env.NVIDIA_API_KEY || process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY),
      auth: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      payments: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    },
  });
});

// ── Unified AI Generation (NVIDIA NIM / Groq / Gemini) ───────
async function callAI(prompt, { temperature = 0.7, maxTokens = 2200, system, model: modelOverride, timeoutMs = 120_000 } = {}) {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!nvidiaKey && !groqKey && !geminiKey) throw new Error("AI service not configured");

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    // 1) Primary: NVIDIA NIM (Llama 3.1 / Nemotron)
    if (nvidiaKey) {
      try {
        const baseUrl = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
        const model = modelOverride || process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
        const r = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nvidiaKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: system ||
                  "You are ShortsCraft, an expert AI video and YouTube Shorts creator who writes punchy Hinglish (Hindi-English mix) content for animated motion graphics, kinetic typography, viral hooks, SEO titles, descriptions, hashtags, ideas, and thumbnail prompts. Always be concise, energetic, and video-first.",
              },
              { role: "user", content: prompt },
            ],
            temperature,
            top_p: 0.95,
            max_tokens: Math.min(maxTokens, 2500),
          }),
          signal: ctrl.signal,
        });

        if (r.ok) {
          const data = await r.json();
          const msg = data?.choices?.[0]?.message;
          const content = msg?.content?.trim() || "";
          if (content) return content;
        } else {
          const errText = await r.text().catch(() => "");
          console.warn(`[NVIDIA NIM error ${r.status}]:`, errText.slice(0, 200));
          if (!groqKey && !geminiKey) {
            throw new Error(`NVIDIA AI provider error (${r.status}): ${errText.slice(0, 200)}`);
          }
        }
      } catch (nErr) {
        console.warn("[NVIDIA NIM attempt failed]:", nErr.message);
        if (!groqKey && !geminiKey) throw nErr;
      }
    }

    // 2) Secondary: Groq
    if (groqKey) {
      const model = modelOverride || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: system ||
                "You are ShortsCraft, an expert AI video and YouTube Shorts creator who writes punchy Hinglish (Hindi-English mix) content for animated motion graphics, kinetic typography, viral hooks, SEO titles, descriptions, hashtags, ideas, and thumbnail prompts. Always be concise, energetic, and video-first.",
            },
            { role: "user", content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: ctrl.signal,
      });

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        if (!geminiKey) throw new Error(`Groq AI error (${r.status}): ${errText.slice(0, 200)}`);
      } else {
        const data = await r.json();
        const c = data?.choices?.[0]?.message?.content?.trim() || "";
        if (c) return c;
      }
    }

    // 3) Fallback: Gemini
    if (geminiKey) {
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
      let attempts = 0;
      let r, errText;
      while (attempts < 2) {
        attempts++;
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: 8192,
                responseMimeType: "application/json"
              }
            }),
            signal: ctrl.signal,
          }
        );
        if (r.ok) break;
        if (r.status === 503 && attempts < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        errText = await r.text().catch(() => "");
        throw new Error(`Gemini AI provider error (${r.status}): ${errText.slice(0, 200)}`);
      }
      const data = await r.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      return parts.map((p) => p.text).filter(Boolean).join("").trim();
    }

    throw new Error("AI returned empty response. Please retry.");
  } finally {
    clearTimeout(timeout);
  }
}
const callGroq = callAI;

function sanitizeTopic(s) {
  return String(s || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 200);
}

const generationLimiter = rateLimit({ windowMs: 60_000, max: 12 });

app.post("/api/generate", generationLimiter, async (req, res) => {
  try {
    const topic = sanitizeTopic(req.body?.topic);
    const type = String(req.body?.type || "all").toLowerCase();
    if (!topic || topic.length < 2) {
      return res.status(400).json({ success: false, error: "Topic is required (min 2 characters)." });
    }

    const prompts = {
      all: `Topic: "${topic}"

Generate a complete YouTube Shorts / Instagram Reels content pack in natural Hinglish. Use this EXACT format with these section headers:

=== SCRIPT ===
[HOOK]
(3-4 punchy lines that grab attention in the first 3 seconds. Make it human, not robotic.)

[MAIN]
(Professional 1-2 minute voiceover script: 180-260 words, 10-16 short spoken lines, simple examples, curiosity, retention, and smooth flow. Use Hinglish that Indian creators can record directly.)

[CTA]
(2 strong but natural CTA lines, not spammy.)

=== TITLES ===
1. (clickable Hinglish title with emoji, under 60 chars)
2. (...)
3. (...)
4. (...)
5. (...)

=== DESCRIPTION ===
(Full YouTube description: 3-4 lines hook + bullet points + CTA + relevant keywords. Mix Hinglish and English.)

=== HASHTAGS ===
#tag1 #tag2 #tag3 ... (15 hashtags total: mix broad + niche + Hindi creator tags)

=== IDEAS ===
1. (related video idea)
2. (...)
3. (...)
4. (...)
5. (...)
6. (...)
7. (...)

=== THUMBNAIL ===
1. (Detailed English AI image prompt for Midjourney/DALL-E with subject, mood, lighting, composition, style — for YouTube thumbnail)
2. (...)
3. (...)
`,
      script: `Write a professional 1-2 minute YouTube Shorts / Instagram Reels voiceover script in natural Hinglish for the topic: "${topic}".

Strict requirements:
- Total length: 180-260 words
- Hook: first 3 seconds must be powerful
- Main section: 10-16 short spoken lines with simple examples, curiosity, and retention
- CTA: 2 natural closing lines
- Tone: human, confident, premium, Indian creator style
- No robotic intro like "hello guys"
- Format strictly as:
[HOOK]
(...)
[MAIN]
(...)
[CTA]
(...)`,
      titles: `Generate 5 click-worthy Hinglish YouTube Shorts titles for: "${topic}". Number them 1-5. Each under 60 characters with emojis.`,
      description: `Write a full SEO-optimized YouTube description in Hinglish for: "${topic}". Include hook lines, bullet points, CTA, and relevant keywords. No hashtags.`,
      hashtags: `Generate 15 relevant YouTube Shorts hashtags for: "${topic}". Mix broad (#shorts #viral), niche, and Indian creator tags. Output only hashtags space-separated.`,
      ideas: `Generate 7 related YouTube Shorts video ideas for: "${topic}". Number them 1-7. Each one a single line in Hinglish.`,
      thumbnail: `Generate 3 detailed English AI image prompts for YouTube thumbnails on the topic: "${topic}". Each prompt should describe subject, mood, lighting, composition, style, and text overlay suggestion. Number them 1-3.`,
    };

    const prompt = prompts[type] || prompts.all;
    const content = await callGroq(prompt, { temperature: 0.85, maxTokens: type === "all" ? 3400 : type === "script" ? 1800 : 900 });

    if (!content) {
      return res.status(502).json({ success: false, error: "AI returned empty response. Please retry." });
    }

    res.json({ success: true, type, topic, content, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[/api/generate]", err.message);
    const userMsg =
      err.name === "AbortError"
        ? "AI is taking too long. Please retry."
        : err.message?.includes("not configured")
        ? "Service temporarily unavailable."
        : "Generation failed. Please retry in a few seconds.";
    res.status(500).json({ success: false, error: userMsg });
  }
});

/* Pro Max launches as a lifetime deal for the first credits.LIFETIME_SLOTS
   buyers. Once those seats are taken the same price buys a year instead.
   The decision is made here, server-side, at the moment of purchase. */
function planTermFor(planId) {
  const plan = credits.PLANS[planId];
  if (!plan) return "month";
  if (plan.term !== "lifetime") return plan.term;
  const taken = auth.countLifetime(planId);
  return taken < credits.LIFETIME_SLOTS ? "lifetime" : (plan.fallbackTerm || "year");
}

// ── Launch offer status (how many lifetime seats are left) ──
app.get("/api/offer", (req, res) => {
  res.set("Cache-Control", "no-store");
  const taken = auth.countLifetime("promax");
  const total = credits.LIFETIME_SLOTS;
  const left = Math.max(0, total - taken);
  res.json({
    success: true,
    plan: "promax",
    price: credits.PLANS.promax.price,
    total, taken, left,
    lifetimeAvailable: left > 0,
    term: left > 0 ? "lifetime" : (credits.PLANS.promax.fallbackTerm || "year")
  });
});

// ── Razorpay: create order ──────────────────────────────────
app.post("/api/razorpay/order", rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  try {
    // Who and what first — "log in to upgrade" is actionable, "not configured"
    // is not, so the user-fixable problems are reported before ours.
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Please log in before upgrading." });
    }

    // Which plan is being bought. The price comes from our own PLANS table,
    // never from the client, so the amount cannot be tampered with.
    const planId = String(req.body?.plan || "pro");
    const plan = credits.PLANS[planId];
    if (!plan || plan.price <= 0) {
      return res.status(400).json({ success: false, error: "Choose a paid plan." });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.status(503).json({ success: false, error: "Payments are not switched on yet. Please try again shortly." });
    }

    const term = planTermFor(planId);
    const amountPaise = plan.price * 100;
    const userId = req.user.id;

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `sc_${Date.now()}_${userId.slice(0, 12)}`,
        notes: { product: `ShortsCraft ${plan.label}`, userId, plan: planId, term },
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("[razorpay/order]", t);
      return res.status(502).json({ success: false, error: "Could not create payment order." });
    }
    const order = await r.json();
    res.json({
      success: true, orderId: order.id, amount: order.amount,
      currency: order.currency, keyId, plan: planId, term
    });
  } catch (err) {
    console.error("[razorpay/order]", err.message);
    res.status(500).json({ success: false, error: "Payment order failed." });
  }
});

// ── Razorpay: verify signature ──────────────────────────────
app.post("/api/razorpay/verify", rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: "Missing payment details." });
    }
    if (!secret) return res.status(503).json({ success: false, error: "Payment service not configured." });

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // timingSafeEqual throws on a length mismatch, so check that first —
    // a wrong-length signature is simply invalid, not a server error.
    const got = Buffer.from(String(razorpay_signature));
    const want = Buffer.from(expected);
    const valid = got.length === want.length && crypto.timingSafeEqual(got, want);
    if (!valid) return res.status(400).json({ success: false, error: "Invalid payment signature." });

    // The signature is genuine, so the money is real — now actually deliver the
    // plan. Without this the user pays and receives nothing.
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Please log in to activate your plan." });
    }
    const planId = credits.PLANS[String(req.body?.plan || "")] ? String(req.body.plan) : "pro";
    const term = planTermFor(planId);

    auth.changePlan(req.user.id, planId, term);
    credits.setPlan(req, planId);

    res.json({
      success: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      plan: planId,
      term
    });
  } catch (err) {
    console.error("[razorpay/verify]", err.message);
    res.status(500).json({ success: false, error: "Verification failed." });
  }
});

// ── Feedback / contact form ─────────────────────────────────
// Robust route: never breaks the UI if external storage is not configured.
app.post("/api/feedback", rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 80);
  const email = String(req.body?.email || "").trim().slice(0, 120);
  const subject = String(req.body?.subject || "Studio feedback").trim().slice(0, 140);
  const message = String(req.body?.message || "").trim().slice(0, 2000);

  if (!name || !message || message.length < 5) {
    return res.status(400).json({ success: false, error: "Name and message (min 5 chars) required." });
  }

  const feedback = {
    name,
    email,
    subject,
    message,
    ip: req.ip,
    ua: req.headers["user-agent"] || "",
    created_at: new Date().toISOString(),
  };

  // 1) Save a local backup. Works on local/dev and does not crash if filesystem is read-only.
  try {
    const dir = path.join(__dirname, "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "feedback.jsonl"), JSON.stringify(feedback) + "\n", "utf8");
  } catch (e) {
    console.warn("[feedback local backup skipped]", e.message);
  }

  // 2) Store in Supabase only if configured. Failure should not fail the user request.
  const supaUrl = process.env.SUPABASE_URL;
  const supaSrv = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supaUrl && supaSrv && typeof fetch === "function") {
    try {
      const r = await fetch(`${supaUrl.replace(/\/$/, "")}/rest/v1/feedback`, {
        method: "POST",
        headers: {
          apikey: supaSrv,
          Authorization: `Bearer ${supaSrv}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(feedback),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        console.warn("[feedback supabase non-fatal]", r.status, t.slice(0, 200));
      }
    } catch (e) {
      console.warn("[feedback supabase non-fatal]", e.message);
    }
  } else {
    console.log("[feedback]", { name, email, subject, message: message.slice(0, 100) });
  }

  return res.json({ success: true });
});

// ============================================================
// VIDEO EXPORT  —  template -> real MP4
// ============================================================
// Renders the generated animation in headless Chrome, steps the CSS timeline
// frame-by-frame with the Web Animations API (deterministic: exact fps, no
// dropped frames, unlike screen recording), pipes PNG frames into ffmpeg and
// streams back an H.264 MP4.
const puppeteer = require("puppeteer");
const { spawn } = require("child_process");

const EXPORT_LIMITS = {
  fps: [24, 30, 60],
  heights: [720, 1080, 1440],
  maxDurMs: 12000,              // total across all clips
  maxFrames: 900,
  maxClips: 8,
  aspects: {
    "9:16": [9, 16], "16:9": [16, 9], "1:1": [1, 1], "4:5": [4, 5],
    "3:4": [3, 4], "2:3": [2, 3], "21:9": [21, 9]
  }
};

let _browser = null;
async function getBrowser() {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"]
  });
  return _browser;
}

// Exports are CPU heavy. Serialise them so one request cannot starve the box.
let _queue = Promise.resolve();
function serialise(job) {
  const run = _queue.then(job, job);
  _queue = run.catch(() => {});
  return run;
}

// even dimensions are required by yuv420p
const even = (n) => (n % 2 === 0 ? n : n + 1);

function encodeMp4(frames, fps) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y",
      "-f", "image2pipe",
      "-framerate", String(fps),
      "-i", "pipe:0",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-movflags", "frag_keyframe+empty_moov+faststart",
      "-f", "mp4",
      "pipe:1"
    ], { stdio: ["pipe", "pipe", "pipe"] });

    const out = [];
    let err = "";
    ff.stdout.on("data", (d) => out.push(d));
    ff.stderr.on("data", (d) => { err += d.toString(); });
    ff.on("error", (e) => reject(new Error("ffmpeg not available: " + e.message)));
    ff.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffmpeg exited " + code + ": " + err.slice(-400)));
      resolve(Buffer.concat(out));
    });

    (async () => {
      for (const f of frames) {
        if (!ff.stdin.write(f)) {
          await new Promise((r) => ff.stdin.once("drain", r));
        }
      }
      ff.stdin.end();
    })().catch(reject);
  });
}

// ============================================================
// AI ANIMATION  —  prompt (+ optional image) -> a real scene
// ============================================================
// The model writes only `css` + `body`; the document is assembled by
// SC_TPL2.buildCustom, so a generated scene is structurally identical to a
// shipped template and exports through the same frame-stepped pipeline.
// Costs credits.animate because it burns a model call.
const anim = require("./animate");

// bigger body than the 100kb global limit: an attached image travels as a data URL
const jsonBig = express.json({ limit: "2mb" });

app.post("/api/animate", jsonBig, rateLimit({ windowMs: 60_000, max: 8 }), async (req, res) => {
  const b = req.body || {};
  const prompt = String(b.prompt || "").trim().slice(0, 600);
  const dur = Math.min(Math.max(Number(b.dur) || 4600, 1500), EXPORT_LIMITS.maxDurMs);
  const image = b.image ? String(b.image) : null;

  /* The three model tiers are the three plans. A free account cannot silently
     use the Pro model, and it is told which plan unlocks it rather than being
     quietly downgraded. */
  const TIER = {
    mini: { plans: ["free", "pro", "promax"], label: "Free", model: () => process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct" },
    pro: { plans: ["pro", "promax"], label: "Pro", model: () => process.env.NVIDIA_MODEL_PRO || process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct" },
    max: { plans: ["promax"], label: "Pro Max", model: () => process.env.NVIDIA_MODEL_MAX || process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct" }
  };
  const quality = TIER[b.quality] ? b.quality : "mini";

  if (prompt.length < 8) {
    return res.status(400).json({ success: false, error: "Describe the animation in a few more words." });
  }
  // validate what the user sent before complaining about our own configuration:
  // "your image is the wrong format" is actionable, "no API key" is not
  if (image) {
    try { anim.sanitise({ css: "a{}", body: "<div></div>", img: image }); }
    catch (err) { return res.status(400).json({ success: false, error: err.message }); }
  }
  /* Order matters: validate the request, then check what this account is allowed
     to use, and only then complain about our own configuration. */
  const plan = credits.state(req).plan;
  if (TIER[quality].plans.indexOf(plan) < 0) {
    return res.status(403).json({
      success: false,
      error: `The ${TIER[quality].label} model needs the ${TIER[quality].label} plan. ` +
        `You are on ${credits.PLANS[plan].label}.`,
      needPlan: TIER[quality].plans[0],
      credits: credits.state(req)
    });
  }
  if (!process.env.NVIDIA_API_KEY && !process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: "AI generation is not configured on this server yet."
    });
  }

  const bill = credits.charge(req, "animate");
  if (!bill.ok) {
    return res.status(402).json({
      success: false,
      error: `A custom animation costs ${bill.need} credits and you have ${bill.left} left today.`,
      credits: credits.state(req)
    });
  }

  try {
    const scene = await anim.generateScene({
      prompt, dur, image,
      model: TIER[quality].model(),
      callModel: ({ system, user, model, maxTokens, temperature }) =>
        callAI(user, { system, model, maxTokens, temperature })
    });
    return res.json({ success: true, scene, credits: credits.state(req) });
  } catch (err) {
    // nobody pays for our failure
    credits.refund(req, "animate");
    const bad = err instanceof anim.BadScene;
    console.error("[/api/animate]", bad ? "rejected: " : "", err.message);
    return res.status(bad ? 422 : 502).json({
      success: false,
      error: bad
        ? "The generated scene did not pass our safety and quality checks. Try rewording the prompt."
        : "The AI service did not respond. Please retry.",
      detail: bad ? err.message : undefined,
      credits: credits.state(req)
    });
  }
});

app.post("/api/export", jsonBig, rateLimit({ windowMs: 120_000, max: 6 }), async (req, res) => {
  const b = req.body || {};

  // A project is a sequence of clips. `clips` is the current payload; the flat
  // tpl/lines/dur fields are still accepted as a single-clip request.
  const rawClips = Array.isArray(b.clips) && b.clips.length
    ? b.clips.slice(0, EXPORT_LIMITS.maxClips)
    : [{ tpl: b.tpl, lines: b.lines, accent: b.accent, font: b.font, dur: b.dur }];

  const aspect = EXPORT_LIMITS.aspects[b.aspect] ? b.aspect : "9:16";
  const fps = EXPORT_LIMITS.fps.includes(Number(b.fps)) ? Number(b.fps) : 30;
  const height = EXPORT_LIMITS.heights.includes(Number(b.height)) ? Number(b.height) : 1080;

  const clips = [];
  for (const c of rawClips) {
    // a clip is either a shipped template id or an AI-authored scene. The scene
    // is re-sanitised here: /api/animate is not the only way to reach this route.
    if (c && c.spec) {
      let spec;
      try {
        spec = anim.sanitise(c.spec);
      } catch (err) {
        return res.status(400).json({ success: false, error: "Scene rejected: " + err.message });
      }
      clips.push({
        spec,
        tpl: "custom",
        dur: Math.min(Math.max(Number(c.dur) || 4600, 1000), EXPORT_LIMITS.maxDurMs),
        font: String((c && c.font) || "inter").slice(0, 24),
        accent: /^#[0-9a-fA-F]{6}$/.test(String((c && c.accent) || "")) ? c.accent : undefined,
        lines: []
      });
      continue;
    }
    const tpl = String((c && c.tpl) || "").slice(0, 40);
    if (!/^[a-z0-9-]{2,40}$/.test(tpl)) {
      return res.status(400).json({ success: false, error: "Invalid template id." });
    }
    clips.push({
      tpl,
      dur: Math.min(Math.max(Number(c.dur) || 4600, 1000), EXPORT_LIMITS.maxDurMs),
      font: String((c && c.font) || "inter").slice(0, 24),
      accent: /^#[0-9a-fA-F]{6}$/.test(String((c && c.accent) || "")) ? c.accent : undefined,
      lines: Array.isArray(c && c.lines)
        ? c.lines.slice(0, 3).map((l) => String(l == null ? "" : l).slice(0, 160))
        : []
    });
  }

  const dur = clips.reduce((s, c) => s + c.dur, 0);
  if (dur > EXPORT_LIMITS.maxDurMs) {
    return res.status(400).json({ success: false, error: "Requested clip is too long." });
  }
  const tpl = clips[0].tpl;

  const ar = EXPORT_LIMITS.aspects[aspect];
  // "720p" / "1080p" means the SHORT side, the way creators mean it: a 9:16
  // 1080p export is 1080x1920, not 1080 tall.
  const short = even(height);
  let w, h;
  if (ar[0] < ar[1]) {            // portrait -> width is the short side
    w = short;
    h = even(Math.round((short * ar[1]) / ar[0]));
  } else if (ar[0] > ar[1]) {     // landscape -> height is the short side
    h = short;
    w = even(Math.round((short * ar[0]) / ar[1]));
  } else {                        // square
    w = h = short;
  }

  // frames are apportioned per clip so the total matches duration * fps exactly
  const total = Math.round((dur / 1000) * fps);
  if (total > EXPORT_LIMITS.maxFrames) {
    return res.status(400).json({ success: false, error: "Requested clip is too long." });
  }

  // Exporting costs a credit. Charged after validation so a malformed request
  // never bills, and refunded below if the render itself fails.
  const bill = credits.charge(req, "export");
  if (!bill.ok) {
    return res.status(402).json({
      success: false,
      error: `Exporting costs ${bill.need} credit and you have ${bill.left} left today.`,
      credits: credits.state(req)
    });
  }

  try {
    const mp4 = await serialise(async () => {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });

        // Build the documents with the very same engine the editor uses.
        await page.goto("about:blank");
        await page.addScriptTag({ path: path.join(__dirname, "public", "templates-v2.js") });
        const docs = [];
        for (const c of clips) {
          const html = c.spec
            ? await page.evaluate(
              (spec, opts) => window.SC_TPL2.buildCustom(spec, opts),
              c.spec,
              { aspect, dur: c.dur, font: c.font, accent: c.accent || c.spec.accent }
            )
            : await page.evaluate(
              (id, opts) => window.SC_TPL2.build(id, opts),
              c.tpl,
              { lines: c.lines, accent: c.accent, aspect, dur: c.dur, font: c.font }
            );
          if (!html) throw new Error("Unknown template.");
          docs.push(html);
        }

        const frames = [];
        let done = 0;
        for (let ci = 0; ci < clips.length; ci++) {
          const c = clips[ci];
          // last clip absorbs the rounding remainder
          const n = ci === clips.length - 1
            ? total - done
            : Math.round((c.dur / 1000) * fps);

          await page.setContent(docs[ci], { waitUntil: "load" });
          await page.evaluateHandle("document.fonts.ready");

          // Freeze the timeline: from here every frame is positioned explicitly.
          await page.evaluate(() => {
            document.getAnimations().forEach((a) => a.pause());
          });

          const step = c.dur / Math.max(1, n);
          for (let i = 0; i < n; i++) {
            await page.evaluate((t) => {
              document.getAnimations().forEach((a) => { a.currentTime = t; });
            }, i * step);
            frames.push(await page.screenshot({ type: "png", optimizeForSpeed: true }));
          }
          done += n;
        }

        return encodeMp4(frames, fps);
      } finally {
        await page.close().catch(() => {});
      }
    });

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", String(mp4.length));
    res.setHeader("Content-Disposition",
      `attachment; filename="shortscraft-${tpl}-${aspect.replace(":", "x")}.mp4"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Credits-Left", String(credits.state(req).left));
    return res.end(mp4);
  } catch (err) {
    credits.refund(req, "export");
    console.error("[/api/export]", err.message);
    if (/Unknown template/.test(err.message)) {
      return res.status(400).json({ success: false, error: "Unknown template." });
    }
    const msg = /ffmpeg/i.test(err.message)
      ? "Video encoder unavailable on the server."
      : "Export failed. Please retry.";
    return res.status(500).json({ success: false, error: msg });
  }
});

const SEO_ROUTE_META = {
  "/seo-tools": {
    title: "SEO Tools — ShortsCraft",
    description: "Generate SEO titles, descriptions, hashtags, ideas and thumbnail prompts for animated YouTube Shorts created with ShortsCraft motion graphics video generator.",
    h1: "SEO tools for animated Shorts",
    intro: "Use these tools after creating your motion graphics video, or generate a complete Shorts content pack from one topic.",
    h2: "Titles, hashtags, scripts & more"
  },
  "/youtube-shorts-script-generator": {
    title: "YouTube Shorts Script Generator — ShortsCraft",
    description: "Generate hook-first YouTube Shorts scripts with a clear structure, retention flow, and creator-friendly wording.",
    h1: "YouTube Shorts Script Generator",
    intro: "Create short-form video scripts with strong hooks, clean flow, and ready-to-edit sections.",
    h2: "Generate YouTube Shorts scripts"
  },
  "/youtube-shorts-title-generator": {
    title: "YouTube Shorts Title Generator — ShortsCraft",
    description: "Generate catchy, SEO-friendly YouTube Shorts titles for creators, faceless channels, reels, and short videos.",
    h1: "YouTube Shorts Title Generator",
    intro: "Turn one topic into clickable YouTube Shorts title ideas designed for curiosity and clarity.",
    h2: "Generate Shorts titles"
  },
  "/youtube-shorts-hashtag-generator": {
    title: "YouTube Shorts Hashtag Generator — ShortsCraft",
    description: "Generate relevant YouTube Shorts hashtags for better topic clarity and short-form video discovery.",
    h1: "YouTube Shorts Hashtag Generator",
    intro: "Create clean hashtag sets for Shorts, Reels, and short-form videos without keyword stuffing.",
    h2: "Generate Shorts hashtags"
  },
  "/youtube-shorts-description-generator": {
    title: "YouTube Shorts Description Generator — ShortsCraft",
    description: "Generate SEO-friendly YouTube Shorts descriptions with natural keywords and creator-ready formatting.",
    h1: "YouTube Shorts Description Generator",
    intro: "Write paste-ready descriptions that explain your video clearly and support YouTube discovery.",
    h2: "Generate Shorts descriptions"
  },
  "/youtube-shorts-ideas-generator": {
    title: "YouTube Shorts Ideas Generator — ShortsCraft",
    description: "Generate fresh YouTube Shorts ideas for creators, faceless channels, educational videos, and viral content planning.",
    h1: "YouTube Shorts Ideas Generator",
    intro: "Find fresh video ideas from a single niche or topic and plan your next Shorts faster.",
    h2: "Generate Shorts ideas"
  },
  "/ai-thumbnail-prompt-generator": {
    title: "AI Thumbnail Prompt Generator — ShortsCraft",
    description: "Generate AI thumbnail prompts for YouTube thumbnails with cinematic composition, readable text space, and strong visual hooks.",
    h1: "AI Thumbnail Prompt Generator",
    intro: "Create thumbnail prompts for AI image tools with clear subject, lighting, mood, and composition guidance.",
    h2: "Generate thumbnail prompts"
  }
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch]));
}

/* The six keyword URLs all serve seo-tools.html with their own metadata.
   The page is generated by build_pages.js, so the swap targets stable hooks
   (data-seo attributes) instead of matching prose that a redesign would move. */
function renderSeoToolsPage(route) {
  const meta = SEO_ROUTE_META[route] || SEO_ROUTE_META["/seo-tools"];
  const canonical = `https://shortscraft.online${route}`;
  const filePath = path.join(__dirname, "public", "seo-tools.html");
  let html = fs.readFileSync(filePath, "utf8");

  const swaps = [
    [/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`],
    [/<meta name="description" content="[\s\S]*?"\/>/, `<meta name="description" content="${escapeHtml(meta.description)}"/>`],
    [/<meta property="og:title" content="[\s\S]*?"\/>/, `<meta property="og:title" content="${escapeHtml(meta.title)}"/>`],
    [/<meta property="og:description" content="[\s\S]*?"\/>/, `<meta property="og:description" content="${escapeHtml(meta.description)}"/>`],
    [/<meta property="og:url" content="[\s\S]*?"\/>/, `<meta property="og:url" content="${canonical}"/>`],
    [/<link rel="canonical" href="[\s\S]*?"\/>/, `<link rel="canonical" href="${canonical}"/>`],
    [/<h1 data-seo="h1">[\s\S]*?<\/h1>/, `<h1 data-seo="h1">${escapeHtml(meta.h1)}</h1>`],
    [/<p data-seo="intro">[\s\S]*?<\/p>/, `<p data-seo="intro">${escapeHtml(meta.intro)}</p>`]
  ];

  for (const [re, replacement] of swaps) {
    if (!re.test(html)) {
      // fail loudly in the log instead of silently serving the generic page
      console.warn("[seo meta] hook missing for", route, re.source.slice(0, 40));
      continue;
    }
    html = html.replace(re, replacement);
  }
  return html;
}

// ============================================================
// SEO + STATIC ROUTING
// ============================================================
const PAGES = {
  "/": "index.html",
  "/editor": "editor.html",
  "/community": "community.html",
  "/pricing": "pricing.html",
  "/about": "about.html",
  "/contact": "contact.html",
  "/privacy": "privacy.html",
  "/terms": "terms.html",
  "/login": "login.html",
  "/signup": "signup.html",
  "/account": "account.html",
  "/template": "template.html",
  "/creator": "creator.html",

  // The SEO Tools workspace itself. It must be registered here as well as the
  // keyword URLs below — without it /seo-tools 404s even though the footer,
  // the pricing CTA and the /generator redirect all point at it.
  "/seo-tools": "seo-tools.html",

  // Legacy SEO tool URLs now open the new SEO Tools workspace.
  "/youtube-shorts-script-generator": "seo-tools.html",
  "/youtube-shorts-title-generator": "seo-tools.html",
  "/youtube-shorts-hashtag-generator": "seo-tools.html",
  "/youtube-shorts-description-generator": "seo-tools.html",
  "/youtube-shorts-ideas-generator": "seo-tools.html",
  "/ai-thumbnail-prompt-generator": "seo-tools.html",
};

// /generator was the old Studio on the legacy stylesheet stack. Its only unique
// feature — AI script writing — now lives in the rebuilt /seo-tools, so the URL
// is kept alive as a redirect instead of serving the old theme. 302, not 301,
// because nothing is deployed yet and a permanent redirect is cached hard.
app.get("/generator", (req, res) => res.redirect(302, "/seo-tools"));

for (const [route, file] of Object.entries(PAGES)) {
  app.get(route, (req, res) => {
    if (file === "seo-tools.html") {
      try {
        res.type("html").send(renderSeoToolsPage(route));
        return;
      } catch (err) {
        console.error("[seo page render]", route, err.message);
        res.status(500).send("Could not render page");
        return;
      }
    }

    const filePath = path.join(__dirname, "public", file);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error("[static page missing]", route, file, err.message);
        res.status(err.statusCode || 404).sendFile(path.join(__dirname, "public", "404.html"));
      }
    });
  });
}

// ── 404 fallback ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[server error]", err);
  res.status(500).json({ success: false, error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`⚡ ShortsCraft v2.0 running on :${PORT} (${NODE_ENV})`);
});
