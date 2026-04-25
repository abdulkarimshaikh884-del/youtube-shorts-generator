require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function parseSections(text) {
  const hookMatch = text.match(/Hook:\s*([\s\S]*?)(?=Main Content:|CTA:|$)/i);
  const mainMatch = text.match(/Main Content:\s*([\s\S]*?)(?=CTA:|$)/i);
  const ctaMatch  = text.match(/CTA:\s*([\s\S]*)/i);
  return {
    hook:        hookMatch ? hookMatch[1].trim() : "",
    mainContent: mainMatch ? mainMatch[1].trim() : "",
    cta:         ctaMatch  ? ctaMatch[1].trim()  : "",
  };
}

function extractJsonArray(text, fallbackLimit = 5) {
  try {
    const match  = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return text
      .split("\n")
      .map(l => l.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, fallbackLimit);
  }
}

async function callGroq(messages, temperature = 0.9, max_tokens = 900) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature,
      max_tokens,
    }),
  });
  if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);
  const data = await response.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

// ── SCRIPT ───────────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const outputText = await callGroq([
      {
        role: "system",
        content: `Tu ek viral YouTube Shorts script writer hai jo Hinglish mein likhta hai. Hinglish matlab Hindi aur English ka natural mix. Ekdum conversational, energetic, emotional aur relatable tone rakho. Sirf spoken lines likho. Script 150-200 words ki honi chahiye. Hook mein curiosity ya shock. Main Content mein 3-4 solid points with examples. CTA strong aur personal. IMPORTANT: Sirf neeche diya format use karo.`,
      },
      {
        role: "user",
        content: `"${topic}" topic par ek viral Hinglish YouTube Shorts script likho.\n\nHook: [2-3 lines catchy opening]\nMain Content: [6-8 lines detailed Hinglish explanation]\nCTA: [2-3 lines strong call to action]`,
      },
    ]);
    let sections = parseSections(outputText);
    if (!sections.hook && !sections.mainContent && !sections.cta) {
      sections = { hook: "", mainContent: outputText, cta: "" };
    }
    return res.json(sections);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── TITLES ────────────────────────────────────────────────────
app.post("/api/titles", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq(
      [
        {
          role: "system",
          content: `Tu ek YouTube SEO expert hai. Viral Hinglish titles likho. Numbers aur emojis use karo. Sirf JSON array return karo.`,
        },
        {
          role: "user",
          content: `"${topic}" ke liye exactly 5 viral YouTube Shorts titles do.\n\nSirf JSON array:\n["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]`,
        },
      ],
      0.9,
      400
    );
    return res.json({ titles: extractJsonArray(out, 5) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── DESCRIPTION (FIXED) ───────────────────────────────────────
app.post("/api/description", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq(
      [
        {
          role: "system",
          content: `You are a YouTube SEO expert who writes engaging video descriptions. Write in a Hinglish + English natural mix (Indian creator style). The description must be SEO-optimized, emoji-rich, and ready-to-paste into YouTube. Structure:
1) Catchy opening line (1-2 sentences with emojis)
2) 3-4 line detailed explanation of the video value
3) "In this video you'll learn:" followed by 4-5 bullet points (use ✅ or 🔥)
4) Call-to-action (Subscribe, Like, Comment) with emojis
5) 8-10 relevant hashtags at the end on a single line
Keep total length between 120-180 words. Return ONLY the description text, no preamble, no markdown fences, no "Here is..." prefix.`,
        },
        {
          role: "user",
          content: `Write a complete YouTube description for a Shorts video on the topic: "${topic}"`,
        },
      ],
      0.85,
      700
    );

    // Clean any accidental wrapping quotes or code fences
    const description = out
      .replace(/^```[a-z]*\s*/i, "")
      .replace(/```\s*$/, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    return res.json({ description });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── HOOKS ─────────────────────────────────────────────────────
app.post("/api/hooks", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq(
      [
        {
          role: "system",
          content: `Tu ek viral content creator hai. 5 alag style hooks likho: 1.Shock 2.Question 3.Bold 4.Pain Point 5.Story. Hinglish mein. Sirf JSON array return karo.`,
        },
        {
          role: "user",
          content: `"${topic}" ke liye 5 alag viral hooks do (2-3 lines each).\n\nSirf JSON array:\n["Hook 1", "Hook 2", "Hook 3", "Hook 4", "Hook 5"]`,
        },
      ],
      0.95,
      600
    );
    return res.json({ hooks: extractJsonArray(out, 5) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── HASHTAGS ──────────────────────────────────────────────────
app.post("/api/hashtags", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq(
      [
        {
          role: "system",
          content: `Tu YouTube SEO hashtag expert hai. Broad + niche + Hindi hashtags mix karo. Sirf JSON array return karo.`,
        },
        {
          role: "user",
          content: `"${topic}" ke liye exactly 15 best YouTube hashtags do.\n\nSirf JSON array:\n["#hashtag1", "#hashtag2"]`,
        },
      ],
      0.7,
      300
    );
    return res.json({ hashtags: extractJsonArray(out, 15) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── IDEAS ─────────────────────────────────────────────────────
app.post("/api/ideas", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq(
      [
        {
          role: "system",
          content: `Tu YouTube content strategist hai. Related video ideas do jo creator bana sake. Hinglish mein catchy aur actionable. Sirf JSON array return karo.`,
        },
        {
          role: "user",
          content: `"${topic}" se related 7 YouTube Shorts video ideas do.\n\nSirf JSON array:\n["Idea 1", "Idea 2", "Idea 3", "Idea 4", "Idea 5", "Idea 6", "Idea 7"]`,
        },
      ],
      0.9,
      500
    );
    return res.json({ ideas: extractJsonArray(out, 7) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── THUMBNAIL PROMPTS (100% ENGLISH) ──────────────────────────
app.post("/api/thumbnail", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq(
      [
        {
          role: "system",
          content: `You are a professional YouTube thumbnail designer and an expert AI image prompt engineer for Midjourney, DALL-E 3, and Stable Diffusion.

STRICT RULES:
- Write prompts in 100% ENGLISH ONLY.
- NEVER use Hindi, Hinglish, Urdu, or any non-English words.
- NO romanized Hindi (no "yaar", "bhai", "zindagi", "life badal", etc.).
- Every prompt must be a single long descriptive sentence (60-90 words) in cinematic English.

Each prompt MUST include ALL of these elements:
1. Subject (clear main focus — person, object, or scene)
2. Facial expression or action (e.g., shocked, pointing, laughing)
3. Cinematic lighting (e.g., dramatic rim light, golden hour, neon glow)
4. Background (detailed, relevant to topic)
5. Color palette (high contrast, vibrant, bold saturated colors)
6. Bold English text overlay — include the exact text in quotes (e.g., big bold text "STOP DOING THIS!")
7. Composition: 16:9 aspect ratio, close-up framing, YouTube thumbnail style
8. Style keywords: ultra-realistic, 8k, cinematic, viral YouTube thumbnail, eye-catching, high contrast

Return ONLY a valid JSON array of 3 strings. No markdown, no extra text.`,
        },
        {
          role: "user",
          content: `Topic: "${topic}"\n\nGenerate exactly 3 different professional AI thumbnail image prompts in English only.\n\nReturn strictly as JSON:\n["prompt 1 in english...", "prompt 2 in english...", "prompt 3 in english..."]`,
        },
      ],
      0.8,
      1000
    );
    return res.json({ thumbnail: extractJsonArray(out, 3) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── RAZORPAY ─────────────────────────────────────────────────
const crypto = require('crypto');

app.post("/api/create-order", async (req, res) => {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(503).json({ error: "Payment setup incomplete. Please contact admin." });
  }

  try {
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        amount: 9900,       // ₹99 in paise
        currency: "INR",
        receipt: `sc_${Date.now()}`,
        notes: { product: "ShortsCraft Pro", plan: "monthly" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Razorpay create-order error:", errText);
      return res.status(500).json({ error: "Could not create payment order. Try again." });
    }

    const order = await response.json();
    return res.json({
      order_id: order.id,
      key_id: keyId,        // Safe to expose key_id (public key)
      amount: order.amount,
      currency: order.currency,
    });
  } catch (e) {
    console.error("create-order error:", e);
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/verify-payment", (req, res) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    return res.status(503).json({ success: false, error: "Payment setup incomplete." });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, error: "Missing payment fields." });
  }

  try {
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;
    return res.json({ success: isValid });
  } catch (e) {
    console.error("verify-payment error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server: http://localhost:${PORT}`);
  console.log(`🔑 Groq: ${process.env.GROQ_API_KEY ? "Loaded ✓" : "MISSING ✗"}`);
});
