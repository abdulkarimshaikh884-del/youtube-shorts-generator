# Remaining mobile pages — 24 October 2026

Local presentation pass on the reviewed release worktree. Not published.
The main checkout's unrelated engine work is untouched.

## Implemented

- Compact tutorial, project and public-creator cards; two-column collections.
- Compact profile header, settings links and all routed account detail panes.
- Smaller form headings/gaps/buttons; input text stays 16px to avoid phone zoom.
- Swipeable plan/Star-pack rows, retaining every configured price and entitlement.
  The existing calculator recommendation now has a real `#plans` destination.
- More concise Help/legal/contact/404 presentation without removing their text.
- Smaller animation/design editor toolbars and panels, keeping existing behavior.
- Dedicated Reference Motion styling; offline, scope and processing-consent
  notices remain visible. No processing or model behavior changed.
- Compact admin chrome; original permission and record controls retained.
- Tutorial creator images fall back to real name initials when unavailable;
  the shared page builder retains the same tested behavior.

## Verification

144 focused automated checks pass, plus JavaScript/whitespace checks. These are
source/behavior contracts, not proof that the product's AI features are complete.

Actual Chrome UI evidence was captured from the loopback-only read-only preview:

- Full-page 390px captures: community, account, credits, projects, pricing, Help,
  feedback, edit profile, notifications, support, referrals, followers/following,
  creations, public creator, template detail, admin, about, privacy, terms, 404,
  login/signup/password recovery and both editors/Reference Motion.
- 320px geometry: Animations, community, account, credits, referrals,
  notifications, projects, pricing, Help, feedback and Reference Motion all have
  document scroll width equal to client width. Native Design Studio also fits.
- All 14 admin sections were selected through the real section selector at
  320px; each opened its correct panel without document horizontal overflow.
- At 1440px, community/account/pricing/contact retained normal desktop sizing.
- Animation editor: Preview/Edit/AI tabs and export-options dialog open/close.
  Design Studio: Layers opens and Done returns to canvas; title input stays 16px.
- Empty login password visibility toggle works; no credentials were entered.
- Pricing slider updates its recommendation, `#plans` scrolls into view, and
  every paid purchase button remains disabled.
- Unavailable tutorial avatar images show initials rather than broken icons.

## Evidence

Screenshots are private local artifacts under
`audit_results/mobile-compact-20261024/before/` and `after/`.
`after-sheet-1.jpg` summarizes account, tutorials, feedback, Help, login and pricing.
The before folder contains selected start-of-pass captures, not a pristine
baseline for every screen; parallel CSS work may already affect some captures.

The preview uses public catalog GETs and labeled synthetic account/admin data;
My Projects may also display existing browser-local drafts. It is not evidence
of production saves, billing, AI generation, conversion or export completion.
No production payments, notifications, emails, uploads or record mutations were
performed; the fixture refuses API writes.

## Boundaries

Browser emulation was light mode, not physical-phone, iOS/Safari, dark-mode,
virtual-keyboard or exhaustive modal-state certification. Long legal content
and genuine project libraries still scroll; information was not hidden to make
the page artificially shorter. Alias routes and auth/permissions retain their
existing contracts. No production deployment or paid resource change occurred.

## Follow-up: menu, notifications and three Home animation rows

Completed locally on 25 October after the supplied marked screenshots:

- Removed Publish Template and Profile only from the mobile drawer in the
  shared builder and matching shell documents. Bottom Profile and existing
  Upload entry points remain. Drawer rows are 32px with bounded internal scroll.
- Notification dropdown uses smaller text, avatars and controls; its scroll
  area remains within the phone viewport above the bottom tabs. Options expand
  inline so the last notification's actions do not clip. Account notification
  feeds keep their own styles. Opening, outside dismissal, Escape and focus
  return were checked without reading/deleting/muting alerts or enabling push.
- Home reuses its existing ten templates in three rows on phones, with one
  shared horizontal scroll area. Designs and tutorial carousels retain one row.
  Desktop retains five columns and two rows. The last template is reachable by
  keyboard focus without document horizontal overflow.
- Fixed an actual filtering bug: the empty-state node is never counted or
  mounted as a template when clearing a search.

Chrome checks covered 320x568, 378x642, 390x844, 640x360, and desktop 1440x900.
At 320px, scrollbar-aware notification width fixed a negative left edge found
in the initial check. At 378px, the settled drawer height is about 381px;
notifications are about 321px high and bounded at 370px before scrolling.
The short landscape view scrolls panels internally. Home has three measured
row positions at 320px and 378px; desktop retains two rows.

The focused suite now passes 150 tests including six new menu/gallery tests.
Syntax and whitespace checks pass. These results describe local presentation
and existing controls, not production notification delivery or AI behavior.
No deployment occurred.

Actual CUA captures are in the audit folder root:
`menu-378.jpg`, `notification-378.jpg`, `notification-320.jpg`,
`notification-options-378.jpg`, `home-three-rows-detail-378.jpg`, and
`menu-notification-three-rows-review.jpg` (a labeled contact sheet of captures).
