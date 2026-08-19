/* Renders every SC_TPL2 template mid-loop via a REAL srcdoc iframe on a page
   navigated to the live origin (matches production exactly: shell.js does the
   same thing), then composites them into contact-sheet grid images so many
   templates can be visually scanned at once for overlap/legibility issues. */
const puppeteer = require("puppeteer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(__dirname, "audit_results", "contact_sheets");
const TILE_W = 300, TILE_H = 533; // 9:16 tile
const COLS = 8;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: TILE_W + 40, height: TILE_H + 40 });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => !!window.SC_TPL2, { timeout: 20000 });
  const list = await page.evaluate(() => window.SC_TPL2.list());
  console.log("Templates:", list.length);

  const shots = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    await page.evaluate((id) => {
      document.body.innerHTML = "";
      document.body.style.margin = "0";
      const html = window.SC_TPL2.build(id, { aspect: "9:16" });
      const iframe = document.createElement("iframe");
      iframe.id = "shot";
      iframe.style.width = "300px";
      iframe.style.height = "533px";
      iframe.style.border = "0";
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.setAttribute("scrolling", "no");
      document.body.appendChild(iframe);
      iframe.srcdoc = html;
    }, t.id);
    await new Promise((r) => setTimeout(r, 1600)); // let entrance settle mid-loop
    const el = await page.$("#shot");
    const buf = await el.screenshot({ type: "png" });
    const outPath = path.join(OUT_DIR, `${String(i).padStart(3, "0")}_${t.id}.png`);
    fs.writeFileSync(outPath, buf);
    shots.push({ id: t.id, name: t.name, buf, index: i });
    console.log(`[${i + 1}/${list.length}] ${t.id}`);
  }
  await browser.close();

  const PER_SHEET = 40; // 8 cols x 5 rows
  const LABEL_H = 22;
  const cellW = TILE_W, cellH = TILE_H + LABEL_H;
  for (let sheetStart = 0; sheetStart < shots.length; sheetStart += PER_SHEET) {
    const batch = shots.slice(sheetStart, sheetStart + PER_SHEET);
    const rows = Math.ceil(batch.length / COLS);
    const sheetW = COLS * cellW;
    const sheetH = rows * cellH;

    const composites = [];
    for (let j = 0; j < batch.length; j++) {
      const col = j % COLS, row = Math.floor(j / COLS);
      const label = Buffer.from(
        `<svg width="${cellW}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#111"/><text x="4" y="15" font-size="11" fill="#fff" font-family="monospace">${sheetStart + j}:${batch[j].id.slice(0, 30)}</text></svg>`
      );
      composites.push({ input: label, left: col * cellW, top: row * cellH });
      composites.push({ input: batch[j].buf, left: col * cellW, top: row * cellH + LABEL_H });
    }
    const sheetPath = path.join(OUT_DIR, `sheet_${String(sheetStart / PER_SHEET).padStart(2, "0")}.jpg`);
    await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#000" } })
      .composite(composites)
      .jpeg({ quality: 72 })
      .toFile(sheetPath);
    console.log("Wrote", sheetPath);
  }
  console.log("DONE");
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
