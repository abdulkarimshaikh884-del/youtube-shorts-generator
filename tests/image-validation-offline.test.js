"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const {validateAttachment, MAX_BYTES} = require("../image-validation");
const url = (bytes, mime="png") => `data:image/${mime};base64,${bytes.toString("base64")}`;
(async () => {
  let checks = 0;
  const image = sharp({create:{width:16,height:12,channels:4,background:"#ff0000"}});
  let png;
  for (const format of ["png","jpeg","webp","gif"]) {
    const bytes = await image.clone().toFormat(format).toBuffer();
    if(format==="png") png = bytes;
    assert.equal(await validateAttachment(url(bytes,format)),url(bytes,format)); checks++;
    if(format==="jpeg") { await validateAttachment(url(bytes,"jpg")); checks++; }
  }
  const bad = [
    url(Buffer.from("not an image")),
    url(png.subarray(0, png.length / 2)),
    url(png,"jpeg"),
    url(Buffer.alloc(MAX_BYTES+1)),
    "data:image/png;base64,!!!!", "data:image/png;base64,AB==",
    "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,", null
  ];
  for (const value of bad) { await assert.rejects(validateAttachment(value), /Choose a valid/); checks++; }
  const wide = await sharp({create:{width:8193,height:1,channels:3,background:"white"}}).png().toBuffer();
  const large = await sharp({create:{width:4097,height:4096,channels:3,background:"white"}}).png().toBuffer();
  for (const value of [url(wide), url(large)]) { await assert.rejects(validateAttachment(value), /Choose a valid/); checks++; }
  const server = fs.readFileSync(path.resolve(__dirname,"../server.js"),"utf8");
  const handler = server.slice(server.indexOf('app.post("/api/animate"'));
  assert.ok(handler.indexOf("await validateAttachment(image)") < handler.indexOf("await credits.state(req)")); checks++;
  assert.ok(require("../animate").LIMITS.MAX_IMG_BYTES >= Math.ceil(MAX_BYTES / 3) * 4 + 40); checks++;
  console.log(`Image validation: ${checks} offline checks passed; no DB/provider calls.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
