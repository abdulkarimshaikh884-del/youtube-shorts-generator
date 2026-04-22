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

app.post("/api/generate", async (req, res) => {
  const { topic } = req.body;
  if (!topic || !topic.trim()) return res.status(400).json({ error: "Topic is required." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Groq API key missing! .env file check karo." });

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
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
        ],
        temperature: 0.9,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq error:", errText);
      throw new Error("Groq API se response nahi aaya.");
    }

    const data = await response.json();
    const outputText = (data.choices?.[0]?.message?.content || "").trim();
    let sections = parseSections(outputText);

    if (!sections.hook && !sections.mainContent && !sections.cta) {
      sections = { hook: "", mainContent: outputText, cta: "" };
    }

    return res.json(sections);
  } catch (error) {
    console.error("Generation error:", error);
    return res.status(500).json({ error: error.message || "Script generate nahi hui. Dobara try karo." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server chal raha hai: http://localhost:${PORT}`);
  console.log(`🔑 Groq API Key: ${process.env.GROQ_API_KEY ? "Loaded ✓" : "MISSING ✗ — .env check karo!"}`);
});
