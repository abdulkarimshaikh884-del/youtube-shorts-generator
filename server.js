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
  const ctaMatch = text.match(/CTA:\s*([\s\S]*)/i);

  return {
    hook: hookMatch ? hookMatch[1].trim() : "",
    mainContent: mainMatch ? mainMatch[1].trim() : "",
    cta: ctaMatch ? ctaMatch[1].trim() : "",
  };
}

function extractJsonArray(text, fallbackLimit = 5) {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return text
      .split("\n")
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
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

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq error: ${errText}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

// ── SCRIPT GENERATE ──────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const { topic } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required." });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Groq API key missing!" });
  }

  try {
    const outputText = await callGroq([
      {
        role: "system",
        content: `Tu ek viral YouTube Shorts script writer hai jo Hinglish mein likhta hai.
Hinglish matlab Hindi aur English ka natural mix — jaise Indians normally bolte hain.
Ekdum conversational, energetic, emotional aur relatable tone rakho.
Sirf spoken lines likho — koi stage directions, brackets, ya extra explanation mat likho.
Script 150-200 words ki honi chahiye — detailed aur engaging.
Hook mein curiosity ya shock create karo.
Main Content mein 3-4 solid points doh with examples ya facts.
CTA strong aur personal hona chahiye.
IMPORTANT: Sirf neeche diya format use karo, kuch extra mat likho.`,
      },
      {
        role: "user",
        content: `"${topic}" topic par ek viral Hinglish YouTube Shorts script likho.

Script 150-200 words ki honi chahiye. Detailed aur engaging rakho.

Exactly is format mein likho:

Hook: [2-3 lines ki super catchy opening — curiosity ya shock create karo]
Main Content: [6-8 lines mein detailed explanation — examples, facts, tips ke saath Hinglish mein]
CTA: [2-3 lines ka strong personal call to action]`,
      },
    ]);

    let sections = parseSections(outputText);

    if (!sections.hook && !sections.mainContent && !sections.cta) {
      sections = { hook: "", mainContent: outputText, cta: "" };
    }

    return res.json(sections);
  } catch (error) {
    console.error("Generate error:", error);
    return res.status(500).json({ error: error.message || "Script generate nahi hui." });
  }
});

// ── TITLES GENERATE ───────────────────────────────────────────
app.post("/api/titles", async (req, res) => {
  const { topic } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required." });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Groq API key missing!" });
  }

  try {
    const outputText = await callGroq([
      {
        role: "system",
        content: `Tu ek YouTube SEO expert hai. Tera kaam hai viral, clickbait-y lekin honest video titles likhna.
Titles Hinglish mein hone chahiye — Hindi aur English ka mix.
Har title curiosity, emotion ya shock create kare.
Numbers use karo jahan ho sake. Emojis allowed hain.
IMPORTANT: Sirf JSON array return karo, kuch aur nahi.`,
      },
      {
        role: "user",
        content: `"${topic}" topic ke liye exactly 5 viral YouTube Shorts titles do.

Sirf JSON array return karo is format mein:
["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]

Kuch aur mat likho — sirf JSON array.`,
      },
    ], 0.9, 400);

    const titles = extractJsonArray(outputText, 5);
    return res.json({ titles });
  } catch (error) {
    console.error("Titles error:", error);
    return res.status(500).json({ error: error.message || "Titles generate nahi hue." });
  }
});

// ── HOOKS GENERATE ────────────────────────────────────────────
app.post("/api/hooks", async (req, res) => {
  const { topic } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required." });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Groq API key missing!" });
  }

  try {
    const outputText = await callGroq([
      {
        role: "system",
        content: `Tu ek viral content creator hai jo killer hooks likhta hai YouTube Shorts ke liye.
Hooks Hinglish mein hone chahiye — punchy, emotional aur scroll-stopping.
Har hook alag style ka hona chahiye:
1. Shock/Surprising fact
2. Question jo curiosity jagaye
3. Bold/Controversial statement
4. Relatable pain point
5. Story-style opening
IMPORTANT: Sirf JSON array return karo, kuch aur nahi.`,
      },
      {
        role: "user",
        content: `"${topic}" topic ke liye exactly 5 alag alag style ke viral hooks do (2-3 lines each).

Sirf JSON array return karo is format mein:
["Hook 1 text", "Hook 2 text", "Hook 3 text", "Hook 4 text", "Hook 5 text"]

Kuch aur mat likho — sirf JSON array.`,
      },
    ], 0.95, 600);

    const hooks = extractJsonArray(outputText, 5);
    return res.json({ hooks });
  } catch (error) {
    console.error("Hooks error:", error);
    return res.status(500).json({ error: error.message || "Hooks generate nahi hue." });
  }
});

// ── HASHTAGS GENERATE ─────────────────────────────────────────
app.post("/api/hashtags", async (req, res) => {
  const { topic } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required." });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Groq API key missing!" });
  }

  try {
    const outputText = await callGroq([
      {
        role: "system",
        content: `Tu ek YouTube SEO aur hashtag expert hai.
Relevant, trending aur high-reach hashtags do jo views badhayein.
Mix karo: broad hashtags + niche hashtags + Hindi/Hinglish hashtags.
IMPORTANT: Sirf JSON array return karo, kuch aur nahi.`,
      },
      {
        role: "user",
        content: `"${topic}" topic ke liye exactly 15 best YouTube hashtags do.

Sirf JSON array return karo is format mein:
["#hashtag1", "#hashtag2", "#hashtag3"]

Kuch aur mat likho — sirf JSON array.`,
      },
    ], 0.7, 300);

    const hashtags = extractJsonArray(outputText, 15);
    return res.json({ hashtags });
  } catch (error) {
    console.error("Hashtags error:", error);
    return res.status(500).json({ error: error.message || "Hashtags generate nahi hue." });
  }
});

// ── IDEAS GENERATE ────────────────────────────────────────────
app.post("/api/ideas", async (req, res) => {
  const { topic } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Topic required." });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Groq API key missing!" });
  }

  try {
    const outputText = await callGroq([
      {
        role: "system",
        content: `Tu ek YouTube content strategist hai.
Tera kaam hai related video ideas dena jo ek creator apne channel pe bana sake.
Ideas Hinglish mein hone chahiye — catchy aur actionable.
IMPORTANT: Sirf JSON array return karo, kuch aur nahi.`,
      },
      {
        role: "user",
        content: `"${topic}" se related 7 YouTube Shorts video ideas do.

Sirf JSON array return karo:
["Idea 1", "Idea 2", "Idea 3", "Idea 4", "Idea 5", "Idea 6", "Idea 7"]`,
      },
    ], 0.9, 500);

    const ideas = extractJsonArray(outputText, 7);
    return res.json({ ideas });
  } catch (error) {
    console.error("Ideas error:", error);
    return res.status(500).json({ error: error.message || "Ideas generate nahi hue." });
  }
});

// ── THUMBNAIL GENERATE ────────────────────────────────────────
app.post("/api/thumbnail", async (req, res) => {
  const { topic } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Topic required." });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Groq API key missing!" });
  }

  try {
    const outputText = await callGroq([
      {
        role: "system",
        content: `Tu ek YouTube thumbnail designer hai.
Tera kaam hai short, bold, eye-catching thumbnail text likhna.
Text 1-5 words ka hona chahiye — maximum impact ke liye.
Mix of Hindi/English allowed.
IMPORTANT: Sirf JSON array return karo, kuch aur nahi.`,
      },
      {
        role: "user",
        content: `"${topic}" topic ke liye 6 thumbnail text ideas do — short, bold, clickbait style.

Sirf JSON array return karo:
["TEXT 1", "TEXT 2", "TEXT 3", "TEXT 4", "TEXT 5", "TEXT 6"]`,
      },
    ], 0.9, 300);

    const thumbnail = extractJsonArray(outputText, 6);
    return res.json({ thumbnail });
  } catch (error) {
    console.error("Thumbnail error:", error);
    return res.status(500).json({ error: error.message || "Thumbnail ideas generate nahi hue." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server chal raha hai: http://localhost:${PORT}`);
  console.log(`🔑 Groq API Key: ${process.env.GROQ_API_KEY ? "Loaded ✓" : "MISSING ✗"}`);
});
