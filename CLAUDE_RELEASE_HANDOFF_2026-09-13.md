# ShortsCraft — Claude continuation and release-readiness prompt

Prepared: 13 September 2026. Workspace: `C:\Users\karim\kiroai\shortscraft`.

Copy this entire document into Claude, or ask Claude to read it from this workspace.
It is an implementation brief, NOT certification that every feature was tested.

---

## 1. Your assignment

You are continuing engineering work on my existing ShortsCraft website. Stabilize the real product, finish the explicitly agreed launch scope, and produce evidence for a safe release. Do not start a replacement app, blindly redesign everything again, or ask me to identify each individual bug. Investigate complete user journeys yourself.

Explain progress to me in simple Hinglish. Work in small, reviewable batches: reproduce → identify cause → fix at the source → regression test → inspect in the browser → update the checklist. Preserve work already done by Claude, Codex and me.

Do not claim “100% bug-free”, “all pages passed” or “production ready” from compilation, generated screenshots, mocked tests or one successful flow. The objective is no known release-blocking defects in the shipped scope, meaningful automated and human QA, and a working recovery/rollback process. No engineering process can guarantee zero future bugs.

The owner is working alone with a limited budget. A smaller reliable product is preferable to many advertised but unfinished features. Do not silently remove an agreed core feature to obtain a green test report: explain the limitation and obtain approval for a reduced release scope.

## 2. Read the current state before editing

Read these files in order and reconcile them with current code:

1. `SHORTSCRAFT_PRODUCT_MASTER_PLAN.md` — agreed product direction; parts of its implementation-status section are historical.
2. `POLISH_CHECKLIST_2026-09-12.md` — September 12–13 fixes and verification boundaries.
3. `LAUNCH_READINESS.md` — accumulated release evidence; includes later corrections to earlier statements.
4. `AUDIT_REPORT_2026-09-11.md` — historical findings and reproduction details, not a list of bugs guaranteed to remain today.
5. Current `git status`, diff, startup configuration, migrations and test scripts.

HEAD was `3f73d46` when this handoff was prepared, with many uncommitted changes. Files were changing during preparation. `.claude/launch.json` and template assets also changed outside the preceding Codex pass. Re-inventory the working tree rather than relying on a snapshot or overwriting another agent's changes. Coordinate ownership if another agent is still editing.

The September 9 readiness document eventually records an uninterrupted historical full-suite pass. That does NOT contradict the need for a new run after subsequent changes. Do not reuse its counts, environment state, account counts, deployed commit or old credentials observations as current facts.

Architecture is an existing CommonJS Express application with generated/static frontend pages. Important owners:

- `build_pages.js` generates product pages. Edit the source generator, regenerate, and inspect the diff; do not patch generated pages only.
- `public/editor.html`, `public/editor.js`, `public/editor.css`: editor surface.
- `public/templates-v2.js`: template registry/renderer and editable schemas.
- `public/authui.js`, `public/shell.js`, `public/template-detail.js`, `public/creator-profile.js`: profile/publisher/gallery/detail consumers.
- `public/drafts-store.js`, `public/drafts-page.js`, `projects.js`: project storage and synchronization.
- `auth.js`, `credits.js`, `community.js`, `social.js`, `support.js`, `admin.js`, `server.js`: backend authorities.
- `payment-delivery.js`, `public/checkout.js`, `mailer.js`, `db.js`, `supabase/migrations/`: payment, delivery and storage boundaries.

Find current functions and routes by symbol, not old report line numbers.

## 3. Safety boundaries — before any integration test

- The owner could not confirm whether the configured remote database is staging or production. Treat it as potentially containing real users.
- Localhost does NOT mean an isolated database. Read-only page visits can also invoke analytics or lazy scheduling writes.
- Do not run signup/publish/export/social/support/payment suites against that unknown database. Do not create fake production accounts, seed counters, purge fixtures or apply remote migrations without resolving the environment and exact targets first.
- Use a dedicated staging database, storage bucket, test email destination and gateway test mode. Identify the environment without printing secrets, tokens, connection strings or private user data.
- Preserve existing data and dirty files. No destructive resets, broad deletes or blanket “cleanup test users” operations. Test fixtures must be traceable to a specific isolated run, and teardown must use exact created IDs.
- A frontend preview server with APIs disabled is only visual QA, not a working application or evidence of backend success.
- Do not deploy, enable billing, buy services, migrate production or change real accounts merely because the prompt says finish. Present the release result and obtain the owner's specific approval for consequential production actions.
- Never lower production authentication, TLS, isolation or rate-limit protections to make tests pass.

## 4. Product rules that must remain consistent

Current scope is ANIMATION TEMPLATES. The homepage keeps the chatbox at the top and template gallery underneath. Light theme is default, dark optional. Use restrained, professional design, readable typography and real media; avoid decorative neon/glass overload and inflated marketing claims.

Users must be able to discover → customize → preview → save/reopen → export. Creators must be able to manage their actual published work. No fake projects, people, engagement, earnings, availability, progress percentages, testimonials, scarcity or “saved” confirmations before persistence.

Built-in demonstration content inside an actual template is not a real user's data. Label it as editable template content; never count it as a user project or successful user activity.

Keep the official `@shortscraft` identity verified, but do not restore “ShortsCraft Original” badges or secretly boost its templates over other creators. Follow/follower, like/comment/share/save and Stars figures must come from real records. Stars are non-cash appreciation, separate from spendable credits. Monetization remains Coming soon, with no fictitious earnings or payout promises.

Reference plan configuration from the agreed master plan — recheck code and UI alignment, not provider profitability:

| Plan | Monthly / yearly price | Daily credits | 30-day comparison | Maximum export | Watermark |
|---|---|---:|---:|---|---|
| Free | ₹0 | 5 | 150 | 480p | Yes |
| Pro | ₹199 / ₹1,999 | 40 | 1,200 | 1080p | No |
| Pro Max | ₹399 / ₹3,999 | 100 | 3,000 | 1440p | No |

Export costs 1 credit. Standard AI costs 2; Detailed 5; Advanced 8. Both paid subscriptions can access all three AI tiers. Daily credits reset at the agreed boundary, do not accumulate, and must not be presented as a monthly balance delivered upfront. Show actual remaining credits and next reset separately. These prices are agreed product values, NOT a verified unit-economics assessment.

Yearly-plan badge entitlement is included only while eligible. Earlier discussion of a standalone ₹29 introductory / ₹49 monthly badge was not carried through as a complete billing specification in the master plan. Do not invent or enable that additional subscription; resolve it explicitly if the owner still wants it. A paid badge must not imply independently checked identity or safety.

Initial AI operation should avoid unnecessary spending and must honestly disclose capability. Do not promise a stronger underlying model simply because a tier costs more if the backend is identical. Never promise that a free provider stays available forever.

## 5. What was already fixed — preserve and reverify

These are local source fixes with limited evidence, not production certifications:

| Area | Repair already present | Evidence / remaining check |
|---|---|---|
| Creator customization | Gallery, popup and Creator Studio pass creator props; detail/backend had related fixes | Offline renderer wiring passed; real publish/reopen/export still required |
| Template links | Publish success points to the exact community template; legacy links normalized | Source/isolated checks; recheck fresh publish in staging |
| Missing templates | Detail no longer substitutes stock artwork/stale metadata | Browser error state inspected |
| Private/scheduled editor load | `GET /api/user/creations/:id` enforces session owner; editor uses owner route and awaits source | Isolated module and HTTP-handler tests passed |
| Failed editor source | Retry notice; no fake autosave/export/publish; intentional new clip recovers | Mobile database-free browser check passed |
| Credits display | Removed invented 8-credit/720p failure fallback | Source plus visible unknown-balance state checked |
| Project sync | Shared in-flight promise, await in editor, stale account/session response rejection, timeout | Offline account-switch and coalescing tests passed |
| Payment delivery | Receipt, account plan and credits in one transaction; order lock/deduplication | In-memory rollback/retry tests passed, NOT real PostgreSQL concurrency |
| Publisher UX | Clear Studio-publishing wording, blank-line preservation, schedule validation, focus trap/return, loading retry | Offline checks and limited signed-in UI interactions |
| Help/shared shell | Readable help cards, corrected factual copy, one main landmark, refreshed asset versions | 20-route layout smoke check, selected visual inspection |
| Earlier Claude fixes | Mobile theme access, light-first recovery pages, retirement of SEO generation route | Previously rechecked; retain them |

Do not change the opaque-origin engine-preview sandbox to `allow-same-origin` to solve rendering errors. Existing `allow-scripts` is for the vetted template engine, not permission to execute arbitrary uploaded code.

Tests added in the last pass:

```text
npm run test:polish:offline
verify_polish_offline.js
tests/polish-backend-offline.test.js
tests/draft-sync-offline.test.js
```

These passed in the preceding pass. Rerun after your edits. `tests/polish-preview-server.js` is an API-disabled visual helper only. The previous application process was stopped at handoff; inspect current processes before starting anything. A new server must load the intended current backend files and isolated environment.

## 6. Prioritized remaining work: problem, impact, repair, proof

Use these statuses honestly: CONFIRMED SOURCE GAP; LOCAL FIX NEEDS INTEGRATION; UNVERIFIED RELEASE RISK; PRODUCT DECISION. Reproduce before escalating a risk to a confirmed bug.

### R01 — Environment identity and release candidate (P0 gate; unverified)

User impact: test activity can alter real projects, balances or accounts. Admin impact: corrupted statistics, unexpected bills and unsafe deployments.

Fix: establish dedicated staging, document environment/version identifiers, isolate secrets/storage/email/jobs, then freeze a candidate. Record which commit plus uncommitted changes each test used. Any later relevant change invalidates that area's previous pass.

Proof: staging tests demonstrably cannot write to production; fresh backend/assets/migrations agree; no test rows or secrets reach production. Do not silently copy production personal data into fixtures.

### R02 — Own-file/folder/ZIP upload (P1 core requirement; not implemented in the preceding pass)

Current Studio publisher customizes a shipped template. That is NOT importing a creator's own artwork. Accepting a filename or ZIP and publishing a preset is a fake implementation.

User impact: creator cannot upload original work, loses customization, or downloads an unusable project. Admin impact: arbitrary code execution, hostile archives, storage abuse, copyright complaints and impossible support promises.

Required UX: select file/folder/ZIP → validate and show actual detected format → process/preview actual artwork → title/category/description/rights and useful dependencies → public/private/scheduled → persisted result → exact detail/gallery link. Distinguish Upload source from Publish current Studio project. Show supported extensions, limitations, size limits and a downloadable example.

There is no universal browser importer for every desktop application's native project. Separate these capabilities explicitly:

1. Browser-editable template with validated editable schema and proven export adapter.
2. Downloadable source package requiring its original desktop software, only if the owner approves this different product mode.
3. Unsupported format, rejected helpfully before claiming success.

The old master plan proposed Lottie-first public import. The owner later explained that their current workflow uses Remotion and requested broad PC support. Resolve this conflict deliberately: recommend a verified Remotion/controlled-template integration first, or choose a constrained declarative import after showing its limitations. Do not claim this architectural choice was already approved or completed.

Remotion/React source is executable code. A public importer needs isolated build/render workers, no production secrets or host access, unprivileged execution, strict network/egress policy, pinned/allowed dependencies, process/time/memory/disk limits and cleanup. An iframe alone or a default container is not a complete build-security boundary. Do not run uploaded `npm install`, lifecycle scripts or arbitrary source in the web server.

Archive admission must reject traversal/absolute paths, symlinks, nested archive abuse, excessive decompressed size/file count, type spoofing and executable surprises. Normalize assets, block internal-network fetches and track private ownership. Design manifest/schema versioning, asset references, editability limits and meaningful errors. Separate source package, validated internal definition, preview media and export artifact.

Proof: actual sample per advertised adapter; preview/customization/export match; reopen on another device; missing assets/dependencies and unsafe files rejected; failed processing never appears published; unauthorized downloads denied; deleting a project does not delete assets still referenced by another authorized item. If no safe adapter is ready, obtain approval for a clearly limited release rather than advertising universal support.

### R03 — All-template preview/edit/export parity (P1; local repairs need integration)

User impact: edits/images vanish or final video differs from the canvas. Admin impact: wasted render cost, refunds and creator distrust.

Fix: enumerate the CURRENT registry, not an old 58/59 count. Trace one canonical definition and props through editor, draft, publisher, database, list/detail API, gallery, Creator Studio and renderer. Audit every advertised control, aspect and template-specific asset. Persist durable media references, not session-only blob URLs. Validate schema versions and preserve old drafts when templates evolve.

Proof: text/blank text/Hindi/emoji/long strings, background, fonts, image replacement, layout, duration, aspect, multi-clip edits; save/reload/publish/reopen; actual MP4 frames match intended changes. HTML mutation alone is not visual proof. Record per-template results; newly added templates must enter this inventory and regression suite.

### R04 — Draft persistence and data isolation (P1; local fixes need integration)

User impact: lost work, wrong account's drafts, stale content silently overwriting newer edits. Admin impact: privacy incidents and irrecoverable support cases.

Fix: verify the new sync guards with real sessions, account switching, offline edits, refresh, two tabs/devices and storage-quota failures. Define conflict handling using server versions or an explicit newer-version warning. Never label local-only data as cloud-saved. Investigate missing/corrupt draft URLs and unauthorized source IDs rather than silently saving a replacement as the original.

Proof: A cannot GET/update/delete/adopt B's projects; logout clears authorized views; failed sync retains recoverable local work; successful sync survives a second device; delete cannot resurrect via stale adoption; save status reflects the actual durability level.

### R05 — Credits, generation/export jobs and resource limits (P1; end-to-end unverified)

User impact: double charges, no refunds, stuck export, unexpected quality/watermark. Admin impact: negative balances, runaway compute, refund disputes and downtime.

Fix: server owns entitlement checks, input limits, charges, job IDs and refunds. Verify durable/idempotent job submission, concurrency, retry policy and recovery after worker/process death. Client disconnection must not create ambiguous duplicate jobs. A single failed job gets exactly one refund. Apply resource limits and admission control before expensive work. Validate requested duration, quality and remote media server-side.

Proof: balance 0/1/2/5/8; double-click and parallel requests; daily reset while a job is running; timeout; failed renderer/provider; retry after restart; Free480p/watermark, Pro1080p, ProMax1440p; inspect playable MP4 dimensions/duration/frames and audio when applicable. Test queue priority if advertised. Do not treat a requested export as a successful export in analytics.

### R06 — Authentication, recovery and profile (P1; production delivery unverified)

User impact: cannot register/recover account, profile upload fails, duplicate handles or unauthorized access. Admin impact: support burden, impersonation and account takeover risk.

Fix: complete signup/login/logout/expiry/reset-email flow with safe return URLs and clear errors. Prove real inbox delivery, expiry, one-use tokens and revocation policy. Verify case-insensitive handle uniqueness via DB constraint, reserved identity protection and concurrent handle claims. Avatar upload/remove needs genuine image decoding, byte/dimension limits and safe output. Validate public links and keep private emails off public profiles.

Proof: guest/Free/paid/owner/other-account matrix; incorrect credentials, expired/reused reset, delivery outage and rate-limit behavior; image replacement persists in all consumers. Do not conclude live email works or fails solely from local `.env` presence.

### R07 — Paid checkout lifecycle (P1 BEFORE payments are enabled)

The atomic-delivery repair is present. Real PostgreSQL behavior, gateway events and crash recovery are not established by mocked tests. The inspected `paymentsLive()` currently derives availability from Razorpay credential presence. Adding keys must not accidentally open untested checkout.

User impact: charged without benefits, repeated renewal, lost remaining subscription time or confusing cancellation. Admin impact: disputes, manual reconciliation and incorrect revenue reporting.

Fix: add/verify an explicit server-side launch switch as well as credential readiness; client and order creation must follow it. Keep verified gateway ownership/amount/currency/signature checks. Implement authenticated, idempotent webhook/reconciliation recovery for browser-close and delayed/out-of-order events. Define plan renewal, upgrade/downgrade, existing expiry, cancellation and refund/revocation behavior. One-time purchase of a month/year is not automatic recurring billing: either implement the subscription lifecycle or label manual renewal honestly.

Proof: real staging transaction rollback under failure, concurrent same-payment/order callbacks, event replays, distinct payments racing for one account, checkout closed after charge, gateway delay, expired plan, refund and recovery. Validate actual database privileges/migrations. Reconcile older partially delivered receipts carefully; never delete payment history or regrant all historical receipts blindly.

Payments-off release is possible only with an honestly disabled paid purchase path, no contradictory promises, and owner's approval. Payment readiness and general free-product readiness must be separate decisions.

### R08 — Verification badge consistency (P2; source inconsistency needs reproduction)

Current `auth.js` derives active yearly verification and the creator endpoint uses that helper. However `community.js` still selects/serializes stored `u.verified` for card authors, and `social.js` has raw `row.verified` actor serialization. Do NOT report yearly verification as entirely unimplemented; check each consumer.

User impact: paid/official badge appears on one page but disappears elsewhere, or remains after expiry. Admin impact: entitlement complaints and impersonation confusion.

Fix: use one authoritative entitlement rule with all required fields across account, public profile, gallery, followers/comments/notifications and admin display. Distinguish permanent official/manual status from expiring membership status and explain badge meaning.

Proof: active yearly, expired yearly, monthly, free and official creator across every surface, including cached responses. Reserved `@shortscraft` cannot be self-assigned by another account.

### R09 — Publish/private/schedule lifecycle (P1 if creator publishing ships)

Owner retrieval and preview fixes exist, but real lifecycle verification remains. Inspected `community.js` calls `publishDue()` from reads. A separately deployed reliable scheduler was not established in this handoff; a database/external scheduler may exist and must be checked before assuming it is absent.

User impact: scheduled work appears late, private work leaks, creator cannot edit or unpublish. Admin impact: confused review states and duplicate notifications.

Fix: explicit allowed state transitions, owner/admin authorization, UTC storage with local timezone display, reliable scheduled worker if not already present, idempotent publish/notification processing, restart recovery and cache invalidation. Make due-publication checks a fallback, not an undocumented traffic-dependent promise.

Proof: publish now/private/schedule/cancel/reschedule/archive; schedule becomes public with no gallery visitor; missed schedules recover once after restart; direct URLs and APIs respect privacy; gallery/profile/counts reflect the same state; duplicate submissions don't create duplicate items.

### R10 — Reporting, moderation and admin audit (P1 with public UGC)

Inspected `admin.js` counts `content_reports` and writes `admin_audit_log`; the inspected server route inventory did not expose a complete content-report submission/review or audit-log reading workflow. Recheck current changes rather than treating this inventory as exhaustive forever.

User impact: no effective route to report copied/unsafe content or understand rejection. Admin impact: a report counter with no usable inbox, untraceable actions and overwhelming manual work.

Fix: usable Report action, stored target/reason/details, rate limits, private reporter identity, review queue, action notes and safe archive/unpublish. Give the solo owner a paginated searchable audit view. Record actor/target/before-after/reason without secrets or private message bodies in general logs. Preserve records needed for disputes. Test role enforcement server-side, not just hidden navigation.

Proof: user report → admin triage → action → creator explanation → resolved state; malicious report text is inert; other users cannot read reports; unauthorized admin APIs fail; every sensitive action has a traceable audit entry. If public uploads are opened without this, abuse handling becomes a launch blocker.

### R11 — Support and notifications (P1; full current flow unverified)

User impact: lost tickets, replies to the wrong person, silent failures and unusable help. Admin impact: repeated requests and no way to prioritize one-person workload.

Fix: reverify existing durable conversation/owner checks, user/admin replies, closed-ticket behavior, notification destination and unread state. Provide retry without duplicate submissions. Guest support must explain how replies arrive without exposing another ticket. Surface failed delivery to admin with safe retry.

Proof: ticket creation → admin reply → user notification/email as configured → authorized conversation → reply/close; wrong-owner/guest denial; network failures; long text; mobile keyboard. Do not promise staffed 24/7 service. A practical solo-admin inbox should prioritize account lockouts, billing and failed exports.

### R12 — Social, recommendations and trustworthy numbers (P2; current E2E unverified)

User impact: broken follows/comments, lost Stars, unfair discovery and misleading popularity. Admin impact: inflated metrics, spam and poor product decisions.

Fix: real unique ledgers, server constraints, idempotent actions and transactional Stars allowance. Clearly define impression/open/edit/export/share events; a share button opening a dialog is not proof someone completed an external share. Exclude test runs and obvious repeat/self-engagement from ranking by a documented policy. Use deterministic, explainable ranking before complex personalization.

Proof: repeated like/unlike/follow/unfollow, self-follow/Stars denial, parallel Stars transfers, empty lists, block/report handling, comment ownership, returned counts and notification links. No official-template preference. Preserve real zeros; don't refill empty dashboards with sample activity.

### R13 — AI usefulness, honesty and provider resilience (P1 if AI is advertised)

User impact: generic unusable scenes, image ignored, charged failures or stalled generation. Admin impact: acquisition fails despite attractive UI; provider limits/costs become outages.

Fix: benchmark a representative prompt set, not one favorite demo. Use structured scene planning and validated editable definitions. Show capability limits; unsupported images or requests get a useful explanation before charge where possible. Bound retries; provide provider outage handling, budget limits and an AI kill switch. Never silently downgrade and claim identical quality.

Proof: Hindi/English text, real creator use cases, attached-image cases, edits to generated scenes, malformed provider output, timeout/rate limits, refunds and preview/export parity. Record prompt match, readability, editable coverage, duration, latency and actual cost. Choose paid providers later from measured evidence and current official terms—not from assumptions that a country's models are free.

### R14 — Shared design, mobile and accessibility (P2; not a full visual pass)

Earlier 20-route no-overflow results only covered particular widths/states. They do not prove all dialogs, logged-in pages, dark styles, keyboards or exported media work.

User impact: hidden actions, impossible forms, unreadable labels, lost focus. Admin impact: mobile drop-off and repetitive support.

Fix: shared tokens/components for spacing/type/buttons/forms/status; preserve fixed home order; remove duplicate navigation and dead links; make upload/image controls clear in both themes. Give loading, empty, error and success states intentional layouts. Fix source generator/CSS rather than piling per-page overrides over conflicts.

Proof: 320/390/768/1280/1440 CSS widths as relevant; light/dark; keyboard-only focus; zoom/long content; reduced motion; phone keyboard and safe areas; tap targets; portrait/landscape; Safari/Chrome behavior where supported. Mobile AI/Canvas/Edit/export/publish must remain accessible. Inspect screenshots, actual interactions and current console errors, not only DOM dimensions.

### R15 — Production reliability, data lifecycle and performance (P1 gate)

User impact: slow gallery, lost media, broken reset links, failed exports after deploy. Admin impact: disk exhaustion, outage, runaway costs and inability to recover.

Fix: verify persistent storage, migration order/backward compatibility, stable production secrets, actual public URLs, asset cache versions, health/readiness checks, structured request/job IDs and alerts. Test storage cleanup without removing referenced assets; monitor queue/CPU/memory/disk/DB pool; lazy-mount preview iframes and limit concurrent animation. Separate expensive rendering from web availability as workload requires.

Proof: backup RESTORE into isolated infrastructure, restart recovery, concurrent realistic load, missing dependency/font/media, deployment rollback and old/new frontend/backend compatibility. Set measured latency/queue/storage budgets before release; do not claim unmeasured capacity. Inspect dependency/security findings proportionately without a blind framework rewrite.

## 7. Page-by-page acceptance inventory

For EVERY row, record guest/authorized states where relevant, light/dark, mobile/desktop, loading/empty/error/success and console errors. Do not mark a signed-in page passed because its guest redirect rendered.

| Route / surface | Required checks |
|---|---|
| `/` | Chat above gallery; real templates; search/filter/sort/reset; accessible cards; menu/theme; failure state; bounded preview loading |
| `/template` | Correct exact creator source, props/aspect, comment/like/save/share, clear 404 versus retry; no private source leak |
| `/editor` | Every control, images, timing, aspect, timeline, undo/redo if exposed, mobile panels, save/reopen, failure recovery, actual export |
| `/drafts` | Guest sign-in, own-only projects, empty state, rename/open/duplicate/delete as exposed, sync/error status |
| `/uploads` | Actual Creator Studio inventory, publisher/import distinction, owner-only open, lifecycle actions and status/count consistency |
| `/account` | Real profile and counts, edit/photo, links, plans/credits; no duplicate profile popup or private data leak |
| `/creator` | Stable unique handle, actual public work, badge/follow/Stars/share, no unrelated creator fallback |
| `/settings` | Every displayed setting persists correctly, validation/security actions, theme/profile consistency |
| `/pricing` | Agreed price/quality/cost rules, monthly/yearly wording, daily-credit disclosure, checkout disabled or genuinely functional |
| `/login` | Success/failure, safe next URL, session handling, mobile keyboard/password manager |
| `/signup` | Validations, unique handle/account race handling, real session, errors; no test-account seeding |
| `/forgot-password` | Truthful delivery/error behavior, anti-enumeration, rate limits, same auth theme |
| `/reset-password` | Valid/invalid/expired/reused tokens, password policy, session revocation policy, useful recovery |
| `/contact` | Ticket submit/history/conversation/reply/close and notification authorization |
| `/tutorials` | Accurate current steps and screenshots/examples, no unsupported capability promises, readable mobile cards |
| `/community` | Reconcile current Creator Skills teaching-video purpose with navigation copy; don't route published templates to an unrelated gallery |
| `/admin` | Actual owner view; overview, users, templates, support, moderation, flags, audit/job-health tools; all API denials |
| Notifications/menu/dialogs | Correct read state and authorized targets; focus trap/Escape/return where appropriate; no offscreen menus |
| `/about`, `/privacy`, `/terms` | Accurate product/operator/data/processor/rights/renewal statements; specialist review for legal commitments |
| 404 / retired routes | Useful back/retry; no fake template fallback; SEO product stays retired; normal metadata/sitemap hygiene can remain |

## 8. Execution plan and deliverables

### Phase A — Inventory and isolate

Produce `RELEASE_TASKS.md` with issue ID, status, evidence, reproduction, priority, affected files, user/admin impact, proposed fix and acceptance test. Reconcile the latest owner instructions with the older master plan. Identify staging, separate current launch scope from future requests, and agree a candidate freeze. No production mutations.

### Phase B — Protect the core journey

Prioritize R01, R03–R06 and source-load recovery. Run offline regressions, then authenticated staging checks and real exports. Fix data loss, cross-account access and incorrect charges before aesthetic extras. Add a failing test for each reproducible bug when practical.

### Phase C — Finish the chosen creator-upload scope

Resolve R02 explicitly. Prove one real supported import end-to-end before adding more formats. Then finish R09–R12 for the features that will be public. Do not hide “file import missing” inside a long list of minor UI fixes.

### Phase D — Final UI and admin acceptance

Walk the entire page inventory with genuine staging users and an owner account. Show before/after evidence for meaningful visual fixes. Make the solo-admin “Today” view practical: open support, reports/review queue, failed jobs/payment recovery and system alerts. Optional advanced analytics must not displace basic moderation and support.

### Phase E — Release gates

Freeze the release candidate; freshly start the intended staging backend; run `npm run test:polish:offline` and the complete existing regression chain plus new tests. Read scripts first: some create accounts, charge credits or render media. The historical test chain needs enough auth-test capacity; any rate-limit override is isolated-test-only. Test production rate-limit guards separately and never carry the override into deployment.

`npm run build` currently generates favicons; it is NOT proof that `build_pages.js` was run or that all frontend/backend code was verified. Verify generation and all required build artifacts explicitly. Do not drop tests or weaken assertions merely to get green output.

Prepare `RELEASE_EVIDENCE.md`: tested revision/environment, commands/results, route/role matrix, actual output samples, remaining issues and feature flags. Prepare `DEPLOYMENT_RUNBOOK.md`: migrations, config, backups, restore evidence, release sequence, monitoring and rollback. Do not put secrets in either file.

### Explicit GO / NO-GO

NO-GO for known critical/high-impact privacy, auth, data-loss, incorrect-credit or broken core edit/export defects. NO-GO if live database identity is unknown, rollback is unproven, or advertised core imports are fake. No unresolved blocker in the agreed shipped scope.

Conditional release only for optional features that are safely disabled server-side, communicated honestly and explicitly accepted by the owner. Payments, monetization and unsupported import adapters must not become active because a button/credential was added.

GO requires current full regression evidence AND human mobile/desktop checks, correct migrations/environment/assets, working essential recovery/support, genuine output and owner approval. Low-risk deferred issues must be named with impact and workaround, not buried in “everything passed”.

After approved deployment: check the actual live revision, guest flow, login/recovery with authorized accounts, a scoped export, support, asset loading and server health. Use defined alert thresholds for error rate, queue failures and inconsistent payment/credit events. Roll back or disable the affected feature when thresholds are breached. A code rollback must not erase new user data; schema compatibility matters.

## 9. Future roadmap — suggestions, not launch blockers or automatic authorization

### Next, after stable core usage

- Project version history/recovery, duplicate/remix, useful collections and reusable brand colors/fonts.
- Creator upload diagnostics, validated downloadable sample packages and template-version compatibility.
- Small quality-controlled template catalog, good categories and honest search before a complicated recommendation model.
- Better measured AI prompt interpretation and editable scene quality; opt-in beta for new generation modes.
- Lightweight feedback attached to failed export/generation job IDs, plus solo-owner alerts and documented recovery actions.
- Creator analytics that answer “which template gets used/exported?” and “where do people drop off?” using real events.

### After measured demand and affordable operation

- Additional safe import adapters, one independently tested format at a time.
- Paid-model routing based on current quality, latency, actual cost and terms; per-account/site budgets and fallback policy.
- Brand kits, template collections, localization and useful creator-follow discovery, if users repeatedly request them.
- Team workspaces and finer admin roles only when more people actually need them.

### Later, separate approved projects

- Creator monetization/paid templates only after a real funding model, fraud controls, transparent accounting, payout operations and specialist legal/tax/payment review.
- Thumbnails, banners and post-design products only after animation retention/reliability is established; each needs its own schema/editor/export tests.

Do NOT add now: cash-like Stars, fake earnings, guaranteed growth claims, broad arbitrary executable uploads, lifetime unlimited compute, an unrelated SEO-tools suite, a social network's full feature set, or many unsupported Coming soon items across navigation.

Growth cannot be guaranteed by adding features. Measure activation (first useful export), repeat exports, time to usable result, failure/refund rate and creator publish success. Use that evidence to choose the next improvement instead of repeatedly redesigning the shell.

## 10. Expected final answer from Claude

Give me:

1. What was actually wrong, where, and what you changed.
2. Which existing fixes you retained rather than replaced.
3. Which user/admin journeys you exercised, with environment and evidence.
4. Which templates/formats were genuinely imported/edited/exported, and exact limits.
5. Which checks failed, remain untested or require my decision/credentials/approval.
6. Migration/config requirements without exposing secrets.
7. GO, CONDITIONAL GO, or NO-GO with reasons and a rollback plan.
8. The next small prioritized backlog, with future features separate from release blockers.

Do not respond only with “done”, “premium UI”, “all bugs fixed” or “tests pass”. My priority is real working functionality and a sustainable one-person operation, not the number of files changed.
