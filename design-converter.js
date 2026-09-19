/* ============================================================
   design-converter.js — AI-powered 'Convert to Editable' Engine.
   Reconstructs flattened images (PNG, JPG, WebP) into multi-layer
   ShortsCraft Design Projects with editable text, background inpainting,
   and movable object layers.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const STORAGE_ROOT = path.join(__dirname, "public", "storage", "designs");

// Ensure storage root directory exists
try {
  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }
} catch (e) {
  console.error("[design-converter] Storage directory creation warning:", e.message);
}

const SUPPORTED_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB max upload

/**
 * Validates uploaded image buffer
 */
async function validateImage(buffer, mimeType) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { error: "No image file received." };
  }
  if (buffer.length > MAX_BYTES) {
    return { error: "Image file is too large (maximum 15 MB)." };
  }
  if (mimeType && !SUPPORTED_MIMES.has(mimeType.toLowerCase())) {
    return { error: "Supported image formats are PNG, JPG, and WebP." };
  }

  try {
    const meta = await sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
    if (!meta.width || !meta.height) {
      return { error: "Could not read image dimensions." };
    }
    if (meta.width < 100 || meta.height < 100) {
      return { error: "Image is too small. Please upload a design at least 100x100 pixels." };
    }
    return { success: true, metadata: meta };
  } catch (err) {
    return { error: "The uploaded image is damaged or unsupported." };
  }
}

/**
 * Creates project asset workspace folder on disk
 */
function createWorkspace(jobId) {
  const dir = path.join(STORAGE_ROOT, jobId);
  const assetsDir = path.join(dir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  return { dir, assetsDir, urlBase: `/storage/designs/${jobId}` };
}

/**
 * AI Visual Analysis & Layout OCR prompt
 */
const ANALYSIS_PROMPT = `
You are an expert design & vision decomposition engine for graphic designs, YouTube thumbnails, posters, and logos.
Analyze this image and reconstruct it into an editable layered design project.

Decompose the image into structured JSON matching this EXACT format:
{
  "designType": "youtube-thumbnail", // or "poster", "logo", "social-post", "banner"
  "suggestedTitle": "Short descriptive title of the design",
  "textElements": [
    {
      "id": "text_1",
      "text": "Exact text string as visible in image",
      "bbox": { "x": 0.05, "y": 0.15, "width": 0.50, "height": 0.18 }, // normalized 0.0 to 1.0 relative to image
      "fontFamily": "Anton", // choose nearest: "Anton", "Space Grotesk", "Inter", "Roboto", "Oswald", "Montserrat", "Impact", "IBM Plex Mono"
      "fontWeight": 900, // 400, 600, 700, 800, 900
      "fill": "#ffffff", // text color hex
      "stroke": "#000000", // stroke color hex or null
      "strokeWidth": 4, // estimated stroke width in px (0 if none)
      "shadow": { "color": "#000000", "blur": 8, "offsetX": 2, "offsetY": 4 }, // or null
      "alignment": "left", // "left", "center", "right"
      "rotation": 0, // estimated rotation in degrees
      "confidence": 0.95 // 0.0 to 1.0
    }
  ],
  "foregroundObjects": [
    {
      "id": "obj_1",
      "label": "Person / Character / Product / Device / Logo",
      "bbox": { "x": 0.55, "y": 0.05, "width": 0.42, "height": 0.90 }, // normalized 0.0 to 1.0
      "confidence": 0.92
    }
  ],
  "shapeElements": [
    {
      "id": "shape_1",
      "shape": "curvedArrow", // "rectangle", "roundedRectangle", "pill", "circle", "curvedArrow", "straightArrow"
      "bbox": { "x": 0.40, "y": 0.35, "width": 0.15, "height": 0.12 },
      "fill": "#f59e0b",
      "stroke": null,
      "radius": 16,
      "rotation": 15,
      "confidence": 0.85
    }
  ],
  "background": {
    "type": "dark", // "dark", "light", "gradient", "photo", "solid"
    "dominantColor": "#0f172a",
    "description": "Short description of background"
  }
}

CRITICAL RULES:
1. Every visible text phrase must be detected and converted into textElements. Do not omit words.
2. Coordinates (bbox.x, bbox.y, bbox.width, bbox.height) MUST be normalized floats between 0.0 and 1.0.
3. Separate distinct visual subjects (faces/people, product mockups, big logos) into foregroundObjects.
4. Output ONLY clean JSON.
`;

/**
 * Calls AI vision model to analyze layout
 */
async function analyzeVisualLayout(callAIFn, imageBuffer, meta) {
  const base64 = imageBuffer.toString("base64");
  const mime = meta.format === "png" ? "image/png" : (meta.format === "webp" ? "image/webp" : "image/jpeg");
  const dataUri = `data:${mime};base64,${base64}`;

  try {
    const rawRes = await callAIFn(ANALYSIS_PROMPT, {
      image: dataUri,
      json: true,
      maxTokens: 2500,
      temperature: 0.2
    });

    let parsed;
    try {
      // Clean possible markdown code fences
      const cleanJson = rawRes.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.warn("[design-converter] JSON parse fallback:", e.message);
      parsed = {};
    }
    return sanitizeAnalysis(parsed, meta);
  } catch (err) {
    console.error("[design-converter] AI Vision call failed:", err.message);
    // Graceful fallback to heuristic detection
    return fallbackHeuristicAnalysis(meta);
  }
}

/**
 * Sanitize and enforce strict boundaries on model output
 */
function sanitizeAnalysis(data, meta) {
  const width = meta.width || 1280;
  const height = meta.height || 720;

  const validFonts = new Set(["Anton", "Space Grotesk", "Inter", "Roboto", "Oswald", "Montserrat", "Impact", "IBM Plex Mono"]);

  const textElements = (Array.isArray(data.textElements) ? data.textElements : []).map((t, idx) => {
    const text = String(t.text || "").trim();
    if (!text) return null;
    const bbox = t.bbox || {};
    const bx = Math.max(0, Math.min(0.95, Number(bbox.x) || 0.05));
    const by = Math.max(0, Math.min(0.95, Number(bbox.y) || 0.1 * (idx + 1)));
    const bw = Math.max(0.05, Math.min(1.0 - bx, Number(bbox.width) || 0.4));
    const bh = Math.max(0.03, Math.min(1.0 - by, Number(bbox.height) || 0.1));

    return {
      id: `text_${idx + 1}`,
      text: text,
      bbox: { x: bx, y: by, width: bw, height: bh },
      fontFamily: validFonts.has(t.fontFamily) ? t.fontFamily : "Anton",
      fontWeight: [400, 600, 700, 800, 900].includes(Number(t.fontWeight)) ? Number(t.fontWeight) : 800,
      fill: /^#[0-9a-fA-F]{6}$/.test(String(t.fill)) ? t.fill : "#ffffff",
      stroke: /^#[0-9a-fA-F]{6}$/.test(String(t.stroke)) ? t.stroke : null,
      strokeWidth: Math.max(0, Math.min(16, Number(t.strokeWidth) || 0)),
      shadow: t.shadow ? {
        color: t.shadow.color || "rgba(0,0,0,0.7)",
        blur: Number(t.shadow.blur) || 8,
        offsetX: Number(t.shadow.offsetX) || 0,
        offsetY: Number(t.shadow.offsetY) || 4
      } : null,
      alignment: ["left", "center", "right"].includes(t.alignment) ? t.alignment : "left",
      rotation: Math.max(-180, Math.min(180, Number(t.rotation) || 0)),
      confidence: Math.max(0.1, Math.min(1.0, Number(t.confidence) || 0.85))
    };
  }).filter(Boolean);

  const foregroundObjects = (Array.isArray(data.foregroundObjects) ? data.foregroundObjects : []).map((o, idx) => {
    const bbox = o.bbox || {};
    const bx = Math.max(0, Math.min(0.95, Number(bbox.x) || 0.5));
    const by = Math.max(0, Math.min(0.95, Number(bbox.y) || 0.1));
    const bw = Math.max(0.05, Math.min(1.0 - bx, Number(bbox.width) || 0.4));
    const bh = Math.max(0.05, Math.min(1.0 - by, Number(bbox.height) || 0.8));

    return {
      id: `obj_${idx + 1}`,
      label: String(o.label || "Foreground Subject").slice(0, 40),
      bbox: { x: bx, y: by, width: bw, height: bh },
      confidence: Math.max(0.1, Math.min(1.0, Number(o.confidence) || 0.80))
    };
  });

  const shapeElements = (Array.isArray(data.shapeElements) ? data.shapeElements : []).map((s, idx) => {
    const bbox = s.bbox || {};
    const bx = Math.max(0, Math.min(0.95, Number(bbox.x) || 0.3));
    const by = Math.max(0, Math.min(0.95, Number(bbox.y) || 0.3));
    const bw = Math.max(0.02, Math.min(1.0 - bx, Number(bbox.width) || 0.15));
    const bh = Math.max(0.02, Math.min(1.0 - by, Number(bbox.height) || 0.15));

    const validShapes = new Set(["rectangle", "roundedRectangle", "pill", "circle", "curvedArrow", "straightArrow"]);
    return {
      id: `shape_${idx + 1}`,
      shape: validShapes.has(s.shape) ? s.shape : "curvedArrow",
      bbox: { x: bx, y: by, width: bw, height: bh },
      fill: /^#[0-9a-fA-F]{6}$/.test(String(s.fill)) ? s.fill : "#f59e0b",
      stroke: /^#[0-9a-fA-F]{6}$/.test(String(s.stroke)) ? s.stroke : null,
      radius: Math.max(0, Math.min(100, Number(s.radius) || 16)),
      rotation: Number(s.rotation) || 0,
      confidence: Math.max(0.1, Math.min(1.0, Number(s.confidence) || 0.80))
    };
  });

  return {
    designType: data.designType || "youtube-thumbnail",
    suggestedTitle: String(data.suggestedTitle || "Editable Design").slice(0, 80),
    textElements,
    foregroundObjects,
    shapeElements,
    background: data.background || { type: "dark", dominantColor: "#0b0f19" }
  };
}

/**
 * Fallback heuristic analysis if AI provider fails or is unconfigured
 */
function fallbackHeuristicAnalysis(meta) {
  return {
    isFallback: true,
    warning: "AI vision was unavailable; generated a starter template with customizable layers.",
    designType: meta.width > meta.height ? "youtube-thumbnail" : "poster",
    suggestedTitle: "Editable Design Project",
    textElements: [
      {
        id: "text_1",
        text: "CLICK TO EDIT HEADLINE",
        bbox: { x: 0.08, y: 0.18, width: 0.75, height: 0.18 },
        fontFamily: "Anton",
        fontWeight: 900,
        fill: "#ffffff",
        stroke: "#000000",
        strokeWidth: 3,
        alignment: "left",
        confidence: 0.70
      }
    ],
    foregroundObjects: [],
    shapeElements: [],
    background: { type: "dark", dominantColor: "#0f172a" }
  };
}

/**
 * Reconstructs clean background by removing/erasing baked text regions
 */
async function reconstructBackground(imageBuffer, textElements, meta, assetsDir) {
  const width = meta.width;
  const height = meta.height;
  const bgPath = path.join(assetsDir, "background.webp");

  try {
    // If no text was detected, copy original as background
    if (!textElements || !textElements.length) {
      await sharp(imageBuffer)
        .rotate()
        .webp({ quality: 88, effort: 4 })
        .toFile(bgPath);
      return { success: true, path: bgPath, relativeUrl: "assets/background.webp" };
    }

    // Build composites to inpaint/erase baked text:
    // Sample context from surrounding background and blend with blur/soft patch
    const composites = [];

    for (const t of textElements) {
      const pxX = Math.round(t.bbox.x * width);
      const pxY = Math.round(t.bbox.y * height);
      const pxW = Math.round(t.bbox.width * width);
      const pxH = Math.round(t.bbox.height * height);

      // Expand bounding box with 6% padding for clean boundary erasure
      const padX = Math.round(pxW * 0.06);
      const padY = Math.round(pxH * 0.08);
      const patchX = Math.max(0, pxX - padX);
      const patchY = Math.max(0, pxY - padY);
      const patchW = Math.min(width - patchX, pxW + (padX * 2));
      const patchH = Math.min(height - patchY, pxH + (padY * 2));

      if (patchW > 4 && patchH > 4) {
        // Extract blurred local background patch to dissolve high frequency text contours
        const patchBuffer = await sharp(imageBuffer)
          .extract({ left: patchX, top: patchY, width: patchW, height: patchH })
          .blur(18)
          .modulate({ brightness: 0.98 })
          .toBuffer();

        composites.push({
          input: patchBuffer,
          left: patchX,
          top: patchY,
          blend: "over"
        });
      }
    }

    if (composites.length) {
      await sharp(imageBuffer)
        .composite(composites)
        .webp({ quality: 88, effort: 4 })
        .toFile(bgPath);
    } else {
      await sharp(imageBuffer)
        .webp({ quality: 88, effort: 4 })
        .toFile(bgPath);
    }

    return { success: true, path: bgPath, relativeUrl: "assets/background.webp" };
  } catch (err) {
    console.warn("[design-converter] Background reconstruction warning:", err.message);
    // Safe fallback: copy original as background
    await sharp(imageBuffer).webp({ quality: 88 }).toFile(bgPath);
    return { success: true, path: bgPath, relativeUrl: "assets/background.webp" };
  }
}

/**
 * Extracts foreground objects (people, products, icons) into transparent layers
 */
async function segmentForegroundObjects(imageBuffer, foregroundObjects, meta, assetsDir) {
  const width = meta.width;
  const height = meta.height;
  const extracted = [];

  for (const obj of foregroundObjects) {
    try {
      const pxX = Math.max(0, Math.round(obj.bbox.x * width));
      const pxY = Math.max(0, Math.round(obj.bbox.y * height));
      const pxW = Math.min(width - pxX, Math.round(obj.bbox.width * width));
      const pxH = Math.min(height - pxY, Math.round(obj.bbox.height * height));

      if (pxW > 20 && pxH > 20) {
        const objFileName = `layer_${obj.id}.webp`;
        const objFilePath = path.join(assetsDir, objFileName);

        await sharp(imageBuffer)
          .extract({ left: pxX, top: pxY, width: pxW, height: pxH })
          .webp({ quality: 90, effort: 4 })
          .toFile(objFilePath);

        extracted.push({
          id: obj.id,
          label: obj.label,
          src: `assets/${objFileName}`,
          x: pxX,
          y: pxY,
          width: pxW,
          height: pxH,
          confidence: obj.confidence
        });
      }
    } catch (e) {
      console.warn(`[design-converter] Failed to crop object ${obj.id}:`, e.message);
    }
  }

  return extracted;
}

/**
 * Main Conversion Pipeline
 */
async function convertToEditable(imageBuffer, mimeType, { callAI, useAsImage = false, designType = "youtube-thumbnail" } = {}) {
  // 1. Validation
  const valRes = await validateImage(imageBuffer, mimeType);
  if (!valRes.success) return valRes;
  const meta = valRes.metadata;

  const jobId = `job_${crypto.randomBytes(8).toString("hex")}`;
  const ws = createWorkspace(jobId);

  // Save original image for review comparison & fallback
  const origPath = path.join(ws.dir, "original.webp");
  await sharp(imageBuffer).rotate().webp({ quality: 92 }).toFile(origPath);
  const originalUrl = `${ws.urlBase}/original.webp`;

  const canvasWidth = meta.width || 1280;
  const canvasHeight = meta.height || 720;

  // If user selected "Use as Image", create simple flat image project
  if (useAsImage) {
    const flatProject = {
      version: 1,
      projectType: "design",
      designType: designType,
      title: "Custom Image Design",
      canvas: { width: canvasWidth, height: canvasHeight },
      source: {
        type: "image",
        originalUploadId: jobId,
        sourceImage: originalUrl
      },
      elements: [
        {
          id: "bg_flat",
          type: "image",
          role: "background",
          src: originalUrl,
          x: 0,
          y: 0,
          width: canvasWidth,
          height: canvasHeight,
          zIndex: 0,
          locked: true
        }
      ]
    };

    return {
      success: true,
      jobId,
      originalUrl,
      previewUrl: originalUrl,
      project: flatProject,
      isAiConverted: false
    };
  }

  // 2. AI Visual Layout & OCR Analysis
  const analysis = await analyzeVisualLayout(callAI, imageBuffer, meta);

  // 3. Background Inpainting (erasing baked text)
  const bgRes = await reconstructBackground(imageBuffer, analysis.textElements, meta, ws.assetsDir);
  const backgroundUrl = `${ws.urlBase}/${bgRes.relativeUrl}`;

  // 4. Foreground Object Segmentation
  const segmentedObjects = await segmentForegroundObjects(imageBuffer, analysis.foregroundObjects, meta, ws.assetsDir);

  // 5. Assemble Project Elements with correct Z-ordering
  const elements = [];
  let currentZ = 0;

  // Background layer (Z: 0)
  elements.push({
    id: "layer_background",
    name: "Clean Background",
    type: "image",
    role: "background",
    src: backgroundUrl,
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    zIndex: currentZ++,
    locked: true
  });

  // Vector Shape layers (Z: 1..k)
  for (const s of analysis.shapeElements) {
    const sx = Math.round(s.bbox.x * canvasWidth);
    const sy = Math.round(s.bbox.y * canvasHeight);
    const sw = Math.round(s.bbox.width * canvasWidth);
    const sh = Math.round(s.bbox.height * canvasHeight);

    elements.push({
      id: s.id,
      name: s.shape.replace(/([A-Z])/g, " $1").trim(),
      type: "shape",
      shape: s.shape,
      x: sx,
      y: sy,
      width: sw,
      height: sh,
      fill: s.fill || "#f59e0b",
      stroke: s.stroke,
      radius: s.radius || 12,
      rotation: s.rotation || 0,
      confidence: s.confidence,
      zIndex: currentZ++
    });
  }

  // Foreground Image layers (Z: k..m)
  for (const obj of segmentedObjects) {
    elements.push({
      id: obj.id,
      name: obj.label,
      type: "image",
      role: "foreground",
      src: `${ws.urlBase}/${obj.src}`,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      confidence: obj.confidence,
      zIndex: currentZ++
    });
  }

  // Editable Text layers (Z: m..n)
  for (const t of analysis.textElements) {
    const tx = Math.round(t.bbox.x * canvasWidth);
    const ty = Math.round(t.bbox.y * canvasHeight);
    const tw = Math.round(t.bbox.width * canvasWidth);
    const th = Math.round(t.bbox.height * canvasHeight);

    // Approximate font size based on bounding box height
    const estimatedFontSize = Math.max(16, Math.round(th * 0.72));

    elements.push({
      id: t.id,
      name: `Text: "${t.text.slice(0, 18)}${t.text.length > 18 ? "..." : ""}"`,
      type: "text",
      text: t.text,
      x: tx,
      y: ty,
      width: tw,
      height: th,
      fontFamily: t.fontFamily || "Anton",
      fontSize: estimatedFontSize,
      fontWeight: t.fontWeight || 800,
      fill: t.fill || "#ffffff",
      stroke: t.stroke,
      strokeWidth: t.strokeWidth || 0,
      shadow: t.shadow,
      alignment: t.alignment || "left",
      rotation: t.rotation || 0,
      confidence: t.confidence,
      zIndex: currentZ++
    });
  }

  const project = {
    version: 1,
    projectType: "design",
    designType: analysis.designType || designType,
    title: analysis.suggestedTitle || "Reconstructed Design",
    canvas: { width: canvasWidth, height: canvasHeight },
    source: {
      type: "ai-converted",
      originalUploadId: jobId,
      conversionVersion: 1,
      sourceImage: originalUrl,
      confidenceSummary: {
        textCount: analysis.textElements.length,
        objectCount: segmentedObjects.length,
        shapeCount: analysis.shapeElements.length
      }
    },
    elements
  };

  return {
    success: true,
    jobId,
    originalUrl,
    previewUrl: backgroundUrl,
    project,
    isAiConverted: true,
    fallback: !!analysis.isFallback,
    warning: analysis.warning || null
  };
}

module.exports = {
  validateImage,
  convertToEditable
};
