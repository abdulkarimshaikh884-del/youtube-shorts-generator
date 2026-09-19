/**
 * test_design_conversion.js — Verification tests for "Convert to Editable" feature
 */
const assert = require("assert");
const path = require("path");
const fs = require("fs");

const { validateImage, convertToEditable } = require("../design-converter");
const designs = require("../designs");

async function runTests() {
  console.log("=== Testing Design Conversion & Storage System ===\n");

  // Test 1: Image Validation with invalid data
  console.log("1. Testing validateImage() with invalid input...");
  const invalidRes = await validateImage("not-a-buffer", "image/png");
  assert(invalidRes.error, "Should return error for invalid buffer");
  console.log("   ✓ Properly rejected invalid buffer:", invalidRes.error);

  const unsupportedMime = await validateImage(Buffer.from("xyz"), "image/gif");
  assert(unsupportedMime.error, "Should return error for unsupported mime");
  console.log("   ✓ Properly rejected unsupported MIME:", unsupportedMime.error);

  // Create a minimal 1280x720 PNG buffer for testing
  const sharp = require("sharp");
  const testPngBuffer = await sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 4,
      background: { r: 24, g: 32, b: 47, alpha: 1 }
    }
  }).png().toBuffer();

  // Test 2: Image Validation with valid PNG
  console.log("2. Testing validateImage() with valid 1280x720 PNG...");
  const validated = await validateImage(testPngBuffer, "image/png");
  assert(validated.success, "Should succeed");
  assert.strictEqual(validated.metadata.format, "png");
  assert.strictEqual(validated.metadata.width, 1280);
  assert.strictEqual(validated.metadata.height, 720);
  console.log("   ✓ Image validated successfully (1280x720, png, buffer size:", testPngBuffer.length, "bytes)");

  // Test 3: convertToEditable with useAsImage = true
  console.log("3. Testing convertToEditable() in 'useAsImage' mode...");
  const mockCallAI = async () => { throw new Error("AI should not be called in useAsImage mode"); };
  const flatResult = await convertToEditable(testPngBuffer, "image/png", {
    useAsImage: true,
    designType: "youtube-thumbnail",
    callAI: mockCallAI
  });
  assert(flatResult.success, "Result should be successful");
  assert(flatResult.project, "Should contain project object");
  assert.strictEqual(flatResult.project.elements.length, 1, "Should have 1 background element");
  assert.strictEqual(flatResult.project.elements[0].type, "image");
  assert.strictEqual(flatResult.project.elements[0].role, "background");
  assert.strictEqual(flatResult.project.canvas.width, 1280);
  assert.strictEqual(flatResult.project.canvas.height, 720);
  console.log("   ✓ 'useAsImage' mode generated clean flat project with 1 layer:", flatResult.project.title);

  // Test 4: convertToEditable with AI fallback
  console.log("4. Testing convertToEditable() graceful fallback when AI fails...");
  const failingCallAI = async () => { throw new Error("Mock AI provider timeout"); };
  const fallbackResult = await convertToEditable(testPngBuffer, "image/png", {
    useAsImage: false,
    designType: "youtube-thumbnail",
    callAI: failingCallAI
  });
  assert(fallbackResult.success, "Should succeed via fallback mode");
  assert(fallbackResult.fallback, "Fallback flag should be true");
  assert(fallbackResult.warning, "Should contain user warning");
  assert(fallbackResult.project.elements.length >= 1, "Should retain image layer");
  console.log("   ✓ Gracefully recovered with fallback layer:", fallbackResult.warning);

  // Test 5: Designs Store - listTemplates
  console.log("5. Testing designs.listTemplates()...");
  const listRes = await designs.listTemplates();
  assert(listRes.success, "Should succeed");
  const templates = listRes.templates;
  assert(Array.isArray(templates), "Templates should be an array");
  assert(templates.length >= 4, "Should contain at least 4 default seed templates");
  console.log("   ✓ Seed templates available:", templates.length);
  templates.forEach(t => console.log("     - [" + t.designType + "] " + t.title + " (layers: " + (t.elements ? t.elements.length : 0) + ")"));

  // Test 6: Designs Store - cloneTemplate
  console.log("6. Testing designs.cloneTemplate()...");
  const templateToClone = templates[0];
  const cloneRes = await designs.cloneTemplate("test-user-123", templateToClone.id);
  assert(cloneRes.success, "Clone should succeed");
  const cloned = cloneRes.project;
  assert(cloned, "Cloned project should exist");
  assert.notStrictEqual(cloned.id, templateToClone.id, "Cloned project ID must be unique");
  assert.strictEqual(cloned.userId, "test-user-123");
  console.log("   ✓ Successfully cloned template:", cloned.title, "-> project id:", cloned.id);

  // Test 7: Designs Store - saveProject & getProject
  console.log("7. Testing designs.saveProject() and getProject()...");
  cloned.title = "My Customized YouTube Thumbnail";
  cloned.name = "My Customized YouTube Thumbnail";
  cloned.elements.push({
    id: "txt_custom_" + Date.now(),
    type: "text",
    name: "Custom Headline",
    text: "HOW I GOT 1M VIEWS",
    x: 100,
    y: 100,
    width: 600,
    height: 120,
    fontSize: 52,
    fontFamily: "Anton",
    fontWeight: "900",
    fill: "#f59e0b",
    zIndex: 10
  });

  const saveRes = await designs.saveProject("test-user-123", cloned.id, cloned);
  assert(saveRes.success, "Save should succeed");
  const saved = saveRes.project;
  assert.strictEqual(saved.title, "My Customized YouTube Thumbnail");

  const getRes = await designs.getProject("test-user-123", cloned.id);
  assert(getRes.success, "Get project should succeed");
  const retrieved = getRes.project;
  assert(retrieved, "Retrieved project must exist");
  assert.strictEqual(retrieved.title, "My Customized YouTube Thumbnail");
  assert.strictEqual(retrieved.elements.length, cloned.elements.length);
  console.log("   ✓ Successfully saved and retrieved project:", retrieved.id, "with", retrieved.elements.length, "elements");

  // Test 8: Designs Store - listProjects
  console.log("8. Testing designs.listProjects()...");
  const userProjectsRes = await designs.listProjects("test-user-123");
  assert(userProjectsRes.success, "List projects should succeed");
  const userProjects = userProjectsRes.projects;
  assert(Array.isArray(userProjects), "Should return array of projects");
  assert(userProjects.some(p => p.id === cloned.id), "User projects should contain the cloned project");
  console.log("   ✓ User projects list confirmed (count:", userProjects.length, ")");

  console.log("\n>>> ALL DESIGN CONVERSION & STORAGE TESTS PASSED! <<<\n");
}

runTests().catch(err => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
