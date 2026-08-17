const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");
const sourceCropped = path.join(publicDir, "icon-cropped.png");

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

async function writePng(input, size, filename) {
  const data = await sharp(input)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, filename), data);
  return data;
}

async function createIcons() {
  if (!fs.existsSync(sourceCropped)) {
    throw new Error(`Missing cropped source: ${sourceCropped}`);
  }
  fs.mkdirSync(publicDir, { recursive: true });

  const browserSizes = [16, 32, 48, 180, 192, 512];
  const browserBuffers = new Map();
  for (const size of browserSizes) {
    const data = await writePng(sourceCropped, size, `favicon-${size}.png`);
    browserBuffers.set(size, data);
  }

  fs.copyFileSync(path.join(publicDir, "favicon-16.png"), path.join(publicDir, "favicon-16x16.png"));
  fs.copyFileSync(path.join(publicDir, "favicon-32.png"), path.join(publicDir, "favicon-32x32.png"));
  fs.copyFileSync(path.join(publicDir, "favicon-180.png"), path.join(publicDir, "apple-touch-icon.png"));
  fs.copyFileSync(path.join(publicDir, "favicon-192.png"), path.join(publicDir, "android-chrome-192x192.png"));
  fs.copyFileSync(path.join(publicDir, "favicon-512.png"), path.join(publicDir, "android-chrome-512x512.png"));

  const ico = buildIco([16, 32, 48].map((size) => ({ size, data: browserBuffers.get(size) })));
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);

  // SVG wrapping base64 512px PNG for ultra-crisp display in browser tabs
  const png512Base64 = browserBuffers.get(512).toString("base64");
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="ShortsCraft">
  <image href="data:image/png;base64,${png512Base64}" width="512" height="512"/>
</svg>
`;
  fs.writeFileSync(path.join(publicDir, "favicon.svg"), svgContent);

  console.log("FAVICON_BUILD=PASS");
  console.log("Generated: favicon.svg, favicon.ico, 16/32/48/180/192/512 PNGs, Apple 180, Android 192/512");
}

createIcons().catch((error) => {
  console.error("FAVICON_BUILD=FAIL", error);
  process.exit(1);
});
