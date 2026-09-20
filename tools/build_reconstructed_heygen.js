const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "public", "storage", "designs", "templates", "heygen");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const SOURCE_PATH = path.join(__dirname, "..", "public", "storage", "designs", "templates", "heygen-trick.jpg");

async function main() {
  console.log("=== Building Reconstructed HeyGen Template Assets ===");

  // 1. Generate Clean Background Plate (1280x720)
  // Deep charcoal/black canvas with rich emerald green radial glow
  console.log("1. Generating pristine Clean Plate background...");
  const bgSvg = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glowCenter" cx="38%" cy="44%" r="55%">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.36" />
      <stop offset="35%" stop-color="#10b981" stop-opacity="0.22" />
      <stop offset="70%" stop-color="#059669" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#020804" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowRight" cx="76%" cy="48%" r="46%">
      <stop offset="0%" stop-color="#16a34a" stop-opacity="0.25" />
      <stop offset="50%" stop-color="#065f46" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#020603" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="baseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#020603" />
      <stop offset="50%" stop-color="#030d06" />
      <stop offset="100%" stop-color="#010402" />
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#baseGrad)" />
  <rect width="1280" height="720" fill="url(#glowCenter)" />
  <rect width="1280" height="720" fill="url(#glowRight)" />
</svg>
`;
  const bgCleanPath = path.join(OUT_DIR, "bg_clean.webp");
  await sharp(Buffer.from(bgSvg))
    .webp({ quality: 92 })
    .toFile(bgCleanPath);
  console.log("   ✓ Clean plate saved:", bgCleanPath);

  // 2. Generate Pristine White 3D Headline Card (820x320)
  // Multi-layered 3D rounded card with green neon outline and CLEAN white surface (no baked text!)
  console.log("2. Generating pristine 3D Headline Panel (clean white face)...");
  const cardSvg = `
<svg width="840" height="340" viewBox="0 0 840 340" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4ade80" />
      <stop offset="50%" stop-color="#22c55e" />
      <stop offset="100%" stop-color="#15803d" />
    </linearGradient>
  </defs>

  <!-- Stacked 3D Depth Layers beneath -->
  <rect x="24" y="36" width="790" height="280" rx="44" ry="44" fill="#042f1a" opacity="0.8" />
  <rect x="20" y="30" width="790" height="280" rx="44" ry="44" fill="#14532d" opacity="0.9" />
  <rect x="16" y="24" width="790" height="280" rx="44" ry="44" fill="#bbf7d0" opacity="0.95" />

  <!-- Outer Neon Green Glow & Border -->
  <rect x="10" y="14" width="796" height="284" rx="44" ry="44" fill="none" stroke="url(#borderGrad)" stroke-width="12" filter="url(#neonGlow)" />

  <!-- Main Clean Solid White Face (NO BAKED TEXT!) -->
  <rect x="12" y="16" width="792" height="280" rx="42" ry="42" fill="#ffffff" stroke="#22c55e" stroke-width="5" />
</svg>
`;
  const headlineCardPath = path.join(OUT_DIR, "headline_card.webp");
  await sharp(Buffer.from(cardSvg))
    .webp({ quality: 94 })
    .toFile(headlineCardPath);
  console.log("   ✓ Headline panel saved:", headlineCardPath);

  // 3. Segment Character Cutout (Right-side anime character with green jacket)
  console.log("3. Segmenting Character cutout with alpha channel...");
  // Scale original 1024x576 to 1280x720 first
  const scaledBuf = await sharp(SOURCE_PATH)
    .resize(1280, 720, { fit: "fill" })
    .toBuffer();

  // Character bounding box in 1280x720: left: 630, top: 0, width: 650, height: 720
  // In the crop, the character is vibrant (green jacket, skin tones, hair),
  // while the background is dark green/black (#020804 / #061906).
  const charCrop = await sharp(scaledBuf)
    .extract({ left: 630, top: 0, width: 650, height: 720 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create alpha mask
  const charWidth = charCrop.info.width;
  const charHeight = charCrop.info.height;
  const charChannels = charCrop.info.channels;
  const charRaw = charCrop.data;
  const charRgba = Buffer.alloc(charWidth * charHeight * 4);

  for (let y = 0; y < charHeight; y++) {
    for (let x = 0; x < charWidth; x++) {
      const idxIn = (y * charWidth + x) * charChannels;
      const idxOut = (y * charWidth + x) * 4;
      const r = charRaw[idxIn];
      const g = charRaw[idxIn + 1];
      const b = charRaw[idxIn + 2];

      charRgba[idxOut] = r;
      charRgba[idxOut + 1] = g;
      charRgba[idxOut + 2] = b;

      // Character body is on the right side of the crop
      // Background on the far-left of crop has low brightness & dark green hue
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Far-left edge of the crop transitions to the background
      let alpha = 255;
      if (x < 180) {
        // Test if pixel is background
        if (brightness < 42 && g > r && g > b) {
          alpha = 0;
        } else if (brightness < 60) {
          alpha = Math.max(0, Math.min(255, Math.round((brightness - 35) * 10)));
        }
      }
      charRgba[idxOut + 3] = alpha;
    }
  }

  const charPath = path.join(OUT_DIR, "character.webp");
  await sharp(charRgba, { raw: { width: charWidth, height: charHeight, channels: 4 } })
    .webp({ quality: 92, effort: 4 })
    .toFile(charPath);
  console.log("   ✓ Character cutout saved:", charPath);

  // 4. Segment Hand + HeyGen 3D Card (Grouped foreground element)
  console.log("4. Segmenting Hand + HeyGen Card (grouped)...");
  // In 1280x720: left: 140, top: 310, width: 480, height: 410
  const handCrop = await sharp(scaledBuf)
    .extract({ left: 140, top: 310, width: 480, height: 410 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const hWidth = handCrop.info.width;
  const hHeight = handCrop.info.height;
  const hChannels = handCrop.info.channels;
  const hRaw = handCrop.data;
  const hRgba = Buffer.alloc(hWidth * hHeight * 4);

  for (let y = 0; y < hHeight; y++) {
    for (let x = 0; x < hWidth; x++) {
      const idxIn = (y * hWidth + x) * hChannels;
      const idxOut = (y * hWidth + x) * 4;
      const r = hRaw[idxIn];
      const g = hRaw[idxIn + 1];
      const b = hRaw[idxIn + 2];

      hRgba[idxOut] = r;
      hRgba[idxOut + 1] = g;
      hRgba[idxOut + 2] = b;

      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      // In this region, card is white/blue and hand is peach/skin tones
      // Background around them is dark green/black
      let alpha = 255;
      if (brightness < 38 && (g >= r || b <= 40)) {
        alpha = 0;
      } else if (brightness < 55) {
        alpha = Math.max(0, Math.min(255, Math.round((brightness - 35) * 12)));
      }
      hRgba[idxOut + 3] = alpha;
    }
  }

  const handCardPath = path.join(OUT_DIR, "hand_card.webp");
  await sharp(hRgba, { raw: { width: hWidth, height: hHeight, channels: 4 } })
    .webp({ quality: 92, effort: 4 })
    .toFile(handCardPath);
  console.log("   ✓ Hand + Card cutout saved:", handCardPath);

  // 5. Segment Orange Callout Arrow
  console.log("5. Segmenting Orange Callout Arrow...");
  // In 1280x720: left: 560, top: 290, width: 230, height: 210
  const arrowCrop = await sharp(scaledBuf)
    .extract({ left: 560, top: 290, width: 230, height: 210 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const aWidth = arrowCrop.info.width;
  const aHeight = arrowCrop.info.height;
  const aChannels = arrowCrop.info.channels;
  const aRaw = arrowCrop.data;
  const aRgba = Buffer.alloc(aWidth * aHeight * 4);

  for (let y = 0; y < aHeight; y++) {
    for (let x = 0; x < aWidth; x++) {
      const idxIn = (y * aWidth + x) * aChannels;
      const idxOut = (y * aWidth + x) * 4;
      const r = aRaw[idxIn];
      const g = aRaw[idxIn + 1];
      const b = aRaw[idxIn + 2];

      aRgba[idxOut] = r;
      aRgba[idxOut + 1] = g;
      aRgba[idxOut + 2] = b;

      // Orange arrow has high red, medium green, low blue (r > 160, g > 80, b < 70)
      const isOrange = r > 120 && g > 60 && (r - b > 50);
      let alpha = 0;
      if (isOrange) {
        alpha = 255;
      } else if (r > 90 && g > 45 && r > b) {
        alpha = Math.round(((r - 90) / 30) * 255);
      }
      aRgba[idxOut + 3] = Math.max(0, Math.min(255, alpha));
    }
  }

  const arrowPath = path.join(OUT_DIR, "arrow.webp");
  await sharp(aRgba, { raw: { width: aWidth, height: aHeight, channels: 4 } })
    .webp({ quality: 92, effort: 4 })
    .toFile(arrowPath);
  console.log("   ✓ Orange arrow cutout saved:", arrowPath);

  // 6. Segment YouTube Corner Badge
  console.log("6. Segmenting YouTube Corner Badge...");
  // In 1280x720: left: 1160, top: 640, width: 120, height: 80
  const ytCrop = await sharp(scaledBuf)
    .extract({ left: 1160, top: 640, width: 120, height: 80 })
    .webp({ quality: 90 })
    .toFile(path.join(OUT_DIR, "yt_badge.webp"));
  console.log("   ✓ YouTube badge saved");

  console.log("\n>>> All HeyGen Reconstructed Assets Successfully Built! <<<");
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
