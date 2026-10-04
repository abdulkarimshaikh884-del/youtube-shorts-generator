# Reversible Profile + Settings preview — 2026-10-05

Implemented locally only. Not pushed to GitHub or deployed to production.

## Layout and behavior

- Profile header retained; one divider, then Settings. No Creations/Settings tab strip or extra introductory subtitle. Creations is the first expandable Settings option.
- Settings groups reuse the original form/pane DOM nodes and their API handlers, not duplicate IDs or a new database.
- Creations; edit profile; account/Google sign-in/credits; appearance; device notifications; read-only Earnings & Stars; help/support history; Referral; authorised Admin Console; logout.
- Referral is visible even when unavailable, without a fabricated link or counters. Enabled responses expose the real invite link, copy control, rewarded/pending/monthly statistics, email verification and retry. `#referrals` opens this group directly. Backend DB/email failures return safe 503 JSON rather than leaving Express async requests unhandled.
- Public creator profile is unchanged. Signed-out users see the login gate and an appearance control, not private settings. Admin visibility follows existing role/permission logic; server authorization remains unchanged.
- `/settings` redirects to the account workspace, preserving query/hash and verification/OAuth return paths. Legacy account hashes remain usable. Sidebar Settings goes to `/account#settings`.
- No new financial capability or referral rollout. Existing server-side free-release locks retained.
- `public/account.html` and `public/settings.html` are canonical hand-maintained pages. The page builder preserves them instead of regenerating obsolete layouts. Other generated pages retain their existing build flow.

## Verification

- `node tests/profile-settings-qa.js`: PASS at 320/390/768/1440 in both themes; Creations-first layout, no tabs, hash routing, theme reload persistence, unique IDs, grouped panels, guest/admin/public-profile boundaries, mocked profile save/error/cancel, keyboard accordion navigation and builder-preservation checks. Referral UI fixtures cover disabled/outage/retry, response fields, copy, verification send/error/confirmation and token URL cleanup. These do not prove actual email delivery or credit grants.
- `node tests/referral-routes-offline.test.js`: PASS actual route handlers against isolated dependency stubs: authentication/config guards, provider/DB failures, safe errors, confirmation statuses and referral return URL.
- `node tests/workspace-settings-qa.js`: PASS at 390/1440; prior settings/roles/theme/projects checks updated for the redirect.
- `node tests/account-published-templates.test.js`: PASS; built-in published presentation and non-public/deletion semantics preserved.
- `npm run test:polish:offline` and `node tests/free-release-policy.test.js`: PASS.
- Screenshots in `audit_results/profile-settings/` use explicitly named Preview Creator fixtures in isolated browser interception. These are NOT real account records and were never persisted/published.
- Real Google provider, device push permission, live profile writes and real-phone hardware were not exercised by this UI change.

## Referral activation gate — rechecked 2026-10-05

- A read-only transaction against the configured remote database found none of the referral tables or the required `users.email_verified_at` / `credits.bonus_credits` columns. No production rows or schema were changed.
- Local `REFERRALS_ENABLED` is false; `RESEND_API_KEY` + `AUTH_FROM_EMAIL` are not configured. Do not switch referrals on against this database yet.
- Existing 2026-10-02 real PostgreSQL/HTTP evidence remains saved in `audit_results/postgres-isolated/referral-http-evidence.json` (actual MP4 export, 10+10 rewards, replay/refund checks; verification token injected for QA, not delivered by email). This turn could NOT rerun that integration: Docker Desktop/its Linux engine did not start. Browser and route-stub tests are current; the earlier DB evidence is explicitly historical.
- Before activation: recover the isolated QA engine without factory-resetting user data; rerun `node tests/run-postgres-http-qa.js tests/referral-export-http.test.js` and PostgreSQL access/cap/rollback tests; review production backup and the existing `supabase/migrations/20260930165509_referral_bonus_credits.sql`; apply through the normal authorised migration workflow; verify RLS/revokes/app-role grants; configure a verified Resend sender and secrets; verify actual inbox delivery and a controlled export/reward; then enable referrals and deploy. No frontend-only reward or fake success is permitted.

## Rollback

Baseline local tag: `rollback/profile-settings-before-20261004`, commit `63d59087dfdf8e95c9a03a9c5615cbb082731b8d`.

This feature is saved in one separate local commit, tagged `profile-settings-preview-20261005`. If the design is rejected, with a clean worktree run:

```powershell
git revert profile-settings-preview-20261005
```

This creates a reversal commit for only this feature; it does not erase unrelated work or Git history. Stop and resolve any newer overlapping edits instead of using a hard reset. No push is needed while reviewing locally. If later deployed, deployment of the reversal is a separate authorised step.

The user's latest layout revision is saved separately as `profile-settings-referral-preview-20261005`. To undo only that revision:

```powershell
git revert profile-settings-referral-preview-20261005
```

To return all the way to the original pre-merge profile, revert the revision first, then `profile-settings-preview-20261005`. UI rollback does not delete any account or referral data. No migration was applied by either preview.
