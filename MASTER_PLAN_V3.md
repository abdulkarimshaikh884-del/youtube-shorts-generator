# ShortsCraft v3 — MASTER PLAN
Date: 2026-08-08 · Supersedes the scope section of SWISHY_REBUILD_PLAN.md

User decisions locked in:
1. The new monochrome shell is approved → **every page** gets it. No old page survives.
2. **Delete all 13 old templates.** Real feedback: "ye koi animation hai?" — they are the
   reason the site has no visitors.
3. Build genuinely premium motion-graphics templates, **one set per category**, Swishy-grade.
4. **New differentiator: users publish their own templates**, moderated, like a mods site.

---

## 1. WHY THE OLD TEMPLATES FAILED (diagnosis, not opinion)

All 13 old templates are the same idea: **large Hinglish words on a coloured gradient,
cycled as "scenes"**. Compare what Swishy actually ships:

| Swishy template | What it animates |
|---|---|
| ON-OFF Toggle | a real iOS toggle switch flipping |
| Spotify Player Animation | a player UI with a moving progress bar |
| animate netflix logo | a logo drawing itself |
| Photobooth animation | photo strip printing out |
| alarm toggle | a clock face + switch |
| folder gallery | a folder opening, files popping out |
| Squiggle flow text | text riding a morphing blob |

The difference is not polish. It is **subject matter**. Swishy animates *objects and UI*;
we animate *paragraphs*. Four concrete quality rules fall out of this:

1. **Animate an object, not a wall of text.** Text is a caption, not the subject.
2. **Restrained palette.** Mostly black or white plus ONE accent. Our rainbow gradients
   read as "template", theirs read as "designed".
3. **Spring/precision easing.** `cubic-bezier(.16,1,.3,1)` and overshoot, not linear fades.
4. **One idea per template, looping cleanly.** No 6-scene text carousels.

### Architectural consequence
The old engine's scene machine is also the source of our live bugs: `build()` routes
everything through `buildPremiumEngine()` which emits `.pm-scene`, while
`verify_video_templates.js` asserts `.scene` — so the verifier reports 0 scenes. And
`viral-hook` / `ultra-typography` currently render blank tiles in the gallery.

So we do not patch v1. **We replace it.** Templates v2 is CSS-only and loop-based:
no scene machine, no JS cycling, therefore that entire class of bug disappears.

---

## 2. TEMPLATES V2 — DESIGN CONTRACT

One file, `public/templates-v2.js`, exposing:

```js
window.SC_TPL2 = {
  cats(),                  // category metadata
  list(),                  // [{id,name,cat,desc,dark,accent}]
  build(id, opts)          // -> full self-contained HTML document string
}
```

`opts = { lines:[l1,l2,l3], accent, aspect, dur }`

Rules every v2 template obeys:
* Fixed 1080×1920 design canvas, scaled to any viewport with one transform — so the same
  document works as a 214 px gallery tile and as a full-screen export.
* **CSS-only, `animation … infinite`.** No JS. Loops seamlessly.
* Monochrome base + exactly one accent colour (user-overridable).
* Shared base: reset, canvas fit, safe area, type scale, spring easings, watermark.
* Text comes from `opts.lines`, HTML-escaped.

### Launch set — 12 templates, one per Swishy-equivalent category

| id | Category | Subject that animates |
|---|---|---|
| `type-cascade` | Text | words rise + unblur in sequence over a hairline rule |
| `mask-wipe` | Text | headline revealed by a travelling mask bar |
| `toggle-ui` | UI Elements | iOS toggle flipping on, label swapping |
| `ios-notify` | UI Elements | notification card springing onto a lock screen |
| `like-burst` | Social | heart button tap, particle burst, counter tick |
| `story-bars` | Social | story progress bars advancing across frames |
| `logo-draw` | Logos | monogram drawing itself via stroke-dash, then filling |
| `bar-race` | Charts & Data | four bars growing with staggered springs |
| `ring-counter` | Charts & Data | circular progress sweep + stepped percentage |
| `cash-stack` | Money | notes stacking up with a rising total |
| `phone-scroll` | App & Website | phone mockup scrolling under a moving cursor |
| `countdown` | Launch Videos | 3-2-1 ring countdown into a title card |

---

## 3. ALL-PAGES REDESIGN

Every page moves into the `sh-` shell. Rule: pages load **only** `shell.css` — never
`styles.css` / `premium.css` / `landing.css`, which own generic class names and force the
legacy violet theme with `!important`.

| Page | Work |
|---|---|
| `/` | DONE (this shell) — repoint gallery to v2 |
| `/generator` | biggest job: rebuild the Studio in the shell, switch to v2 engine, read `?topic=&style=&aspect=` and `sc_pending_prompt` |
| `/seo-tools` | rebuild in shell, keep the server-side meta swap for all 6 legacy tool URLs |
| `/pricing` `/about` `/contact` `/privacy` `/terms` `/404` | straight reskin, content preserved |
| new `/community` | published user templates |
| new `/publish` | submit-a-template form |
| new `/my-projects` | a user's own saved animations |

Non-negotiable while doing this: **keep every existing URL alive** and keep the
`/youtube-shorts-*` keyword pages intact. That organic surface is the only traffic we have.

---

## 4. COMMUNITY PUBLISHING (the differentiator)

Model it on a mods site: the user owns the whole flow, a moderator only gates publication.

### Flow
`Create in Studio → Publish → pending → moderator approves/rejects → live in /community`
Live templates are usable by anyone from the gallery, with author credit.

### Supabase schema
```sql
create table templates (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references auth.users(id) on delete set null,
  author_name  text not null,
  title        text not null check (char_length(title) between 3 and 80),
  description  text check (char_length(description) <= 400),
  category     text not null,
  html         text not null,            -- the generated document
  accent       text,
  status       text not null default 'pending',  -- pending|approved|rejected
  reject_note  text,
  downloads    int  not null default 0,
  likes        int  not null default 0,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid
);
alter table templates enable row level security;
create policy read_approved  on templates for select using (status = 'approved');
create policy read_own       on templates for select using (auth.uid() = author_id);
create policy insert_own     on templates for insert with check (auth.uid() = author_id);
```

### API
* `POST /api/templates`         submit (auth required, rate limited)
* `GET  /api/templates`         list approved, filter by category, paginate
* `GET  /api/templates/:id`     one
* `POST /api/templates/:id/like`
* `GET  /api/admin/templates`   moderation queue (admin only)
* `POST /api/admin/templates/:id/review`  approve / reject with note

### SECURITY — read this before writing a line of it
User-submitted HTML is **hostile input**. This is the single highest-risk feature on the site.

1. Render every user template **only** inside `<iframe sandbox="allow-scripts" srcdoc>`,
   never `innerHTML` into the page. No `allow-same-origin` — ever. Combining
   `allow-scripts allow-same-origin` lets the frame remove its own sandbox.
2. Server-side reject on submit: `<script`, `on*=` handlers, `javascript:`,
   `<iframe`, `<object`, `<embed`, `<link`, `<meta http-equiv`, `fetch(`,
   `XMLHttpRequest`, `import(`, and any absolute URL that is not on our allowlist.
   Cap size at ~256 KB.
3. Tighten CSP for community pages: no `unsafe-inline` for scripts on those routes.
   The current global CSP allows `script-src 'unsafe-inline'`, which is too loose to be
   shipping user content under.
4. Moderation is mandatory before anything is public. Default status `pending`.
5. Rate limit submissions per user per day, and log author + IP.
6. Strip EXIF / reject uploaded binaries — v1 accepts generated HTML only, no file uploads.

I will not ship this feature without 1, 2 and 4 in place.

---

## 5. ORDER OF WORK

**Phase A — templates v2 (do first; it is the actual complaint)**
1. `public/templates-v2.js` — engine + 12 templates
2. Repoint the index gallery to v2, categories from v2
3. `verify_templates_v2.js` — every template builds, has motion, no page errors,
   no horizontal overflow, fits its canvas
4. Retire v1: delete `public/video-templates.js` and the outdated
   `verify_video_templates.js` **after** the Studio no longer imports them

**Phase B — pages**
5. Studio (`/generator`) rebuilt in the shell on v2, reading the handoff params
6. `/seo-tools` + the 6 keyword URLs
7. pricing / about / contact / privacy / terms / 404
8. Replace the obsolete `verify_page_redesign.js` with `verify_shell.js` covering every page

**Phase C — community**
9. Supabase table + RLS
10. `POST/GET /api/templates` with the sanitiser
11. `/publish`, `/community`, `/my-projects`
12. Moderator queue + admin gate
13. `verify_community.js` including an XSS attempt that must be rejected

**Honest estimate:** Phase A is one session. Phase B is 2-3. Phase C is 2-3. This is not a
one-night job, and rushing Phase C is how a site gets defaced. Phase A is the one that
changes whether anybody wants to use the site, so it goes first and lands complete.

---

## 6. WHAT "FIX ALL ERRORS" MEANS HERE

| Failure | Resolution |
|---|---|
| `verify_page_redesign.js` — `getComputedStyle(null)`, asserts deleted `.lp-*` markup | obsolete → replaced by `verify_shell.js` in Phase B |
| `verify_video_templates.js` — 0 scenes for `kinetic-3d` / `liquid` | verifier asserts `.scene` but the v1 premium engine emits `.pm-scene`. v1 is being deleted, so both file and verifier go in Phase A step 4 |
| `viral-hook` / `ultra-typography` render blank tiles | same subsystem; removed with v1 |

Replacing the broken subsystem is the fix. Patching a module we are deleting this week is not.

---

## 7. STATUS — end of session 2026-08-08 ~00:45

### DONE and verified
* **Templates v2 shipped**: `public/templates-v2.js`, 12 object-based templates across all
  8 categories, CSS-only and loop-based. `TEMPLATES_V2=PASS` — every template builds,
  contains no `<script>`, has running animations, ≥3 of 5 sampled frames distinct,
  no overflow, exact 9:16 canvas, zero runtime errors.
* **Index gallery repointed to v2** — live sandboxed previews, chips driven by engine
  categories, composer options generated from the engine.
* Preview iframes now use `sandbox=""` (no `allow-scripts` at all) because v2 needs no JS —
  the strongest available isolation.
* **Per-template DEMO content** added. A single generic caption set was feeding prose into
  data templates, so the progress ring displayed "beats motivation" and Cash Stack showed
  "₹beats motivation".
* `verify_shell.js` written, replaces the crashing `verify_page_redesign.js` (deleted).
  Covers theme, layout geometry, gallery, iframe sandbox flags, chip filtering, the whole
  SEO surface and mobile nav. `SHELL=PASS`.
* `npm test` now runs shell + templates + studio + generator.
* **Full suite: 5/5 green, 0 failing assertions.**

### Bugs found and fixed this session
| Bug | Cause |
|---|---|
| hero scattered, tiles zero-height, sidebar CTA a blank pill | shell used generic class names (`.hero`, `.main`, `.tile`) that collide with the 297 KB `styles.css`; fixed by namespacing everything `sh-` |
| `.sh-stage` ignored `aspect-ratio` | it is an `<a>`, which is inline by default — needed `display:block` |
| body stayed dark violet | `styles.css` and `premium.css` set the body background with `!important`; index now loads only `shell.css` |
| `logo-draw` showed no motion | `stroke-dasharray:260` against a real path length of 174, so the draw finished in the first 27% and the frame sat static |
| progress ring numbers overlapped | stepped keyframe windows were computed with overlapping ranges |
| first row of tiles blank | `MAX_LIVE=8` eviction unmounted tiles that were still on screen; now unmounts only on leaving the viewport |
| verifier failed a valid template | motion test sampled two arbitrary instants; now samples 5 across the loop |

### NOT done — next session, in this order
1. **`/generator` (Studio) rebuild** in the shell on v2, reading `?topic=&tpl=&aspect=`
   and `sc_pending_prompt`. This is the blocker for everything below.
2. **Delete v1** — `public/video-templates.js` + `verify_video_templates.js`.
   They cannot go yet: `/generator` still imports `SC_VIDEO_TEMPLATES`, so deleting now
   would break a live page. v1 dies the moment the Studio is migrated, not before.
3. Remaining pages: `/seo-tools`, pricing, about, contact, privacy, terms, 404.
4. Community publishing (§4) — schema, sanitiser, `/publish`, `/community`, moderator queue.
   Do not start before §4's security items 1, 2 and 4 are in place.
5. Nothing has been deployed. All of this is local only.

---

## 8. STATUS — session 2, 2026-08-08 ~02:20

### Shipped this session (all verified)

**A. Landing page rebuilt as a monochrome app shell** (`public/index.html`, `shell.css`, `shell.js`)
Sidebar + topbar + prompt-first hero + category chips + live template gallery.
Page loads **only** `shell.css` — `styles.css` / `premium.css` / `landing.css` own generic
class names and force the legacy violet theme with `!important`.

**B. Templates v2** (`public/templates-v2.js`) — 12 object-based templates, 8 categories,
CSS-only and loop-based. Engine API: `cats() list() build(id,opts) fonts() aspects()`.
`opts = {lines, accent, aspect, dur, font}`. Per-template `DEMO` content and `FIELDS`
labels so the editor can build meaningful controls.

**C. New `/editor`** (`editor.html`, `editor.js`, `editor.css`) — replaces the old
`/generator` for template work. Fixed-viewport 3-column app: template rail, stage with
playback + scrubbable timeline, properties panel. Page never scrolls; columns scroll
internally. Controls: template, scene font, per-template content fields, accent
(hex + picker + 9 swatches), 7 aspect ratios via device toggles, loop length.

**D. Real MP4 export** (`POST /api/export`) — the headline fix. HTML download is gone.
Headless Chrome renders the animation, the CSS timeline is stepped frame-by-frame with the
Web Animations API (deterministic: exact fps, zero dropped frames — screen recording was
rejected for this reason), PNG frames pipe into ffmpeg, H.264 MP4 streams back.

Measured: 720x1280 2.0s@30 = exactly 60 frames / 2.00s; 1080x1920 4.6s@30 = 13.6s render,
`r_frame_rate=30/1`, `duration=4.600000`; 16:9@1080 = 1920x1080; valid `ftyp` box;
12 of 12 extracted frames distinct.

Guards: template id regex-validated (`../../etc/passwd` → 400), fps/resolution/aspect
allowlists, duration capped at 12s, max 900 frames, 6 exports / 2 min, and exports are
**serialised** so one request cannot starve the box.

### Environment facts worth keeping
* **ffmpeg 8.1.2 is on PATH** (WinGet Gyan.FFmpeg build). puppeteer 25.3.0, node v24.16.0.
* `page.screencast()` exists but was deliberately not used.
* Run the dev server with **`npm run dev`** (`node --watch`). A stale `node server.js` from
  before a route was added caused a phantom 404 on `/editor` — the code was fine, the
  process was old. Always verify against the port the user is actually on.

### Bugs found and fixed, session 2
| Bug | Root cause |
|---|---|
| hero scattered, tiles zero-height, sidebar CTA blank | shell used generic class names colliding with the 297 KB `styles.css`; namespaced everything `sh-` |
| `.sh-stage` ignored `aspect-ratio` | it is an `<a>`, inline by default; needed `display:block` |
| body stayed violet | `styles.css`/`premium.css` set body background with `!important` |
| `logo-draw` looked frozen | `stroke-dasharray:260` vs real path length 174, so the draw finished in the first 27% |
| progress-ring numbers overlapped | stepped keyframe windows computed with overlapping ranges |
| first gallery row blank | `MAX_LIVE=8` eviction unmounted tiles still on screen; now unmounts only on leaving the viewport |
| ring/cash showed "beats motivation" | one generic caption set fed prose into data templates; added per-template `DEMO` |
| like-burst counter double-printed | both counter states visible after 30%; cross-cut them |
| 16:9 export collided caption + watermark | templates use `cqh` on a 9:16 grid; added a fixed 9:16 `.cv` safe box inside any frame |
| 9:16 720p exported 406x720 | resolution was height-led; "720p" means the **short side** for creators |
| verifier failed a valid template | motion test sampled two instants; now samples 5 across the loop |

### Verification suite — 7/7 green, 0 failing assertions
`verify_shell.js` · `verify_editor.js` (35+ assertions incl. real pause/seek/restart)
`verify_templates_v2.js` · `verify_export.js` (ffprobe-checked) · `verify_studio_redesign.js`
`verify_generator_restore.js` · `verify_seo_a11y_size.js`
`npm test` runs shell → editor → templates → export → studio → generator.
`verify_page_redesign.js` was deleted (asserted removed `.lp-*` markup, crashed on
`getComputedStyle(null)`).

### Preview iframe sandbox policy — do not regress this
* Landing gallery: `sandbox=""` — v2 templates need no JS at all, strongest isolation.
* Editor stage: `sandbox="allow-same-origin"` **without** `allow-scripts`, so the parent can
  drive pause/seek/restart via the Web Animations API while the frame still cannot execute
  script. `allow-scripts` + `allow-same-origin` together lets a frame drop its own sandbox
  and is never used.
* Future user-submitted templates: keep the strict `sandbox=""`.

### NOT done — tomorrow, in this order
1. **Editor polish** — user says "abhi bhi bahot se problem hai", specifics not yet listed.
   Ask for the list first.
2. **Export on hosting** — 1080p takes 13.6s of heavy CPU. Render's free instance will
   time out. Either a paid instance or turn export into a background job (queue the render,
   hand back a link when ready). Decide before deploying.
3. **Migrate the AI script feature** out of `/generator` (Groq script + SEO pack) into the
   new shell, then delete `/generator`, `public/video-templates.js` and
   `verify_video_templates.js`. v1 cannot be deleted while `/generator` imports it.
4. Remaining pages into the shell: `/seo-tools` + the 6 keyword URLs, pricing, about,
   contact, privacy, terms, 404.
5. **Community publishing** (§4) — schema, HTML sanitiser, `/publish`, `/community`,
   moderator queue. Security items §4.1, §4.2 and §4.4 are prerequisites, not extras.
6. Still nothing deployed. Everything is local.

---

## 9. STATUS — session 3, 2026-08-08 ~13:45

Started by re-running the suite to confirm the baseline: **6/6 green, exit 0** (`verify_shell`,
`verify_editor`, `verify_templates_v2`, `verify_export`, `verify_studio_redesign`,
`verify_generator_restore`).

**Run note:** `verify_shell.js` and `verify_templates_v2.js` default to `BASE_URL=http://localhost:3211`
while the others hardcode `3000`. Run the suite as
`$env:BASE_URL="http://localhost:3000"; npm test` against a server on 3000, or shell/templates
fail instantly with `ERR_CONNECTION_REFUSED`.

### Editor audit — the mobile editor was unusable, and the verifier could not see it

Instead of waiting for the user's bug list, the editor was audited with screenshots + DOM
measurement at 1440×900, 1440×700 and 390×844.

| Bug | Measured before | Root cause | Now |
|---|---|---|---|
| On mobile nothing below the stage could be reached — the whole Properties panel, i.e. every content field, accent, aspect, duration and the export resolution | `.ed-app` 1885px tall but `documentElement.scrollHeight` = 844 | the `max-width:820px` query switched `overflow` to `auto` but left `height:100%` on `html`/`body`, and `.ed-app` kept `overflow:hidden`, so the stacked layout was trapped in one viewport with no scroll | `height:auto;min-height:100%;overflow:visible` on html/body + `overflow:visible` on `.ed-app`; page scrolls to 1041, last group (Export) reachable |
| Export button off-screen on a phone, project name input crushed to 26px | `.ed-top` scrollWidth 553 vs clientWidth 390 | 5 device toggles + name + Feedback + Export do not fit in 390px, and the overflow was *hidden* rather than visible so it looked fine | `.ed-devices` hidden ≤820px (the Format → Aspect ratio select is the same control), `Feedback` hidden ≤560px, `.ed-name{flex:1 1 auto}`; top bar now 390/390 |
| Export unreachable once you scrolled down on mobile | — | non-sticky bar | `.ed-top{position:sticky;top:0}` — needed `.ed-app{overflow:visible}` too, since an `overflow:hidden` ancestor silently kills sticky |
| Accent colour input sat inside `<div role="group" aria-label="Aspect ratio">` | — | markup slip | moved into `.ed-topright`; it also stopped looking like a 6th device toggle |

**Not a bug — earlier read was wrong:** the desktop Properties panel *does* scroll internally.
Measured `scrollTop` 294 at 900px and 494 at 700px height, Export group reachable in both.
The cut-off "Resolution" select in the screenshot is just the scroll boundary.

### Why the old test missed all of this
`verify_editor.js`'s mobile section checked only column count and
`documentElement.scrollWidth <= innerWidth`. Because the overflow was clipped by
`.ed-app{overflow:hidden}`, the document never reported overflow — the clipping *hid the
symptom from the test*. Replaced with 10 assertions that measure reachability, not just
geometry: page scrolls on mobile, top bar fits, name not squeezed, Export pinned while
scrolled, last Properties group reachable, plus a 1440×700 case for internal panel scroll.

**Suite after the fix: 6/6 green, exit 0.**

Files touched: `public/editor.css`, `public/editor.html` (css cache-bust `?v=2`),
`verify_editor.js`. Evidence screenshots: `shots/audit_editor_desktop.jpg`,
`shots/audit_editor_mobile.jpg`.

### Still open, unchanged priority
1. The user's own editor complaint list ("abhi bhi bahot se problem hai") — the mobile
   blocker above is fixed, but their specific list is still unknown. Ask.
2. Export on hosting: 1080p = 13.6s CPU, Render free tier will time out → background job.
3. Migrate the Groq script feature out of `/generator`, then delete `/generator`,
   `public/video-templates.js`, `verify_video_templates.js`.
4. Remaining pages into the shell.
5. Community publishing.
6. Minor polish spotted but not fixed: `.ed-status` renders as an empty 36px strip under the
   timeline when there is no message; the template rail is hidden below 1180px so on a phone
   templates can only be changed from the Properties select.

---

## 10. TIMELINE — session 3 part 2, 2026-08-08 ~15:00

The user supplied a reference screenshot (ruler with `00:00…` labels, red playhead with a dot
on the ruler, a clip block carrying name + `00:04:00` timecode + film strip, and `+ Add`)
and asked for our timeline to work like that. The old timeline was a bare `<input
type=range>` in a control bar.

### A project is now a SEQUENCE, not one looping clip
`+ Add` cannot be an ornament, so the data model changed: `state.clips = [{tpl, lines,
accent, font, dur}]` with `sel` for the selected clip. Aspect ratio stays project-wide;
text, accent, font and duration are per clip and the Properties panel edits the selected one.

* **Preview** mounts one iframe layer per clip inside `#edFrame` (`.ed-lay`, absolute, only
  the active one visible, `id="edPreview"` moves to it). Crossing a boundary therefore costs
  no reload and seeking is instant.
* **Playback stays native.** The CSS animations really run — `verify_editor` asserts
  `playState === "running"`, and more importantly a hand-rolled clock would drift from the
  animation. At a boundary the overshoot past `clip.dur` is handed to the next clip
  (`mount(next); setLocal(over)`), so the sequence keeps time.
* **Export** takes `clips[]` (`/api/export`, `EXPORT_LIMITS.maxClips = 8`) and renders each
  clip's frames into the *same* ffmpeg pipe, so a sequence comes back as one MP4. The flat
  `tpl/lines/dur` payload still works as a single clip. Frames are apportioned per clip with
  the last one absorbing the rounding remainder, so total frames = duration × fps exactly.
  The 12s cap is now a cap on the **sum**, and the editor disables `+ Add` when it is reached.

### Timeline UI
Ruler with major/minor ticks and MM:SS labels · red playhead with a ruler dot · clip blocks
sized to their duration in ruler pixels, with grip, name, MM:SS:FF timecode, film strip,
resize handle and a delete ✕ on the selected clip · `+ Add`.

`#edSeek` is still the accessible control — it now overlays the ruler with a transparent
track and thumb, so pointer drag, click-to-seek and arrow keys all work while `.ed-head`
draws the visible line. Dragging a clip's right edge changes its duration and drives the
Loop-length slider. Space toggles playback unless focus is in a field.

Scale: `pps = (rulerWidth − addButtonWidth − 10) / (totalSeconds + 2)`. The Add button has
to be subtracted or the lane pushes past a phone's viewport.

### Bugs found while building it
| Bug | Root cause |
|---|---|
| **The entire timeline had width 0 on any screen under 560px** — no error, nothing drawn | `.ed-tl` was already the class of the top-bar *Feedback* link, and the 560px rule from earlier this session set `.ed-tl{display:none}`. Same class-collision family as the `sh-` namespacing bug. Link renamed to `.ed-flink` |
| Arrow-key seeking froze the playhead readout until the slider lost focus | the `input` handler latched `scrubbing = true`, which only `pointerup`/`blur` cleared. Pointer drag keeps the flag; `input` no longer sets it |
| Sequence export returned 400 "Invalid template id." | **not a code bug** — a stale `node server.js` from 13:31 still owned port 3000, so every later start failed to bind and my edits were never live. Confirmed with `Get-NetTCPConnection -LocalPort 3000`. This is the trap already recorded in §8; always check the port owner, not just that something answers |
| Delete ✕ sat on top of the clip timecode | absolute button over the top row; selected clips now reserve `margin-right:20px` on `.ed-clipdur` |
| Last ruler label clipped at the right edge | labels past `width − 30` are no longer drawn |

### Verification
New `verify_timeline.js` — 38 assertions, wired into `npm test`: ruler ticks/labels, clip
width vs its duration measured from real tick spacing, playhead colour/movement/scrub
landing, edge-drag resize, `+ Add` producing a real second layer + document + summed length,
boundary crossing mounting clip 2 near t=0, delete, "last clip cannot be deleted", the 12s
cap disabling Add, a **2-clip export ffprobed at 2.00s / 720x1280 / 30fps**, and the mobile
case that the class collision would have failed.

**Suite: 7/7 green, exit 0** (`shell`, `editor`, `timeline`, `templates_v2`, `export`,
`studio_redesign`, `generator_restore`).

Files touched: `public/editor.js` (rewritten around the clip model), `public/editor.html`,
`public/editor.css`, `server.js`, `package.json`, new `verify_timeline.js`.
Screenshots: `shots/timeline_clean.jpg` (desktop, 2 clips), `shots/timeline_mobile.jpg`.

### Timeline work deliberately left out
Clip **reordering** (the grip is drawn but does not drag yet), per-clip transitions, audio,
and clip trimming from the left edge. Reordering is the obvious next one.

---

## 11. ALL PAGES REBUILT — session 3 part 3, 2026-08-08 ~16:20

User instruction: every remaining link still opened the **legacy** site, and nothing old was
to be reused. So all of them were rebuilt on the new stack.

### One chrome, seven pages
`build_pages.js` (run `node build_pages.js`) generates every non-app page from a single
sidebar + topbar + mobile-nav + footer definition, so the chrome cannot drift between pages:

`/pricing` · `/about` · `/contact` · `/privacy` · `/terms` · `/404` · `/seo-tools`

New assets, nothing recycled: **`public/page.css`** (all classes namespaced `pg-`),
**`public/page.js`** (mobile nav + feedback form), **`public/seo.js`** (the SEO tools app).
Pages load **only** `shell.css` + `page.css`. `styles.css` (297 KB), `premium.css`,
`landing.css`, `seo-tools.css`, `studio.css` and `script.js` are no longer referenced
anywhere. Content was written fresh — the old pages were not scraped.

### The SEO Tools page is a real app again
Six tools (script, titles, description, hashtags, ideas, thumbnail prompts) posting
`{topic, type}` to the existing `/api/generate`, rendering the `=== SECTION ===` headers the
model returns as headings, with Copy and Download .txt. It is a proper tablist with roving
tabindex and arrow-key support, and each of the six keyword URLs preselects its own tool.

`renderSeoToolsPage()` was rewritten: the old version pattern-matched **prose**
(`<h2>Scripts, titles, hashtags & more</h2>`) which any redesign silently breaks. It now
swaps stable hooks — `data-seo="h1"`, `data-seo="intro"`, title, canonical, og:* — and logs
a warning if a hook is missing instead of quietly serving generic metadata.

### `/generator` retired
Its only unique feature (AI script writing) now lives in `/seo-tools`, so `/generator`
**302s to `/seo-tools`** rather than serving the legacy theme. Files are left on disk —
this project is **not a git repo**, so deletion is unrecoverable and needs the user's word.
`verify_studio_redesign.js` and `verify_generator_restore.js` assert that legacy UI, so they
moved out of `npm test` into `npm run test:legacy`.

### Bugs found
| Bug | Root cause |
|---|---|
| The Pro plan's "Upgrade to Pro" button rendered as a blank white pill | `shell.css` has `body.sh-body{color:#fff !important}` **and** `body.sh-body a{color:inherit}` — specificity (0,1,2) outranks `.pg-bw` (0,1,0), so the anchor inherited white text on a white background. `<button class="pg-bw">` was fine, which is why it only affected some buttons. Fixed with `.pg a.pg-bw` |
| Verifier wrongly failed the keyword URLs | express sends an ETag for these composed pages, so a repeat visit is **304**, not 200 |
| Verifier wrongly flagged phone overflow on `/seo-tools` | the tool tabs are a deliberate `overflow-x:auto` strip; the check now ignores nodes inside a scrollable ancestor |

### Verification — `verify_pages.js`, 70 assertions
Per page: 200, only the new stylesheets, no `script.js`, **no legacy markup classes**, black
theme, shell chrome present, exactly one `h1`, no horizontal overflow. Plus: phone widths,
the burger menu actually opening, **all 15 internal links resolving** (no 404 inside the
site), per-keyword-URL title/h1/intro/canonical, the hashtag URL opening the Hashtags tool,
an empty topic being refused *before* any request goes out, the tool posting to
`/api/generate` and rendering the response, the feedback form rejecting an empty form and a
bad email then posting to `/api/feedback` and resetting, a **contrast check that every button
label is readable** (the bug above), and `/404` served with status 404, `noindex`, and links back.

**Suite: 6/6 green, exit 0** — `shell`, `editor`, `timeline`, `templates_v2`, `pages`, `export`.

Files: new `build_pages.js`, `public/page.css`, `public/page.js`, `public/seo.js`,
`verify_pages.js`; regenerated `pricing/about/contact/privacy/terms/404/seo-tools.html`;
edited `server.js`, `package.json`. Screenshots `shots/new_*.jpg`.

### Note for the user
The privacy policy and terms are written fresh and factual (Groq, Supabase, Razorpay, GA are
named as the actual processors) but they are **not legal advice** — read them once and tell me
anything that does not match how you actually operate, especially refunds and data deletion.

### Still open
1. Old files remain on disk unreferenced: `generator.html`, `script.js`, `styles.css`,
   `premium.css`, `landing.css`, `seo-tools.css`, `studio.css`, `video-templates.js`,
   `animations.js`, plus `verify_video_templates.js` / `verify_premium.js` /
   `verify_seo_*.js` / `diag_studio.js` / `audit_final.js` / `shot.js`. Say the word and
   they go — there is no git history to recover them from.
2. Login / signup links still point at `/pricing`; there is no auth yet.
3. Export as a background job before deploying (1080p is 13.6s of CPU).
4. Community publishing (§4).
5. Clip reordering on the timeline.

---

## 12. AI ANIMATIONS + CREDITS + 3 PLANS — session 4, 2026-08-08 ~21:30

User brief: a composer like the reference screenshot, so a user who does not like our
templates can **describe their own animation** (optionally attaching an image) and get a
premium one; credits pay for it — **5 for a custom animation, 1 for a template export,
10 free per day**; and **three plans: Free, Pro ₹99, Pro Max ₹199**.

### Two facts that shaped the build
* **`GROQ_API_KEY` is empty in `.env`.** Nothing AI-powered can run live until a key is
  added (free from console.groq.com/keys) — that includes the SEO tools shipped earlier,
  whose verifier only ever saw a mocked `fetch`. `/api/animate` therefore answers **503 with
  a plain explanation and charges nothing**, and the editor surfaces that message.
* **`llama-3.3-70b-versatile` has no vision.** So an attached image is used as an *asset*
  the scene animates (background-image with parallax / masked reveal), not something the
  model "sees". A `GROQ_MODEL_PRO` hook is in place for when a multimodal model is wired.

### How AI animation actually works
The model does **not** write a web page. It returns strict JSON with only `css` and `body`,
authored against the same design system the built-in templates use — container units
(`cqw`/`cqh`), `--ac/--fg/--dim/--hair/--surf`, `--D`, spring easings. The document is then
assembled by the **new `SC_TPL2.buildCustom(spec, opts)`**, which reuses `base()`. So an AI
scene is structurally identical to a shipped template: same canvas, same 9:16 safe box, same
watermark, and the existing frame-stepped export renders it with no special case.
An attached picture reaches the scene only as `--img`, and `url(var(--img))` is the **only**
url() the sanitiser permits.

The prompt encodes the house rules that made templates v2 work (animate an object not a
paragraph, one accent, spring easing, seamless loop) plus a hard technical contract. Output
is then gated: no `@keyframes` or no `var(--D)` means the scene is rejected as "not an
animation" rather than shipped as a still.

### Security — model output is hostile input
`animate.js` `sanitise()` is a closed allowlist (tags, attributes, CSS constructs) and runs
on **both** `/api/animate` and `/api/export`, because a client can post any `spec` it likes
straight to the export route. 16 attack cases are in the verifier: script tags, `on*`
handlers, `<iframe>`, `<img>`, external `url()`, `@import`, `javascript:`, `<style>`,
`</style>` breakouts, forbidden attributes, `<form>`, oversized css/body, empty css,
`data:text/html` images, non-base64 images. All refused, and the export route refuses a
hostile scene too.

### Credits — server-side, not a browser counter
New `credits.js`: signed anonymous id in an HttpOnly cookie, file-backed ledger, daily
grant. `PLANS` and `COST` are defined **once** there and the pricing page is generated from
them, so the numbers cannot drift between code and marketing.

| | Free | Pro ₹99 | Pro Max ₹199 |
|---|---|---|---|
| credits/day | 10 | 100 | 300 |

`export` = 1 credit, `animate` = 5. Charged **after** validation so a malformed request never
bills, and **refunded** if our render or the model call fails. `GET /api/credits` publishes
the balance and the price list; the editor shows a credits pill, the sidebar badge shows
"N of M credits left today", and the export button reads "Download MP4 · 1 credit".

Honest limit, documented in the module: clearing cookies earns a new anonymous allowance.
That is why the daily grant is small, and it is fixed properly by accounts, not by tricks.

### UI
* **Editor composer** (the reference layout): prompt textarea, image attach with a removable
  chip, Mini/Pro model select, the price, and Create. Enter creates, Shift+Enter is a newline.
  An AI clip is marked `AI ·` on the timeline; its Properties panel shows the brief and a
  **Re-roll · 5 credits** button instead of empty text fields.
* **Landing composer**: image attach + a "Use a template / AI scene from my prompt" mode that
  swaps the template select for the model select. Attaching an image switches to AI mode.
  The handoff **prefills** the editor prompt and image — it never auto-submits, because that
  would spend credits the user did not choose to spend.
* **Pricing**: three plans generated from `credits.js`, plus a "what a credit buys" grid.

### Bugs found
| Bug | Root cause |
|---|---|
| The "image ×" chip showed even with nothing attached | `display:inline-flex` outranks the `[hidden]` attribute. Needed explicit `.sh-cimg[hidden]`/`.ed-aichip[hidden]` |
| Landing sidebar badge showed stale static copy | the live-credits fetch was only in `page.js`; the landing loads `shell.js` |
| `/api/animate` complained about our missing API key before checking the user's image | "your image is the wrong format" is actionable, "no API key" is not — request validation now comes first |
| The credit ledger ignored the file after first read | an in-memory cache meant a second process (or a test) could not be seen. Now the cache is dropped when the file's mtime changes, which matches the module's own claim that the file is the source of truth |
| `verify_export` failed at the end of the suite | `verify_credits` had used up the export rate limit (6 / 2 min). The suite is now order-independent: export runs first **and** `post()` waits out a 429 instead of reporting a product failure |
| Credits pill squeezed the mobile top bar | the accent chip is a duplicate of Properties → Colours, so it is what hides under 560px |

### Verification — `verify_credits.js`, 41 assertions
Sanitiser (1 good scene + 16 attacks) · `generateScene` with a **stubbed model** so the
prompt→parse→sanitise→quality-gate path is tested offline (code-fenced JSON accepted; prose,
broken JSON, a still image, ignoring `var(--D)`, and a smuggled `<script>` all rejected) ·
the ledger over HTTP (fresh grant, export charges 1, balance persists, rejected request never
bills, 402 when empty, a second visitor has their own balance) · **a custom AI scene exported
to a real MP4, ffprobe-checked at 1.00s / 720x1280** · a hostile scene posted directly to
`/api/export` refused.

**Suite: 7/7 green, exit 0** — shell, editor, timeline, templates_v2, pages, export, credits.

Files: new `credits.js`, `animate.js`, `verify_credits.js`; edited `server.js`
(`/api/credits`, `/api/animate`, credit charging, custom clips in export, `callGroq` now takes
a system prompt and model override), `public/templates-v2.js` (`buildCustom`),
`public/editor.{html,css,js}`, `public/index.html`, `public/shell.{css,js}`, `public/page.js`,
`build_pages.js`, `package.json`, `.gitignore` (`.credits.json`).

### What the user needs to do
1. **Add a Groq API key** to `.env` (`GROQ_API_KEY=gsk_...`) and restart. Until then the AI
   composer and the SEO tools answer 503 with that exact reason.
2. Decide whether the Pro/Pro Max daily numbers (100/300) are right — they are one constant
   each in `credits.js` and the pricing page follows automatically.
3. Payments are not wired to plans yet: "Upgrade" points at Help & Feedback, and
   `credits.setPlan()` is ready for a Razorpay webhook to call.

### Still open after this session
1. Real accounts, so credits are not tied to a cookie.
2. Razorpay webhook → `credits.setPlan()`.
3. Export as a background job before deploy (1080p is 13.6s of CPU).
4. Clip reordering on the timeline; community publishing (§4).
5. The unreferenced legacy files still on disk (list in §11).

---

## 13. ACCOUNTS + SIMPLER COMPOSER — session 5, 2026-08-08 ~22:00

Two asks: **Log in / Sign up did nothing** (they pointed at `/pricing` — there was no auth at
all), and the composer had **too many dropdowns** — it should be image upload plus a model
selector named after the plans.

### Composer, trimmed to what was asked
The bar is now: **image attach → model (Free / Pro / Pro Max) → Create**, with the hint
"Enter to create · 5 credits". Removed: the mode select, the template select and the aspect
select. Templates are picked from the gallery right below the composer, and aspect ratio
belongs in the editor where all seven ratios have device toggles — the bar was repeating both.
The editor's own composer uses the same three tier names.

**The tiers are enforced, not decorative.** `/api/animate` maps
`mini|pro|max → Free|Pro|Pro Max`, checks the account's plan, and answers **403 naming the
plan required** rather than silently downgrading the model. Order inside the route:
validate the request → authorise the plan → check our configuration → charge.

### Auth, without an external service
`SUPABASE_URL` / `SUPABASE_ANON_KEY` are not configured here, so building auth on Supabase
would have been dead on arrival like the Groq features. New **`auth.js`** uses only node
crypto and the same file-backed store as credits:

* **scrypt** (N=16384) with a 16-byte per-user salt. `timingSafeEqual` for the comparison.
* Session token is 24 random bytes; **only its SHA-256 is stored**, so a leaked store cannot
  be replayed as a live session.
* Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production.
* **No user enumeration**: a wrong password and an unknown email return the identical
  message, and a decoy hash is computed for missing accounts so the timing matches. Sign-up is
  the one place that must admit an address is taken.
* Rate limits: signup 20/hour, login 20/10min (the first draft's 8/10min was too tight for
  users behind one NAT — and it was also tripping the test suite, which was the hint).

Routes: `POST /api/auth/signup|login|logout`, `GET /api/auth/me`.
Pages: **`/login`, `/signup`, `/account`**, generated by `build_pages.js` in the same shell,
`noindex`. New **`public/authui.js`** paints the signed-in state; it is shared by the landing
page (which loads `shell.js`) and the generated pages (which load `page.js`), so the logic
exists once. `data-auth="in|out"` elements swap, `[data-auth-email]` shows the local part of
the address, and `/account` shows email, plan, credits and Log out.

### Credits now follow the account
`credits.js` keys the ledger on `u:<userId>` when signed in and on the signed anonymous
cookie otherwise, and the plan comes from the **account record**, which is the source of
truth — so an upgrade grants the new allowance immediately instead of at midnight.
`/api/credits` also returns `signedIn` and `email`.

### Bugs found
| Bug | Root cause |
|---|---|
| Topbar auth links would not hide | `[hidden]` loses to `display:inline-flex` again — needed `body.sh-body .sh-topbar [hidden]{display:none}`. Third time this family of bug has appeared; worth remembering |
| `verify_shell` failed after the composer changed | it asserted 12 template options in the composer. Replaced with assertions for the **new** contract: image upload present, chip hidden until a file is picked, tiers are exactly `Free/Pro/Pro Max`, no duplicate template picker, exactly one select in the bar |
| Signup validation cases exhausted the rate limit | the four negative cases now run in-process against `auth.signUp()`; only the duplicate-email case needs the store, so the HTTP budget stays for real users |

### Verification — `verify_auth.js`, 45 assertions
Signup creates an account + session; the password is never echoed, never stored in plaintext,
and is an `scrypt$` hash; the **raw session token is absent from the store** (hashed);
duplicate email, short password, malformed email, missing password and an all-spaces password
are refused; login works case-insensitively; a wrong password gives 401 with no session; an
unknown email returns the **same** message; logout clears the session and **the old cookie
cannot be replayed**; credits are billed to the account; the Pro and Pro Max models are
**403 on a Free plan**. In the browser: `/login` and `/signup` render on the new stack with a
masked password and `noindex`, client-side validation fires before the request, signing up
lands in the editor, the top bar swaps to Account + Log out, `/account` shows email/plan/
credits, and logging out returns the chrome to the guest state.

**Suite: 8/8 green, exit 0** — shell, editor, timeline, templates_v2, pages, auth, export,
credits.

Files: new `auth.js`, `public/authui.js`, `verify_auth.js`, generated `login.html`,
`signup.html`, `account.html`; edited `server.js`, `credits.js`, `build_pages.js`,
`public/index.html`, `public/shell.{css,js}`, `public/page.{js,css}`, `public/editor.html`,
`verify_shell.js`, `package.json`, `.gitignore` (`.users.json`).

### Known limits of this auth (deliberate, documented)
* No email verification and no password reset yet — both need an email sender.
* Sessions live in a local file, so they are per-instance. Fine for one box; a second
  instance would need a shared store.
* Plans are set on the user record; nothing calls `changePlan()` yet because payments are not
  wired. `credits.setPlan()` / `auth.changePlan()` are the hooks a Razorpay webhook will use.

---

## 14. BARE AUTH SCREENS + END OF DAY, 2026-08-08 ~22:30

User: on `/login` and `/signup` **only the form should show** — no sidebar, no top bar, no
footer.

`build_pages.js` gained a `bare: true` page flag. `chrome()` now builds the `<head>` once and
**returns early** for bare pages (an earlier attempt tried to comment out the unused chrome
with `<!--`, which was rejected as a hack — the sidebar markup would still have been in the
file). A bare page is: centred wordmark → the form card → Terms / Privacy / Help. CSS lives in
`page.css` under `body.pg-bare` / `.pg-screen`.

Measured after the change: `sh-rail`, `sh-topbar`, `sh-footer` all absent from the HTML,
420px card on desktop, 350px and no horizontal overflow at 390px, zero page errors.
`verify_auth.js` now asserts the absence of all three chrome elements plus the wordmark and
no overflow, so the chrome cannot creep back in.

`PAGES=PASS` and `AUTH=PASS` re-run after the change.

---

## 15. WHERE THINGS STAND — end of 2026-08-08

Four sessions today. Everything is **local only; nothing is deployed.**

### Working and verified
* **Landing** in the monochrome shell; composer is now just prompt + image upload + model tier
  (Free / Pro / Pro Max) + Create.
* **Templates v2** — 12 object-based CSS-only templates, 8 categories.
* **Editor** with a real timeline: ruler, red playhead, clip blocks with timecode, edge-drag
  resize, `+ Add`, delete, 12s project cap. A project is a **sequence**; each clip has its own
  template or AI scene, text, accent, font and duration.
* **Real MP4 export** — headless Chrome frame-stepping into ffmpeg. Multi-clip sequences render
  into one file. Costs 1 credit.
* **AI animations** — prompt (+ optional image) → the model returns `css` + `body` only →
  `SC_TPL2.buildCustom` assembles the same document shape as a template → exports through the
  same pipeline. Closed-allowlist sanitiser on both the generate and export routes.
  Costs 5 credits.
* **Credits** — server-side ledger, 10/day Free, 100/day Pro, 300/day Pro Max, charged after
  validation, refunded on our failures.
* **Accounts** — signup / login / logout / `/account`, scrypt hashes, hashed session tokens,
  no user enumeration, credits follow the account. Bare screens, no chrome.
* **All pages rebuilt** on the new stack: pricing (3 plans), about, contact, privacy, terms,
  404, seo-tools, login, signup, account. No legacy CSS or `script.js` referenced anywhere.
* **Suite: 8/8 green** — `npm test` with `BASE_URL=http://localhost:3000`.

### Blocked on the user
1. **`GROQ_API_KEY` is empty** → AI animations and the SEO tools answer 503 with that exact
   reason. Free key at console.groq.com/keys, then restart.
2. Payments not wired to plans (Razorpay hooks ready).
3. Whether to delete the unreferenced legacy files (no git history, so it is irreversible).

### Next session, suggested order
1. Groq key in, then judge the real quality of AI scenes and tune the prompt — that is the
   feature the whole session was built for and it has never run live.
2. Razorpay → plan upgrade → `auth.changePlan()` + `credits.setPlan()`.
3. Password reset + email verification (needs an email sender).
4. Export as a background job before any deploy (1080p ≈ 13.6s CPU).
5. Clip reordering on the timeline; then community publishing (§4).

### Operational notes worth keeping
* Run the server, then `$env:BASE_URL="http://localhost:3000"; npm test`. `verify_shell` and
  `verify_templates_v2` default to port **3211**, so the env var matters.
* **Always check the port owner**, not just that something answers:
  `Get-NetTCPConnection -LocalPort 3000 -State Listen`. A stale process silently served old
  `server.js` code for a whole debugging round today.
* State files: `.credits.json`, `.users.json` (both gitignored). Delete them to reset credits
  and accounts.
* `[hidden]` loses to `display:flex/inline-flex` — this bit us three separate times
  (tiles, image chip, topbar auth links). Spell out `.thing[hidden]{display:none}`.
* Generic class names collide with the 297 KB legacy `styles.css`. Everything new is namespaced
  (`sh-`, `ed-`, `pg-`).
