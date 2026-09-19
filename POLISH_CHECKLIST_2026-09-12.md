# ShortsCraft: September 12 stabilization pass

## Boundaries
- Preserve Claude's existing uncommitted page, auth UI and CSS changes.
- No deployment, remote schema changes, live test accounts or purchases.
- Current checkout starts at 3f73d46. Earlier audit findings require rechecking.
- Do not equate source-file storage with editable animation support.

## Work order
1. Recheck previous findings against current source.
2. Preserve creator configuration through gallery, modal, studio and detail previews.
3. Fix misleading missing-template states and publishing navigation/validation.
4. Check shared page styling and current public browser flows.
5. Record verified outcomes and remaining release gates.

## Upload requirement (owner clarified)
Creators should select their own file/folder/ZIP, see a real preview, supply title,
description/category and choose publish/private/schedule. The owner currently
creates templates in Remotion; no source sample is available.

Universal editable import is NOT implemented by accepting file extensions.
After Effects/Premiere native projects need their respective rendering/editing
engines. Remotion is executable React/JavaScript and must not run in the website
server or privileged browser context without a separate isolation boundary.

Decision needed before replacing the current publisher:
- First editable-import adapter: Remotion, with a documented package contract,
  declared editable props, packaged assets, dependency policy and isolated builds.
- Optional later source-download marketplace for other application formats;
  clearly label required software and do not promise browser editing.

Do not introduce a fake file selector that publishes a stock preset instead of
the uploaded artwork. Actual import requires source validation, bounded archive
extraction, malware/abuse controls, durable private storage, preview/render jobs,
ownership/licensing checks, failure recovery and deletion lifecycle.

## Remaining release gates
Staging database identity, authenticated journeys, real AI/export tests, payment
atomicity and recovery, source-import isolation, and final desktop/mobile QA.

## Implemented in this pass (September 12–13)
- Gallery cards, gallery popup and Creator Studio previews now pass creator props
  to the renderer. Creator Studio previews allow engine scripts only inside the
  existing opaque-origin sandbox (no allow-same-origin).
- Popup format reflects the rendered aspect instead of hard-coded 9:16 wording.
- Corrected editor publish-success link to include commId; old id-only community
  links are also recognized by the detail page.
- Unknown template IDs show an unavailable state; the entire detail card is
  replaced, including stale title, creator and comment placeholders.
- Publisher now explicitly distinguishes Studio publishing from unsupported
  source-file import. No fake file upload or conversion has been introduced.
- Publisher focus entry/trap/return, larger touch controls, dynamic mobile height,
  recoverable library loading, title/schedule checks, and device-time-zone wording.
- Preserve empty text positions and ignore irrelevant stale schedule values.
- Help page now has four readable step cards and current editor/credit/save copy;
  removed unsupported fixed render-time promises and contradictory AI-cost text.
- One main landmark per generated route; shared asset cache version updated.
- Owner-only template GET endpoint for private/scheduled Creator Studio items;
  editor awaits source loading and preserves creator title, props and aspect.
- Failed source loads show a focused retry notice, prevent autosaving/exporting/
  publishing a substitute, and recover when the person intentionally adds a clip.
- Missing credit balances show an unavailable state, not invented 8-credit/720p
  entitlements. Initial HTML balance is also an unknown placeholder.
- Payment receipt, account plan and credit grant now use one database transaction
  and an order-scoped advisory lock. Existing gateway verification remains intact.
- Editor awaits project synchronization; concurrent sync callers share a promise.
  Account/session changes invalidate stale sync responses before local writes.
  Sync requests have a bounded timeout.

## Verified here
- `node verify_polish_offline.js`: PASS. Actual gallery mount and publisher
  serializer exercised with in-memory dependencies; source-wiring and 20 page
  landmark/theme checks. No database writes.
- `node verify_ai_definition.js`: PASS. Offline only, not AI provider quality.
- Syntax checks for edited frontend JS and `git diff --check`: PASS.
- 20 local routes inspected for mobile (390px) and desktop (1280px) document
  overflow; no overflow observed. This is a layout smoke test, not every feature.
- Mobile theme switch is now reachable (Claude's fix); recovery pages use light
  theme correctly. Help page layout visually inspected after this pass.
- Existing signed-in Chrome session: publisher opens, template selection/details
  work, Shift+Tab wraps within dialog and closing restores trigger focus. No
  publish, schedule, account change, payment or export was submitted.
- Unknown-template browser check confirms no default artwork or stale details.
- `npm run test:polish:offline`: PASS, including actual auth/credits modules with
  in-memory transaction dependencies, rollback/retry, receipt recipient checks,
  payment/order deduplication, owner-only GET handler and draft sync isolation.
  These mocks do not establish real PostgreSQL concurrency or gateway behavior.
- September 13 database-free browser preview: at 390px, the unavailable-source
  notice/retry is visible with no horizontal overflow; Export is blocked and
  Add clip clears the error. No API operation reached the application database.
- Edited frontend/backend syntax checks and whitespace checks passed again.
- Previous port 3000 application server is now stopped. Backend changes have
  NOT been exercised on that running application. The temporary read-only QA
  server on port 3327 was stopped after testing; viewport override reset.

## Recheck findings / still open
- Earlier props fix existed in backend/detail; gallery/studio consumers still
  dropped props, addressed here. A real publish/reopen/export on staging remains.
- Retired SEO `/api/generate` handler is removed in current source.
- Payment atomic delivery is source-fixed and isolated-tested in this pass.
  Staging PostgreSQL concurrency, migrations/privileges, gateway verification,
  webhook recovery and reconciliation of any older partially delivered receipts
  remain release gates. No real payment or remote schema change was performed.
- Private/scheduled owner retrieval is source-fixed and isolated-tested;
  authenticated browser integration on a known staging database remains.
- Draft sync account isolation is tested offline; actual cross-device network
  recovery and simultaneous edits still require staging integration checks.
- Annual badge behavior has not been revalidated end-to-end.
- Native After Effects/Premiere/Remotion file/folder/ZIP upload is NOT implemented.
  Supporting downloadable source packages versus browser-editable templates is
  a product decision; there is no universal converter in this codebase.
- No final site-wide release certification: full signed-in flows, all visual
  states, staging integration tests, upload architecture and export QA remain.
