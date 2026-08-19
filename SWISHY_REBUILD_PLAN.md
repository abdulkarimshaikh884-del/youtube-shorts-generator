# ShortsCraft → Swishy-style Rebuild — PLAN
Date: 2026-08-07 · Status: PLANNING ONLY, no code written yet

Goal (user): make shortscraft.online work and feel like **swishy.ai**.

---

## 1. WHAT SWISHY ACTUALLY IS

Read from swishy.ai directly. Three separable layers:

**A. App-shell UI**
* Left sidebar: logo, primary `+ Create Animation` CTA, nav = Templates / My Projects / Community / Tutorials & Help
* Top bar: Feedback (Tally form) · Changelog (GitBook) · Upgrade · Log in / Sign up
* Hero: `What can I help animate?` + subtitle "Your AI motion designer for stunning animations and typefaces"
* Prompt composer: one textarea (`What will you imagine?`), image-upload + video toggles, tier selector (`Mini`), `Create` button
* Mobile: "try Swishy on desktop" + email-me-a-link

**B. Gallery-as-content + programmatic SEO**
* Category chips are **real routes**: `/text` `/graphics` `/overlays` `/logos` `/social` `/charts-data` `/money` `/app-website` `/ui-elements` `/launch-videos`
* ~150 template cards, each = preview + title + **the user's original prompt as the description**
* 6 feature landing pages with their own keyword clusters: `/ai-motion-designer` `/ai-typeface` `/ai-text-animation` `/ai-motion-graphics` `/ai-animator` `/after-effects-alternative`
* Social proof stats (10K+ creators, 500K+ animations, 30sec avg, 4.9/5)
* 8-question FAQ accordion, "Popular searches" internal link cluster, 4-column footer

**C. The product**
Prompt → generated animation. This is the expensive layer.

---

## 2. WHAT SHORTSCRAFT ALREADY IS

Verified by reading `server.js`, `package.json`, `public/`, `remotion/`, `public/video-templates.js`.

**Live** at `shortscraft.online`, deployed on **Render** (code has a Render reverse-proxy note + www→non-www 301).

Stack: Express 4 (CommonJS) · static frontend · **Supabase** auth · **Razorpay** payments (PRO_PRICE_INR default 99) · **Groq** `llama-3.3-70b-versatile` for text · GA · Puppeteer + Sharp · in-memory rate limiter · CSP/HSTS/security headers already set.

Routes: `/` `/generator` `/seo-tools` `/pricing` `/about` `/contact` `/privacy` `/terms`, plus 6 legacy SEO URLs that all render `seo-tools.html` with **server-side swapped meta/H1** — a working programmatic-SEO pattern already in place.

API: `/api/health` `/api/config` `/api/generate` (type = all/script/titles/description/hashtags/ideas/thumbnail) `/api/razorpay/order` `/api/razorpay/verify` `/api/feedback`. Free credits 10/day.

**The important find — `public/video-templates.js` (259 KB) is an animation engine.**
`window.SC_VIDEO_TEMPLATES` holds a `TEMPLATE_HTMLS` map of named, self-contained HTML documents: `motivation`, `clean-minimal`, `luxury`, `social-pop`, `horror`, `gaming`, `news`, `vhs`, `neon-cyber`, `kinetic-3d`, … Each is a 9:16 `.phone` container running a scene machine on pure CSS keyframes, with a documented contract:

```
.scene > .copy > .line > .w      (+ a .flash transition layer)
decorative accents use .ring / .badge / .card so entrances replay per cycle
```

Separately `remotion/src/` has `MainVideo.tsx`, `KineticText.tsx`, `Background.tsx`, `theme.ts`, `fx.ts`, `scenes.ts` — a second, real render path.

**So we already ship kinetic-typography motion graphics.** That is precisely Swishy's biggest category.

---

## 3. THE REAL GAP

| | Swishy | ShortsCraft today |
|---|---|---|
| Prompt → animation | AI authors a **new** animation each time | AI writes text, then it is poured into ~10 **fixed** templates |
| Gallery | ~150 community templates, prompt-as-description, per-category routes | none (templates hidden inside the generator) |
| Shell | sidebar app | marketing landing + separate generator page |
| Projects | My Projects (saved, revisitable) | nothing persisted |
| Export | video file | HTML animation in-page (Remotion + Puppeteer exist but unwired) |

Only 4 real gaps. The shell and the gallery are cheap. Projects is medium. Export is the expensive one.

### The unlock
Our templates are **self-contained HTML+CSS**. That means an LLM can author one directly. Groq is already wired. So "prompt → new animation" becomes: **Groq emits a scene document that obeys the `.scene/.copy/.line/.w` contract → we render it in a sandboxed iframe → optionally export via Puppeteer/Remotion.**

No image model, no GPU, no new vendor. This is the cheapest credible path to Swishy's core feature, and it plays to what we already built.

---

## 4. PHASED PLAN

### Phase 1 — App shell (frontend only, ~1 day)
Sidebar (logo, `+ Create Animation`, Templates / My Projects / Community / Help), top bar (Feedback / Changelog / Upgrade / auth), prompt-first hero replacing the marketing hero, category chips, masonry gallery grid. Existing generators stay wired behind it. No API changes.

### Phase 2 — Gallery as real content + programmatic SEO (~1 day)
Turn the ~10 existing templates into gallery cards with live previews. Add category routes reusing the **already-proven** `renderSeoToolsPage` meta-swap pattern. Keep every existing `/youtube-shorts-*` URL alive.

### Phase 3 — Prompt → new animation (the core, ~2-4 days)
New `/api/animate`: Groq authors a scene document against our contract; validate and sanitise; render in a sandboxed iframe; retry-on-invalid. Seed the gallery from real successful prompts, Swishy-style.

### Phase 4 — Projects + credits (~2 days)
Persist prompt + generated HTML per user in Supabase, `My Projects` list, wire the existing free-credits/Razorpay Upgrade flow to animation generations.

### Phase 5 — Video export (most expensive, decide later)
Two options: client-side capture (free, limited) or server-side Puppeteer/Remotion render (needs a paid Render instance + a worker + storage). **Do not start this before Phases 1-3 prove demand.**

---

## 5. DECISIONS NEEDED FROM USER

1. **Scope** — redesign only (look like Swishy) or product pivot (do what Swishy does)? Recommendation: Phases 1-2 now, then decide on 3.
2. **Brand/SEO** — ShortsCraft's SEO is built on "YouTube Shorts script/title/hashtag generator" keywords, with real ranking pages. Swishy's is "AI animation / AI typeface". **Recommendation: do NOT drop the Shorts keywords.** Add animation as the product, keep the Shorts SEO surface. Dropping it throws away existing organic traffic.
3. **Video export at MVP, or later?** This is the single biggest cost driver.
4. **Render plan** — free or paid? Server-side rendering will not work on a free instance.

---

## 6. RISKS / CALLOUTS

* **SECURITY — the big one.** Phase 3 means injecting LLM-authored HTML into a page. That is a direct XSS vector. It MUST render inside a sandboxed iframe (`sandbox` without `allow-same-origin`), never `innerHTML` into the main document. The CSP in `server.js` also currently allows `'unsafe-inline'` for scripts, which weakens this — needs review before Phase 3 ships.
* **Monolith size** — `public/styles.css` is 297 KB and `public/script.js` is 124 KB. A redesign has to be additive (new shell stylesheet) rather than a rewrite, or it will regress pages we cannot easily retest.
* **Existing test suite must stay green** — `verify_studio_redesign.js`, `verify_generator_restore.js`, `verify_seo_a11y_size.js`, `verify_brand_logos.js`, `verify_video_templates.js`, `verify_page_redesign.js`. `npm test` runs the first two. Run these after every phase.
* **Live site** — all changes get built and verified locally first, then deployed. No direct production edits.
* **Groq output reliability** — LLM-authored HTML will sometimes be invalid. Needs a validator + retry, and a fallback to the fixed templates so the user never sees a dead result.
* **Mobile** — Swishy openly punts to desktop. Our Shorts audience is mobile-heavy, so we cannot copy that. The shell must work on mobile.

---

## 7. START HERE (next session)

Answer the four decisions in §5, then begin Phase 1. Build locally, run `npm test` plus the relevant `verify_*.js`, and only deploy after they pass.
