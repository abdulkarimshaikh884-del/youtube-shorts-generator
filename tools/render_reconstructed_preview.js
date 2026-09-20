const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const TEMPLATES_DIR = path.join(__dirname, "..", "public", "storage", "designs", "templates");
const HEYGEN_DIR = path.join(TEMPLATES_DIR, "heygen");

async function main() {
  console.log("=== Rendering Reconstructed HeyGen Composite Preview (Pixel Accurate) ===");

  const bgPath = path.join(HEYGEN_DIR, "bg_clean.webp");
  const charPath = path.join(HEYGEN_DIR, "character.webp");
  const cardPath = path.join(HEYGEN_DIR, "headline_card.webp");
  const handPath = path.join(HEYGEN_DIR, "hand_card.webp");
  const arrowPath = path.join(HEYGEN_DIR, "arrow.webp");
  const ytPath = path.join(HEYGEN_DIR, "yt_badge.webp");

  // Generate SVG overlay for native text & pill
  const textSvg = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="textGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.75" />
    </filter>
  </defs>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Anton&amp;family=Space+Grotesk:wght@800&amp;display=swap');
    .txt-black {
      font-family: 'Anton', Impact, 'Arial Black', sans-serif;
      font-size: 82px;
      font-weight: 900;
      fill: #09090b;
      letter-spacing: 1px;
    }
    .txt-red {
      font-family: 'Anton', Impact, 'Arial Black', sans-serif;
      font-size: 114px;
      font-weight: 900;
      fill: #dc2626;
      stroke: #ffffff;
      stroke-width: 5px;
      paint-order: stroke fill;
      filter: url(#textGlow);
    }
    .txt-sub {
      font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
      font-size: 25px;
      font-weight: 800;
      fill: #ffffff;
      letter-spacing: 0.5px;
    }
  </style>

  <!-- Subtitle Pill Shape tucked at bottom of headline card -->
  <rect x="105" y="260" width="605" height="46" rx="23" ry="23" fill="#18181b" stroke="#34d399" stroke-width="1.5" />

  <!-- Native Reconstructed Text Elements -->
  <text x="58" y="118" class="txt-black">FREE &amp; UNLIMITED</text>
  <text x="52" y="235" class="txt-red">HeyGen Trick!</text>
  <text x="126" y="293" class="txt-sub">🤯 NO CREDITS, NO SUBSCRIPTION</text>
</svg>
`;

  const textBuffer = await sharp(Buffer.from(textSvg)).png().toBuffer();

  // Composite layers in exact Z-order:
  // 1. bg_clean (base)
  // 2. character (x: 680, y: 0)
  // 3. headline_card (x: 20, y: 15)
  // 4. textBuffer (x: 0, y: 0)
  // 5. hand_card (x: 140, y: 310)
  // 6. arrow (x: 560, y: 290)
  // 7. yt_badge (x: 1160, y: 640)

  const compositeLayers = [
    { input: charPath, left: 680, top: 0 },
    { input: cardPath, left: 20, top: 15 },
    { input: textBuffer, left: 0, top: 0 },
    { input: handPath, left: 140, top: 310 },
    { input: arrowPath, left: 560, top: 290 },
    { input: ytPath, left: 1160, top: 640 }
  ];

  const renderedPreviewPath = path.join(TEMPLATES_DIR, "heygen-trick.webp");
  await sharp(bgPath)
    .composite(compositeLayers)
    .webp({ quality: 92 })
    .toFile(renderedPreviewPath);

  console.log("   ✓ Reconstructed composite saved to:", renderedPreviewPath);

  // Measure similarity against original
  const origScaled = await sharp(path.join(TEMPLATES_DIR, "heygen-trick.jpg"))
    .resize(1280, 720, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const reconRaw = await sharp(renderedPreviewPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let diffSum = 0;
  const totalPixels = 1280 * 720;
  for (let i = 0; i < origScaled.data.length; i += 3) {
    diffSum += Math.abs(origScaled.data[i] - reconRaw.data[i]);
    diffSum += Math.abs(origScaled.data[i + 1] - reconRaw.data[i + 1]);
    diffSum += Math.abs(origScaled.data[i + 2] - reconRaw.data[i + 2]);
  }
  const avgDiff = diffSum / (totalPixels * 3);
  const similarityScore = Math.max(0, 100 - (avgDiff / 2.55));
  console.log(`   ✓ Structural & Visual Similarity Score: ${similarityScore.toFixed(1)}% / 100%`);
  console.log(`   ✓ Quality Rating: ${similarityScore >= 80 ? "Excellent" : (similarityScore >= 65 ? "Good" : "Needs Review")}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
