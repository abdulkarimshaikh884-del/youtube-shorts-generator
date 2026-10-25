# Independent Home carousels and push configuration guard

Local review only; no production deployment, billing/configuration change or
browser notification permission change was performed.

## Changes

- Phone Home has three animation rows, two design rows and two tutorial rows.
  Each row owns its scroll container. Original card nodes and handlers move
  rather than being cloned. Balanced contiguous groups retain canonical order;
  breakpoint restoration, hidden results and asynchronous catalog repaint are
  handled. Desktop receives the original flat collection, without wrappers.
- Pricing cards use aligned plan/price typography, a fixed feature divider,
  smaller natural-height content and a top-right featured badge. Star packs
  use a compact quantity/price layout. Existing prices, entitlements and
  disabled purchase states were retained.
- The read-only preview's `/api/push/key` deliberately returns `enabled:false`
  and an empty public key. The old client ignored that flag, decoded an empty
  key, requested permission and called PushManager.subscribe, causing the
  supplied browser error. The client now validates availability and the real
  P-256 point before permissions, service-worker registration or subscription.
  The preview shows device notifications unavailable, with in-app alerts kept.
  This does not establish production push delivery; that still needs valid
  server keys and an authorized subscription/delivery test in its environment.

## Actual verification

Chrome at 378x642: all seven rows were individually scrolled through actual
keyboard focus. For every row its scrollLeft increased while neighboring
rows' positions stayed unchanged (within 1px). Measurements are saved in
`audit_results/mobile-independent-20261025/independent-scroll-checks.json`.
The final screenshot moves only animation row 1, leaving rows 2 and 3 at start.

At 320x568: row counts remain 3/2/2 with no document, pricing-card or Star-card
horizontal overflow. At 1440x900: zero mobile row wrappers and original
10/12/8 direct cards are restored. The browser reported no console errors.
Notification panel showed the unavailable copy and no Turn on button;
browser permission was not requested during review.

157 focused tests passed, with no skips/failures. New tests execute node
movement/restoration, hide/clear and renderer repaint, disabled/malformed keys,
an invalid P-256 point, and a valid generated P-256 key through an inert consent
and subscription harness. These are control-flow checks, not real push delivery.
Syntax and whitespace checks passed.

Screenshots and labeled contact sheets are in the same audit directory.
Browser emulation was Chrome light mode; physical-device touch/iOS testing
and live push delivery remain outside this local review.

## Profile header follow-up

The account header now follows photo/name/handle, social counts, bio, then
Stars/Share/Edit. Original control IDs and route handlers remain intact.
Phone controls share equal column widths; desktop actions remain beside the
name. Builder and canonical account header match. Chrome checks at 320px and
378px found no overflow; Edit opens the existing form and Stars opens Account
& Earnings. Share-to-Edit keyboard order matches the phone layout. The share
control remains unique/enabled; clipboard sharing was not invoked. Desktop
1440px keeps the identity/actions beside each other. Eight relevant existing
checks and whitespace/syntax checks pass. No deployment occurred.
Screenshots: `profile-order-378.jpg` and `profile-order-320.jpg` in the same
audit folder.
