'use strict';

// Independent pixel evidence for a model-proposed native scene. The model's
// confidence and its description of a scene never enter this decision. A PASS
// is a bounded reconstruction comparison, not professional visual acceptance.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const {validateScene, assetIds} = require('./schema');
const {ReferenceMotionError} = require('./admission');
const THRESHOLDS = Object.freeze({maxMeanAbsoluteError: 12, maxChangedPixelFractionOver30: .12,
  minForegroundRecall: .90, minForegroundPrecision: .90, minEdgeRecall: .80, minEdgePrecision: .80,
  minFlatBorderFraction: .80, minimumVisiblePixels: 16});

function refused(message) {throw new ReferenceMotionError('REFERENCE_VISUAL_EVIDENCE_INVALID', message, 422);}
function aborted(signal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason :
    new ReferenceMotionError('REFERENCE_CANCELLED', 'Reference visual verification was cancelled.', 499);
}
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

async function ownedLocations(framesDirectory, workDirectory) {
  if (![framesDirectory, workDirectory].every(value => typeof value === 'string' && path.isAbsolute(value))) refused('Visual evidence requires private absolute working directories.');
  const source = path.resolve(framesDirectory), work = path.resolve(workDirectory), root = path.dirname(source);
  if (path.basename(source) !== 'frames' || !samePath(path.dirname(work), root) ||
      !/^semantic-quality(?:-[A-Za-z0-9_-]{1,40})?$/.test(path.basename(work)) ||
      !samePath(path.dirname(root), path.resolve(os.tmpdir())) || !/^shortscraft-reference-[A-Za-z0-9]+$/.test(path.basename(root))) {
    refused('Visual evidence must stay inside the current owned reference scratch directory.');
  }
  for (const directory of [root, source]) {
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !samePath(await fs.realpath(directory), directory)) refused('Visual evidence refused an aliased directory.');
  }
  const markerPath = path.join(root, 'owner.json'), stat = await fs.lstat(markerPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) refused('Visual evidence scratch ownership could not be verified.');
  const marker = JSON.parse(await fs.readFile(markerPath, 'utf8'));
  if (marker.kind !== 'reference-motion-private-v1' || typeof marker.directory !== 'string' || !samePath(marker.directory, root)) refused('Visual evidence scratch owner does not match.');
  // Never overwrite prior evidence, even in an otherwise valid scratch root.
  try {await fs.lstat(work); refused('Visual evidence directory already exists.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  return {source, work};
}

function dilate(mask, width, height) {
  const horizontal = new Uint8Array(mask.length), output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    horizontal[p] = mask[p] || (x && mask[p - 1]) || (x + 1 < width && mask[p + 1]) ? 1 : 0;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    output[p] = horizontal[p] || (y && horizontal[p - width]) || (y + 1 < height && horizontal[p + width]) ? 1 : 0;
  }
  return output;
}

function edgeMask(pixels, width, height) {
  const edges = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, a = p * 3;
    for (const q of [x + 1 < width ? p + 1 : p, y + 1 < height ? p + width : p]) {
      const b = q * 3;
      if (Math.max(Math.abs(pixels[a] - pixels[b]), Math.abs(pixels[a + 1] - pixels[b + 1]), Math.abs(pixels[a + 2] - pixels[b + 2])) > 24) {edges[p] = 1; edges[q] = 1;}
    }
  }
  return edges;
}

function overlap(original, generated, width, height) {
  const originalExpanded = dilate(original, width, height), generatedExpanded = dilate(generated, width, height);
  let originalCount = 0, generatedCount = 0, recalled = 0, precise = 0;
  for (let p = 0; p < original.length; p++) {
    if (original[p]) {originalCount++; if (generatedExpanded[p]) recalled++;}
    if (generated[p]) {generatedCount++; if (originalExpanded[p]) precise++;}
  }
  return {recall: originalCount ? recalled / originalCount : generatedCount ? 0 : 1,
    precision: generatedCount ? precise / generatedCount : originalCount ? 0 : 1, originalCount, generatedCount};
}

function measureRgb(original, generated, width, height, background) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 2_100_000 ||
      original.length !== width * height * 3 || generated.length !== original.length || !/^#[0-9a-f]{6}$/i.test(background)) refused('Visual comparison pixels have invalid dimensions.');
  const bg = [1, 3, 5].map(index => parseInt(background.slice(index, index + 2), 16));
  const sourceMask = new Uint8Array(width * height), resultMask = new Uint8Array(width * height);
  let absolute = 0, squared = 0, changed = 0, flatBorderPixels = 0, borderPixels = 0;
  for (let p = 0; p < sourceMask.length; p++) {
    const i = p * 3;
    let difference = 0, sourceBackgroundDifference = 0, resultBackgroundDifference = 0;
    for (let c = 0; c < 3; c++) {
      const delta = Math.abs(original[i + c] - generated[i + c]);
      difference = Math.max(difference, delta); absolute += delta; squared += delta * delta;
      sourceBackgroundDifference = Math.max(sourceBackgroundDifference, Math.abs(original[i + c] - bg[c]));
      resultBackgroundDifference = Math.max(resultBackgroundDifference, Math.abs(generated[i + c] - bg[c]));
    }
    if (difference > 30) changed++;
    sourceMask[p] = sourceBackgroundDifference > 12 ? 1 : 0;
    resultMask[p] = resultBackgroundDifference > 12 ? 1 : 0;
    const x = p % width, y = Math.floor(p / width);
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {borderPixels++; if (sourceBackgroundDifference <= 12) flatBorderPixels++;}
  }
  const foreground = overlap(sourceMask, resultMask, width, height);
  const edges = overlap(edgeMask(original, width, height), edgeMask(generated, width, height), width, height);
  return {meanAbsoluteError: absolute / original.length, psnrDb: squared ? Math.min(200, 10 * Math.log10(255 * 255 / (squared / original.length))) : 200,
    changedPixelFractionOver30: changed / sourceMask.length, foregroundRecall: foreground.recall, foregroundPrecision: foreground.precision,
    edgeRecall: edges.recall, edgePrecision: edges.precision, sourceForegroundPixels: foreground.originalCount,
    renderedForegroundPixels: foreground.generatedCount, flatBorderPixels, borderPixels};
}

function rowPass(row) {return row.meanAbsoluteError < THRESHOLDS.maxMeanAbsoluteError && row.changedPixelFractionOver30 < THRESHOLDS.maxChangedPixelFractionOver30 &&
  row.foregroundRecall >= THRESHOLDS.minForegroundRecall && row.foregroundPrecision >= THRESHOLDS.minForegroundPrecision &&
  row.edgeRecall >= THRESHOLDS.minEdgeRecall && row.edgePrecision >= THRESHOLDS.minEdgePrecision;}

function summarize(rows, width, height, nativeTextCount, hiddenBackgroundMaxDelta) {
  if (!rows.length || rows.length > 300 || rows.some((row, i) => row.frame !== i)) refused('Visual verification must compare every consecutive output frame.');
  const visibleSource = rows.reduce((sum, row) => sum + row.sourceForegroundPixels, 0), visibleOutput = rows.reduce((sum, row) => sum + row.renderedForegroundPixels, 0);
  const borderFraction = rows.reduce((sum, row) => sum + row.flatBorderPixels, 0) / Math.max(1, rows.reduce((sum, row) => sum + row.borderPixels, 0));
  const globalFailure = visibleSource < THRESHOLDS.minimumVisiblePixels || visibleOutput < THRESHOLDS.minimumVisiblePixels || borderFraction < THRESHOLDS.minFlatBorderFraction || hiddenBackgroundMaxDelta !== 0;
  const failed = rows.filter(row => !rowPass(row));
  const worst = rows.reduce((a, b) => b.meanAbsoluteError > a.meanAbsoluteError ? b : a);
  const sampleIndices = [...new Set([0, Math.floor(rows.length / 2), rows.length - 1, worst.frame])].sort((a, b) => a - b);
  return {quality: {state: globalFailure || failed.length ? 'FAILED' : 'REVIEW_REQUIRED', visualComparison: globalFailure || failed.length ? 'FAIL' : 'PASS', exactRecreation: false,
    nativeText: nativeTextCount ? 'PARTIAL_NATIVE' : 'NOT_RETAINED', nativeTextCount,
    // This is structural native rendering, NOT OCR mask/inpainting evidence.
    textRemoval: 'NOT_RUN', objectIdentity: 'NOT_RUN', audioReconstruction: 'NOT_RETAINED', zOrder: 'REVIEW_REQUIRED',
    comparedFrameCount: rows.length, failedFrameCount: globalFailure ? rows.length : failed.length,
    comparisonWidth: width, comparisonHeight: height, worstFrame: worst.frame,
    meanAbsoluteError: rows.reduce((sum, row) => sum + row.meanAbsoluteError, 0) / rows.length,
    maxMeanAbsoluteError: worst.meanAbsoluteError, maxChangedPixelFractionOver30: Math.max(...rows.map(row => row.changedPixelFractionOver30)),
    minForegroundRecall: Math.min(...rows.map(row => row.foregroundRecall)), minForegroundPrecision: Math.min(...rows.map(row => row.foregroundPrecision)),
    comparisons: sampleIndices.map(index => {const row = rows[index]; return Object.fromEntries(['frame', 'meanAbsoluteError', 'psnrDb', 'changedPixelFractionOver30', 'foregroundRecall', 'foregroundPrecision'].map(key => [key, row[key]]));})},
    evidence: {scope: 'Actual encoded fixed-renderer output versus all decoded source frames; no model confidence', allFramesCompared: true,
      thresholds: THRESHOLDS, minEdgeRecall: Math.min(...rows.map(row => row.edgeRecall)), minEdgePrecision: Math.min(...rows.map(row => row.edgePrecision)),
      flatBorderFraction: borderFraction, sourceForegroundPixels: visibleSource, renderedForegroundPixels: visibleOutput,
      allHiddenBackgroundMaxDelta: hiddenBackgroundMaxDelta, humanVisualAcceptance: 'NOT_RUN', actualTextRemovalInference: 'NOT_RUN'}};
}

async function rgb(filename, width, height, expectedWidth = width, expectedHeight = height) {
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) refused('Visual verification found an unsafe frame.');
  const image = sharp(filename, {limitInputPixels: 2_100_000}), meta = await image.metadata();
  if (meta.format !== 'png' || (meta.pages || 1) !== 1 || meta.width !== expectedWidth || meta.height !== expectedHeight) refused('Visual verification requires actual single-frame PNG files with verified dimensions.');
  return image.flatten({background: '#000000'}).toColourspace('srgb').removeAlpha().resize(width, height, {fit: 'fill', kernel: 'lanczos3'}).raw().toBuffer();
}

async function verifySemanticReconstruction({scene: raw, framesDirectory, workDirectory, ffmpegPath = 'ffmpeg', signal}, deps = {}) {
  const scene = validateScene(raw);
  if (scene.version !== 4 || assetIds(scene).length || scene.layers.some(layer => !layer.text && !layer.vector)) refused('Semantic visual verification accepts only closed native V4 layers.');
  if (typeof ffmpegPath !== 'string' || (!path.isAbsolute(ffmpegPath) && ffmpegPath !== 'ffmpeg') || /[\r\n\u0000]/.test(ffmpegPath)) refused('Visual verification requires a server-controlled FFmpeg executable.');
  const {source, work} = await ownedLocations(framesDirectory, workDirectory);
  aborted(signal);
  const sourceFiles = (await fs.readdir(source)).filter(name => /^frame-\d{6}\.png$/.test(name)).sort();
  if (sourceFiles.length !== scene.durationFrames || sourceFiles.some((name, i) => name !== `frame-${String(i + 1).padStart(6, '0')}.png`)) refused('Source frame count does not match the native scene.');
  for (const filename of sourceFiles) {
    aborted(signal);
    const stat = await fs.lstat(path.join(source, filename));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) refused('Source verification refused a non-file or aliased frame.');
  }
  const even = value => Math.max(2, Math.round(value / 2) * 2), short = Math.min(scene.width, scene.height);
  const width = even(scene.width / short * 480), height = even(scene.height / short * 480);
  if (width > 4096 || height > 4096 || width * height > 2_100_000) refused('Reference aspect ratio exceeds the visual-verification pixel budget.');
  const first = await sharp(path.join(source, sourceFiles[0]), {limitInputPixels: 1280 * 1280}).metadata();
  if (first.width !== scene.width || first.height !== scene.height) refused('Source dimensions do not match the native scene.');
  await fs.mkdir(work);
  const render = deps.render || require('./render').renderReference, run = deps.run || require('./service').runProcess;
  const output = path.join(work, 'reconstructed.mp4'), frames = [...new Set([0, Math.floor(scene.durationFrames / 2), scene.durationFrames - 1])];
  const started = Date.now();
  const metrics = await render({scene, images: {}}, {output, height: 480, watermark: false, stills: frames, signal});
  aborted(signal);
  if (metrics.width !== width || metrics.height !== height || metrics.frames !== scene.durationFrames || metrics.fps !== scene.fps) refused('Actual render timing or dimensions differ from the validated native scene.');
  const videoStat = await fs.lstat(output);
  if (!videoStat.isFile() || videoStat.isSymbolicLink() || videoStat.size < 1024 || videoStat.size > 64 * 1024 * 1024) refused('Visual verification did not receive a bounded actual MP4.');
  const handle = await fs.open(output, 'r');
  try {const header = Buffer.alloc(12); const {bytesRead} = await handle.read(header, 0, 12, 0); if (bytesRead !== 12 || header.toString('ascii', 4, 8) !== 'ftyp') refused('Visual verification output is not an actual MP4 container.');}
  finally {await handle.close();}
  const decoded = path.join(work, 'decoded'); await fs.mkdir(decoded);
  await run(ffmpegPath, ['-v', 'error', '-nostdin', '-threads', '1', '-protocol_whitelist', 'file,pipe', '-i', output,
    '-map', '0:v:0', '-an', '-sn', '-dn', '-fps_mode', 'passthrough', '-frames:v', String(scene.durationFrames + 1), '-threads', '1', path.join(decoded, 'frame-%06d.png')], {signal, maxBytes: 1024});
  aborted(signal);
  const decodedFiles = (await fs.readdir(decoded)).filter(name => /^frame-\d{6}\.png$/.test(name)).sort();
  if (decodedFiles.length !== scene.durationFrames || decodedFiles.some((name, i) => name !== sourceFiles[i])) refused('Actual encoded video frame count differs from the source.');
  const rows = [];
  for (let i = 0; i < sourceFiles.length; i++) {
    aborted(signal);
    // A malformed generated frame can reject before the source reader closes.
    // Await both readers even on failure before the caller removes scratch.
    const compared = await Promise.allSettled([rgb(path.join(source, sourceFiles[i]), width, height, scene.width, scene.height), rgb(path.join(decoded, decodedFiles[i]), width, height)]);
    const failedRead = compared.find(result=>result.status==='rejected');
    if(failedRead)throw failedRead.reason;
    const [original,generated] = compared.map(result=>result.value);
    const row = {frame: i, ...measureRgb(original, generated, width, height, scene.background)}; rows.push(row);
    if (frames.includes(i)) {
      const diff = Buffer.alloc(original.length); for (let p = 0; p < diff.length; p++) diff[p] = Math.min(255, Math.abs(original[p] - generated[p]) * 3);
      await sharp({create: {width: width * 3, height, channels: 3, background: '#000000'}}).composite(
        [original, generated, diff].map((input, index) => ({input, raw: {width, height, channels: 3}, left: width * index, top: 0})))
        .png().toFile(path.join(work, `comparison-${i}.png`));
    }
  }
  const hiddenDirectory = path.join(work, 'all-hidden');
  const hidden = {...scene, layers: scene.layers.map(layer => ({...layer, visible: false}))};
  const hiddenFrame = frames[Math.floor(frames.length / 2)];
  await render({scene: hidden, images: {}}, {output: path.join(hiddenDirectory, 'unused.mp4'), height: 480, watermark: false, stills: [hiddenFrame], stillsOnly: true, signal});
  aborted(signal);
  const backgroundPixels = await rgb(path.join(hiddenDirectory, `frame-${hiddenFrame}.png`), width, height);
  const background = [1, 3, 5].map(index => parseInt(scene.background.slice(index, index + 2), 16)); let backgroundDelta = 0;
  for (let i = 0; i < backgroundPixels.length; i++) backgroundDelta = Math.max(backgroundDelta, Math.abs(backgroundPixels[i] - background[i % 3]));
  const result = summarize(rows, width, height, scene.layers.filter(layer => layer.text).length, backgroundDelta);
  result.evidence.elapsedMs = Date.now() - started;
  result.evidence.renderer = 'checked-in ReferenceMotion H264 with watermark disabled';
  await fs.writeFile(path.join(work, 'all-frame-metrics.json'), JSON.stringify(rows));
  await fs.writeFile(path.join(work, 'quality.json'), JSON.stringify(result, null, 2));
  return result;
}

module.exports = {verifySemanticReconstruction, measureRgb, summarize, ownedLocations, THRESHOLDS};
