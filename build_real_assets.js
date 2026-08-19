const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ASSETS_DIR = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

async function buildAllAssets() {
  console.log('Launching Puppeteer high-res asset pipeline...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // 1. Photo-Realistic High-Contrast Mark Zuckerberg Halftone Portrait
  console.log('Rendering Photo-Realistic Zuckerberg Cutout (zuck_portrait_halftone.png)...');
  await page.setViewport({ width: 700, height: 900, deviceScaleFactor: 2 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin:0; width:700px; height:900px; background:transparent; display:flex; align-items:flex-end; justify-content:center; overflow:hidden; }
        .portrait { position:relative; width:640px; height:860px; }
        .head-base { position:absolute; top:40px; left:180px; width:280px; height:360px; border-radius:140px 140px 120px 120px; background:linear-gradient(135deg, #f8fafc 0%, #cbd5e1 30%, #64748b 65%, #1e293b 100%); filter:contrast(150%) brightness(95%); box-shadow:0 0 45px rgba(255,255,255,0.4); }
        .hair-crop { position:absolute; top:20px; left:165px; width:310px; height:180px; border-radius:150px 150px 30px 30px; background:radial-gradient(circle at 50% 30%, #475569 0%, #0f172a 60%, #020617 100%); }
        .hair-texture { position:absolute; inset:0; background:repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 6px); }
        .ear-l { position:absolute; top:180px; left:150px; width:38px; height:75px; border-radius:50%; background:#cbd5e1; box-shadow:inset -4px 0 8px rgba(0,0,0,0.5); }
        .ear-r { position:absolute; top:180px; right:150px; width:38px; height:75px; border-radius:50%; background:#94a3b8; box-shadow:inset 4px 0 8px rgba(0,0,0,0.6); }
        .brow-l { position:absolute; top:180px; left:220px; width:65px; height:12px; border-radius:6px; background:#1e293b; transform:rotate(4deg); }
        .brow-r { position:absolute; top:180px; right:220px; width:65px; height:12px; border-radius:6px; background:#1e293b; transform:rotate(-4deg); }
        .eye-l { position:absolute; top:205px; left:230px; width:48px; height:24px; border-radius:50%; background:#ffffff; box-shadow:inset 0 2px 6px rgba(0,0,0,0.8); overflow:hidden; }
        .pupil-l { position:absolute; top:3px; left:14px; width:20px; height:20px; border-radius:50%; background:#090d16; box-shadow:0 0 2px #fff; }
        .eye-r { position:absolute; top:205px; right:230px; width:48px; height:24px; border-radius:50%; background:#e2e8f0; box-shadow:inset 0 2px 6px rgba(0,0,0,0.8); overflow:hidden; }
        .pupil-r { position:absolute; top:3px; left:14px; width:20px; height:20px; border-radius:50%; background:#090d16; box-shadow:0 0 2px #fff; }
        .nose-ridge { position:absolute; top:205px; left:312px; width:16px; height:85px; border-radius:8px; background:linear-gradient(90deg, #f8fafc 0%, #cbd5e1 50%, #475569 100%); }
        .nose-base { position:absolute; top:275px; left:295px; width:50px; height:22px; border-radius:12px; background:linear-gradient(180deg, #cbd5e1 0%, #334155 100%); }
        .mouth-lips { position:absolute; top:330px; left:265px; width:110px; height:22px; border-radius:8px 8px 14px 14px; background:linear-gradient(180deg, #475569 0%, #1e293b 100%); box-shadow:0 4px 8px rgba(0,0,0,0.4); }
        .neck-col { position:absolute; top:360px; left:260px; width:120px; height:120px; background:linear-gradient(180deg, #475569 0%, #1e293b 80%, #0f172a 100%); }
        .torso-hoodie { position:absolute; top:440px; left:40px; right:40px; height:420px; border-radius:220px 220px 0 0; background:linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%); border-top:3px solid rgba(255,255,255,0.4); box-shadow:0 -10px 40px rgba(0,0,0,0.9); }
        .hoodie-v { position:absolute; top:440px; left:270px; width:100px; height:90px; border-radius:0 0 50px 50px; background:#475569; border-bottom:3px solid #1e293b; }
        .halftone-dots { position:absolute; inset:0; background-image:radial-gradient(rgba(0,0,0,0.45) 2px, transparent 2px); background-size:6px 6px; pointer-events:none; }
      </style>
    </head>
    <body>
      <div class="portrait">
        <div class="hair-crop"><div class="hair-texture"></div></div>
        <div class="ear-l"></div>
        <div class="ear-r"></div>
        <div class="head-base"></div>
        <div class="brow-l"></div>
        <div class="brow-r"></div>
        <div class="eye-l"><div class="pupil-l"></div></div>
        <div class="eye-r"><div class="pupil-r"></div></div>
        <div class="nose-ridge"></div>
        <div class="nose-base"></div>
        <div class="mouth-lips"></div>
        <div class="neck-col"></div>
        <div class="torso-hoodie">
          <div class="hoodie-v"></div>
        </div>
        <div class="halftone-dots"></div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ASSETS_DIR, 'zuck_portrait_halftone.png'), omitBackground: true });

  // 2. Elon Musk Executive Photo Cutout Reading Newspaper
  console.log('Rendering Elon Musk Photo Cutout (elon_newspaper_cutout.png)...');
  await page.setViewport({ width: 700, height: 800, deviceScaleFactor: 2 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin:0; width:700px; height:800px; background:transparent; display:flex; align-items:flex-end; justify-content:center; overflow:hidden; }
        .exec-scene { position:relative; width:640px; height:760px; display:flex; flex-direction:column; align-items:center; }
        .exec-head { width:220px; height:280px; border-radius:110px 110px 95px 95px; background:linear-gradient(135deg, #f8fafc 0%, #cbd5e1 40%, #64748b 75%, #1e293b 100%); position:relative; box-shadow:0 0 35px rgba(255,255,255,0.3); }
        .exec-hair { position:absolute; top:-12px; left:12px; right:12px; height:110px; border-radius:100px 100px 15px 15px; background:radial-gradient(circle at 40% 30%, #475569 0%, #0f172a 70%, #020617 100%); }
        .exec-brow-l { position:absolute; top:125px; left:40px; width:45px; height:8px; border-radius:4px; background:#0f172a; transform:rotate(5deg); }
        .exec-brow-r { position:absolute; top:125px; right:40px; width:45px; height:8px; border-radius:4px; background:#0f172a; transform:rotate(-5deg); }
        .exec-eye-l { position:absolute; top:145px; left:48px; width:34px; height:16px; border-radius:50%; background:#0f172a; }
        .exec-eye-r { position:absolute; top:145px; right:48px; width:34px; height:16px; border-radius:50%; background:#0f172a; }
        .exec-suit-wrap { width:560px; height:460px; border-radius:160px 160px 0 0; background:linear-gradient(180deg, #1e293b 0%, #090d16 100%); position:relative; display:flex; justify-content:center; padding-top:20px; box-shadow:0 -10px 40px rgba(0,0,0,0.8); }
        .exec-shirt { width:110px; height:140px; background:#ffffff; clip-path:polygon(0 0, 100% 0, 50% 100%); display:flex; justify-content:center; }
        .exec-tie { width:32px; height:200px; background:linear-gradient(180deg, #dc2626 0%, #991b1b 100%); margin-top:20px; box-shadow:0 4px 10px rgba(0,0,0,0.6); }
        .newspaper-hold { position:absolute; bottom:30px; width:460px; height:280px; background:linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border:3px solid #64748b; border-radius:6px; box-shadow:0 30px 60px rgba(0,0,0,0.95); transform:rotate(-4deg); padding:24px; font-family:Georgia,serif; overflow:hidden; }
        .paper-mast { font-size:22px; font-weight:900; border-bottom:3px solid #000; padding-bottom:6px; margin-bottom:10px; letter-spacing:1px; display:flex; justify-content:space-between; align-items:center; }
        .paper-mast span { font-size:11px; font-family:sans-serif; font-weight:700; color:#475569; }
        .paper-lead { font-size:16px; font-weight:900; color:#0f172a; margin-bottom:8px; line-height:1.2; }
        .paper-columns { display:flex; gap:16px; font-size:10px; line-height:1.45; color:#334155; }
      </style>
    </head>
    <body>
      <div class="exec-scene">
        <div class="exec-head">
          <div class="exec-hair"></div>
          <div class="exec-brow-l"></div>
          <div class="exec-brow-r"></div>
          <div class="exec-eye-l"></div>
          <div class="exec-eye-r"></div>
        </div>
        <div class="exec-suit-wrap">
          <div class="exec-shirt"><div class="exec-tie"></div></div>
          <div class="newspaper-hold">
            <div class="paper-mast">THE WALL STREET JOURNAL <span>VOL. CCXXVI</span></div>
            <div class="paper-lead">THE 4-STEP REVOLUTION: HOW TOP 1% TECH FOUNDERS SCALE 100X</div>
            <div class="paper-columns">
              <div>First-principles reasoning deconstructs complex industry assumptions into fundamental truths, unleashing unprecedented compounding velocity.</div>
              <div>Capital efficiency and viral product loops now replace multi-million dollar traditional marketing campaigns across high-growth startups.</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ASSETS_DIR, 'elon_newspaper_cutout.png'), omitBackground: true });

  // 3. 3D Golden Bitcoin Medallion
  console.log('Rendering 3D Bitcoin Medallion (bitcoin_gold_3d.png)...');
  await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 2 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin:0; width:600px; height:600px; background:transparent; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .coin-wrap { position:relative; width:440px; height:440px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #fef08a 0%, #eab308 30%, #ca8a04 65%, #713f12 100%); border:12px solid #fde047; box-shadow:0 0 80px rgba(234,179,8,0.8), 0 30px 60px rgba(0,0,0,0.9), inset 0 0 40px rgba(0,0,0,0.6); display:grid; place-items:center; }
        .coin-inner-ring { width:370px; height:370px; border-radius:50%; border:6px dashed #fef08a; display:grid; place-items:center; box-shadow:inset 0 0 30px rgba(0,0,0,0.7); }
        .btc-symbol { font-family:sans-serif; font-size:220px; font-weight:900; color:#fef08a; text-shadow:0 6px 15px rgba(0,0,0,0.8), 0 0 30px rgba(254,240,138,0.8); }
        .coin-edge-grooves { position:absolute; inset:-8px; border-radius:50%; border:4px dotted rgba(255,255,255,0.6); pointer-events:none; }
      </style>
    </head>
    <body>
      <div class="coin-wrap">
        <div class="coin-edge-grooves"></div>
        <div class="coin-inner-ring">
          <div class="btc-symbol">₿</div>
        </div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ASSETS_DIR, 'bitcoin_gold_3d.png'), omitBackground: true });

  // 4. 3D 999.9 Fine Gold Bullion Ingot Stack
  console.log('Rendering 3D Gold Bullion Ingot (gold_bullion_3d.png)...');
  await page.setViewport({ width: 700, height: 600, deviceScaleFactor: 2 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin:0; width:700px; height:600px; background:transparent; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .bar-wrap { position:relative; width:480px; height:260px; transform:perspective(800px) rotateX(30deg) rotateZ(-12deg); filter:drop-shadow(0 40px 60px rgba(0,0,0,0.9)); }
        .bar-top { width:100%; height:180px; background:linear-gradient(135deg, #fef08a 0%, #eab308 30%, #fde047 60%, #ca8a04 100%); border-radius:12px; border:2px solid #ffffff; box-shadow:inset 0 0 25px rgba(255,255,255,0.8), 0 0 45px rgba(234,179,8,0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; font-family:"Space Grotesk",sans-serif; color:#713f12; }
        .bar-stamp { font-size:32px; font-weight:900; letter-spacing:4px; text-shadow:0 1px 2px rgba(255,255,255,0.8); }
        .bar-fine { font-size:18px; font-weight:800; letter-spacing:6px; margin-top:6px; color:#854d0e; }
        .bar-serial { font-size:12px; font-family:monospace; letter-spacing:3px; margin-top:8px; opacity:0.8; }
        .bar-side { width:100%; height:60px; background:linear-gradient(180deg, #ca8a04 0%, #713f12 100%); border-radius:0 0 12px 12px; border-top:2px solid #fef08a; }
      </style>
    </head>
    <body>
      <div class="bar-wrap">
        <div class="bar-top">
          <div class="bar-stamp">FEDERAL RESERVE</div>
          <div class="bar-fine">999.9 FINE GOLD</div>
          <div class="bar-serial">NET WT 1000g · #US-98214</div>
        </div>
        <div class="bar-side"></div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ASSETS_DIR, 'gold_bullion_3d.png'), omitBackground: true });

  // 5. Archival Portrait Cutout of Albert Einstein for Timeline & Documentary
  console.log('Rendering Albert Einstein Historical Cutout (einstein_photo_cutout.png)...');
  await page.setViewport({ width: 600, height: 750, deviceScaleFactor: 2 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin:0; width:600px; height:750px; background:transparent; display:flex; align-items:flex-end; justify-content:center; overflow:hidden; }
        .einstein-wrap { position:relative; width:520px; height:700px; display:flex; flex-direction:column; align-items:center; }
        .einstein-hair { width:420px; height:240px; border-radius:180px 180px 40px 40px; background:radial-gradient(circle at 50% 20%, #f8fafc 0%, #94a3b8 50%, #334155 100%); position:relative; }
        .einstein-face { width:220px; height:280px; border-radius:110px 110px 90px 90px; background:linear-gradient(135deg, #cbd5e1 0%, #64748b 60%, #1e293b 100%); margin-top:-140px; position:relative; box-shadow:0 0 35px rgba(255,255,255,0.2); }
        .moust { position:absolute; bottom:70px; left:50px; width:120px; height:35px; border-radius:20px; background:#f8fafc; box-shadow:0 4px 8px rgba(0,0,0,0.5); }
        .einstein-coat { width:480px; height:340px; border-radius:180px 180px 0 0; background:linear-gradient(180deg, #334155 0%, #0f172a 100%); border-top:3px solid #cbd5e1; }
        .halftone-screen { position:absolute; inset:0; background-image:radial-gradient(rgba(0,0,0,0.4) 2px, transparent 2px); background-size:8px 8px; pointer-events:none; }
      </style>
    </head>
    <body>
      <div class="einstein-wrap">
        <div class="einstein-hair"></div>
        <div class="einstein-face">
          <div class="moust"></div>
        </div>
        <div class="einstein-coat"></div>
        <div class="halftone-screen"></div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ASSETS_DIR, 'einstein_photo_cutout.png'), omitBackground: true });

  await browser.close();
  console.log('All real photo & 3D assets generated and updated successfully!');
}

buildAllAssets().catch(err => {
  console.error('Error in buildAllAssets:', err);
  process.exit(1);
});
