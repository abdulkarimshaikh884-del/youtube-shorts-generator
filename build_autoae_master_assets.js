const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ASSETS_DIR = path.join(__dirname, 'public', 'assets');

function getBase64(filename) {
  const filePath = path.join(ASSETS_DIR, filename);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filename).toLowerCase() === '.png' ? 'png' : 'jpeg';
    return `data:image/${ext};base64,${fs.readFileSync(filePath).toString('base64')}`;
  }
  return '';
}

async function buildAutoAEMasterAssets() {
  console.log('Generating exact 3D props for AutoAE Master Template with embedded base64...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const img1 = getBase64('archival_suspect.jpg');
  const img2 = getBase64('statue_bust.jpg');
  const img3 = getBase64('knight_monarch.jpg');
  const img4 = getBase64('vinyl_disc.jpg');

  // 1. 3D Analog Wall Clock with Glass Reflections
  console.log('Rendering 3D Wall Clock (analog_wall_clock_3d.png)...');
  await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 2 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin:0; width:600px; height:600px; background:transparent; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .clock-wrap { position:relative; width:440px; height:440px; border-radius:50%; background:linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%); border:12px solid #475569; box-shadow:0 30px 60px rgba(0,0,0,0.95), inset 0 0 25px rgba(0,0,0,0.8); transform:perspective(800px) rotateX(20deg) rotateY(15deg); display:grid; place-items:center; }
        .clock-face { position:relative; width:380px; height:380px; border-radius:50%; background:linear-gradient(135deg, #ffffff 0%, #f1f5f9 60%, #cbd5e1 100%); box-shadow:inset 0 0 20px rgba(0,0,0,0.4); font-family:Inter,sans-serif; color:#0f172a; }
        .num { position:absolute; font-size:32px; font-weight:800; transform:translate(-50%,-50%); }
        .n12 { top:12%; left:50%; }
        .n1  { top:18%; left:70%; }
        .n2  { top:30%; left:84%; }
        .n3  { top:50%; left:88%; }
        .n4  { top:70%; left:84%; }
        .n5  { top:82%; left:70%; }
        .n6  { top:88%; left:50%; }
        .n7  { top:82%; left:30%; }
        .n8  { top:70%; left:16%; }
        .n9  { top:50%; left:12%; }
        .n10 { top:30%; left:16%; }
        .n11 { top:18%; left:30%; }
        .pin { position:absolute; top:50%; left:50%; width:16px; height:16px; border-radius:50%; background:#0f172a; transform:translate(-50%,-50%); box-shadow:0 2px 6px rgba(0,0,0,0.5); z-index:10; }
        .hand-hour { position:absolute; top:28%; left:50%; width:8px; height:90px; background:#0f172a; border-radius:4px; transform-origin:bottom center; transform:translateX(-50%) rotate(290deg); box-shadow:0 4px 8px rgba(0,0,0,0.4); }
        .hand-min { position:absolute; top:16%; left:50%; width:5px; height:140px; background:#1e293b; border-radius:3px; transform-origin:bottom center; transform:translateX(-50%) rotate(75deg); box-shadow:0 4px 8px rgba(0,0,0,0.4); }
        .glass-glare { position:absolute; inset:0; border-radius:50%; background:linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%); pointer-events:none; }
      </style>
    </head>
    <body>
      <div class="clock-wrap">
        <div class="clock-face">
          <div class="num n12">12</div><div class="num n1">1</div><div class="num n2">2</div>
          <div class="num n3">3</div><div class="num n4">4</div><div class="num n5">5</div>
          <div class="num n6">6</div><div class="num n7">7</div><div class="num n8">8</div>
          <div class="num n9">9</div><div class="num n10">10</div><div class="num n11">11</div>
          <div class="hand-hour"></div>
          <div class="hand-min"></div>
          <div class="pin"></div>
          <div class="glass-glare"></div>
        </div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ASSETS_DIR, 'analog_wall_clock_3d.png'), omitBackground: true });

  // 2. 3D Photographic Evidence Board with Embedded Base64 Real Photos
  console.log('Rendering 3D Evidence Board with Real Photos (investigation_photo_board_3d.png)...');
  await page.setViewport({ width: 700, height: 850, deviceScaleFactor: 2 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin:0; width:700px; height:850px; background:transparent; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .board-wrap { position:relative; width:580px; height:740px; background:linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #020617 100%); border:3px solid rgba(56,189,248,0.4); border-radius:24px; box-shadow:0 40px 80px rgba(0,0,0,0.95), 0 0 60px rgba(56,189,248,0.4); transform:perspective(1000px) rotateX(22deg) rotateY(-12deg); padding:24px; display:grid; grid-template-columns:1fr 1fr; gap:18px; position:relative; overflow:hidden; }
        .volumetric-light { position:absolute; top:-100px; right:-100px; width:450px; height:450px; background:radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 70%); filter:blur(40px); pointer-events:none; }
        .photo-card { position:relative; background:#ffffff; border-radius:6px; padding:10px 10px 24px 10px; box-shadow:0 12px 25px rgba(0,0,0,0.8); }
        .p-img { width:100%; height:160px; background:#334155; border-radius:4px; object-fit:cover; filter:contrast(120%) brightness(90%); }
        .p1 { transform:rotate(-4deg); }
        .p2 { transform:rotate(6deg); }
        .p3 { transform:rotate(3deg); }
        .p4 { transform:rotate(-5deg); }
        .pin-head { position:absolute; top:-6px; left:50%; width:14px; height:14px; border-radius:50%; background:#ef4444; transform:translateX(-50%); box-shadow:0 2px 5px rgba(0,0,0,0.6); }
      </style>
    </head>
    <body>
      <div class="board-wrap">
        <div class="volumetric-light"></div>
        <div class="photo-card p1">
          <div class="pin-head"></div>
          <img src="${img1}" class="p-img" alt="Evidence 1" />
        </div>
        <div class="photo-card p2">
          <div class="pin-head"></div>
          <img src="${img2}" class="p-img" alt="Evidence 2" />
        </div>
        <div class="photo-card p3">
          <div class="pin-head"></div>
          <img src="${img3}" class="p-img" alt="Evidence 3" />
        </div>
        <div class="photo-card p4">
          <div class="pin-head"></div>
          <img src="${img4}" class="p-img" alt="Evidence 4" />
        </div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(ASSETS_DIR, 'investigation_photo_board_3d.png'), omitBackground: true });

  await browser.close();
  console.log('AutoAE Master 3D props regenerated with base64 embedded photos!');
}

buildAutoAEMasterAssets().catch(err => {
  console.error('Error in buildAutoAEMasterAssets:', err);
  process.exit(1);
});
