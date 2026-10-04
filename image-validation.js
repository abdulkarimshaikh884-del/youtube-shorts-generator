"use strict";
const sharp = require("sharp");
const MAX_BYTES = 900 * 1024;
const MAX_PIXELS = 16777216;

// Composer attachments only. Never trust a filename, MIME header or data-URL
// prefix alone; decode before any provider request or credit charge.
async function validateAttachment(dataUrl) {
  const invalid = () => new Error("Choose a valid PNG, JPEG, WebP or GIF image smaller than 900 KB.");
  if (typeof dataUrl !== "string" || dataUrl.length > Math.ceil(MAX_BYTES / 3) * 4 + 40) throw invalid();
  const match = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0) throw invalid();
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.toString("base64") !== match[2]) throw invalid();
  try {
    const input = sharp(bytes, {failOn:"warning", limitInputPixels:MAX_PIXELS, pages:1});
    const meta = await input.metadata();
    const expected = /^jpe?g$/i.test(match[1]) ? "jpeg" : match[1].toLowerCase();
    if (meta.format !== expected || !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192 || meta.width * meta.height > MAX_PIXELS) throw invalid();
    // metadata() alone accepts some truncated files. Force pixel decoding.
    await input.resize(1, 1).raw().toBuffer();
  } catch (_) { throw invalid(); }
  return dataUrl;
}

module.exports = {validateAttachment, MAX_BYTES, MAX_PIXELS};
