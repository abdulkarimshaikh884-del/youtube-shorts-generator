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
    return text.split("\n").map(l => l.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).slice(0, fallbackLimit);
  }
}

async function callGroq(messages, temperature = 0.9, max_tokens = 900) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, temperature, max_tokens }),
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
      { role: "system", content: `Tu ek viral YouTube Shorts script writer hai jo Hinglish mein likhta hai. Hinglish matlab Hindi aur English ka natural mix. Ekdum conversational, energetic, emotional aur relatable tone rakho. Sirf spoken lines likho. Script 150-200 words ki honi chahiye. Hook mein curiosity ya shock. Main Content mein 3-4 solid points with examples. CTA strong aur personal. IMPORTANT: Sirf neeche diya format use karo.` },
      { role: "user", content: `"${topic}" topic par ek viral Hinglish YouTube Shorts script likho.\n\nHook: [2-3 lines catchy opening]\nMain Content: [6-8 lines detailed Hinglish explanation]\nCTA: [2-3 lines strong call to action]` },
    ]);
    let sections = parseSections(outputText);
    if (!sections.hook && !sections.mainContent && !sections.cta) sections = { hook: "", mainContent: outputText, cta: "" };
    return res.json(sections);
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ── TITLES ────────────────────────────────────────────────────
app.post("/api/titles", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq([
      { role: "system", content: `Tu ek YouTube SEO expert hai. Viral Hinglish titles likho. Numbers aur emojis use karo. Sirf JSON array return karo.` },
      { role: "user", content: `"${topic}" ke liye exactly 5 viral YouTube Shorts titles do.\n\nSirf JSON array:\n["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]` },
    ], 0.9, 400);
    return res.json({ titles: extractJsonArray(out, 5) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ── HOOKS ─────────────────────────────────────────────────────
app.post("/api/hooks", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq([
      { role: "system", content: `Tu ek viral content creator hai. 5 alag style hooks likho: 1.Shock 2.Question 3.Bold 4.Pain Point 5.Story. Hinglish mein. Sirf JSON array return karo.` },
      { role: "user", content: `"${topic}" ke liye 5 alag viral hooks do (2-3 lines each).\n\nSirf JSON array:\n["Hook 1", "Hook 2", "Hook 3", "Hook 4", "Hook 5"]` },
    ], 0.95, 600);
    return res.json({ hooks: extractJsonArray(out, 5) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ── HASHTAGS ──────────────────────────────────────────────────
app.post("/api/hashtags", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq([
      { role: "system", content: `Tu YouTube SEO hashtag expert hai. Broad + niche + Hindi hashtags mix karo. Sirf JSON array return karo.` },
      { role: "user", content: `"${topic}" ke liye exactly 15 best YouTube hashtags do.\n\nSirf JSON array:\n["#hashtag1", "#hashtag2"]` },
    ], 0.7, 300);
    return res.json({ hashtags: extractJsonArray(out, 15) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ── IDEAS ─────────────────────────────────────────────────────
app.post("/api/ideas", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq([
      { role: "system", content: `Tu YouTube content strategist hai. Related video ideas do jo creator bana sake. Hinglish mein catchy aur actionable. Sirf JSON array return karo.` },
      { role: "user", content: `"${topic}" se related 7 YouTube Shorts video ideas do.\n\nSirf JSON array:\n["Idea 1", "Idea 2", "Idea 3", "Idea 4", "Idea 5", "Idea 6", "Idea 7"]` },
    ], 0.9, 500);
    return res.json({ ideas: extractJsonArray(out, 7) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ── THUMBNAIL PROMPTS (AI Image Prompts) ──────────────────────
app.post("/api/thumbnail", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "Topic required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing!" });
  try {
    const out = await callGroq([
      { role: "system", content: `Tu ek professional YouTube thumbnail designer aur AI image prompt expert hai. Tera kaam hai detailed, specific AI image generation prompts likhna jo Midjourney, DALL-E ya Stable Diffusion mein use ho sake. Har prompt mein yeh hona chahiye: subject, visual style, lighting, colors, mood, text overlay suggestion, composition. Professional YouTuber-level thumbnails ke liye. Sirf JSON array return karo, kuch aur nahi.` },
      { role: "user", content: `"${topic}" topic ke YouTube Shorts ke liye exactly 3 alag alag professional AI thumbnail image prompts likho.\n\nHar prompt detailed hona chahiye (50-80 words) with specific visual instructions.\n\nSirf JSON array:\n["Prompt 1 detailed...", "Prompt 2 detailed...", "Prompt 3 detailed..."]` },
    ], 0.85, 800);
    return res.json({ thumbnail: extractJsonArray(out, 3) });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`✅ Server: http://localhost:${PORT}`);
  console.log(`🔑 Groq: ${process.env.GROQ_API_KEY ? "Loaded ✓" : "MISSING ✗"}`);
});
