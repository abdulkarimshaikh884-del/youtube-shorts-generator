const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// public folder ka path define kar rahe hain
const publicDir = path.join(__dirname, 'public');

// agar public folder nahi hai, to automatically bana dega
if (!fs.existsSync(publicDir)){
    fs.mkdirSync(publicDir, { recursive: true });
}

// Logo file dhoondhne ka advanced logic
const possibleSources = [
    path.join(publicDir, 'favicon.svg'),
    path.join(__dirname, 'favicon.svg'),
    path.join(publicDir, 'android-chrome-512x512.png'),
    path.join(__dirname, 'android-chrome-512x512.png')
];

let inputImagePath = '';
for (const src of possibleSources) {
    if (fs.existsSync(src)) {
        inputImagePath = src;
        break;
    }
}

if (!inputImagePath) {
    console.error("❌ Error: Koi source image (favicon.svg ya android-chrome-512x512.png) nahi mili!");
    process.exit(1);
}

async function createIcons() {
    try {
        console.log(`✅ Source image mil gayi: ${inputImagePath}`);
        console.log("⏳ Nayi sizes generate ho rahi hain...");

        // 48x48 icon generate (Google Search ke liye)
        await sharp(inputImagePath)
            .resize(48, 48)
            .toFormat('png')
            .toFile(path.join(publicDir, 'favicon-48.png'));
        console.log("✅ public/favicon-48.png successfully create ho gaya!");

        // 32x32 icon generate
        await sharp(inputImagePath)
            .resize(32, 32)
            .toFormat('png')
            .toFile(path.join(publicDir, 'favicon-32x32.png'));
        console.log("✅ public/favicon-32x32.png successfully create ho gaya!");

    } catch (err) {
        console.error("❌ Favicon banane me error aaya:", err);
        process.exit(1);
    }
}

createIcons();