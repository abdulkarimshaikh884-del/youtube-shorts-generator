# YouTube Shorts Script Generator 🎬

Viral **Hinglish** YouTube Shorts scripts — powered by OpenAI GPT-4o-mini.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create your `.env` file
```bash
cp .env.example .env
```

### 3. Add your OpenAI key in `.env`
```
OPENAI_API_KEY=sk-your-key-here
```

### 4. Run the server
```bash
npm start
```

Open: **http://localhost:3000**

---

## What was fixed

| Problem | Fix |
|---|---|
| Ollama (local AI) was used but not installed | Switched to OpenAI API (GPT-4o-mini) |
| `.env` file wasn't being loaded | Added `require('dotenv').config()` |
| CSS button variables were undefined | Rewrote all CSS with proper variables |
| Hindi/Hinglish not generating properly | Improved prompt with system + user messages |
| Script displayed as plain text | Now shows Hook/Main/CTA as styled sections |

---

## API

### `POST /api/generate`

**Request:**
```json
{ "topic": "Morning productivity hacks" }
```

**Response:**
```json
{
  "hook": "Yaar, subah uthte hi phone mat pakdo...",
  "mainContent": "Pehle 30 minute screen-free rakho...",
  "cta": "Agar ye kaam aaya toh subscribe karo bhai!"
}
```
