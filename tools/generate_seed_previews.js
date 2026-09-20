const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const destDir = path.join(__dirname, '..', 'public', 'storage', 'designs', 'templates');
fs.mkdirSync(destDir, { recursive: true });

async function createTemplates() {
  // 1. Vox Coverup (1280x720)
  const voxSvg = Buffer.from(`
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGrad" cx="70%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#1e1b4b"/>
          <stop offset="100%" stop-color="#080811"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bgGrad)"/>
      <circle cx="880" cy="320" r="260" fill="#312e81" opacity="0.4"/>
      <rect x="80" y="80" width="210" height="44" rx="22" fill="#dc2626"/>
      <text x="104" y="110" font-family="sans-serif" font-weight="800" font-size="20" fill="#ffffff" letter-spacing="2">INVESTIGATION</text>
      <text x="80" y="240" font-family="Impact, sans-serif" font-size="112" font-weight="900" fill="#ffffff" stroke="#000000" stroke-width="4">THE $100M</text>
      <text x="80" y="370" font-family="Impact, sans-serif" font-size="136" font-weight="900" fill="#facc15" stroke="#000000" stroke-width="6">COVERUP</text>
      <rect x="80" y="430" width="700" height="6" fill="#facc15"/>
      <text x="80" y="490" font-family="sans-serif" font-size="36" font-weight="600" fill="#94a3b8">How one company deceived everyone.</text>
      <circle cx="1000" cy="360" r="140" fill="none" stroke="#facc15" stroke-width="12" stroke-dasharray="20 15"/>
      <text x="960" y="390" font-family="Impact, sans-serif" font-size="96" font-weight="900" fill="#ef4444">?!</text>
    </svg>
  `);
  await sharp(voxSvg).webp({ quality: 92 }).toFile(path.join(destDir, 'vox-coverup.webp'));

  // 2. Viral Creator Growth (1280x720)
  const growthSvg = Buffer.from(`
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="lineGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#10b981"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="#070b14"/>
      <rect x="80" y="90" width="180" height="40" rx="8" fill="#10b981"/>
      <text x="104" y="117" font-family="sans-serif" font-size="18" font-weight="800" fill="#ffffff" letter-spacing="1">CASE STUDY</text>
      <text x="80" y="220" font-family="Impact, sans-serif" font-size="96" font-weight="900" fill="#ffffff">FROM 0 TO</text>
      <text x="80" y="340" font-family="Impact, sans-serif" font-size="124" font-weight="900" fill="#38bdf8" stroke="#0f172a" stroke-width="4">1,000,000</text>
      <text x="80" y="420" font-family="sans-serif" font-size="34" font-weight="700" fill="#f59e0b">IN JUST 90 DAYS 🚀</text>
      <rect x="720" y="100" width="480" height="520" rx="24" fill="url(#cardGrad)" stroke="#334155" stroke-width="2"/>
      <text x="760" y="160" font-family="sans-serif" font-size="22" font-weight="700" fill="#94a3b8">Monthly Subscribers</text>
      <text x="760" y="230" font-family="sans-serif" font-size="56" font-weight="900" fill="#10b981">+1,024,890</text>
      <path d="M760 520 Q860 490 940 380 T1140 260" fill="none" stroke="url(#lineGrad)" stroke-width="12" stroke-linecap="round"/>
    </svg>
  `);
  await sharp(growthSvg).webp({ quality: 92 }).toFile(path.join(destDir, 'growth-metrics.webp'));

  // 3. Neon Logo (1080x1080)
  const logoSvg = Buffer.from(`
    <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1080" fill="#050811"/>
      <circle cx="540" cy="440" r="240" fill="none" stroke="#06b6d4" stroke-width="20" opacity="0.9"/>
      <circle cx="540" cy="440" r="160" fill="#06b6d4" opacity="0.12"/>
      <polygon points="540,320 620,480 460,480" fill="#38bdf8"/>
      <text x="540" y="780" text-anchor="middle" font-family="sans-serif" font-size="96" font-weight="900" fill="#ffffff" letter-spacing="12">NEONIX</text>
      <text x="540" y="860" text-anchor="middle" font-family="monospace" font-size="28" font-weight="600" fill="#06b6d4" letter-spacing="6">CREATIVE STUDIOS // 2026</text>
    </svg>
  `);
  await sharp(logoSvg).webp({ quality: 92 }).toFile(path.join(destDir, 'neon-logo.webp'));

  // 4. Minimal Logo (1080x1080)
  const minimalLogoSvg = Buffer.from(`
    <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1080" fill="#0f172a"/>
      <polygon points="540,240 760,640 320,640" fill="#f59e0b"/>
      <polygon points="540,340 680,640 400,640" fill="#0f172a"/>
      <text x="540" y="780" text-anchor="middle" font-family="sans-serif" font-size="88" font-weight="900" fill="#ffffff" letter-spacing="10">APEX</text>
      <text x="540" y="850" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#f59e0b" letter-spacing="8">VENTURE LABS</text>
    </svg>
  `);
  await sharp(minimalLogoSvg).webp({ quality: 92 }).toFile(path.join(destDir, 'minimal-logo.webp'));

  // 5. Event Poster (1080x1920)
  const posterSvg = Buffer.from(`
    <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1920" fill="#090d16"/>
      <rect x="120" y="160" width="320" height="56" rx="28" fill="#6366f1"/>
      <text x="160" y="198" font-family="sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="2">GLOBAL SUMMIT</text>
      <text x="120" y="380" font-family="Impact, sans-serif" font-size="160" font-weight="900" fill="#ffffff">AI DESIGN</text>
      <text x="120" y="540" font-family="Impact, sans-serif" font-size="160" font-weight="900" fill="#38bdf8">FUTURE</text>
      <rect x="120" y="600" width="840" height="8" fill="#6366f1"/>
      <text x="120" y="700" font-family="sans-serif" font-size="44" font-weight="600" fill="#cbd5e1">Where creators shape the next web.</text>
      <rect x="120" y="1340" width="840" height="380" rx="32" fill="#1e293b" stroke="#334155" stroke-width="2"/>
      <text x="180" y="1450" font-family="sans-serif" font-size="42" font-weight="800" fill="#ffffff">OCTOBER 24-26, 2026</text>
      <text x="180" y="1520" font-family="sans-serif" font-size="32" font-weight="600" fill="#94a3b8">Moscone Center · San Francisco</text>
      <text x="180" y="1610" font-family="sans-serif" font-size="28" font-weight="700" fill="#6366f1">REGISTER NOW → shortscraft.online</text>
    </svg>
  `);
  await sharp(posterSvg).webp({ quality: 92 }).toFile(path.join(destDir, 'event-poster.webp'));

  // 6. Social Post (1080x1080)
  const socialSvg = Buffer.from(`
    <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1080" fill="#111827"/>
      <rect x="100" y="100" width="880" height="880" rx="36" fill="#1f2937" stroke="#374151" stroke-width="2"/>
      <circle cx="200" cy="200" r="48" fill="#2563eb"/>
      <text x="186" y="214" font-family="sans-serif" font-size="36" font-weight="900" fill="#ffffff">SC</text>
      <text x="280" y="196" font-family="sans-serif" font-size="32" font-weight="800" fill="#ffffff">ShortsCraft Playbook</text>
      <text x="280" y="234" font-family="sans-serif" font-size="22" font-weight="500" fill="#9ca3af">@shortscraft · 2h ago</text>
      <text x="160" y="420" font-family="Impact, sans-serif" font-size="76" font-weight="900" fill="#ffffff">3 SECONDS TO HOOK</text>
      <text x="160" y="510" font-family="Impact, sans-serif" font-size="76" font-weight="900" fill="#f59e0b">YOUR AUDIENCE.</text>
      <text x="160" y="620" font-family="sans-serif" font-size="32" font-weight="500" fill="#d1d5db">The best Shorts hook before the title appears.</text>
      <rect x="160" y="760" width="280" height="60" rx="30" fill="#2563eb"/>
      <text x="210" y="802" font-family="sans-serif" font-size="24" font-weight="700" fill="#ffffff">SAVE THIS POST</text>
    </svg>
  `);
  await sharp(socialSvg).webp({ quality: 92 }).toFile(path.join(destDir, 'social-post.webp'));

  console.log('All 6 template preview images generated successfully!');
}

createTemplates().catch(console.error);
