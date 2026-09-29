const assert = require("assert");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const {
  SCHEMA_VERSION,
  normalizeImage,
  buildGenericVisionPrompt,
  parseAndValidateAnalysis,
  projectRegionsToLegacyViews,
  generateAnalysisOverlay
} = require("../design-converter");

async function runStage2ValidationTests() {
  console.log("==========================================================");
  console.log("  STAGE 2: GENERIC VISION ANALYSIS & PARSING TEST SUITE   ");
  console.log("==========================================================");

  // ----------------------------------------------------
  // TEST A: Canvas dimensions match Stage 1 normalized metadata
  // ----------------------------------------------------
  console.log("Test A: Verifying canvas dimensions match Stage 1 ground truth...");
  const portraitMeta = { width: 1080, height: 1920, aspectRatio: 0.5625, orientation: "portrait", designType: "story-reel" };
  const parsedA = parseAndValidateAnalysis(JSON.stringify({
    schemaVersion: 2,
    regions: [{ id: "t1", type: "text", bbox: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 }, text: "Title" }]
  }), portraitMeta);
  assert.strictEqual(parsedA.success, true);
  assert.strictEqual(parsedA.document.canvas.width, 1080);
  assert.strictEqual(parsedA.document.canvas.height, 1920);
  assert.strictEqual(parsedA.document.canvas.orientation, "portrait");
  assert.strictEqual(parsedA.document.canvas.designType, "story-reel");
  console.log("  [PASS] Canvas dimensions match Stage 1 metadata strictly.");

  // ----------------------------------------------------
  // TEST B: Every bounding box is clamped inside 0..1
  // ----------------------------------------------------
  console.log("Test B: Verifying out-of-bounds, negative, or excessive bboxes are clamped...");
  const parsedB = parseAndValidateAnalysis(JSON.stringify({
    schemaVersion: 2,
    regions: [
      { id: "r_neg", type: "text", bbox: { x: -0.25, y: -0.1, width: 1.5, height: 2.0 } },
      { id: "r_nan", type: "shape", bbox: { x: "invalid", y: NaN, width: Infinity, height: -5 } }
    ]
  }), portraitMeta);
  assert.strictEqual(parsedB.success, true);
  for (const r of parsedB.document.regions) {
    assert(r.bbox.x >= 0 && r.bbox.x <= 1, `x=${r.bbox.x} out of range`);
    assert(r.bbox.y >= 0 && r.bbox.y <= 1, `y=${r.bbox.y} out of range`);
    assert(r.bbox.width >= 0 && r.bbox.width <= 1, `width=${r.bbox.width} out of range`);
    assert(r.bbox.height >= 0 && r.bbox.height <= 1, `height=${r.bbox.height} out of range`);
    assert(r.bbox.x + r.bbox.width <= 1.0001, `Right boundary exceeded: ${r.bbox.x + r.bbox.width}`);
    assert(r.bbox.y + r.bbox.height <= 1.0001, `Bottom boundary exceeded: ${r.bbox.y + r.bbox.height}`);
  }
  console.log("  [PASS] All bounding boxes strictly clamped to 0..1.");

  // ----------------------------------------------------
  // TEST C: Deduplication of region IDs
  // ----------------------------------------------------
  console.log("Test C: Verifying duplicate region IDs are deterministically deduplicated...");
  const parsedC = parseAndValidateAnalysis(JSON.stringify({
    schemaVersion: 2,
    regions: [
      { id: "duplicate_id", type: "text", bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } },
      { id: "duplicate_id", type: "text", bbox: { x: 0.1, y: 0.3, width: 0.2, height: 0.1 } },
      { id: "duplicate_id", type: "text", bbox: { x: 0.1, y: 0.5, width: 0.2, height: 0.1 } }
    ]
  }), portraitMeta);
  assert.strictEqual(parsedC.success, true);
  const ids = parsedC.document.regions.map(r => r.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, 3);
  assert.strictEqual(uniqueIds.size, 3, "All IDs must be unique after sanitization");
  assert.strictEqual(ids[0], "duplicate_id");
  assert.strictEqual(ids[1], "duplicate_id_2");
  assert.strictEqual(ids[2], "duplicate_id_3");
  console.log("  [PASS] Duplicate IDs cleanly deduplicated:", ids);

  // ----------------------------------------------------
  // TEST D: Relationship graph integrity (dropping dangling references)
  // ----------------------------------------------------
  console.log("Test D: Verifying invalid relationship references are rejected...");
  const parsedD = parseAndValidateAnalysis(JSON.stringify({
    schemaVersion: 2,
    regions: [
      { id: "card_1", type: "panel", bbox: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } },
      { id: "logo_1", type: "logo", bbox: { x: 0.15, y: 0.15, width: 0.1, height: 0.1 } }
    ],
    relationships: [
      { type: "inside", a: "logo_1", b: "card_1" }, // Valid
      { type: "overlaps", a: "logo_1", b: "non_existent_id" }, // Invalid b
      { type: "behind", a: "phantom_id", b: "card_1" }, // Invalid a
      { type: "unknown_rel", a: "logo_1", b: "card_1" } // Invalid type
    ]
  }), portraitMeta);
  assert.strictEqual(parsedD.success, true);
  assert.strictEqual(parsedD.document.relationships.length, 1);
  assert.strictEqual(parsedD.document.relationships[0].a, "logo_1");
  assert.strictEqual(parsedD.document.relationships[0].b, "card_1");
  assert(parsedD.document.warnings.some(w => w.includes("Discarded relationship")), "Should record warning for invalid rel");
  console.log("  [PASS] Relationship graph verified; dangling references discarded with warnings.");

  // ----------------------------------------------------
  // TEST E: Landscape assumptions do not appear in portrait output
  // ----------------------------------------------------
  console.log("Test E: Verifying portrait designs do not contain landscape assumptions...");
  const promptPortrait = buildGenericVisionPrompt(portraitMeta);
  assert(!promptPortrait.includes("16:9"), "Portrait prompt must not assume 16:9");
  assert(promptPortrait.includes("0.5625 (portrait)"), "Prompt must include true aspect ratio");
  console.log("  [PASS] Portrait design prompt adheres strictly to portrait orientation.");

  // ----------------------------------------------------
  // TEST F: No HeyGen-specific regex/style behavior executes
  // ----------------------------------------------------
  console.log("Test F: Verifying zero HeyGen hardcoding in generic prompt and parsing...");
  const landscapeMeta = { width: 1280, height: 720, aspectRatio: 1.7778, orientation: "landscape", designType: "youtube-thumbnail" };
  const promptGeneric = buildGenericVisionPrompt(landscapeMeta);
  assert(!promptGeneric.toLowerCase().includes("heygen"), "Prompt must have NO mention of HeyGen");
  assert(!promptGeneric.includes("NO CREDITS"), "Prompt must have NO mention of NO CREDITS");
  assert(!promptGeneric.includes("green"), "Prompt must have NO mention of green thumbnail");
  assert(!promptGeneric.includes("YouTube icon"), "Prompt must have NO mention of YouTube icon");

  // Verify text without forced red style override
  const parsedF = parseAndValidateAnalysis(JSON.stringify({
    schemaVersion: 2,
    regions: [
      { id: "txt_red", type: "text", role: "headline", bbox: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 }, text: "Special Offer", style: { fill: "#dc2626", stroke: null } }
    ]
  }), landscapeMeta);
  assert.strictEqual(parsedF.document.regions[0].style.fill, "#dc2626");
  assert.strictEqual(parsedF.document.regions[0].style.stroke, null, "Stroke must not be forced to #ffffff");
  console.log("  [PASS] Zero HeyGen-specific assumptions or forced color overrides in prompt/parser.");

  // ----------------------------------------------------
  // TEST G: Parser survives fenced JSON and prose before/after
  // ----------------------------------------------------
  console.log("Test G: Verifying parser survives markdown code fences and surrounding prose...");
  const rawWithFencesAndProse = `
Here is the design decomposition you requested:
\`\`\`json
{
  "schemaVersion": 2,
  "design": { "backgroundType": "solid" },
  "regions": [
    { "id": "btn_1", "type": "shape", "shape": "pill", "bbox": { "x": 0.2, "y": 0.8, "width": 0.6, "height": 0.1 } }
  ]
}
\`\`\`
Hope this helps! Let me know if you need more details.
  `;
  const parsedG = parseAndValidateAnalysis(rawWithFencesAndProse, landscapeMeta);
  assert.strictEqual(parsedG.success, true);
  assert.strictEqual(parsedG.document.regions.length, 1);
  assert.strictEqual(parsedG.document.regions[0].id, "btn_1");
  console.log("  [PASS] Parser extracted JSON cleanly from markdown code fences and surrounding prose.");

  // ----------------------------------------------------
  // TEST H: Parser safely rejects malformed/corrupted JSON
  // ----------------------------------------------------
  console.log("Test H: Verifying parser safely rejects malformed or unrecoverable JSON...");
  const brokenJson = `{"schemaVersion": 2, "regions": [ { "id": "incomplete`;
  const parsedH = parseAndValidateAnalysis(brokenJson, landscapeMeta);
  assert.strictEqual(parsedH.success, false);
  assert(parsedH.error.includes("Invalid JSON format"), "Should report JSON error honestly");
  console.log("  [PASS] Malformed JSON failed honestly without fabricating fake project.");

  // ----------------------------------------------------
  // TEST I: Unknown region types do not crash the pipeline
  // ----------------------------------------------------
  console.log("Test I: Verifying unknown region types are mapped safely to 'unknown'...");
  const parsedI = parseAndValidateAnalysis(JSON.stringify({
    schemaVersion: 2,
    regions: [
      { id: "alien_obj", type: "unrecognized_future_widget", bbox: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } }
    ]
  }), landscapeMeta);
  assert.strictEqual(parsedI.success, true);
  assert.strictEqual(parsedI.document.regions[0].type, "unknown");
  console.log("  [PASS] Unknown region types mapped to 'unknown' without crashing.");

  // ----------------------------------------------------
  // TEST J: Multiple objects of the same type are fully supported
  // ----------------------------------------------------
  console.log("Test J: Verifying support for multiple people, products, logos, and text blocks...");
  const parsedJ = parseAndValidateAnalysis(JSON.stringify({
    schemaVersion: 2,
    regions: [
      { id: "person_1", type: "person", role: "main-subject", bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.8 } },
      { id: "person_2", type: "person", role: "secondary-subject", bbox: { x: 0.5, y: 0.1, width: 0.3, height: 0.8 } },
      { id: "logo_1", type: "logo", role: "replaceable-content", bbox: { x: 0.05, y: 0.05, width: 0.1, height: 0.1 } },
      { id: "logo_2", type: "logo", role: "replaceable-content", bbox: { x: 0.85, y: 0.05, width: 0.1, height: 0.1 } },
      { id: "t1", type: "text", role: "headline", bbox: { x: 0.1, y: 0.85, width: 0.8, height: 0.05 }, text: "Co-founders" },
      { id: "t2", type: "text", role: "caption", bbox: { x: 0.1, y: 0.92, width: 0.8, height: 0.04 }, text: "Live Interview" }
    ]
  }), landscapeMeta);
  assert.strictEqual(parsedJ.success, true);
  assert.strictEqual(parsedJ.document.regions.length, 6);
  assert.strictEqual(parsedJ.document.regions.filter(r => r.type === "person").length, 2);
  assert.strictEqual(parsedJ.document.regions.filter(r => r.type === "logo").length, 2);
  assert.strictEqual(parsedJ.document.regions.filter(r => r.type === "text").length, 2);
  console.log("  [PASS] Multiple instances of person, logo, and text fully supported.");

  console.log("\n>>> ALL STAGE 2 MANDATORY TEST ASSERTIONS (A-J) PASSED! <<<\n");
}

if (require.main === module) {
  runStage2ValidationTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runStage2ValidationTests };
