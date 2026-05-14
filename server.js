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
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://checkout.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co https://api.groq.com https://api.razorpay.com https://www.google-analytics.com",
      "frame-src https://checkout.razorpay.com https://api.razorpay.com",
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
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
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
      if (/favicon|apple-touch-icon|site\.webmanifest/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  })
);

// ============================================================
// API ROUTES
// ============================================================

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
    freeCreditsPerDay: Number(process.env.FREE_CREDITS_PER_DAY || 10),
    gaId: process.env.GA_ID || "",
  });
});

// ── Groq AI generation ──────────────────────────────────────
async function callGroq(prompt, { temperature = 0.85, maxTokens = 1500 } = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30_000);

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
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
      throw new Error(`AI provider error (${r.status}): ${errText.slice(0, 200)}`);
    }
    const data = await r.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } finally {
    clearTimeout(timeout);
  }
}

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

// ── Razorpay: create order ──────────────────────────────────
app.post("/api/razorpay/order", rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.status(503).json({ success: false, error: "Payment service not configured." });
    }

    const amountInr = Number(process.env.PRO_PRICE_INR || 99);
    const amountPaise = amountInr * 100;
    const userId = String(req.body?.userId || "guest").slice(0, 80);

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
        notes: { product: "ShortsCraft Pro", userId },
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("[razorpay/order]", t);
      return res.status(502).json({ success: false, error: "Could not create payment order." });
    }
    const order = await r.json();
    res.json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency, keyId });
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

    const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
    if (!valid) return res.status(400).json({ success: false, error: "Invalid payment signature." });

    res.json({ success: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id });
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

function renderSeoToolsPage(route) {
  const meta = SEO_ROUTE_META[route] || SEO_ROUTE_META["/seo-tools"];
  const canonical = `https://shortscraft.online${route}`;
  const filePath = path.join(__dirname, "public", "seo-tools.html");
  let html = fs.readFileSync(filePath, "utf8");
  html = html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/<meta name="description" content=".*?"\/>/s, `<meta name="description" content="${escapeHtml(meta.description)}"/>`)
    .replace(/<link rel="canonical" href=".*?"\/>/s, `<link rel="canonical" href="${canonical}"/>`)
    .replace(/<section class="seo-tools-hero">([\s\S]*?)<h1>.*?<\/h1>\s*<p>.*?<\/p>/, `<section class="seo-tools-hero">$1<h1>${escapeHtml(meta.h1)}</h1>\n    <p>${escapeHtml(meta.intro)}</p>`)
    .replace(/<h2>Scripts, titles, hashtags & more<\/h2>\s*<p>Use these tools after creating your video or whenever you need a complete Shorts content pack\.<\/p>/, `<h2>${escapeHtml(meta.h2)}</h2>\n        <p>${escapeHtml(meta.intro)}</p>`);
  return html;
}

// ============================================================
// SEO + STATIC ROUTING
// ============================================================
const PAGES = {
  "/": "index.html",
  "/generator": "generator.html",
  "/seo-tools": "seo-tools.html",
  "/pricing": "pricing.html",
  "/about": "about.html",
  "/contact": "contact.html",
  "/privacy": "privacy.html",
  "/terms": "terms.html",

  // Legacy SEO tool URLs now open the new SEO Tools workspace.
  "/youtube-shorts-script-generator": "seo-tools.html",
  "/youtube-shorts-title-generator": "seo-tools.html",
  "/youtube-shorts-hashtag-generator": "seo-tools.html",
  "/youtube-shorts-description-generator": "seo-tools.html",
  "/youtube-shorts-ideas-generator": "seo-tools.html",
  "/ai-thumbnail-prompt-generator": "seo-tools.html",
};

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
