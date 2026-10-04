# Reversible Profile + Settings preview — 2026-10-05

Implemented locally only. Not pushed to GitHub or deployed to production.

## Layout and behavior

- Profile header retained; two primary tabs: Creations and Settings.
- Settings groups reuse the original form/pane DOM nodes and their API handlers, not duplicate IDs or a new database.
- Edit profile; account/Google sign-in/credits; appearance; device notifications; read-only Earnings & Stars; help/support history; referrals when enabled; authorised Admin Console; logout.
- Public creator profile is unchanged. Signed-out users see the login gate and an appearance control, not private settings. Admin visibility follows existing role/permission logic; server authorization remains unchanged.
- `/settings` redirects to the account workspace, preserving query/hash and verification/OAuth return paths. Legacy account hashes remain usable. Sidebar Settings goes to `/account#settings`.
- No new financial capability or referral rollout. Existing server-side free-release locks retained.
- `public/account.html` and `public/settings.html` are canonical hand-maintained pages. The page builder preserves them instead of regenerating obsolete layouts. Other generated pages retain their existing build flow.

## Verification

- `node tests/profile-settings-qa.js`: PASS at 320/390/768/1440 in both themes; tab switching, hash routing, theme reload persistence, unique IDs, grouped panels, guest/admin/public-profile boundaries, mocked profile save/error/cancel, keyboard navigation and builder-preservation checks.
- `node tests/workspace-settings-qa.js`: PASS at 390/1440; prior settings/roles/theme/projects checks updated for the redirect.
- `node tests/account-published-templates.test.js`: PASS; built-in published presentation and non-public/deletion semantics preserved.
- `npm run test:polish:offline` and `node tests/free-release-policy.test.js`: PASS.
- Screenshots in `audit_results/profile-settings/` use explicitly named Preview Creator fixtures in isolated browser interception. These are NOT real account records and were never persisted/published.
- Real Google provider, device push permission, live profile writes and real-phone hardware were not exercised by this UI change.

## Rollback

Baseline local tag: `rollback/profile-settings-before-20261004`, commit `63d59087dfdf8e95c9a03a9c5615cbb082731b8d`.

This feature is saved in one separate local commit, tagged `profile-settings-preview-20261005`. If the design is rejected, with a clean worktree run:

```powershell
git revert profile-settings-preview-20261005
```

This creates a reversal commit for only this feature; it does not erase unrelated work or Git history. Stop and resolve any newer overlapping edits instead of using a hard reset. No push is needed while reviewing locally. If later deployed, deployment of the reversal is a separate authorised step.
