# Admin Console review flow

Scope: Admin Console only, using the currently deployed mobile release as the baseline. Preserve all fourteen sections, permission checks, audit logging, financial controls and public asset privacy.

1. Inspect: dashboard review queue currently offers immediate decisions without media; animation View opens a public page that cannot load pending content; names in Users are plain text. A protected design preview exists but is hard to discover.
2. Review: open the submitted animation or design in an accessible dialog on the same page. Read the exact saved properties through a permission-gated endpoint. Render through first-party controlled components in an opaque sandbox. Never publish content to make its preview work. Show unavailable/unsupported content explicitly.
3. Decision: show title, creator, status, dimensions/duration and review note beside the preview. Offer labeled approval/rejection controls after media loads; retain required rejection reasons and existing audit writes. Preview itself is read-only.
4. People: make real handles clickable in Users, Creators, submissions and recent joins. Accounts without public handles retain an account-management route; never derive a fake public handle from email.
5. Interface: retain desktop hub navigation; add clear mobile shortcuts and the complete section selector. Use readable cards and labeled actions with compact spacing. Wide preview on desktop, contained media and reachable controls on phone.
6. Evidence: real-module API permission/privacy tests plus local synthetic review fixtures for browser interactions. Verify animation playback, protected design layers, tutorial preview/fallback, profile navigation, failed preview state, rejection reason, section switching, focus, mobile/desktop fit. Distinguish fixture results from production content. No production approvals, account edits, payments or deployment during implementation.
