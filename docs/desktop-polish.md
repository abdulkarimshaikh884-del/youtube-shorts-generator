# Desktop polish, 8 October 2026

Scope: the user's desktop requests 1–14. Subsequent Referral/Admin work is
documented in referral-admin-release.md; further mobile-specific requests remain
deferred. Money features remain disabled/Coming Soon. The evidence below was
collected locally and must not be presented as production test results.

## Implemented

1. Animation popup: Replay removed; Like, Share and Report fit without clipping.
2. Animations search beside the heading; existing sorting/source/category logic retained.
3. Designs: wider search and combined free/premium, publisher and category filters.
4. Design preview shows the publisher avatar, verified badge and handle.
5. Tutorials search by title, description, platform and creator.
6. Home and Designs share the same thumbnail cards, menus, real persisted likes
   and compact premium labels. Delayed reaction reads cannot undo a newer click.
7. Redundant home section eyebrow labels removed; shorter title/subtitle layout.
8. Guest appearance control separated from the login actions.
9. Creations use four compact columns on desktop, with responsive fallbacks.
10. Optional public creator type, niche, languages, business contact, portfolio,
    Telegram, X, LinkedIn and TikTok fields. Server validation and durable storage;
    Cancel and Save adjacent. These fields are NOT authorization or payout/KYC data.
11. Shared dialog offers WhatsApp, Telegram, X, Email, optional native share and
    explicit Copy link. Opening Share never copies automatically.
12. Account overview, Earnings/Stars, existing payout history and the real credit/
    Stars/payment ledger combined under Account & Earnings. Old earnings URL redirects.
13. Full notification page uses the bell's actual feed, read actions, retry and
    Show more (existing API maximum: 50 recent notifications). Push success hides
    the on/off button; browser permissions remain manageable in browser settings.
14. Appearance and Logout last in Settings. Theme changes inline; logout confirms.

Notification follow-up: dedicated-page headings now have an icon-only back link.
Notifications has one heading with Mark all read beside it, no duplicate/device
explanatory block. The permission prompt disappears completely once enabled.
Every notification has a keyboard-accessible three-dot menu in both the full page
and bell. Delete removes only the account-owned row; Mute/Unmute similar alerts
persists per account and type/entity category. History remains visible, but muted
categories do not count as unread, trigger live toasts or send Web Push. Unmute
resumes future alerts without replaying the backlog. Email security messages are
unaffected. `tests/notification-controls-qa.js` verifies actual local PostgreSQL/
HTTP ownership, persistence, push selection, failed actions, and light/dark
390/1440px rendering; permission transport alone is simulated.

## Verification and boundaries

- `node tests/desktop-polish-qa.js`: isolated fixture browser checks, visual evidence
  in `audit_results/desktop-polish/`, including light/dark and 390/1440px fit.
- `node tests/profile-settings-qa.js`: 320/390/768/1440px profile/settings regression.
- `node tests/workspace-settings-qa.js`: guest/user/admin visibility, theme persistence.
- `node tests/run-launch-offline-qa.js`: 19 existing offline release suites.
- Owned local PG17 via `tests/run-postgres-http-qa.js`: new profile/history/like
  HTTP tests plus `verify_auth.js`, `verify_notifications.js`, free release policy.
  No production accounts, transactions, emails or gateway calls are made.
- Browser screenshots use explicitly isolated fixture data. Real phone push
  delivery and cross-email-client rendering are not certified by this UI pass.
- Supabase security advisor checked read-only: backend-only tables retain RLS
  with no public policies (intentional default-deny). Its existing Supabase Auth
  leaked-password warning is separate from this app's custom auth. No permissions
  or production settings were changed by this pass.

## Interactive preview catalog

`node tests/browser-preview.js` serves the isolated local app at
`http://127.0.0.1:3341`. Its test database does not contain production uploads.
For catalog review, startup reads only the live site's public Designs and
Tutorials GET endpoints into an in-memory snapshot, resolving public media on
the live origin. No production database, private accounts or write requests are
used. Likes and free design copies remain in the isolated local database; public
catalog changes appear after restarting the preview. This is a discovery/layout
preview, not a production account or publishing mirror. External email, AI and
payment providers remain disabled.

`node tests/preview-catalog-qa.js` checks the actual local server without catalog
mocks: real cards, decoded sample images, filters, tutorial title/creator search
and removal of the workflow separator. Evidence is in
`audit_results/preview-catalog/`.

## Release order

1. Review the local screenshot gallery and this scoped diff.
2. Apply `supabase/migrations/20261008163422_creator_profile_details.sql` and
   `supabase/migrations/20261008181456_notification_mutes.sql` to the
   intended production project through the normal migration workflow. It only
   adds a bounded JSONB column to users and backend column permissions; the
   notification migration adds a private RLS-enabled backend-only mute table. Do not
   grant anon/authenticated access to the private users table.
3. Verify that column and the mute table exist and the backend role has the
   documented permissions; then deploy
   the code. The creator-profile query requires this migration BEFORE deployment.
4. Smoke-test the live profile save/reload, discovery, notifications and ledger
   with an authorized test account. Keep money flags disabled.

The pre-change Git baseline is `codex/pre-ui-polish-20261008` at
`d50e2f2d4eba61947af9874f5f566d862671c5ac`. Preserve unrelated local changes;
use a scoped revert if rollback is needed, not a hard reset.
