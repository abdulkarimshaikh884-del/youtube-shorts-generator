# ShortsCraft — page-by-page QA, 2026-10-01

**Release verdict: NOT CERTIFIED.** This is an evidence report, not a zero-bug guarantee or permission to deploy.

## Real backend follow-up — 2026-10-02

The historical inventory below is retained. Current evidence is in the dated follow-up of [FINAL_RELEASE_CHECKLIST.md](FINAL_RELEASE_CHECKLIST.md), which supersedes its earlier timeout/Docker/unrun statements.

- Actual app-role remote `SELECT 1` passed read-only (1468 ms). Live referral tables/columns remain absent; the migration was applied to isolated local PG17 only. No production records, schema or deployment changed.
- Docker/WSL diagnosis recovered Docker by backing up runtime socket directories, not resetting data. Local QA runs with its own label and loopback-only port. Do not restart its initdb-only container entrypoint blindly; Docker/container restart recovery was not tested.
- Real PG17: 21 module checks PASS plus 15 pgTAP access assertions. Actual HTTP auth/reset, credit/render/refund, projects/social/support/publish/admin and referral 10+10 journeys pass. Staff permission boundaries, notification storage (stubbed push transport), tutorial moderation and actual uploaded Lottie preview/edit/MP4 also pass locally.
- Final combined real HTTP regression: **15/15 registered suites PASS, exit 0**; saved per-suite logs and `http-evidence.json` are the final rerun evidence. Rate limiting was disabled, so abuse/rate-limit behavior is not certified by this result.
- Real Design projects save/reopen/clone/publish and ownership checks pass. Unknown use counts were removed from built-in fallback records; no production analytics were overwritten. Real image decomposition accuracy and every asset format are not certified.
- Fixed locally: undefined Admin broadcast audit variable; stale export credit header before referral reward. Corrected obsolete test fixtures instead of inventing free Stars or altering the daily credit contract.
- Render harness 19 PASS; encoded portrait/landscape samples viewed. Free plan currently caps at 480p, Pro at 1080p. Output motion/content checks do not certify every template's framing or cloud CPU performance.
- Local backup restored all 31 public tables with matching counts/checksums; new app-side process sees persisted bonuses. This is not production disaster recovery proof.
- The complete DB-free `npm run test:release:ui` wrapper was executed and passed; it is no longer merely an unrun entry point.
- Notification combined-run worker race corrected in the QA harness, not hidden: earlier `fetch`-only isolation did not cover Web Push HTTPS. Final preload explicitly blocks real push and isolates the server worker from the injected child sender. Phone delivery remains unverified.
- Razorpay actual tests deferred until the user creates the account after receiving PAN. Unconfigured checkout/email give honest unavailable responses. No provider delivery, captured payment or account upgrade is claimed.

Evidence: `audit_results/postgres-isolated/{evidence,http-evidence,referral-http-evidence,design-http-evidence,backup-restore-evidence}.json` and `audit_results/export-isolated/evidence.json`. Financial withdrawal/reversal/shared-pack risks, real Google/AI/email providers, scheduling/source security, physical devices, long-run performance, production migration/restore and deployment parity remain open. This is not a full `npm test` or whole-site certification.

The supplied checklist was read and used as the Home certification framework. Current requirements take precedence over stale checklist assumptions: Home has 10 distinct animation cards, not 8. Missing evidence is labelled NOT VERIFIED rather than converted into PASS. Public page availability is not feature certification.

## Fix follow-up — 2026-10-02 (local, not deployed)

The 2026-10-01 findings/results below are retained as the original audit snapshot. QA-01 through QA-07 have now been fixed locally and retested; this does not remove the backend or production release gates.

| Retest | Current local evidence |
| --- | --- |
| Home certification | 167 PASS, including 150 layout/theme/account-fixture states; zero uncaught page errors or failed local assets |
| Forms certification | 86 PASS, including actual keyboard password toggles on Login/Signup/Reset and failed-submission recovery |
| Primary-button contrast | 84 page states, zero failed eligible opaque primary-control samples; not full WCAG certification |
| Additional release interactions | 35 PASS: Arrow/Enter/Space model selection, focus restoration, Home/Studio valid/corrupt/unsupported/oversized images, cancel/remove/stale-promise behavior, credit outage/invalid payload/reload recovery on Home/Feedback/Account, notification Retry/read failures/99+ count/safe links |
| Server attachment validation | 18 offline checks PASS: PNG/JPEG/WebP/GIF decoding, truncated/corrupt/spoofed/oversized payloads, base64 and dimension limits; validation is wired before credit-state lookup/charge. No provider or live DB calls |
| Existing mobile/Design/admin/profile suites | PASS: 97 mobile layout checks plus Studio interactions in five phone/tablet/landscape sizes, Design Studio edits/PNG export at six sizes, 112 admin tab/layout checks and official profile at 390/1440 |
| Offline feature regressions | Polish/backend/draft/structured-AI, referral, admin balances, Stars purchases, Google auth, design storage/assets PASS in isolated fixtures; not real PostgreSQL/gateway/email proof |

Changes:

- Shared primary labels use the semantic on-brand colour, fixing the light-on-light dark-theme regression across pages.
- The model picker supports Arrow/Home/End/Enter/Space/Escape; notification Escape restores focus. Password toggle buttons are keyboard reachable, including the page-generator source.
- Header/sidebar/profile credits show Loading or Unavailable rather than silently retaining five credits on failure. Reload recovery is tested; this does not certify real billing balances.
- Home and Studio use one bounded image reader. Rejected replacement preserves the last valid image; removal invalidates pending reads. Server decoding independently guards the AI endpoint before billing. The animation data-URL limit now accommodates the advertised 900 KB binary limit.
- Notification outages show Retry. Failed read requests do not clear unread counts; successful individual reads do not interpret `99+` as zero. Notification destinations cannot redirect via protocol-relative or backslash URLs.
- Removed unverified “thousands of creators”, “zero rendering lag” and “any browser” claims. Studio no longer claims completed AI analysis/storyboard stages on arbitrary timers; it shows genuine elapsed waiting time. Real provider-stage progress is not available from the current API.
- Updated changed shared asset URLs to `2026100201`; Home image-reader include and keyboard/copy fixes are also in `build_pages.js`. The generator was not run over the existing customized admin page.

Current screenshots: `audit_results/page-certification/interactions/feedback-dark-after.png`, `home-dark-after.png`, and refreshed form/mobile screenshots. Contrast-suite screenshots named `*-primary-dark.png` were captured on the **original failing run** and must not be presented as current fixed-state images.

Still NOT VERIFIED after the current backend follow-up: physical phones/other browser engines, actual email/Google/AI provider journeys, production referral migration, financial withdrawal/reversal/reconciliation, production restore/deployment and parity. Auth, MP4/refunds and local restore now have real isolated evidence as recorded above; do not confuse this with production certification.

Repeat the isolated UI suites sequentially with `npm run test:release:ui`; the aggregate wrapper now passed. Do not run another port-3327-owning suite in parallel. Run `node tests/image-validation-offline.test.js` separately for the image-server checks. Real local DB suites use the guarded `node tests/run-postgres-http-qa.js` (port 3341, exclusive ownership). Keep generic mutation-heavy `npm test` away from the configured live database.

## Environment and safety

- Checkout: `C:\Users\karim\kiroai\shortscraft`, HEAD `8ac8218862e9f2556b3a9717d5a537bd97369315`, with substantial existing uncommitted changes. HEAD alone does not describe the tested working tree.
- Local browser tests use the DB-free static preview at port 3327. API responses are intercepted in the browser. Fake accounts/content exist only as test fixtures, never in production or application records.
- Home tests cover guest, Free, Pro, Pro Max and owner UI fixtures, not real authentication or authorization. Home/form/contrast suites deliberately block external fonts to exercise fallback rendering.
- Production checks are unauthenticated, read-only HTTP GETs. No real signup, email, payment, AI generation, render, upload, admin mutation, migration or deployment was performed.
- In the initial audit pass, new files were QA scripts and this report; application fixes are recorded separately in the dated follow-up above.
- The static preview does not run Express redirects, session middleware, rate limiting or security headers. Those cannot be certified from its results.

## Original results — 2026-10-01, before the fixes above

| Suite | Result | What this proves / does not prove |
| --- | --- | --- |
| `node tests/home-certification-qa.js` | **162 PASS / 5 FAIL** | 150 Home layout/state cases pass: 15 sizes × 2 themes × 5 user fixtures. Additional interactions find failures below. Zero uncaught page errors and no failed local assets in the clean run. Not real AI/account/payment proof. |
| `node tests/forms-certification-qa.js` | **76 PASS / 6 FAIL** | Five form pages at 4 sizes × 2 themes; validation, password visibility, safe next-link handling, disabled Google fallback, and failed submission recovery. Four dark-contrast failures plus two keyboard failures. No real account, email or support ticket created. |
| `node tests/primary-button-contrast-qa.js` | **FAIL** | 21 page routes × 2 sizes × 2 themes = 84 page states. Latest completed run: 137 eligible control samples; 45 fail, affecting 13 routes. Eligibility depends on visible/settled controls; this is not a count of every button. Flat, opaque, enabled primary controls only—not every text element or full WCAG certification. |
| `node tests/run-polish-browser-qa.js` | **PASS** | Four existing regression suites below rerun successfully. This narrower pass does not cancel the failures in the stricter suites. |
| Mobile layout regression | **PASS: 97 checks** | 320/390/768/1440 layouts, no document overflow or uncaught errors; five animation Studio interaction sizes, including short/landscape. |
| Design Studio regression | **PASS: 6 sizes** | Reachable tools, local text edits/preview and actual local PNG export. Cloud save/publication responses are mocked, not production persistence. |
| Admin regression | **PASS: 112 tab/layout checks** | Both themes, category filtering, hostile-label fixtures, actual zero-credit display, dialog Escape and visible API outage. No approve/reject/payment/user changes made. |
| Official profile regression | **PASS: 390/1440** | 59 built-ins alongside uploads; non-public statuses and built-in deletion restrictions remain intact. |
| `npm run test:polish:offline` | **PASS** | Gallery/publisher wiring, isolated atomic subscription delivery/retry, draft coalescing/session isolation and structured editable AI definitions. |
| Referral offline suite | **PASS** | 10 credits EACH, verified charged-export qualification, rollback/replay/caps, source-aware spending/refunds, signed attribution and hashed verification tokens. Not migration or real PostgreSQL proof. |
| Admin-balance / Star-purchase offline suites | **PASS** | Isolated strict bonus adjustments/audit rollback; captured receipt matching, tamper/replay protection and atomic grants. Not real money settlement. |
| Google / Design-storage / Design-assets offline suites | **PASS** | Isolated OAuth/linking rules, ownership/outage reporting and durable asset contracts. Not real Google callback or production storage verification. |
| `npm audit --omit=dev` | **PASS: 0 reported vulnerabilities** | Dependency advisory scan only, not a security certification. |
| `node tests/production-pages-readonly.js` | **31 PASS / 1 NOT AVAILABLE** | 24 page URLs (including Help alias), robots/sitemap/actual linked manifest, real HTTP 404 for an unknown page; three guest admin GET denials. The fourth admin URL is unavailable. |
| Production Home assets | **15/15 HTTP 200** | Five served assets differ from the local working tree even after normalizing line endings. This is not a deployed-local-release match. |

Do not add these counts into a single “percent complete”: suites overlap and have different scopes.

Home sizes: 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720, 1180×820, 1024×768, 820×1180, 768×1024, 430×932, 412×915, 390×844, 375×812, 360×800 and 320×568.

## Original reproduced problems — see dated fix/retest follow-up above

### QA-01 — shared dark-theme primary buttons have unreadable labels (P1)

**Reproduction:** Select dark theme, open Feedback and inspect Send message. Repeat on Home’s Browse All buttons, Pricing’s Choose Pro / Star purchases, and Forgot Password’s Send reset link. Both 390px and 1440px fail.

Measured foreground `rgb(255,255,255)`, background `rgb(245,245,245)`, contrast **1.09:1**, below the 4.5:1 threshold for these small labels. The Feedback check also reproduces at 320px and 768px. Screenshots confirm the visible issue; it is not merely a computed-style warning.

**Affected preview routes:** Home, Animations, Community, My Projects/Drafts, legacy Uploads, Settings, Pricing, Tutorials, Account, Feedback, About, Forgot Password and the 404 page. `/uploads` is a legacy file in the static test; production redirects that route to `/drafts`.

**Cause:** `public/ds.css`'s shared `:is(...)` primary-button selector forces white labels with `!important`. Its specificity is raised by compound selectors in that list. The later `monochrome.css` rule sets the dark background to nearly white but does not reliably win the foreground cascade. Login/signup avoid this through a more specific form-submit override; that is not a global solution.

**Fix:** Use consistent semantic foreground/background tokens (`--sc-brand` / `--sc-on-brand`) in the shared button definition. Resolve conflicting specificity rather than stacking page-specific colour patches. Check normal, hover, focus, loading and disabled variants; do not recolour template media.

**User/admin impact:** Users miss essential actions, including login/reset/checkout and creation. This can look like a broken button even when click handling exists; admin receives avoidable support reports and lost conversions.

**Required retest:** Both contrast suites, screenshots of affected light/dark pages and actual keyboard/mouse/touch interactions. Do not claim every button passes solely from the targeted samples.

### QA-02 — model dropdown does not close with Escape (P2)

Open Home’s generation-model picker, focus its trigger, press Escape. `#qualityMenu` remains open. `public/shell.js` wires clicks/outside clicks but no picker Escape handler.

Fix close + `aria-expanded` synchronization + focus restoration, then rerun `model/keyboard-Escape`. This blocks keyboard accessibility, particularly for users who cannot click outside the popup.

### QA-03 — model options are not keyboard-operable (P2)

`#qualityMenu [role=option]` are non-focusable elements. Tab cannot reach them as normal controls; click-only selection is not an accessible listbox implementation.

Use a native select, or fully implement one coherent accessible pattern with focus, Arrow keys, Enter/Space, Escape and selected-state semantics. Test actual keyboard selection, not just the existence of ARIA attributes. Keep the existing stored selection and editor handoff intact.

### QA-04 — corrupt image accepted by the Home composer (P1)

Select a file named `corrupt.png` with `image/png` MIME but bytes `not an image`. The image attachment chip appears. The current `FileReader` path only checks size; it does not decode/validate the image.

Validate allowed types AND successful decoding, bounded dimensions/size and stale-selection races. Reject visibly without setting attachment state. Validate independently on the server too; browser checks are usability checks, not a security boundary. Preserve a previously valid selection on cancellation/rejection according to a documented policy.

User impact: an apparently accepted attachment reaches the next step and fails later. Admin impact: avoidable generation failures, processing work and support. The automated result proves the corrupt-PNG case; other unsupported formats still need their own cases.

### QA-05 — notifications do not close with Escape (P2)

Signed-in fixture → open notification bell → focus trigger → Escape. Panel remains open. `public/authui.js: setupNotifications()` handles outside click but not Escape.

Add close/focus restoration and correct expanded state; check Tab order, mobile short viewport and screen-reader semantics. The 390px panel bounds, 99+ badge and hostile-text rendering passed, but that is not real notification persistence.

### QA-06 — API failure leaves a fabricated-looking credit balance (P1)

Return HTTP 503 `{success:false}` for `/api/credits`. Home still displays **5 Credits** from static HTML. `shell.js` silently returns/catches failures instead of distinguishing loading, known balance and unavailable balance.

Show “Unavailable” / retry feedback on failure, and label any deliberately retained last-known balance as stale. Do not treat an unavailable value as zero or five. Apply the same state contract to header/sidebar/dialogs. Test timeout, offline, malformed response, session expiry and recovery, keeping server billing authoritative.

User impact: users cannot know whether a paid action is affordable. Admin impact: billing/refund disputes and misleading screenshots.

### QA-07 — password visibility control skipped by keyboard (P2)

Login and signup have `#authPasswordToggle` with `tabindex=-1`. Clicking works, but normal Tab navigation cannot reach it.

Restore normal button focusability; preserve `type=button`, accessible label/pressed state and focus styling. Test Tab + Enter/Space without accidental submission; include reset-password controls in the shared accessibility review.

## Additional release review findings (not automatically proven false)

- Home currently says “Join thousands of creators”, “zero rendering lag”, “works on any browser”, priority/VIP queues and payout availability. The quantified usage and absolute performance/browser claims are not established by this audit. Replace unsupported claims with truthful copy, or attach current operational evidence. Do not invent counters to support marketing.
- Home displays daily allowances in its pricing preview, despite the earlier requested monthly presentation. Choose one clear product contract across Home/Pricing/Settings; an estimate such as 150 per 30 days must state whether credits still reset daily and do not accumulate. Do not silently convert a daily system into a monthly balance.
- Production CSP contains a `localhost:3000` development origin. Remove development-only allowances in production after checking actual resource needs. This is a hardening finding, not evidence of an exploited vulnerability or a complete CSP audit.
- Production `/api/admin/dashboard`, `/users` and `/templates` returned HTTP 403 as a guest. `/api/admin/withdrawals` returned 404: **NOT AVAILABLE**, not permission proof and not an authorization leak.
- Production assets differing from local: `redesign.css`, `designs.css`, `mobile.css`, `authui.js`, `shell.js`. Live HTML references their `2026092501` URLs; the local release is not proven deployed. Verify actual deployed revision and all changed asset versions after an authorized deployment.

## Page-by-page ledger

All production rows below were checked for HTTP availability only. Feature columns describe additional local/isolated proof. **No row is fully certified yet.**

| Page | Evidence in this pass | Remaining certification / known failure |
| --- | --- | --- |
| Home `/` | 150 fixture layout states; prompt counter/empty input, click model selection, menu Escape, theme across Feedback/reload, notification bounds/XSS, API edge-state render | QA-01 through QA-06; real create/image-to-AI handoff, credits/billing/export, all lower-section content and user journeys |
| Animations | Four-width layout baseline, selected dark category legibility, template modal controls | QA-01; real search/filter/sort/pagination/community ownership, preview timing/share/likes/unlock |
| Designs | Layout, mobile converter opening/closing; gallery/publisher serialization; design ownership/storage offline tests | Actual nonempty gallery/category/search/like flows, real image-to-editable accuracy and durable cloud reuse |
| Animation Studio `/editor` | Five viewport interaction sizes; edit reaches iframe preview, advanced/final field, export dialog and AI tab reachable | Real AI response, resize/undo/redo/audio/timeline, server MP4 entitlements, charged export and refunds |
| Design Studio `/design-editor` | Six sizes; actual local edits/preview/PNG; mocked publish | Real save/reopen/publish/storage, original-vs-layer quality, oversized assets, retries, multi-user isolation |
| Community | Layout + isolated API state | QA-01; real likes/comments/share/follow/report/moderation, malicious inputs and ownership |
| My Projects `/drafts` | Guest and signed-in layout; offline draft coalescing/account isolation | QA-01; real cloud/local merge, duplicate avoidance, delete/rename/archive/export and reopen |
| Uploads `/uploads` | Mobile dialog bounds; production alias reaches `/drafts` | QA-01 on preview legacy file; real source validation, allowed formats, ZIP/folder ingestion, processing/publish/schedule |
| Settings | Mobile signed-in layout, Google-unavailable fallback, help links present | QA-01 on guest CTA; real theme persistence, connect/unlink Google, sessions, referrals and owner-only admin link |
| Pricing | Mobile baseline, served page and targeted buttons | QA-01; monthly/yearly/allowance consistency, actual checkout/webhooks/replay/failure/refunds |
| Tutorials `/tutorials`, `/help` | Mobile baseline, `/help` available in production | QA-01; real tutorials/media/categories, empty/error state, publishing/permitted sources |
| Account | Profile form accessible; built-ins Published with truthful nonpublic upload statuses at 390/1440 | QA-01 on guest CTA; real profile/avatar/handle uniqueness, drafts/delete/share, stars/follow counts |
| Creator profile | Layout; served specific official-handle URL | Real valid/invalid/unknown handles, public-only data, follow/share/pagination and private-data isolation |
| Template detail | Layout; served one template-ID URL | Real valid/invalid IDs, preview/edit/share/unlock/purchase/owner moderation states |
| Feedback `/contact` | Four sizes/both themes, validation, typed input retained after simulated 503/offline/malformed POST, retry enabled | QA-01; real ticket creation/reference/history/replies and owner visibility |
| Login | Layout/validation, next-link preservation/external-next rejection, visibility click, failure recovery, disabled Google fallback | QA-07; real session creation/persistence/logout/expiry, credential/rate-limit security and Google callback |
| Signup | Layout/email/password/handle validation and submission failure recovery | QA-07; real uniqueness races, account verification, referral attribution and provider callback |
| Forgot Password | Layout/email validation/failed submission recovery | QA-01; real email delivery, anti-enumeration/rate limits and usable reset link |
| Reset Password | Missing-token disabled, mismatched passwords blocked, simulated request failure preserves input/retry | Real expiry/replay/wrong-account, password replacement/session invalidation and successful redirect |
| Admin | 112 tab/layout cases, real fixture categories/filtering and zero values, hostile-label protection, modal Escape and outage | Server permissions/owner isolation for every operation; real mutations, ledger integrity, categories over real data, audit persistence |
| About | Layout, metadata/availability | QA-01; truthful product/legal/contact copy and CTA destination |
| Privacy / Terms | Layout and availability | Accuracy against implemented data retention, AI/payment/upload providers and deletion practices; not a legal certification |
| 404 | Local layout; unknown production route actually returns 404 | QA-01; back-navigation and recovery links; explicit static `.html` aliases/soft-404 behavior |

## Supplied Home checklist — phase coverage

PARTIAL means some checks passed, but the phase is not certified. A FAIL is an actually reproduced failure. NOT VERIFIED means the necessary test was not performed; it is not a fabricated failure or success.

| Phase | Status | Evidence / gap |
| --- | --- | --- |
| 0 Test matrix | PARTIAL | All 150 fixture viewport/theme/state cases executed; native zoom and physical devices not run |
| 1 Page load | PARTIAL | Local uncaught errors/assets clear; live static HTTP clear; cold/warm/performance/provider timing not certified |
| 2 Overlap/clipping | PARTIAL | Document overflow baseline clear; geometry does not prove all text/fixed-layer/modal overlap |
| 3 Sidebar/navigation | PARTIAL | Mobile menu opening/Escape and regression routes; every signed-in action not exercised |
| 4 Top bar | FAIL | Credits unavailable state and notification Escape fail |
| 5 Hero | PARTIAL | H1 count, responsive top screenshots and prompt-above-templates checks pass |
| 6 Prompt | PARTIAL | Unicode/counter and empty-click checks pass; full typing/IME/maxlength/Enter handoff coverage incomplete |
| 7 Add image | FAIL | Corrupt image accepted; valid/cancel/replace/provider/phone cases remain |
| 8 Model selector | FAIL | Escape and keyboard option access fail |
| 9 Create animation | NOT VERIFIED | Real successful AI creation and failure/billing/recovery journey not run |
| 10 Popular animations | PARTIAL | 10 distinct cards; local modal regression; real search/filter/likes/share/backend states remain |
| 11 Remaining sections | FAIL | Dark lower-section CTA contrast fails; operational/marketing claims need evidence |
| 12 Light pixel check | PARTIAL | Representative screenshots reviewed; every supplied pixel check not complete |
| 13 Dark pixel check | FAIL | Shared primary-button foreground/background contrast fails |
| 14 Responsive structure | PARTIAL | Emulated sizes pass scoped geometry; real physical-device accessibility not certified |
| 15 Orientation change | PARTIAL | Studio landscape sizes pass; rotation during Home input/open dialogs not run |
| 16 Typography | PARTIAL | Representative screenshot review; native zoom/long-content/font-load variations incomplete |
| 17 Spacing/consistency | PARTIAL | Top screenshot review; full-page/state visual approval still needed |
| 18 Click targets | PARTIAL | Selected mobile controls exercised, not all target sizes/hit testing |
| 19 Keyboard | FAIL | Dropdown/panel/option controls fail |
| 20 Screen reader | NOT VERIFIED | Real accessibility tree/screen-reader journey not run |
| 21 Auth states | PARTIAL | Five UI fixtures; real signup/login/logout/expired session missing |
| 22 Empty/failure/edges | FAIL | Credits failure falsely retains 5; prompt remains usable under simulated failures |
| 23 Security surface | PARTIAL | Notification hostile text and three live guest admin denials; broader attack/ownership/upload security not certified |
| 24 Performance | NOT VERIFIED | No measured Lighthouse/mobile CPU/render/network budget |
| 25 Core Web Vitals | NOT VERIFIED | No field LCP/INP/CLS evidence |
| 26 SEO/share | PARTIAL | Home H1/canonical, robots/sitemap/manifest availability; actual share previews/indexing not verified |
| 27 Copy/data | NOT VERIFIED | Usage/queues/payout claims and credit-display contract need validation |
| 28 Browser compatibility | NOT VERIFIED | Headless Chromium only; not Safari/Firefox/Edge or real Android/iPhone |
| 29 Scroll | PARTIAL | Regression scroll-to-final controls; full Home scroll/keyboard/mobile-browser bars not run |
| 30 Footer | PARTIAL | Seen in selected full-page screenshots; all links/legal copy not certified |
| 31 Visual regression | PARTIAL | Screenshots captured; not all 150 states human-reviewed or approved against a golden baseline |
| 32 Automated overflow | PARTIAL | 150 Home states and 97 regression cases clear for document overflow; separate bounds/overlap checks incomplete |
| 33 Interaction stress | NOT VERIFIED | No comprehensive rapid submit/open/close/cross-navigation stress test |
| 34 Real content stress | PARTIAL | Unicode and hostile notifications; genuine long titles/users/content not fully tested |
| 35 Design quality | FAIL | Unreadable shared dark primary actions |
| 36 User journeys | NOT VERIFIED | Real end-to-end generation, referral, payment and publication journeys missing |
| 37 Console/network | PARTIAL | Clean local uncaught errors/assets and production static GETs; real failed provider/queue/network flows remain |
| 38 30-minute state | NOT VERIFIED | No 30-minute soak/session/polling-memory test |
| 39 Reload/cache/deploy | PARTIAL | Theme survives Feedback route/reload; live/local asset mismatch means final release not verified |
| 40 Index release gate | **FAIL** | Known failures + missing real-flow/device evidence; do not mark INDEX PAGE VERIFIED |

## Evidence locations

Paths relative to the repository:

- `audit_results/home-certification/evidence.json`: individual 167 Home results, intercepted request paths and explicit unverified scope.
- `audit_results/home-certification/*-top.png`, `*-full.png`, notification/edge-state screenshots.
- `audit_results/page-certification/forms/evidence.json`: 82 form results; request paths only, no passwords or request bodies logged.
- `audit_results/page-certification/forms/*-light.png`, `*-dark.png`: full-page forms/screenshots.
- `audit_results/page-certification/primary-button-contrast.json`: every eligible control's measured colours/ratio and route/state.
- `audit_results/page-certification/*-primary-dark.png`: failing primary action screenshots.
- `audit_results/page-certification/production-readonly.json`: HTTP results, selected public headers and asset/local comparison.
- `audit_results/mobile-layout/after.json`, mobile Studio/profile/upload/converter screenshots.
- `audit_results/admin-release/content-*.png`: nonempty category-filter fixtures in both themes.

These generated artifacts are ignored by Git. Preserve/share them deliberately if another machine or reviewer needs the exact evidence. QA scripts and this report are separate source files.

## Remaining backend blockers and safe completion order

The [final release checklist](FINAL_RELEASE_CHECKLIST.md) remains applicable. Its current dated follow-up records successful read-only app connectivity and unchanged missing production referral schema. Passing local tests does not apply a migration or deploy files.

1. Fix the seven reproduced issue types above, starting with shared button tokens and truthful credit failure states. Run the same suites and review screenshots after each focused change.
2. Finish Home's unverified phases and an actual phone journey before calling Home certified. The other page baselines above are preliminary inventory, not bypasses of the Home-first release gate.
3. Establish an isolated staging database and test identities. Do not run mutation-heavy `npm test`, `verify_admin.js` or `test_admin_mobile_flow.js` against the unknown/live configured database.
4. Verify migration/permissions in staging. Referral migration and pgTAP need real PostgreSQL runs; keep `REFERRALS_ENABLED=false` until staging verification, real email/provider verification and a charged successful server MP4 qualify the 10+10 reward.
5. Complete account/Google/email/reset and each page's real save/reopen/upload/schedule/social/ownership/error journey in staging. Test mobile source formats with actual valid and malicious/broken sample files; accepting a ZIP is not proof that every software's native project is editable in-browser.
6. Resolve the earlier withdrawal/reversal/Star-pack ledger issues before enabling real payout claims/actions. Test transactions, concurrency, reconciliation and immutable quotes on isolated PostgreSQL and gateway test mode.
7. Measure performance; run actual browser/device/keyboard/screen-reader/zoom tests, long-content cases and a 30-minute soak. Do reference-based code cleanup only after route/loader/build/test compatibility checks.
8. Prove backup restore and rollback. Review the accumulated dirty diff; deploy only the deliberately verified scope, then verify deployed revision, changed assets, health and authorized staging/production smoke journeys.

This pass does not deploy or promise that future bugs are impossible. It provides reproducible failures, explicit limits and the gates still needed for a responsible release.
