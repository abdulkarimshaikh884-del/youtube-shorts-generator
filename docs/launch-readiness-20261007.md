# ShortsCraft launch readiness — updated 8 October 2026

## Decision

**Conditional approval for a verified free beta, not an all-features final certification.**
The reproduced release blockers have been fixed and covered by local isolated
regressions. Payments, paid unlocks, Stars donations and payouts remain
server-side **Coming Soon**. Production rollout, configuration and smoke checks
must complete before these local results can be called a live-release approval.
No test run establishes that every future error is impossible.

This report supersedes the release verdict in the
[historical pre-fix audit](final-release-audit-20261007.md). That audit is retained
as the record of findings, reproduction details and the older deployment.

## Version and rollback boundary

- Audited local baseline: branch `codex/full-product-redesign`, commit
  `62b1f0d6d15d60b1cb951730afe6ae49e0f44905`. The fixes described below are local
  working-tree changes on top of that baseline; this document does not identify
  them as committed, pushed or deployed.
- Last verified live Render deployment: service `youtube-shorts-generator`,
  `srv-d7ktcp0js32c738607lg`, My Workspace, commit
  `63d59087dfdf8e95c9a03a9c5615cbb082731b8d`, settings-only deployment
  `dep-db3klh3tqb8s73ed4vp0` live on 8 October. It is older than the local
  baseline and does not prove that the new fixes are live.
- Reversible baseline branch: `codex/pre-launch-20261008`, pointing to
  `62b1f0d6d15d60b1cb951730afe6ae49e0f44905`. Unrelated user files were not staged.
- Before rollout, preserve the local baseline and reviewed fix diff, then record
  the actual release commit and the prior live revision as rollback targets.
  Revert the specific release commit(s) to undo application changes; do not
  reset the shared worktree or discard unrelated user changes.
- A code rollback is not a database rollback. Production backup, migration
  compatibility and recovery decisions need their own verified plan.

## Verified local results

These are dated artifacts from the actual run, not a list of tests assumed to
pass. Browser emulation and provider fixtures are identified separately from
real local PostgreSQL/HTTP work.

| Verification | Current result | What it proves / limitation |
| --- | --- | --- |
| DB-free release UI runner | **PASS**, five top-level suites, completed `2026-10-08T08:23:14.311Z` | Home, forms, interactions, contrast and the nested mobile/Designs/admin/account/settings browser fixtures; no production writes |
| Offline launch regressions | **19/19 PASS**, rerun 8 October | Parser limits, release guards and alias, credit operation binding/replay, moderation, balances, referrals, OAuth logic, image validation, Designs storage/concurrency/conversion/assets, polish, draft sync and manual-page build protection |
| Real isolated PostgreSQL module checks | **22 PASS**, completed `2026-10-07T15:08:49.519Z` | Durable auth/session/reset, referral RLS/privilege denials, concurrent uniqueness/spending/refunds, 10+10 referral grants/cap/rollback, admin permissions and bonus adjustments |
| Real Designs HTTP/PostgreSQL regression | **12 PASS**, completed `2026-10-07T15:15:43.990Z` | Save/reopen native layers, owner-only private access, opaque revisions, ten-way concurrency with one winner, public publisher metadata, cross-account clone and owner deletion |
| Real local auth HTTP/browser selected rerun | **PASS**, completed `2026-10-07T15:35:52.094Z` | Signup/login/logout, database password/session safety, actual profile save and reload, actual duplicate-handle rejection, dedicated account pages and mobile navigation |
| Designs browser save-safety regression | **10 PASS**, rerun `2026-10-08T08:00:34.639Z` | Serialized autosave, latest-edit reload, stale-tab protection, image normalization/budget, truthful failure/retry and free publish UI/server policy; isolated memory transport |
| Native HeyGen editor regression | PASS, separately rerun after adding it to the runner | Actual layers/assets render at desktop and phone widths; edit, durable fixture save/reopen and PNG export; missing project/image errors surfaced |
| Latest complete 16-suite HTTP rerun | **16/16 PASS**, completed `2026-10-07T15:41:05.296Z` | Real local signup/reset/profile, credits, admin/projects/social/support/publish, referral exports, staff/notifications/tutorials, H.264/Lottie exports, Design concurrency and 33 financial-policy checks; external providers blocked |
| Page-generator recovery | PASS, completed `2026-10-08T07:54:59.905Z` | Generator cannot overwrite the hand-maintained Admin/Designs/account/settings pages; restored 14 Admin sections and Designs upload recovery, with 112 Admin and 8 Designs viewport/theme cases |
| Legacy feedback access hardening | **7/7 PASS** in isolated PostgreSQL; production ACL subsequently checked | Only obsolete anonymous/authenticated INSERT privileges removed; private service access, rows and current support workflow preserved |

The local HTTP test environment blocks external provider calls and uses real
Express, PostgreSQL 17, Chromium and ffmpeg. Rate limiting is disabled for
regression volume; these results do **not** certify abuse/rate-limit behavior.

Evidence files:

- `audit_results/release-ui-evidence.json`
- `audit_results/launch-offline-evidence.json`
- `audit_results/postgres-isolated/evidence.json`
- `audit_results/postgres-isolated/design-http-evidence.json`
- `audit_results/postgres-isolated/http-selected-evidence.json`
- `audit_results/postgres-isolated/http-evidence.json`
- `audit_results/generator-recovery-evidence.json`
- `audit_results/postgres-isolated/verify_auth.js.log`
- `audit_results/designs/save-safety-evidence.json`

These generated evidence files are local audit artifacts, not necessarily
versioned release files. Preserve them with the release record.

## UI and feature coverage

The passing fixture runs include 167 Home checks, 86 form checks, 35 interaction
checks, 122 primary controls across 84 contrast states, 97 mobile layout states,
five animation-Studio interaction widths, six Designs-editor viewport sizes and
112 admin tab/layout checks. Themes, guest/free/pro/pro-max/owner Home states,
category filtering and safe injected labels were exercised within fixtures.

Account verification covers the profile/settings hub with **Creations first**,
dedicated URL pages, Back/reload and legacy redirects, appearance persistence,
role/guest privacy, keyboard access and visible mobile actions. Referral UI
checks include disabled/outage/retry states, copy and verification messaging;
they do not prove actual inbox delivery. The real selected auth rerun also
checks a genuine database-backed profile save, duplicate-handle failure without
data loss, Cancel restoration, mobile Creations and logout.

Designs verification covers compact cards, menu/preview interaction, editable
native layers, image addition/replacement, save/reopen, ownership, free publish,
cross-user cloning and failure states. It does not mean every arbitrary uploaded
image is reconstructed as perfect, independent layers. Image conversion remains
approximate; photos, overlaps, complex effects and typography can require manual
correction and a user-visible review.

Useful visual evidence:

- `audit_results/profile-settings/preview-settings-light-390.png`
- `audit_results/designs/editor-working-390.png`
- `audit_results/auth-current-pages/edit-profile-saved-desktop.png`
- `audit_results/auth-current-pages/settings-mobile-390.png`
- `audit_results/auth-current-pages/creations-mobile-390.png`

## Blockers repaired since the historical audit

1. Design saves are serialized in the browser and guarded by an opaque,
   full-precision expected revision in the database. A stale tab/request cannot
   silently replace a newer cloud save; the latest edit is drained before Saved
   to cloud is displayed.
2. Design save/publish JSON uses the intended 2 MB parser. Ordinary APIs retain
   the smaller limit; increasing every request limit was not the solution.
3. Added/replaced images are normalized to a single savable WebP source with a
   document-budget preflight. Oversized or rejected saves retain edits and show
   an actionable retry/error state.
4. Legacy `/api/auth/star` is covered by the free-release policy as well as the
   ordinary donation routes. Money actions cannot be enabled accidentally by
   gateway credentials or admin flags in this release.
5. Credit operations are tied to the request/operation state. Changed-payload,
   in-flight, completed and refunded replays are rejected before repeated work;
   concurrent requests cannot obtain extra generation for one debit.
6. Designs publish defaults to free, paid publication is server-blocked and the
   free UI no longer offers earnings controls. Moderation rejection reasons are
   persisted rather than existing only in a transient response.
7. Stale inline account-editor tests now exercise the real dedicated routes;
   owned temporary Chrome profiles and bounded cleanup avoid attaching to or
   terminating the user's browser. Tests preserve real failure checks. The final
   verification-link check awaits actual confirmation completion and URL cleanup,
   asserts one exact-token request and proves reload does not replay it; shell
   readiness alone was not sufficient for this asynchronous test assertion.
8. Reviewed dependency versions include `sharp` 0.35.5 and `proxy-addr` 2.0.8.
   The launch work's fresh dependency audit reported zero known vulnerabilities;
   this is not proof of absence of all security flaws.
9. The page generator now preserves canonical Admin and Designs markup instead
   of replacing it with historical templates. The restored mobile Admin tabs,
   category filtering and Design upload/retry/review/editor flows were rechecked.
10. The unused legacy `public.feedback` anonymous Data API write path is closed.
    Production migration `revoke_legacy_feedback_browser_insert` applied on
    8 October; catalog verification confirmed anonymous/authenticated table and
    column INSERT are denied and `service_role` INSERT remains allowed. No
    production content was inserted, changed or deleted by this migration.

## Referral and email readiness

The implemented rule is **10 bonus credits for each person**, after a newly
referred account is verified and completes its first successful qualifying
export. Local real PostgreSQL/HTTP tests cover exact-once grants, failed-render
refund/no reward, verification binding/replay, and a monthly inviter cap of ten
rewarded referrals.

Production activation is still a separate gate: review/apply the referral
migration through the authorized workflow, verify RLS/revokes/app-role grants,
configure `REFERRALS_ENABLED` deliberately and configure a verified email sender
(`RESEND_API_KEY`/`AUTH_FROM_EMAIL`). Confirm actual delivery and one controlled
signup → verification → successful export → exact 10+10 journey. QA supplied
verification tokens directly; that is not a delivered-email test.

Render Environment was checked directly: `NODE_ENV=production`,
`DISABLE_RATE_LIMIT=false`, `REFERRALS_ENABLED=false`; no `RESEND_API_KEY` or
`AUTH_FROM_EMAIL` was configured. The user confirms a Resend account still needs
to be created. Leave referrals off until sender verification and actual inbox
delivery are verified. Do not claim the local 10+10 result is live.

If those production checks are not complete, keep referrals unavailable with
truthful messaging instead of advertising an active reward. Password-reset and
verification delivery must likewise not say Sent when the mailer is unconfigured.
See the [email setup checklist](resend-setup.md) for the remaining owner steps.

## Remaining release gates and explicit limits

- The complete HTTP suite is now recorded green; keep its isolated/provider
  boundary distinct from production verification.
- Record the intended release commit, review the complete diff, deploy that exact
  revision and verify its live health, assets and server policy afterward. There
  is no new live-deployment claim in this report.
- Render remains the existing Free native Node service, with no paid upgrade.
  `/api/health` monitoring was configured and the settings-only deployment
  succeeded on 8 October; it still used the older application revision. Native
  runtime includes ffmpeg and Puppeteer's existing Render cache configuration
  keeps downloaded Chrome in `node_modules`. Actual authenticated live export,
  font/output quality, capacity and request limits remain a separate check.
- Verify production email/Google OAuth callbacks, AI provider configuration and
  controlled successful/failing exports. Local fixture/mock success is not live
  provider success.
- Test Android/iPhone/Safari touch, keyboard, file picker and downloads. Automated
  widths cannot certify physical phones, all browser engines or every device.
- Verify production backup/restore, migration safety and rollback. Older local
  QA restore artifacts do not certify current production recovery.
- Check production rate limits, concurrent load, p95 latency and operational
  alerts. Read-only healthy pages/no recent error logs are not load certification.
- Review published template content: duplicate artwork, mismatched titles and
  test/E2E-labelled public content are editorial issues, not cleared by a green
  transport or storage test.

**Launch scope:** a free beta with the locally verified core flows, explicit
provider/referral availability and money features Coming Soon, once the exact
production revision and the remaining rollout gates are checked. This is not
approval for paid orders, payouts, unrestricted arbitrary-image conversion
claims or a promise of a permanently bug-free site.
