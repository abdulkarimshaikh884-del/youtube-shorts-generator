# Separate account settings pages — 2026-10-05

Local preview revision only. Not pushed or deployed; no DB migration or provider configuration.

## Behavior

- `/account` retains the profile header, one divider and a Settings menu. Creations is first. Every menu row is a native link, not an accordion. Forms, grids and theme/logout controls are only visible on their destination pages.
- Separate URLs: `/account/creations`, `/account/edit-profile`, `/account/credits`, `/account/appearance`, `/account/notifications`, `/account/earnings`, `/account/support`, `/account/referrals`, `/account/logout`. Header counts also open `/account/followers` and `/account/following`.
- Detail pages show their own heading, relevant controls and Back to Settings. They do not repeat the profile header. Native browser back/forward, new-tab links, direct loads and refresh work. Logout requires pressing the real logout button on its confirmation page; following its link alone does not end the session.
- One canonical HTML shell preserves the existing IDs, handlers and access gates. `public/account-routes.js` is shared by Express, the browser and the DB-free preview server. `account-settings.js` moves original controls to page panels and converts the old template groups to native links before auth handlers bind; there is no duplicate page/form implementation.
- Legacy `/settings`, `/account#edit-profile`, `#account`, `#stars`, `#support`, `#referrals` and other known hashes resolve to the appropriate dedicated URLs, including same-document hash changes. Query parameters (OAuth errors, verification tokens) and guest login return paths are retained. Verification tokens are still removed after processing.
- Guests cannot see private panels. Admin Console keeps its existing server-authorised `/admin` destination and role-gated menu link. Public creator pages are unchanged.
- Unused wallet/support panels are no longer fetched on every account page. The menu fetches real creation counts but does not construct hidden animation previews. Referral requests only run on the referral page.
- Referral and financial activation gates remain unchanged. Missing production referral schema/email setup is not solved or claimed solved by these page changes. No fabricated production records or counters.

## Verification

- `node tests/profile-settings-qa.js`: 320/390/768/1440px, both themes; menu-only layout, native page navigation/back/reload, legacy links, keyboard activation, no overflow, privacy/admin gates, mocked profile save/error/cancel, referral UI/verification-return regression and canonical builder preservation.
- `node tests/workspace-settings-qa.js`: 390/1440px settings/role/theme/projects/legacy navigation regression.
- `node tests/account-published-templates.test.js`: built-in and uploaded publication/status/deletion rules on the dedicated Creations page.
- `node tests/account-pages-http.test.js`: actual server page-registration code served through real Express; all 12 routes return 200, HEAD/query preserved, unknown route returns 404. This intentionally excludes application DB/auth startup.
- `node tests/referral-routes-offline.test.js`, `node tests/free-release-policy.test.js`, `npm run test:polish:offline`, syntax checks and `git diff --check`.
- Browser screenshots under `audit_results/profile-settings/` are isolated, explicitly named Preview Creator fixtures; never persisted to production. Live database writes, real provider delivery and physical-phone testing remain outside this UI preview.

## Local server restart

New Express URL routes require restarting an already running `node server.js` process. Automated stop/restart was blocked by the tool policy; that command did not execute. In the terminal running the local server, press Ctrl+C and run `npm start` from `C:\Users\karim\kiroai\shortscraft`. The files are saved, but an old server process can return 404 for the new routes until restarted.

## Rollback

Saved as a separate local commit/tag: `account-settings-pages-preview-20261005`.

```powershell
git revert account-settings-pages-preview-20261005
```

This restores only this page-navigation revision, leaving the earlier Profile + Settings preview and unrelated files intact. Resolve newer overlapping changes rather than resetting the worktree. No schema rollback is needed, because no migration was applied.
