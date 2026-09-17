# Mobile layout handoff

## Scope

Local responsive UI improvements, preserving the existing uncommitted work.
No deployment, database changes, real accounts, uploads, purchases, credit use,
or AI generation were performed. No test records were added to the product.

## Changes

- Shared phone layout: smaller header/bottom navigation, less promotional
  decoration, compact headings/forms/pricing/help cards, readable input sizes.
- Gallery: restore full portrait previews instead of cropping them into landscape
  thumbnails; restore template titles and creator links; larger like targets.
- Account: compact avatar/header/actions, accessible four-column tabs, smaller
  account shortcuts and Creator Studio statistics.
- Upload modal: bounded phone-height dialog with independently scrolling body.
- Dark theme: fix mobile heading, button and selected-category contrast.
- Studio through 1024px: bottom workspace tabs, viewport-sized preview/timeline,
  real preview retained while editing, independently scrolling properties,
  content-first fields with expandable style/layout controls.
- Studio preview uses a stable logical iframe size on mobile and scales to fit,
  avoiding text reflow when moving between Preview and Edit.
- VisualViewport resize handling accommodates the on-screen keyboard without
  fighting pinch zoom. This still needs a physical iOS/Android check.
- CSS/JS cache keys bumped; 20 static pages rebuilt using build_pages.js.

## Verification

Run a database-free static preview:

```powershell
node tests/polish-preview-server.js
```

In another terminal:

```powershell
node tests/mobile-layout-qa.js
```

This test blocks external requests and all API writes; read-only browser test
fixtures exercise signed-in layouts without touching the database.

- 20 generated public/account/auth routes at 320, 390, 768 and 1440px widths.
- Studio panel geometry at 320, 390 and 768px (89 total layout observations).
- Actual field input reaching the preview iframe at 320x568, 390x844,
  844x390 landscape and 1024x768 tablet sizes.
- Preview/timeline reachability, expanded advanced controls, last property
  reachability, Export options/cancel, AI composer, menu/Escape, profile form,
  upload dialog and light/dark screenshots.
- Screenshots and machine-readable results: audit_results/mobile-layout/.
- node --check public/editor.js passed.
- Scoped git diff --check passed.
- tests/polish-backend-offline.test.js and tests/draft-sync-offline.test.js passed.

## Boundaries / existing test issue

- This is Chromium responsive emulation, not testing on a physical phone.
- Signed-in layouts use isolated fixtures, not real authentication verification.
- No paid export, real upload publication, checkout or AI-generation end-to-end
  tests were run. Admin authenticated content is not comprehensively validated.
- verify_polish_offline.js currently fails because its extracted gallery-mount
  test context omits the existing tileAspect variable used by shell.js. This
  older test-harness issue was observed, not introduced or silently suppressed.
- Existing unrelated edits, including server.js and shell.js, remain untouched.
- One comprehensive rerun timed out waiting for a Studio text edit to reach the
  preview. A focused rerun and the final complete 89-observation run passed;
  the timeout was not reproduced and its cause is not confirmed. The test now
  logs frame/field diagnostics on recurrence and always closes its browser.

## Before deployment

1. Review this diff together with the already-uncommitted changes.
2. On a real Android phone and iPhone check typing, keyboard dismissal,
   rotation, scrolling, file picker and template preview in both themes.
3. Validate authenticated save/upload/export against a staging account.
4. Deploy only after approval; verify new asset cache keys on the live domain.
