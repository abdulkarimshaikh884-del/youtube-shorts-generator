# Designs page and automatic image upload review

## Implemented locally

- Minimal gallery: Design heading, adjacent search, then cards. No conversion button or category strip.
- Cards show the uncropped preview, title and actual publisher fields. Uniform preview boxes, bounded titles, accessible editor button and independent publisher link.
- Duplicate IDs are suppressed; different creators' designs are not deleted just because their previews look alike. Missing publisher data is not replaced with a fictional creator.
- Broken preview/avatar fallbacks, safe image URLs and search by publisher as well as title/description.
- Mobile top Upload remains visible, including at 320 px. One uploader opens per click, with focus and scroll restoration.
- Image uploads start analysis automatically on Designs and through the shared uploader. Animation uploads retain their existing flow.
- Waiting UI tracks the pending request, not invented percentages or stages. Real failures offer retry or an explicitly flat image layer.
- The shared review now displays actual reconstructed layers, not the original masquerading as the reconstruction. Saving failures keep the review and do not silently redirect into an unsaved session.
- Background-repair failures now fail closed: the original with baked text is not returned as a clean background underneath editable text.

## Findings that remain unresolved

The converter is not a universal, lossless image-to-layers engine. Vision estimates regions and fonts. Background repair uses colour patches; foreground extraction supports only limited major objects and rectangular crops/approximate colour-keying. Complex textures, shadows, overlapping subjects and unknown fonts need manual correction. The SVG preview is approximate and not a pixel-identical replacement for the editor's Canvas renderer.

The screenshot includes preview/title mismatches and repeated previews under different publishers. Those particular records were not found in the local seed files. Their production provenance has not been verified; no live records were renamed or deleted.

Before claiming any image becomes independently editable without overlap, integrate and validate real segmentation/masks and background inpainting, check reconstruction against originals, and keep publication behind human review. Require permission to upload/share source artwork. Benchmark varied real thumbnails, not only generated test fixtures.

## Verification boundary

Local Puppeteer checks cover 320, 390, 768 and 1440 px in light/dark themes, card order, search, uniform previews, single modal and Escape. Additional intercepted-API tests cover automatic upload, real layer previews, failed analysis/retry, failed saves, duplicate IDs, broken assets and click concurrency. Converter tests use real image decoding with mocked vision and verify honest repair failure. Offline storage/asset tests verify owner separation and durable asset handling with isolated mocks.

No production writes, AI-provider quality certification, physical-phone verification, deployment or end-to-end public publishing through a live database were performed in this change.
