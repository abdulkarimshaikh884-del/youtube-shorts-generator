# Small accents and loading feedback — 2026-10-05

Local revision, not deployed. No schema, theme preference, media, billing or referral-policy change.

- Existing black/white Light and Dark palettes and neutral primary buttons remain. Soft teal highlights are limited to workflow labels, featured-plan borders, active navigation icons, credit text and hover details; the middle workflow step uses soft amber.
- `finishing.css` and `finishing.js` are included by all 25 public app HTML pages, including both editors, and the shared page generator. Versioned URLs refresh changed CSS/handlers without clearing user preferences.
- Short press/hover feedback and one-time viewport entrances do not gate access to content. No animation is applied inside template previews or to the design canvas. The old gallery animation no longer locks its final transform or retains permanent `will-change` on every card.
- A pointer-transparent, 3px indeterminate indicator appears only while same-origin API fetches are pending for at least 240ms. Concurrent requests keep it active until all settle. Responses, original promises, AbortSignals, credentials and rejection behavior are preserved. No synthetic percentage, request retries, API calls or database writes are added. It measures network response arrival, not the full export/render job; the existing export lifecycle has its own busy spinner.
- Login/signup, password reset, feedback, profile save and MP4 export use `aria-busy` spinners alongside their existing real status text. Designs has a labelled loading state and clears busy only for the current request, including empty/error results.
- Reduced-motion disables the added movement; pending activity remains visible as a static bar with accessible loading text. Keyboard focus, disabled Coming Soon buttons and touch sizes are unchanged.

## Verified

- `node tests/finishing-ui-qa.js`: seven surfaces at 390/1440px, both themes, neutral palette unchanged, no horizontal overflow, screenshots; slow/concurrent/fast/aborted/503 requests, feedback busy lifecycle and reduced motion. API responses are isolated browser fixtures, never real records.
- `node tests/profile-settings-qa.js --flows-only`: account navigation, save/error/cancel, role/privacy/keyboard and referral UI regressions.
- `npm run test:polish:offline`, `node tests/free-release-policy.test.js`, `node tests/account-pages-http.test.js`, JavaScript syntax and `git diff --check`.
- Screenshots visually reviewed under `audit_results/finishing/`. Physical-phone performance and live provider delivery are not certified by these tests.

## Rollback

This change is saved separately as `interface-finishing-preview-20261005`. Use `git revert interface-finishing-preview-20261005` to undo this layer, preserving earlier dedicated account pages. No database rollback is required. Live deployment is a separate action.
