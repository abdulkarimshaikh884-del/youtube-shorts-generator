# Designs failures: investigation and local repair

## Confirmed causes

- Read-only inspection of the configured database found 12 published official
  templates with empty `elements`. `dt_heygen_trick` had zero layers despite a
  working preview. The user's `dp_f94af186d78b` contained only their added heading;
  its clone provenance had also been replaced by `scratch` during autosave.
- The real converter wrote `assets/removal_mask.png`. Durable storage accepts
  only WebP assets, so successful conversion failed before saving assets. Earlier
  tests hand-built two WebP files and did not exercise this actual manifest.
- Text/colour/shape inspector changes redrew the canvas without saving. Undo,
  redo, visibility and lock changes also did not persist. Text without dimensions
  could not be hit-tested reliably.
- A two-line minimum title height reserved an empty line, plus publisher margins.
  Card options were absent; failed project/image loads were silently ignored.

## Changes

- Compact title/publisher spacing, independent three-dot options (view, edit,
  copy link, publisher), actual preview dialog, keyboard/Escape support and
  restrained mobile layout. Preview does not create a copy until Edit is chosen.
- Known empty built-ins receive the existing native definitions at read time.
  Five explicitly identified legacy aliases recover the definitions matching
  their confirmed bundled preview paths. All 12 official templates now return
  native layers through the actual local API. Existing nonempty records, unknown
  artwork, creator uploads, publisher attribution, premium restrictions and
  database records are not overwritten. Similar titles are not enough to match.
- The debug mask lives outside the publishable asset directory. Storage's path
  allowlist stays strict. Real conversion output now passes asset persistence.
- Load failures are visible, editing is gated during load, failed image requests
  do not loop, and incomplete assets cannot be exported as a misleading PNG.
- Metadata survives autosave; inspector edits, undo/redo, hide/lock and quick text
  edits persist. Added text has selectable bounds; constrained built-in headlines
  auto-fit. Known old empty copies offer a fresh-copy link without replacing
  their saved content.
- Browser cache versions updated and local `:3000` server reloaded.

## Evidence and limits

Passed: `design-storage-offline.test.js`, `design-assets-offline.test.js`,
`design-conversion-offline.test.js` (actual Sharp conversion then asset persistence
with an isolated transaction fixture), `designs-ui.test.js`,
`design-upload-flow-qa.js`, `design-mobile-qa.js`,
`design-editor-regression.test.js` and `npm run test:polish:offline`.

The editor regression uses real HeyGen image files and native layers, actual UI
selection/typing, storage-module save/reopen, undo/redo and PNG export at 1440 and
390 px. API/auth/database transport is isolated; it is not a production-write test.
Missing projects/images also fail visibly and block misleading exports.

`design-runtime-readonly-qa.js` checks the actual `:3000` app and configured database:
all known legacy definitions recovered, 14 HeyGen layers, previews, menus and
responsive layout at 1440/390 px. Application DML privileges were checked using
SELECT only. The application's schema-CREATE warning does not justify granting
extra privileges; existing tables remain usable. No live test records, schema
migration, credit charges, deletions or provider generation were performed.

Docker's local engine is unavailable, so new real PostgreSQL write tests remain
unverified. The AI provider and arbitrary-image segmentation quality are not
certified. Background repair/cropping is approximate and needs human review.
Legacy duplicate artwork/title mismatches and existing E2E-labelled public records
have not been renamed/deleted. Paid template unlocks remain Coming Soon under the
approved free-release policy. This change is local, not deployed live.
