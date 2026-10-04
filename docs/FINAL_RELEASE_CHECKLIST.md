# ShortsCraft final release gate

Status: IN PROGRESS — not a claim that the site is production-ready.

## Free-only release decision — 2026-10-02

The user approved **Free release; money features Coming Soon**. This is a scope
decision, not evidence that the financial ledger bugs are fixed.

- `release-policy.js` defaults to a reviewed, hard-disabled monetization policy.
  Existing gateway credentials, admin feature flags or environment variables
  cannot activate payment orders/verification, Stars purchases/donations,
  withdrawals, payout processing, Star reversals, pack configuration or manual
  Star adjustments. Authentication and admin permission denials remain intact.
- `/api/config`, `/api/offer`, pack and wallet responses advertise unavailable
  money actions. Fresh premium unlocks return HTTP 503; free templates, creator
  access and existing purchased unlocks are preserved. No downgrade/deletion.
- Pricing/profile/wallet/admin UI uses Coming Soon and read-only history.
  Removed the current payout timing/revenue-split promise. Estimates in old
  financial records are not verified cash earnings or settlement proof.
- Local middleware tests passed 30 auth/permission/unavailable HTTP cases,
  preserved free/owned/previously unlocked access, and attempted zero ledger
  writes. Full Express + local PG17 checks passed another 30 cases; wallet
  withdrawals remained disabled and the Star ledger row count was unchanged.
  Fresh real local social/admin suites also passed. No live financial POSTs.
- Docker Desktop startup was recovered by backing up socket-only runtime
  directories (no factory reset, volume deletion or WSL reinstall). The stopped
  QA container's one-shot `initdb` command was identified; its complete local
  filesystem was snapshotted and the original container retained as
  `shortscraft-qa-pg17-20261002-preserved`. The active copy now starts PostgreSQL
  directly and is healthy, labelled QA, with only `127.0.0.1:55437` exposed.
- New script references use `2026100202`. Generator source was synchronized for
  changed copy, but no generator-wide rebuild was used to replace user edits.

**Release boundary:** not deployed. Production provider journeys, production
backup/rollback, referral migration/provider rollout and actual phone/Safari
testing remain unverified. Do not enable `REFERRALS_ENABLED` in production
before its migration and mail delivery checks. Do not reopen money actions
before the financial blockers below and real gateway/settlement tests pass.

Evidence: `audit_results/postgres-isolated/tests_free-release-http.test.js.log`,
`verify_social.js.log`, `verify_admin.js.log`; `tests/free-release-policy.test.js`.

### Fresh retest results after Free policy changes

- 16 real local HTTP suites passed in two guarded runs (3 money/social/admin;
  13 auth/reset/export/credits/projects/support/publish/referral/staff/
  notifications/tutorials/Lottie/Design storage). The latest 13-suite evidence
  is `audit_results/postgres-isolated/http-selected-evidence.json`; all 16 logs
  are retained. It is not a production API or external-provider certification.
- 21 real PG17 module checks passed again, including 15 pgTAP checks and reward
  rollback/retry. New-process persistence and backup/restore of all 31 public
  tables passed again. QA backup/restored database retained; production was
  neither dumped nor restored.
- Final aggregate `npm run test:release:ui` passed: Home 167, forms 86,
  interactions 35, contrast 84 states/118 eligible controls/0 failures, mobile
  97 + five Studio sizes, Design six sizes, admin 112, profile 390/1440.
  An earlier Windows Chromium temporary-file cleanup failure is historical;
  the complete rerun exited 0 (no test assertion was suppressed).
- Additional Free UI test passed 18 disabled-control cases at 390/1440 with
  zero mutation requests and page errors, including a stale payments-ready
  response and contradictory wallet eligibility. Wallet phone screenshot was
  inspected; the unusable payout form is hidden and history retained.
  Evidence: `audit_results/free-release-ui/evidence.json` and screenshots.
- Offline polish/atomic mocked delivery/draft/AI definition, admin-balance,
  Star purchase validation and 18 image validation checks passed. Gateway
  delivery mocks are not real payment/settlement proof. `npm audit --omit=dev`
  reported 0 dependency vulnerabilities; not a full security certification.
- Production read-only check passed 32 checks/15 linked assets, but six shared
  assets differed from this working tree. These new changes are NOT live.

**Verdict:** local Free-scope regression gates passed. Full production release
certification remains **IN PROGRESS** pending the production/provider/device
boundaries above. No commit, push, production migration or deploy this batch.

## Real verification follow-up — 2026-10-02 (local only)

This section supersedes older connectivity/isolation statements below. Production data, schema and deployment were not changed.

- Docker Desktop recovered after two failed starts: stale runtime socket directories were renamed to recoverable `.qa-backup-20261002-150236` folders. No factory reset, images/volumes deletion or WSL reinstall. Existing unrelated containers were not altered. QA uses its own labelled PostgreSQL 17 container, `shortscraft-qa-pg17-20261002`, exposed only at `127.0.0.1:55437`.
- The configured app-role PostgreSQL connection was rechecked read-only: `SELECT 1` passed in 1468 ms. The previous timeout is not a current reproduced blocker. Live public availability and selected assets were rechecked read-only; six shared assets still differ from local. Local changes are NOT deployed.
- DDL only was copied from app-visible production tables; no user records were copied. The saved referral migration was applied only to `shortscraft_qa`. Real PostgreSQL module tests: 21 PASS, including 15 pgTAP access checks, concurrent email/handle uniqueness, credit locking/replay/refunds, verified referral 10+10, monthly cap and transaction rollback/retry.
- Real local Express/DB suites passed on signup/login/logout, password reset/session revocation, MP4/custom-scene export, credits/402, admin, projects, social, support, publishing, staff permissions, notifications, tutorials and Lottie upload/publish/edit/export. Push delivery uses a stub transport; email verification tokens were supplied directly for QA, not delivered by an email provider. Real Google/AI/email delivery and payment captures remain unverified.
- Final combined guarded HTTP runner: **15/15 suites PASS, exit 0**, including Design storage. Logs are saved per suite under `audit_results/postgres-isolated/`; the server stops after completion. Rate limits were disabled for this regression volume, not security-certified.
- Design save/reopen/publish/clone and cross-account read/write/delete isolation passed against real local PostgreSQL. Image-to-layer accuracy is a separate, incomplete gate. Built-in fallback Designs no longer start with fabricated usage counts; persisted production metrics were not modified.
- Two real bugs fixed locally and retested: Admin broadcast referenced an undefined `message` after saving notifications; export returned a stale credit header before awarding referral bonus. Export now reports 14 after the qualifying Free-account export (5 - 1 + 10).
- Test assumptions corrected without changing the product: current sidebar wording, Free Stars allowance of zero, daily ledger fixture's `spent` invariant, graceful Windows publish-test shutdown. Credit HTTP mutation tests now actually run in the guarded isolated runner rather than silently skipping.
- Real Chromium/ffmpeg render harness: 19 PASS. Current plan contract yields Free 480x854 portrait with watermark and Pro 1920x1080 landscape without watermark. Encoded frames change with time, edited content and second clip. Representative encoded frames were visually inspected. This is not approval of every template's composition or physical-device playback.
- Local backup/restore drill: a fresh app-side process reads persisted balances; a custom-format QA backup restored into a new QA database with exact row counts/content checksums for all 31 public tables. No production backup/restore, cloud retention/RTO or container restart is certified.
- `npm run test:release:ui` aggregate completed PASS: Home 167, forms 86, additional interactions 35, contrast 84 states, mobile 97 plus five Studio sizes, Design Studio six sizes, admin 112 and profile 390/1440. These browser fixtures are distinct from real DB tests.

Evidence: `audit_results/postgres-isolated/evidence.json`, `http-evidence.json`, `referral-http-evidence.json`, `design-http-evidence.json`, `backup-restore-evidence.json`, and `audit_results/export-isolated/evidence.json`. Earlier failed attempts are historical; use the final rerun timestamps/results.

QA isolation correction: an earlier runner blocked `fetch` and blanked provider keys but did not cover Web Push's HTTPS transport/generated local VAPID keys. A combined notification rerun exposed a background-worker race with fake device subscriptions. The QA preload now blocks real Web Push explicitly and disables only the test HTTP server's automatic push dispatch; the child suite tests delivery with an injected sender. Do not describe earlier runs as fully outbound-network isolated or describe stub delivery as successful phone delivery.

Razorpay: user will create the account after receiving PAN. No fake payment success or real charge was introduced. Unconfigured checkout returns unavailable and does not upgrade an account. Before accepting money, still test gateway test-mode orders/captured receipts, signatures, duplicate callbacks/webhooks, refunds and reconciliation. Existing withdrawal/reversal/pack blockers below are not fixed by absence of a gateway.

## Latest local fix batch — 2026-10-02 (not deployed)

- QA-01–07 from the page audit are locally fixed: dark primary-button contrast, model keyboard access/Escape, image decode validation, notification Escape/errors and truthful failed-credit states, password keyboard toggles.
- Studio shares the validated image picker; the AI server independently decodes bounded image attachments before credit lookup/charge. Corrupt/truncated/MIME-spoofed images are rejected. Attachment byte limits are consistent with 900 KB binary input.
- Notification read failures preserve unread counts; 99+ individual reads no longer zero the count. Retry, recovery and safe notification links are covered with isolated fixtures.
- Removed unsupported quantified/performance/browser claims and timer-based fabricated AI-stage completion. Elapsed time remains an actual clock, not a provider progress signal.
- Retests: Home 167 PASS, forms 86 PASS, additional interactions 35 PASS, 84 contrast page states with zero failed eligible control samples, server images 18 offline checks PASS. Existing mobile/Design/admin/profile and offline feature regression suites pass locally. Scope and evidence are in `PAGE_BY_PAGE_QA_2026-10-01.md`.
- Changed shared scripts/styles use cache version `2026100201`. Existing user edits are preserved; no generator-wide rewrite, DB mutation, migration, commit/push or deployment was performed.
- Backend/release blockers below remain; mock success is not real database, payment, email, render or production certification.

## Locked requirements

- Home: prompt box above animation templates. Default light theme, monochrome UI and saved dark theme.
- Mobile and desktop: controls must be reachable, not merely present in the DOM. Verify phone portrait, short viewport, landscape, tablet and desktop.
- Designs: preview image, title, publisher. Preserve real attribution; no invented likes, revenue, user counts or editable-layer claims.
- Admin: owner access is enforced on the server. Category filters, visible loading/error states and audit reasons for changes.
- Referral: BOTH participants receive 10 bonus credits once a new, verified account completes its first successful server-rendered export. Separate bonus balance, maximum 10 rewarded referrals per inviter per UTC calendar month. No cash or Stars reward. Existing accounts and self-referrals are ineligible.
- Existing data and unrelated edits are preserved. Remove code only after proving it is unused.

## Required release checks

1. Admin endpoint and payload contracts; permission checks; privileged UI injection prevention; errors must not be presented as empty successful data.
2. Referral signup attribution, verification, server-only qualification, atomic/idempotent reward, caps, credit spending/refunds, restart persistence and private statistics.
3. Account/login/Google/reset/verification flows; ownership isolation for projects, uploads, templates and support.
4. Public-page layouts plus actual editor, upload, profile, Designs and admin interactions in both themes.
5. Export resolution/watermark entitlements, insufficient balance, failure refunds, successful MP4/PNG, payment replay and queue failures.
6. Dependency/security audit and a reference-based dead-code inventory. No broad deletion of legacy files without compatibility checks.
7. Backup/restore evidence, migration verification, production configuration, rollback commit and post-deploy HTTP/asset checks.

## Fixed locally (2026-10-01; NOT deployed)

- Design Studio: reachable mobile Text/Images/Shapes/Layers/Backdrop/Edit panels, correctly scaled canvas, live editing/preview, accessible Export/Publish and short/landscape viewport support. Failed cloud saves do not claim Saved.
- Mobile profile tabs and conversion/publish dialogs: horizontal navigation, bounded scroll, keyboard Escape and usable input sizes.
- Designs: publisher links sit above the card-wide edit overlay; clone/open errors show an error and restore the button. Unknown layer confidence no longer defaults to an invented 90%.
- Admin: actual category and animation/design filters; failed loads are errors, not successful empty lists. Broken Feature action replaced by a working View link. Fake AI Retry removed and server refuses to claim dispatch without a worker.
- Admin: user/creator/activity labels built as text, pack input values assigned as DOM properties, real zero credits preserved, matching creator field names. Modal has dialog semantics, Escape and focus trapping/restoration. Filter failures are handled visibly.
- Owner-only staff permission changes enforced on the server.
- Manual balance adjustment: strict whole-number validation; credits use separate bonus balance and never change daily allowance. Bonus deductions cannot exceed bonus balance. Audit or notification failure rolls back the adjustment. Positive Stars are spendable grants, not fabricated withdrawable donations; unsupported Star debits return an explicit error.
- Star purchases: gateway order AND captured payment checked for account, server pack, amount/currency and signature; browser pack selection cannot change the grant; callbacks deliver once per order and chunk writes roll back together. No real payment was made during tests.
- Dependency patches: Express 4.22.3, qs 6.16.0, fflate 0.8.3; the browser's vendored fflate also updated (not just package.json). Changed asset URLs use `2026100101`.
- Referral code, settings UI, hashed single-use email verification, migration and tests added. Reward is 10 bonus credits EACH; daily reset preserves the bonus, and failed renders refund from the exact balance source once.

## Release blockers — do NOT publish as a fully verified release

1. **App database transport — historical timeout resolved on recheck:** actual app-role read-only `SELECT 1` passed. Longer outage/reconnection/SSL-hardening checks and production operating reliability remain separate; do not treat a single connection as an uptime guarantee.
2. **Referral rollout:** live schema does not contain the new referral tables, `users.email_verified_at` or `credits.bonus_credits`. Migration `20260930165509_referral_bonus_credits.sql` is saved, NOT applied. `REFERRALS_ENABLED=false` is the safe default. Email delivery and real successful server MP4 export must pass after a staging migration before enabling. Keep the flag enabled while bonus balances/charges remain in use; disabling it hides bonus balances.
3. **Real DB verification — established locally:** Docker recovery, PG17, migration, pgTAP and real module/HTTP tests now pass as recorded above. Production referral schema is still missing. Use the guarded `tests/run-postgres-http-qa.js`; generic full-suite scripts can write their configured database and must not run against production unchanged. Physical-device/provider/full-feature coverage is still incomplete.
4. **Withdrawal ledger (existing Antigravity code):** processing is not atomic; terminal paid/rejected requests can transition again; split requests repeat whole-request INR values per row; rejected refunds are classified as donation earnings. Redesign around one payout request ID, its reservation/chunks, strict terminal transitions and an atomic non-earnings release. Reconcile historic requests before migration. A typed UTR is manual confirmation, not bank settlement proof.
5. **Star reversal (existing code):** Date.now-based keys allow repeated reversal, missing debit semantics and insufficient-balance checks can corrupt wallet accounting; arbitrary fallback receiver is not a valid financial counterparty. Replace with one deterministic reversal per original transaction and distinct spendable/earned/reserved ledgers. Test concurrent retries and partial failures against isolated Postgres.
6. **Star-pack administration:** Admin currently writes feature-flag JSON but checkout uses static server packs. Do not call saved edits effective. A shared validated pack resolver and immutable server-authored order quote are required, so an admin price change does not break already-paid orders.
7. **Financial reports:** captured payment receipts, fees/refunds and settlement reconciliation are not verified. Gross revenue/platform fee show unavailable rather than invented Stars x rupees; some legacy purchased/earned aggregate queries still need reconciliation.
8. **End-to-end production gates:** real signup/Google/email/reset, permission/ownership isolation, safe admin mutations, server MP4 exports and failure refunds, scheduling, upload security/processing, queue recovery, backup restore and post-deploy health are NOT comprehensively verified. Test on staging first. Then check an actual phone (including Safari); desktop Chromium emulation is not every phone/browser.

## Referral rules and limitations

- A new account is attributed at signup only, via signed first-attribution cookie. Existing-account login/linking and self-referral are not qualifying signup events.
- The referred account must verify its email (or Google identity) and complete an actual successful server-rendered export. Client analytics cannot grant a reward.
- Both grants happen in one transaction, once, with deterministic ledger keys. Maximum 10 rewarded referrals / 100 bonus credits per inviter per UTC calendar month. Over-cap referrals are marked limited, not silently promised a later payout.
- Bonus credits have no cash/Stars payout and do not reset with the daily grant.
- Account self-check, verification and caps do NOT prove one person has only one account. Stronger account-farming detection, review tools and reward-recovery/backfill after an infrastructure failure remain future work.

## Evidence ledger

All browser suites below use the **DB-free QA preview**, intercept API requests, and block outside origins. Test fixtures are not published or persisted. Module suites use isolated storage and real application modules. No production data was changed by these tests.

| Check | Result | Boundary |
| --- | --- | --- |
| `node tests/run-polish-browser-qa.js` | PASS | Owns and stops the static preview; runs the four browser suites below |
| `node tests/mobile-layout-qa.js` | PASS: 97 checks, no document overflow/page errors; 5 Studio viewport interactions | Public routes at 320/390/768/1440 plus live edits/preview/advanced controls/export dialog/AI UI at short and landscape sizes; no real AI/MP4 billing |
| `node tests/design-mobile-qa.js` | PASS: 6 sizes | Real local canvas editing, preview and PNG export; mocked server storage/publish, not live publication |
| `node tests/admin-release-qa.js` | PASS: 112 tab/layout checks | Both themes; category filter, nonempty hostile-name fixtures, zero credits, modal Escape, visible outage; no admin writes |
| `node tests/account-published-templates.test.js` | PASS: 390/1440 | Built-ins share Published presentation with uploads, nonpublic states and library deletion rules retained |
| `npm run test:polish:offline` | PASS | Gallery rendering, publisher serialization, atomic subscription delivery/retry, draft sync isolation, AI definitions |
| `node tests/referrals-offline.test.js` | PASS | 10+10, charged export/verification gates, rollback/replay/cap, exact-source refunds and rollover, signed attribution; hashed token resend, replay, expiry, account/email binding |
| `node tests/admin-balances-offline.test.js` | PASS | Strict validation, migration gate, nonnegative bonus, audit rollback, spendable Star chunk grants; NOT proof of all admin functions |
| `node tests/star-purchases-offline.test.js` | PASS | Mock gateway receipt matching, browser tampering, concurrent callbacks, atomic chunk rollback; no real gateway charge |
| `node tests/google-auth-offline.test.js` | PASS | OAuth state/PKCE/expiry/linking/account role and plan preservation; real Google callback not performed |
| `node tests/design-storage-offline.test.js` | PASS | Owner isolation and no production memory-only success on outage |
| `node tests/design-assets-offline.test.js` | PASS | Durable asset write/ownership/public promotion contract |
| `npm audit --omit=dev` | PASS: 0 reported vulnerabilities | Installed dependency audit, not a security certification |
| Read-only Supabase schema and 6 Admin SELECT EXPLAIN checks | PASS | Matched project schema and query planning only, not app endpoint/mutation proof |
| Local referral migration / pgTAP / real MP4 / local restore | PASS in isolated PostgreSQL 17 | See current dated evidence above; not production migration/restore |
| Real email/Google/AI providers, Razorpay, live deployment | NOT VERIFIED / NOT performed | Required for the corresponding enabled feature; payments deferred by user |

The first animation-preview rerun timed out on rAF polling while its diagnostic already contained the edited text. DOM-content polling was changed to a bounded 100ms check; the complete runner subsequently passed. The preview runner now owns its server lifecycle, avoiding stale test sessions after an interrupted turn.

## Cleanup inventory

- Removed `public/designs.js`'s unused `buildCardPreview` after searching references; the actual card renderer remains `SCDesignPreview`.
- Did not delete legacy pages, verification scripts or user/Antigravity files merely because their names looked old. Check route handlers, HTML/script links, dynamic loaders, build generation and tests before removal.
- Need a remaining reference-based inventory before wider cleanup; build_pages was NOT run to overwrite manually edited pages.

## Next release sequence

1. Fix and regression-test the withdrawal/reversal/shared-pack accounting issues above; do not mix a cosmetic release claim with untested money actions.
2. Local app/Postgres, migration/pgTAP and referral export/replay/refund proof is now available. Complete actual verification-provider delivery and production backup/migration review before enabling referrals. Keep local QA distinct from the live environment.
3. Perform real-device visual QA and safe signed-in workflows; validate image-to-editable output against originals, with honest partial-editability labels.
4. Establish backup/restore and rollback evidence. Enable referral only after migration and verification provider configuration.
5. Review the accumulated dirty diff, commit the verified scope, deploy deliberately, then verify the deployed commit, key assets, health and smoke tests. No deployment has been made during this audit pass.

No zero-bug or no-future-problem guarantee is possible. The goal is documented evidence, explicit remaining risks, observable failures and recoverable releases.
