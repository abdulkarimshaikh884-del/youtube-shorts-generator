const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const {
  SHORTSCRAFT_FONT_CATALOG,
  measureTextWidth,
  wrapTextToLines,
  matchBestFont,
  fitTypography,
  fitTypographyAdvanced,
  reconstructNativeTextElement,
  replaceTextContent,
  generateTypographyDebugOverlay,
  convertToEditable
} = require("../design-converter");

async function runStage3TypographyTests() {
  console.log("==========================================================");
  console.log("  STAGE 3: GENERIC TYPOGRAPHY ENGINE & RECONSTRUCTION     ");
  console.log("==========================================================");

  const scratchDir = path.resolve(__dirname, "../scratch/stage3_typography");
  const artifactDir = "C:\\Users\\karim\\.gemini\\antigravity\\brain\\ef8884d2-ca4f-4c9a-ab61-89f71ec40ef6\\stage3_typography";
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  // -------------------------------------------------------------
  // Test Assertion A: Single-line fitting works
  // -------------------------------------------------------------
  console.log("Test A: Single-line fitting within bounding box...");
  const fitSingle = fitTypographyAdvanced("ULTIMATE GUIDE", 500, 80, { preferredFont: "Anton" });
  if (fitSingle.lines.length !== 1) throw new Error("Expected single line for 'ULTIMATE GUIDE'");
  if (fitSingle.renderedWidth > 500) throw new Error(`Width exceeded: ${fitSingle.renderedWidth} > 500`);
  if (fitSingle.renderedHeight > 80) throw new Error(`Height exceeded: ${fitSingle.renderedHeight} > 80`);
  if (fitSingle.boundsFitScore < 0.70) throw new Error(`Fit score too low: ${fitSingle.boundsFitScore}`);
  console.log(`  [PASS] Single-line Anton fitted at ${fitSingle.fontSize}px (Fit score: ${fitSingle.boundsFitScore})`);

  // -------------------------------------------------------------
  // Test Assertion B: Multiline fitting and word wrapping work
  // -------------------------------------------------------------
  console.log("Test B: Multiline fitting and word wrapping...");
  const multiText = "THE FUTURE OF CONTENT CREATION IS HERE";
  const fitMulti = fitTypographyAdvanced(multiText, 320, 180, { lineCount: 3 });
  if (fitMulti.lines.length < 2) throw new Error("Expected multiline wrapping for wide text in compact box");
  if (fitMulti.renderedWidth > 320) throw new Error(`Multiline width exceeded: ${fitMulti.renderedWidth} > 320`);
  if (fitMulti.renderedHeight > 180) throw new Error(`Multiline height exceeded: ${fitMulti.renderedHeight} > 180`);
  console.log(`  [PASS] Multiline wrapped into ${fitMulti.lines.length} lines at ${fitMulti.fontSize}px`);

  // Explicit newlines respected
  const explicitLines = fitTypographyAdvanced("FIRST LINE\nSECOND LINE\nTHIRD LINE", 400, 150);
  if (explicitLines.lines.length !== 3) throw new Error("Explicit newlines were not preserved");
  console.log("  [PASS] Explicit newlines preserved strictly");

  // -------------------------------------------------------------
  // Test Assertion C: Dynamic line-height adapts
  // -------------------------------------------------------------
  console.log("Test C: Dynamic line-height adapts (tight vs comfortable)...");
  const singleLineRes = fitTypographyAdvanced("HEADLINE", 400, 100);
  const twoLineRes = fitTypographyAdvanced("LINE ONE\nLINE TWO", 400, 140);
  const fourLineRes = fitTypographyAdvanced("ONE\nTWO\nTHREE\nFOUR", 400, 200);

  if (singleLineRes.lineHeight !== 1.0) throw new Error(`Expected single-line line-height 1.0, got ${singleLineRes.lineHeight}`);
  if (twoLineRes.lineHeight > 1.15) throw new Error(`Expected tight 2-line title line-height, got ${twoLineRes.lineHeight}`);
  if (fourLineRes.lineHeight < 1.20) throw new Error(`Expected comfortable paragraph line-height, got ${fourLineRes.lineHeight}`);
  console.log(`  [PASS] Line-height adapts dynamically: 1-line=${singleLineRes.lineHeight}, 2-line=${twoLineRes.lineHeight}, 4-line=${fourLineRes.lineHeight}`);

  // -------------------------------------------------------------
  // Test Assertion D: Dynamic letter-spacing adapts
  // -------------------------------------------------------------
  console.log("Test D: Dynamic letter spacing adapts (caps tracking vs normal)...");
  const capsTracking = fitTypographyAdvanced("PREMIUM EDITION", 400, 60, { preferredFont: "Montserrat" });
  const mixedCase = fitTypographyAdvanced("Natural casing text", 400, 60, { preferredFont: "Inter" });
  if (capsTracking.letterSpacing <= 0) throw new Error("Expected positive letter-spacing for uppercase geometric header");
  if (mixedCase.letterSpacing !== 0) throw new Error("Expected zero tracking for standard mixed case");
  console.log(`  [PASS] Letter spacing adapts: ALL-CAPS=${capsTracking.letterSpacing}px, Mixed-case=${mixedCase.letterSpacing}px`);

  // -------------------------------------------------------------
  // Test Assertion E: Rotated text preservation
  // -------------------------------------------------------------
  console.log("Test E: Preserving text rotation angles...");
  const angles = [0, -10, 15, -30, 90];
  for (const rot of angles) {
    const el = reconstructNativeTextElement({
      id: `text_rot_${rot}`,
      bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 },
      text: `Angled ${rot}`,
      rotation: rot,
      confidence: 0.95
    }, 1280, 720);
    if (el.rotation !== rot) throw new Error(`Rotation ${rot} lost, got ${el.rotation}`);
  }
  console.log("  [PASS] Rotated text angles (0°, -10°, +15°, -30°, 90°) preserved strictly");

  // -------------------------------------------------------------
  // Test Assertion F: No HeyGen-specific typography rules execute
  // -------------------------------------------------------------
  console.log("Test F: Verifying zero HeyGen-specific typography rules execute...");
  const genericRegion = {
    id: "random_text_1",
    role: "title",
    text: "Random Marketing Headline",
    bbox: { x: 0.1, y: 0.2, width: 0.4, height: 0.1 },
    style: { approxFontCategory: "condensed-display", fill: "#ff0055" },
    confidence: 0.92
  };
  const genericEl = reconstructNativeTextElement(genericRegion, 1280, 720);
  if (genericEl.fill !== "#ff0055") throw new Error("Style fill was not respected");
  if (genericEl.fontFamily !== "Anton") throw new Error("Font category condensed-display did not match Anton");
  console.log("  [PASS] Generic text region reconstructed without HeyGen overrides");

  // -------------------------------------------------------------
  // Test Assertion G: No subtitle phrase regexes in typography engine
  // -------------------------------------------------------------
  console.log("Test G: Verifying no subtitle phrase regexes in typography engine...");
  const converterSource = fs.readFileSync(path.resolve(__dirname, "../design-converter.js"), "utf8");
  const typoCode = converterSource.slice(
    converterSource.indexOf("SHORTSCRAFT_FONT_CATALOG"),
    converterSource.indexOf("reconstructBackground")
  );
  if (/no credits|subscription/i.test(typoCode)) {
    throw new Error("Found hardcoded subtitle phrase regexes in typography engine");
  }
  const convertLoop = converterSource.slice(converterSource.indexOf("Editable Text layers"));
  if (/no credits|subscription/i.test(convertLoop)) {
    throw new Error("Found hardcoded subtitle phrase regexes in convertToEditable text loop");
  }
  console.log("  [PASS] Zero subtitle phrase regexes in typography engine and text reconstruction loop");

  // -------------------------------------------------------------
  // Test Assertion H: Fixed emoji offsets completely eliminated
  // -------------------------------------------------------------
  console.log("Test H: Verifying fixed emoji offsets (tx + 14, width: 24) are eliminated...");
  if (converterSource.includes("tx + 14") || converterSource.includes("width: 24, height: 22")) {
    throw new Error("Found hardcoded emoji offsets (tx + 14) in converter code");
  }
  // Check that inline emojis are measured properly by measureTextWidth
  const withEmoji = "🔥 VIRAL HACK 🚀";
  const emojiWidth = measureTextWidth(withEmoji, 32, "Anton");
  const noEmojiWidth = measureTextWidth("VIRAL HACK", 32, "Anton");
  if (emojiWidth <= noEmojiWidth) throw new Error("Emoji advance width was not added to string advance");
  console.log(`  [PASS] Inline emoji advance measured dynamically (${noEmojiWidth.toFixed(1)}px -> ${emojiWidth.toFixed(1)}px)`);

  // -------------------------------------------------------------
  // Test Assertion I: Low-confidence OCR does not fabricate text
  // -------------------------------------------------------------
  console.log("Test I: Low-confidence OCR handling...");
  const lowConfRegion = {
    id: "low_conf_1",
    bbox: { x: 0.2, y: 0.3, width: 0.2, height: 0.05 },
    text: null,
    confidence: 0.25
  };
  const lowConfEl = reconstructNativeTextElement(lowConfRegion, 1280, 720);
  if (!lowConfEl.requiresReview) throw new Error("Low confidence text must flag requiresReview: true");
  if (lowConfEl.text !== "") throw new Error("Low confidence text should not fabricate content");
  console.log("  [PASS] Low-confidence text requires review and does not fabricate fake words");

  // -------------------------------------------------------------
  // Test Assertion J: Long replacement text overflow handling
  // -------------------------------------------------------------
  console.log("Test J: Text replacement and overflow prevention...");
  const initialEl = reconstructNativeTextElement({
    id: "badge_text",
    bbox: { x: 0.05, y: 0.05, width: 0.20, height: 0.06 }, // 256 x 43
    text: "SHORT BADGE",
    confidence: 0.95
  }, 1280, 720);

  // Reasonable replacement fits
  const fitRep = replaceTextContent(initialEl, "NEW BADGE", 1280, 720);
  if (!fitRep.success || fitRep.element.overflowWarning) throw new Error("Valid replacement should not trigger overflow warning");
  console.log("  [PASS] Normal text replacement fits cleanly");

  // Massive text replacement warns about overflow gracefully
  const massiveText = "THIS IS AN ENORMOUS BLOCK OF TEXT THAT CANNOT POSSIBLY FIT INSIDE A TINY BADGE BOX WITHOUT SEVERELY OVERFLOWING";
  const overflowRep = replaceTextContent(initialEl, massiveText, 1280, 720);
  if (!overflowRep.warning || !overflowRep.element.requiresReview) {
    throw new Error("Massive text replacement must trigger overflow warning and requiresReview");
  }
  console.log(`  [PASS] Overflow warning triggered as expected: "${overflowRep.warning}"`);

  // -------------------------------------------------------------
  // Test Assertion K: Works across portrait (9:16), square (1:1), landscape (16:9)
  // -------------------------------------------------------------
  console.log("Test K: Aspect ratio versatility (9:16, 1:1, 16:9)...");
  const layouts = [
    { name: "Landscape 16:9", w: 1280, h: 720, bbox: { x: 0.05, y: 0.08, width: 0.45, height: 0.18 } },
    { name: "Portrait 9:16", w: 1080, h: 1920, bbox: { x: 0.08, y: 0.12, width: 0.84, height: 0.10 } },
    { name: "Square 1:1", w: 1080, h: 1080, bbox: { x: 0.10, y: 0.10, width: 0.80, height: 0.14 } }
  ];

  for (const l of layouts) {
    const el = reconstructNativeTextElement({
      id: `text_${l.name.replace(/[^a-z0-9]/gi, "_")}`,
      bbox: l.bbox,
      text: "VERSATILE DESIGN TITLE",
      confidence: 0.95
    }, l.w, l.h);
    if (el.width <= 0 || el.height <= 0 || el.fontSize < 14) throw new Error(`Failed to fit in ${l.name}`);
    console.log(`  [PASS] ${l.name} (${l.w}x${l.h}): fontSize=${el.fontSize}px, fitScore=${el.boundsFitScore}`);
  }

  // -------------------------------------------------------------
  // Test Assertion L: Font Catalog Metrics & Matching
  // -------------------------------------------------------------
  console.log("Test L: Font catalog coverage across 7 categories...");
  const catalogKeys = Object.keys(SHORTSCRAFT_FONT_CATALOG);
  if (catalogKeys.length < 7) throw new Error(`Expected at least 7 fonts in catalog, found ${catalogKeys.length}`);

  const matchDisplay = matchBestFont("MEGA TITLE", 400, 80, { approxFontCategory: "condensed-display" });
  if (matchDisplay.fontFamily !== "Anton" && matchDisplay.fontFamily !== "Oswald") throw new Error("Expected condensed font for display category");

  const matchSerif = matchBestFont("Elegance in Motion", 400, 60, { approxFontCategory: "serif" });
  if (matchSerif.fontFamily !== "Playfair Display" && matchSerif.fontFamily !== "Roboto Slab") throw new Error("Expected serif font");

  const matchMono = matchBestFont("0101_DEBUG", 300, 40, { approxFontCategory: "monospace" });
  if (matchMono.fontFamily !== "IBM Plex Mono") throw new Error("Expected IBM Plex Mono for monospace category");
  console.log("  [PASS] Font catalog accurately matches categories: display -> Anton, serif -> Playfair, mono -> IBM Plex Mono");

  // -------------------------------------------------------------
  // GENERATE DEBUG RENDERS FOR 8 DISTINCT TEXT CASES
  // -------------------------------------------------------------
  console.log("\nGenerating development debug renders for 8 distinct text cases...");

  const testCases = [
    {
      id: "case1_bold_thumbnail_headline",
      title: "Case 1: Bold Thumbnail Headline",
      canvas: { width: 1280, height: 720, bg: "#0f172a" },
      region: {
        id: "headline_bold",
        role: "headline",
        text: "VIRAL HOOKS THAT WIN",
        bbox: { x: 0.06, y: 0.10, width: 0.65, height: 0.18 },
        style: { approxFontCategory: "condensed-display", fill: "#fbbf24", weight: 900 }
      }
    },
    {
      id: "case2_two_line_headline",
      title: "Case 2: Two-Line Balanced Headline",
      canvas: { width: 1280, height: 720, bg: "#111827" },
      region: {
        id: "headline_twoline",
        role: "headline",
        text: "UNLIMITED AI\nVIDEO TRICK",
        bbox: { x: 0.06, y: 0.12, width: 0.55, height: 0.28 },
        style: { approxFontCategory: "condensed-display", fill: "#ffffff", weight: 900 }
      }
    },
    {
      id: "case3_three_line_poster_title",
      title: "Case 3: Three-Line Event Poster Title",
      canvas: { width: 1080, height: 1920, bg: "#1e1b4b" }, // Portrait 9:16
      region: {
        id: "poster_title",
        role: "title",
        text: "DESIGN\nSUMMIT\nTOKYO 2027",
        bbox: { x: 0.10, y: 0.12, width: 0.80, height: 0.32 },
        style: { approxFontCategory: "serif", fill: "#fef08a", weight: 700 }
      }
    },
    {
      id: "case4_subtitle_badge_pill",
      title: "Case 4: Subtitle Badge / Pill Text",
      canvas: { width: 1280, height: 720, bg: "#09090b" },
      region: {
        id: "subtitle_badge",
        role: "badge",
        text: "100% FREE • NO CARD",
        bbox: { x: 0.08, y: 0.55, width: 0.32, height: 0.07 },
        style: { approxFontCategory: "geometric-sans", fill: "#38bdf8", weight: 800 }
      }
    },
    {
      id: "case5_multiline_body_paragraph",
      title: "Case 5: Multiline Body Paragraph",
      canvas: { width: 1080, height: 1080, bg: "#18181b" }, // Square 1:1
      region: {
        id: "body_copy",
        role: "body",
        text: "Create high-performing video content in seconds using state-of-the-art AI generation tools. Maximize engagement across Shorts, Reels, and TikTok.",
        bbox: { x: 0.10, y: 0.30, width: 0.80, height: 0.22 },
        style: { approxFontCategory: "clean-sans", fill: "#e4e4e7", weight: 400, lineCount: 3 }
      }
    },
    {
      id: "case6_centered_alignment_text",
      title: "Case 6: Centered Alignment Text",
      canvas: { width: 1280, height: 720, bg: "#022c22" },
      region: {
        id: "center_title",
        role: "title",
        text: "THE FUTURE OF CREATIVE TOOLS",
        bbox: { x: 0.15, y: 0.35, width: 0.70, height: 0.16 },
        style: { approxFontCategory: "geometric-sans", fill: "#6ee7b7", alignment: "center", weight: 800 }
      }
    },
    {
      id: "case7_rotated_callout_text",
      title: "Case 7: Rotated Sticker Callout",
      canvas: { width: 1280, height: 720, bg: "#311042" },
      region: {
        id: "rotated_badge",
        role: "badge",
        text: "NEW UPDATE!",
        bbox: { x: 0.65, y: 0.15, width: 0.26, height: 0.11 },
        rotation: -14,
        style: { approxFontCategory: "condensed-display", fill: "#f43f5e", weight: 900 }
      }
    },
    {
      id: "case8_stroke_and_shadow_text",
      title: "Case 8: Text with Heavy Stroke and Shadow",
      canvas: { width: 1280, height: 720, bg: "#172554" },
      region: {
        id: "epic_bonus",
        role: "headline",
        text: "EPIC BONUS",
        bbox: { x: 0.08, y: 0.25, width: 0.50, height: 0.20 },
        style: {
          approxFontCategory: "condensed-display",
          fill: "#facc15",
          stroke: "#000000",
          strokeWidth: 6,
          hasShadow: true,
          shadow: { color: "rgba(0,0,0,0.9)", blur: 12, offsetX: 3, offsetY: 6 }
        }
      }
    }
  ];

  for (const c of testCases) {
    const w = c.canvas.width;
    const h = c.canvas.height;

    // Create solid colored canvas background
    const bgSvg = Buffer.from(`
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${w}" height="${h}" fill="${c.canvas.bg}" />
        <text x="24" y="36" font-family="Segoe UI, sans-serif" font-size="16" font-weight="bold" fill="#64748b">${c.title} (${w}x${h})</text>
      </svg>
    `);
    const bgBuf = await sharp(bgSvg).png().toBuffer();

    const textEl = reconstructNativeTextElement(c.region, w, h);
    const fileName = `${c.id}.png`;
    const scratchPath = path.join(scratchDir, fileName);
    const artifactPath = path.join(artifactDir, fileName);

    await generateTypographyDebugOverlay(bgBuf, [textEl], scratchPath);
    fs.copyFileSync(scratchPath, artifactPath);

    console.log(`  [RENDERED] ${c.title} -> ${textEl.fontFamily} ${textEl.fontSize}px (Fit: ${textEl.boundsFitScore}, Recon: ${textEl.textReconstructionScore})`);
  }

  console.log("\n>>> ALL 12 MANDATORY STAGE 3 ASSERTIONS (A-L) AND 8 DEBUG RENDERS PASSED! <<<\n");
  return true;
}

if (require.main === module) {
  runStage3TypographyTests().catch(err => {
    console.error("Stage 3 Typography Test Failed:", err);
    process.exit(1);
  });
}

module.exports = { runStage3TypographyTests };
