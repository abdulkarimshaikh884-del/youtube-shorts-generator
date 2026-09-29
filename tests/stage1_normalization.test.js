const assert = require("assert");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { validateImage, normalizeImage, convertToEditable } = require("../design-converter");

async function runStage1Tests() {
  console.log("==========================================================");
  console.log("  STAGE 1: IMAGE NORMALIZATION & CANVAS METADATA TEST     ");
  console.log("==========================================================");

  const tplDir = path.resolve(__dirname, "../public/storage/designs/templates");

  // 1. Test Vertical 9:16 format (event-poster.webp: 1080x1920)
  const posterBuf = fs.readFileSync(path.join(tplDir, "event-poster.webp"));
  const posterNorm = await normalizeImage(posterBuf, "image/webp");
  assert.strictEqual(posterNorm.width, 1080, "Poster width should be 1080");
  assert.strictEqual(posterNorm.height, 1920, "Poster height should be 1920");
  assert.strictEqual(posterNorm.aspectRatio, 0.5625, "Poster aspect ratio should be 0.5625");
  assert.strictEqual(posterNorm.orientation, "portrait", "Poster orientation should be portrait");
  assert.strictEqual(posterNorm.designType, "story-reel", "Poster designType should be story-reel");
  console.log("  [PASS] Vertical 9:16 normalization (1080x1920 -> story-reel, portrait)");

  // 2. Test Square 1:1 format (social-post.webp: 1080x1080)
  const squareBuf = fs.readFileSync(path.join(tplDir, "social-post.webp"));
  const squareNorm = await normalizeImage(squareBuf, "image/webp");
  assert.strictEqual(squareNorm.width, 1080, "Square width should be 1080");
  assert.strictEqual(squareNorm.height, 1080, "Square height should be 1080");
  assert.strictEqual(squareNorm.aspectRatio, 1.0, "Square aspect ratio should be 1.0");
  assert.strictEqual(squareNorm.orientation, "square", "Square orientation should be square");
  assert.strictEqual(squareNorm.designType, "square-post", "Square designType should be square-post");
  console.log("  [PASS] Square 1:1 normalization (1080x1080 -> square-post, square)");

  // 3. Test Landscape 16:9 format (growth-metrics.webp: 1280x720)
  const wideBuf = fs.readFileSync(path.join(tplDir, "growth-metrics.webp"));
  const wideNorm = await normalizeImage(wideBuf, "image/webp");
  assert.strictEqual(wideNorm.width, 1280, "Landscape width should be 1280");
  assert.strictEqual(wideNorm.height, 720, "Landscape height should be 720");
  assert.strictEqual(wideNorm.aspectRatio, 1.7778, "Landscape aspect ratio should be 1.7778");
  assert.strictEqual(wideNorm.orientation, "landscape", "Landscape orientation should be landscape");
  assert.strictEqual(wideNorm.designType, "youtube-thumbnail", "Landscape designType should be youtube-thumbnail");
  console.log("  [PASS] Landscape 16:9 normalization (1280x720 -> youtube-thumbnail, landscape)");

  // 4. Test Custom aspect ratio (synthetic 1500x500 banner)
  const bannerBuf = await sharp({
    create: { width: 1500, height: 500, channels: 3, background: { r: 50, g: 100, b: 150 } }
  }).png().toBuffer();
  const bannerNorm = await normalizeImage(bannerBuf, "image/png");
  assert.strictEqual(bannerNorm.width, 1500);
  assert.strictEqual(bannerNorm.height, 500);
  assert.strictEqual(bannerNorm.aspectRatio, 3.0);
  assert.strictEqual(bannerNorm.designType, "banner");
  console.log("  [PASS] Banner 3:1 normalization (1500x500 -> banner, landscape)");

  // 5. Test convertToEditable preserves natural canvas metadata without distortion
  const flatPoster = await convertToEditable(posterBuf, "image/webp", { useAsImage: true });
  assert.strictEqual(flatPoster.project.canvas.width, 1080);
  assert.strictEqual(flatPoster.project.canvas.height, 1920);
  assert.strictEqual(flatPoster.project.canvas.aspectRatio, 0.5625);
  assert.strictEqual(flatPoster.project.canvas.orientation, "portrait");
  assert.strictEqual(flatPoster.project.designType, "story-reel");
  console.log("  [PASS] Project canvas metadata preserved in convertToEditable (natural dimensions, zero distortion)");

  console.log("\n>>> ALL STAGE 1 NORMALIZATION & METADATA TESTS PASSED! <<<\n");
}

if (require.main === module) {
  runStage1Tests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runStage1Tests };
