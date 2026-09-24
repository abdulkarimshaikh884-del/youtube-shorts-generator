# Designs and image conversion — implementation status

## Implemented locally

- Neutral responsive Designs gallery, clear image-upload entry, search, uniform preview areas that preserve different aspect ratios.
- Removed cosmetic like toggles/hardcoded like counts and blanket “Fully editable” promises.
- Preview draws all layers in canvas coordinates, not just the first eight; review exposes conversion limitations.
- Vision requests include the actual image and an image-analysis system prompt. Text-only provider fallback is excluded for image requests.
- Removed the HeyGen-specific conversion shortcut and fabricated fallback headlines/shapes. Provider failure returns failure, not invented content.
- Orientation-normalized image processing, supported decoded-format validation, bounded layer lists, safe generated crop filenames and zero-coordinate handling.
- Auth required for conversion; valid images are charged with the actual `aiStandard` credit action. Failed conversion attempts use the matching refund action. Billing outages fail closed.
- New uploads receive unique project IDs. Configured database save/read failures return errors instead of silently using temporary memory. Production save/publish cannot report memory-only success.
- Generated image layers are stored in the private `design_assets` Postgres table before conversion succeeds. The app serves unpublished layers only to their owner and makes referenced layers public when a design template is published. Temporary conversion files are removed after a successful commit.

## Verified

- `tests/designs-ui.test.js`: 390px/1440px, light/dark, search, uniform previews, dialog focus/Escape, upload/review, twelve-layer preview, layer removal. API responses are isolated fixtures.
- `tests/design-conversion-offline.test.js`: real Sharp image decoding/layer file generation with mocked vision output, invalid-image rejection, flat mode, provider failure, coordinates and crop IDs.
- `tests/design-storage-offline.test.js`: unique IDs, ownership checks, save/reopen in test storage, configured-database failure, production no-storage failure. Not a live database integration test.
- `tests/design-assets-offline.test.js`: durable-write boundary, owner access, path validation, publication promotion with isolated database mocks.
- Updated existing `tests/design-conversion.test.js` passes with honest failure semantics.
- One live-provider diagnostic using the bundled HeyGen sample failed: NVIDIA timed out; Gemini returned HTTP 503/high demand. No production DB/billing/session writes were performed by this diagnostic.

## NOT finished / release gates

1. Successful live vision output still needs to be visually compared with varied real images. A passing mock test does not establish OCR/model accuracy.
2. Background repair currently uses sampled-colour patches, not generative inpainting. Foreground layers are rectangular image crops, not true subject masks; subjects remain present in the background. Moving them can expose duplicates. The UI explicitly says so. General image-to-fully-editable reconstruction is NOT complete.
3. Implement and evaluate proper object masks plus background reconstruction before claiming clean cutouts or universal editability. Keep an explicit flat-image mode for unsupported cases.
4. Postgres storage is durable but is a limited-capacity interim solution for generated media. Add object storage, quotas, and retention/orphan cleanup before conversion traffic grows; a full database must not become an app-wide outage.
5. Validate live project persistence, restart survival, publish/reopen/export and credit refund with a controlled account. Offline tests do not prove these end-to-end flows.
6. The live Supabase schema has been updated with additive design/Google/asset migrations and the server-role grants were verified. This is not a complete security audit.

The UI describes conversion honestly; it does not claim universal editability.
