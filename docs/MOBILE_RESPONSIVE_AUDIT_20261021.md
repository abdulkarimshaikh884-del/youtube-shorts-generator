# Mobile responsive audit — 2026-10-21

Scope: customer-facing ShortsCraft pages from first content to footer, navigation,
account detail screens, editors and owner/admin views. Preserve the desktop
experience, authentication, private assets, generation, billing and saved work.

This matrix has **37 route entries**, including aliases and an unknown-route 404
check. It does not mean 37 unique page designs. Query/hash states add interaction
coverage without introducing more route definitions.

## Before

Baseline is the existing release worktree and actual browser observations before
the new shared responsive layer. The primary dirty checkout is not the release
source and is not reset, stashed or overwritten by this audit.

| Finding | Evidence status before changes | Intended bounded correction |
| --- | --- | --- |
| Home full page is about 12,054 px tall at the audited mobile viewport | Parent browser capture/measurement; desktop is not evidence for this | Improve mobile density, gallery height and section rhythm |
| Designs heading/actions appear cramped | Parent visual observation | Stack heading, search and primary action coherently |
| Animations includes excessive whitespace; a filter flex-basis conflict makes its horizontal strip about 360 px tall | Parent visual observation and source diagnosis | Reset the strip's phone flex basis instead of hiding the empty space |
| Shared footer is over 700 px tall | Parent visual observation | Compact mobile grouping while retaining every destination |
| Admin retains a 64 px icon-only rail on phone | Browser-visible and source-confirmed | Provide phone navigation without consuming permanent canvas width |
| `mobile.css` is followed by other styles despite its comment claiming it loads last | Source-confirmed stylesheet order | Load `/mobile-20261021.css` last consistently |
| Account detail content moves from `.pf-settings` into `.pf-detail`, while some responsive rules still match only `.pf-settings` | Source-confirmed risk; not every affected view visually verified yet | Extend only relevant account scopes after checking the real detail screens |
| Global body `overflow-x:hidden !important` can hide clipped controls | Source-confirmed risk; not by itself proof of a visible defect | Check element bounds and actual reachability, not only page scroll width |
| Touch sizing ranges from 30–44 px across conflicting style layers | Source-confirmed risk | Use consistently usable targets without making every screen excessively tall |
| Editors use separate mobile layout systems and breakpoints | Source-confirmed | Audit Studio, Design Studio and Reference Motion independently |

No unresolved source risk in this table is automatically a confirmed visual bug.
Before/after artifacts must identify the route, viewport, state and whether the
data is production-read-only or a local fixture.

## After

The responsive implementation has been reviewed in Chrome using CUA. These
results are a bounded mobile-interface pass, not certification of the AI engines.

| Verification | Current boundary |
| --- | --- |
| Shared final stylesheet integration | PASS: one final stylesheet on all 23 canonical customer documents; generated and hand-maintained pages remain separate |
| Route inventory | 37 route entries including aliases and404; source coverage is not a claim of37 unique layouts |
| Before/after screenshots | Actual live baseline full-page screenshots; after screenshots use the real files with anonymous public design/tutorial catalog and clearly synthetic account/admin data |
| Narrow-screen clipping | PASS:37/37 route entries at320px after repairs; visible text/control bounds checked as well as document scroll width |
| Tablet clipping | PASS:37/37 route entries at768px; intentional inner horizontal galleries/tables are not treated as document overflow |
| Mobile interactions | Menu, upload sheet, notifications menu, follow-list loading, referral link, Admin section chooser and table/card toggle inspected without submitting data-changing actions |
| Editors | Preview/Edit panels and export options inspected; all six Design Studio tools; both editors at320x568,390x440 and844x390 with bottom navigation in viewport |
| Admin | All14 permission-controlled section choices inspected in safe owner fixtures; record-management dialog opened/closed without executing changes |
| Desktop preservation | Seven representative routes at1440px have normal desktop rails/workspaces and no document overflow |
| Focused regressions |95/95 Node contracts passed: mobile integration, Admin cards, follow boot order and unchanged PC-reference boundaries; not full engine-quality approval |
| Production publication | UI-only release to the existing free service; exact live revision and final production spot checks are recorded in the handoff, not inferred from local tests |

Private, ignored evidence root: `audit_results/mobile-20261021/`. `before/` and
`after/` retain full-page captures; `narrow-final.json`, `responsive-checks.json`,
`admin-checks.json`, `design-panels.json`, `workspace-checks.json` and
`desktop-checks.json` hold the browser measurements. Some full-page captures
include lazy preview placeholders; a long-page screenshot does not establish
playback. Chrome occasionally returned a stale screenshot immediately after a
transition; key dialog/viewport evidence was re-observed before the final review.

Actual repairs include the360px filter flex-basis becoming height on phones,
viewport-width shell sizing, last-in-cascade mobile styles, home swipe galleries,
two-column footer, visible menu action labels,44px buttons, wrapping project-card
actions, dedicated account-pane sizing, native-height export options, readable
Admin records and the real follower-list authentication boot-order defect.

## Evidence boundaries

- Static contracts prove route coverage, responsive viewport metadata, enabled
  browser zoom and final stylesheet order. They do not prove visual quality.
- Browser viewport emulation is not physical devices testing. Real iOS Safari,
  Android Chrome, safe-area cutouts, browser chrome and on-screen keyboards have
  not been fully certified unless separately recorded.
- Current phone/tablet review uses browser-emulated 320, 390 and 768 px widths;
  the exact routes/states observed at each width must be recorded with captures.
  Do not imply that every route has already passed every width.
- Full-page screenshots establish top-to-bottom layout. Fixed editors, drawers,
  dialogs, menus, inner scrolling regions and keyboard-short viewports need
  additional viewport screenshots and interaction checks.
- A hidden horizontal scrollbar is not acceptance. Controls must be visible,
  legible and reachable; inner table scrolling must be discoverable.
- A local fixture is not live account data or real backend functional evidence.
  Empty/error fixtures do not substitute for populated gallery/account/admin
  screenshots. Do not report an HTTP 200 or valid JSON as mobile UX approval.
- No real signup, password reset email, payment, export, AI generation, template
  clone, moderation, broadcast, logout or account mutation is required merely
  to inspect responsive layout.
- Opening a named animation in the live Studio auto-created its normal owned
  sample draft before subsequent editor checks were moved entirely
  into the read-only fixture. No existing draft was edited or deleted. Fixture
  API writes return405; local browser drafts are not production save evidence.
- Screenshot artifacts stay private in the ignored local audit directory.
  Capturing an authenticated view does not authorize publishing customer data,
  reference images, private project assets or account details.
- Do not navigate/reload a user's pending private reference-video handoff tab.
  Use a separate read-only live audit tab or an explicitly labeled fixture.

## Route matrix

For each distinct canonical screen capture a full-page before/after mobile view
where document scrolling exists. The main comparison viewport is 390 px wide;
check 320 px narrow, 768 px tablet and desktop separately. Aliases require route
resolution checks, not duplicated identical screenshots.

| # | Audit URL | Data/auth requirement and state |
| --- | --- | --- |
| 1 | `/` | Guest and signed-in shell; populated libraries, full footer |
| 2 | `/animations` | Populated templates and filter/search controls |
| 3 | `/designs` | Populated designs, search/header and upload entry |
| 4 | `/community` | Populated creator tutorials; empty/error supplementary |
| 5 | `/pricing` | Guest and plan-aware signed-in presentation; do not purchase |
| 6 | `/tutorials` | Help/tutorial content, long sections and footer |
| 7 | `/about` | Entire static document |
| 8 | `/contact` | Form, guidance and footer; no submission needed |
| 9 | `/privacy` | Long legal text and footer |
| 10 | `/terms` | Long legal text and footer |
| 11 | `/login` | Guest form; error/success guidance only with safe fixtures |
| 12 | `/signup` | Guest form; no real account creation needed |
| 13 | `/forgot-password` | Guest form; do not send a real email for screenshots |
| 14 | `/reset-password` | Missing/invalid-token state plus isolated valid-token fixture |
| 15 | `/creator?handle=shortscraft` | Real public creator or labeled populated fixture; unknown creator separately |
| 16 | `/template?id=original-chat-story` | Real built-in template, details, comments and controls; unavailable separately |
| 17 | `/drafts` | Owner projects and `#published`; populated and empty states |
| 18 | `/account` | Owner profile/settings hub; guest gate separately |
| 19 | `/account/creations` | Owner populated creations and empty state |
| 20 | `/account/edit-profile` | Owner fields and final save controls; avoid real saves |
| 21 | `/account/credits` | Owner account overview, earnings and transaction history |
| 22 | `/account/notifications` | Populated notifications, permission prompt, menus and empty state |
| 23 | `/account/support` | Owner ticket list/details and support form; no real submission |
| 24 | `/account/referrals` | Owner invite link, stats, verification/history and unavailable state |
| 25 | `/account/followers` | Owner populated and empty list |
| 26 | `/account/following` | Owner populated and empty list |
| 27 | `/editor` | Blank and named-template Studio; see interactive-state matrix |
| 28 | `/design-editor` | Local default native layers; owner saved project only when available |
| 29 | `/reference-motion` | Feature-gated; guest/offline/upload/result fixtures and owned saved draft |
| 30 | `/admin` | Guest denial and owner fixture; all 14 hash sections |
| 31 | `/help` | Alias serving tutorials; retain working final destination |
| 32 | `/settings` | Client redirect to account, query/hash retained |
| 33 | `/uploads` | Server redirect to `/drafts#published` |
| 34 | `/account/appearance` | Redirect to account; visiting must not change theme |
| 35 | `/account/earnings` | Redirect to `/account/credits` |
| 36 | `/account/logout` | Redirect to account; visiting must not log out |
| 37 | `/mobile-audit-missing-page` | Unknown route: branded 404 content and HTTP 404 |

Direct `.html` suffixes render the same customer documents. Internal player
documents (`/player.html`, `/swishy-runtime.html`) and standalone template preview
documents are not separate customer navigation pages. Retired generator/SEO
URLs intentionally redirect to `/animations`; they are not missing screens.

## Interactive states

| Surface | States to inspect | Safety/fixture notes |
| --- | --- | --- |
| Global shell | Mobile menu open/closed, notification panel, share dialog, long filename chip, bottom navigation and footer links | Separate live tab; no irreversible action |
| Library | Filters/search, populated grids, unavailable image, tutorial cards, upload dialog and local-file error/recovery | Dialog inspection does not certify conversion |
| Account | Permission row, notification item menu, transaction overflow, long invite link/email, follower list, support ticket | Use owner data only; destructive actions not submitted |
| Animation Studio | `/editor?tpl=original-chat-story`; Canvas/Edit/AI; advanced settings; export popup; publish modal; portrait/landscape/short viewport | A named-template page is additional state, not another route definition |
| Design Studio | Text/Images/Shapes/Backdrop/Layers; inspector; save status; load error; publish modal and export UI | `?tpl=<id>` POSTs a template clone: avoid on live read-only audit; use default or isolated fixture |
| Reference Motion | Guest; signed-in worker offline; file-ready; reconstructed layers; original/result comparison; seek bar; quality details; review/export | `?handoff=<token>` consumes private IndexedDB handoff; `?draft=<id>` must belong to the owner |
| Admin | `#overview`, `#users`, `#creators`, `#content`, `#skills`, `#reports`, `#withdrawals`, `#stars_ledger`, `#star_packs`, `#ai_jobs`, `#broadcast`, `#team`, `#support`, `#system` | Owner-only labeled fixtures; inspect detail drawer and long support content without submitting operations |

## Maintenance and repeatability

- Use `build_pages.js` for generated screens. It deliberately preserves the
  hand-maintained account, settings, admin and designs documents. Do not run a
  broad build that silently replaces reviewed application forms.
- Both standalone editors and Reference Motion are maintained independently;
  they need explicit final-layer inclusion, not a shell-only assumption.
- `node --test tests/mobile-responsive-contract.test.js` is read-only and has no
  network or application-server boot. It intentionally fails when a new route,
  admin panel or customer document is omitted from the coverage contract.
- Existing `tests/mobile-layout-qa.js` is not exhaustive visual evidence: it
  samples a limited screenshot subset and omits dedicated account/reference
  states. Existing browser fixture results must be reported as fixture results.
- Add actual screenshot artifact paths and review outcomes before closing this
  audit. Keep separate BEFORE and AFTER evidence and preserve the original
  baseline rather than overwriting it with the new appearance.
