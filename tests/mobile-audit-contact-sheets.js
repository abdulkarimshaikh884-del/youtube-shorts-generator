'use strict';
// Contact sheets from actual CUA screenshots, not synthetic UI renders.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const auditFolder = process.argv[3] || 'mobile-20261021';
if (!/^mobile-[a-z0-9-]+$/.test(auditFolder)) throw new Error('Use a named mobile audit folder');
const root = path.resolve(__dirname, '../audit_results', auditFolder);
async function run() {
  const phase = process.argv[2] || 'before';
  const dir = path.join(root, phase);
  const requested = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
  if (requested && [...requested].some(name => !/^[a-z0-9-]+$/.test(name))) throw new Error('Use simple screenshot names');
  const files = (await fs.readdir(dir)).filter(x => x.endsWith('.jpg') && (!requested || requested.has(x.slice(0, -4)))).sort();
  for (let start = 0; start < files.length; start += 6) {
    const pieces = [];
    for (const [i, file] of files.slice(start, start + 6).entries()) {
      const input = path.join(dir, file), meta = await sharp(input).metadata();
      const height = Math.min(meta.height, 844);
      const thumb = await sharp(input).extract({ left: 0, top: 0, width: meta.width, height }).resize(300, 650, { fit: 'contain', background: '#ddd' }).toBuffer();
      const label = Buffer.from(`<svg width="300" height="30"><rect width="300" height="30" fill="#171717"/><text x="8" y="21" fill="white" font-size="15">${file.replace(/[<&]/g, '')}</text></svg>`);
      const left = (i % 3) * 300, top = Math.floor(i / 3) * 680;
      pieces.push({ input: label, left, top }, { input: thumb, left, top: top + 30 });
    }
    const out = path.join(root, `${phase}-sheet-${Math.floor(start / 6) + 1}.jpg`);
    await sharp({ create: { width: 900, height: 1360, channels: 3, background: '#ddd' } }).composite(pieces).jpeg({ quality: 86 }).toFile(out);
    console.log(out);
  }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
