# ShortsCraft — Launch Checklist (working copy)

Owner's 34-phase checklist, 18 Sep 2026. Rule: **nothing goes live until the owner says "push".**
Legend: ✅ done · 🟡 partly · ❌ missing · ⏸ later (by the checklist itself)

Audit baseline: commit `a1a2911` (live) + local uncommitted work.

## Naming decided (Phase 1)
| Thing | Name everywhere | URL |
|---|---|---|
| Animation template library | **Animations** | `/animations` |
| Design templates (not built) | **Designs** — Coming soon | `/designs` |
| External tutorial links | **Creator Tutorials** (phone tab: **Learn**) | `/community` |
| Help articles | **Help** (was "Tutorials & Help", "Learn") | `/tutorials` |
| Saved work | **My Projects** (was also "Drafts & Projects") | `/drafts` |
| Creator's own content | **Creator Studio** | `/uploads` |
| Plans | **Pricing** (was "Subscription & Plans") | `/pricing` |
| Public profile / account | **Profile**, **Settings** | `/account`, `/settings` |
| Phone tabs | Home · Templates · Create · Learn · Profile | |

## P0 — now
| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Pricing / naming consistency | ✅ local | ₹99 → ₹199 from credits.js; "Save 16%" computed; "Early access" and dead lifetime-pricing code removed. One naming table (above) applied to rail, top bar, phone menu, tab bar, account menu, footer, page titles. New `/animations` (full library, `?cat=`), `/designs` (coming soon), `/help`. Old tool links → `/animations`. |
| 2 | Homepage final | ✅ local | Headline + subheadline, Create Animation / Browse Templates CTAs, Animations + Designs (coming soon) cards, 8 popular animations with category shortcuts, Creator Tutorials from the API, how it works, pricing preview from credits.js, creator benefits, final CTA. |
| 3 | Animation Library | ✅ local | `/animations`: search, categories, sort Trending/Popular/Newest, source Official/Community. Popup + template page: true duration, aspect ratios, 24–60 fps (was a false "60 FPS"), export credit cost, source, **Use Template**, like, share, **Report**. Reports: `content_reports` widened for templates/tutorials/creators/comments (migration applied, additive), `POST /api/reports`, owner/staff notified, new admin **Reports** tab + `reports.review` permission. |
| 4 | Animation editor | 🟡 | Text, font, colour, image, duration, aspect, timeline, clips, undo/redo, autosave, export exist. To test end to end: edit → export → MP4 equals preview. |
| 5 | Save / reopen | 🟡 | projects.js saves per user; cross-device + draft recovery to re-test. |
| 6 | Export reliability | 🟡 | Queue with plan priority + refund on failure exist. Free Render instance is slow (≈28 s for 1 s at 480p). |
| 7 | Mobile | 🟡 | Tab bar, compact layer, Studio phone workspace (Codex, a1a2911). Real-phone pass still needed. |
| 8 | Authentication | 🟡 | Sign up / login / reset tokens (expiry + single use) exist. **Reset email cannot send: RESEND_API_KEY / AUTH_FROM_EMAIL missing on Render.** No account deletion. |
| 9 | Creator profile | 🟡 | Avatar, name, handle, bio, links, followers, stars, templates, tutorials. Missing: joined date, remixes, designs. |
| 10 | Deployment consistency | 🟡 | Render auto-deploy missed a push on 17 Sep; live branch/commit must be confirmed each release. |

## P1
| # | Item | Status |
|---|---|---|
| 11 | Designs Library | ❌ |
| 12 | Design Editor | ❌ |
| 13 | Creator Tutorials (category, level, language, approval, report) | 🟡 URL-only submit, published instantly, admin takedown |
| 14 | Creator Studio tabs (Animations/Designs/Tutorials/Drafts/Scheduled/Published/Private/Reported) | 🟡 |
| 15 | Provenance: Official / Original / Remix, rights confirmation | ❌ |
| 16 | Moderation: report anything, hide, warn, suspend | 🟡 reports + admin review exist; warn/suspend missing |
| 17 | Admin: overview, content, users, payments, system | 🟡 |
| 18 | Support tickets with replies | ✅ basic |

## P2
| # | Item | Status |
|---|---|---|
| 19 | Payments (Razorpay: KYC, webhook, ledger, renewal) | ❌ keys absent, checkout shows "not open yet" |
| 20 | Credit top-ups | ⏸ |
| 21 | Analytics (first successful export rate) | 🟡 GA_ID + template_events |
| 22 | SEO: sitemap, robots, OG image, canonical, 404 | 🟡 files exist, no og:image |
| 23 | Notifications | ✅ bell, push, links |
| 24 | Creator growth | ⏸ |

## P3 — after users
Marketplace, AI design tools, creator monetization, affiliate system, extra AI — **not now** (Phase 34).

## Legal (Phase 27) — before money or uploads
Terms ✅ · Privacy ✅ · Refund policy ❌ · Content policy ❌ · Creator upload terms ❌ · Copyright/takedown ❌

## Launch-ready = these 10 pass
1. Stranger understands the homepage · 2. Signs up · 3. Finds a template · 4. Edits · 5. Saves · 6. Reopens · 7. Exports · 8. Same on phone · 9. Recovers from an error · 10. Same pricing everywhere

## Progress log
- 18 Sep: audit written.
- 18 Sep: P0-1 and P0-2 done locally (not pushed). Checks: every page × desktop/phone free of old names and wrong prices; home sections at 1440/390/360; verify_shell, verify_pages, verify_mobile, verify_auth, verify_social, verify_skills, tests/mobile-layout-qa.js (89 layouts) pass.
- 18 Sep: P0-3 done locally. Supabase migration `content_reports_any_target` applied (adds columns to an empty, unused table; live site unaffected). Checks: library sort/filter, popup and template-page facts, report dialog on desktop and phone, report stored and listed for the owner, ordinary users refused, made-up targets refused; staff, notifications, shell, pages, mobile, support, skills suites pass.
- 18 Sep: owner found the site's look broken (phone and computer had become two different designs after layered fixes). Owner chose **white + blue** for the whole site. New `public/ds.css` (design system, loads last on every page): one token set (light + dark), one primary (blue) and one secondary button, one card style, rail/top bar/footer restyled; Home rebuilt on it for computer and phone (hero with drawing, one content width). Every page inherits the colours; each remaining page gets its own pass with the owner's approval. Checks: home sections, shell, mobile suites pass.
