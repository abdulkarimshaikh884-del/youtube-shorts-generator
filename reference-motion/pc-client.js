'use strict';

// Cloud-side adapter: validate data, dispatch to one authenticated owner PC,
// then persist owner-scoped assets. No Python, Chrome, model keys, or incoming
// connection to the PC is needed on the public web service.
const crypto = require('node:crypto');
const {performance} = require('node:perf_hooks');
const {LIMITS, durationLimit, validateInput, admitProbe, ReferenceMotionError} = require('./admission');
const {validateScene, assetIds} = require('./schema');
const {cleanAnalysis} = require('./project');
const {assertBoundedAnalysis} = require('./service');
const assets = require('./assets');

function invalid(message = 'The beta worker returned an unsupported reconstruction.') {
  throw new ReferenceMotionError('REFERENCE_WORKER_RESULT_INVALID', message, 503);
}
function plain(value) {return value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;}
function parseBody(response) {
  if (!Buffer.isBuffer(response?.body) || response.body.length > 26 * 1024 * 1024 || response.contentType !== 'application/json') invalid();
  try {const parsed = JSON.parse(response.body.toString('utf8')); if (!plain(parsed)) invalid(); return parsed;} catch {invalid();}
}

async function acceptAnalysis(result, {userId, plan, sourceHash, trimToSeconds, signal, persistImage = assets.upload, discardAssets = assets.discard}) {
  if (result.state !== 'REVIEW_REQUIRED' || result.exactRecreationGuaranteed !== false || result.analysisCredits !== 0 || !plain(result.admission)) invalid();
  const scene = validateScene(result.scene), analysis = cleanAnalysis(assertBoundedAnalysis(result.analysis));
  const source = result.admission;
  if (source.sourceSha256 !== sourceHash || source.analysisMode !== 'local' || source.cloudVideoSent !== false ||
      source.rawSourceRetained !== false || source.audioRetained !== false || typeof source.sourceHasAudio !== 'boolean') invalid();
  const admitted = admitProbe({streams: [{codec_type: 'video', index: source.sourceVideoStreamIndex,
    width: source.sourceWidth, height: source.sourceHeight, duration: source.originalDurationSeconds},
    ...(source.sourceHasAudio ? [{codec_type: 'audio'}] : [])]}, plan, trimToSeconds);
  if (scene.durationFrames !== admitted.durationFrames || scene.fps !== 30 || scene.durationFrames > durationLimit(plan) * 30 ||
      Math.max(scene.width, scene.height) > LIMITS.maxSide || scene.width !== source.width || scene.height !== source.height ||
      scene.width > admitted.sourceWidth || scene.height > admitted.sourceHeight ||
      Math.abs(scene.width / scene.height - admitted.sourceWidth / admitted.sourceHeight) > .04) invalid();
  const quality = analysis.quality;
  if (analysis.frameCount !== scene.durationFrames || analysis.width !== scene.width || analysis.height !== scene.height ||
      quality?.visualComparison !== 'PASS' || quality.comparedFrameCount !== scene.durationFrames || quality.failedFrameCount !== 0 ||
      quality.exactRecreation !== false || quality.maxMeanAbsoluteError >= 12 || quality.maxChangedPixelFractionOver30 >= .12 ||
      !Number.isFinite(quality.maxMeanAbsoluteError) || !Number.isFinite(quality.maxChangedPixelFractionOver30) ||
      (analysis.metadata?.networkRequests || 0) !== 0 || analysis.metadata?.provider || analysis.semantic) invalid();
  if (Buffer.byteLength(JSON.stringify({scene, analysis})) > 248 * 1024) invalid('The editable reconstruction exceeds its saved-project budget.');
  const ids = assetIds(scene);
  if (!plain(result.images) || Object.keys(result.images).length !== ids.length || ids.some(id => !Object.hasOwn(result.images, id))) invalid();
  let total = 0;
  // Validate *every* returned raster before any private database write.
  for (const id of ids) {
    const data = result.images[id];
    if (typeof data !== 'string' || data.length > 5500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) invalid();
    const bytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'); total += bytes.length;
    if (!bytes.length || bytes.length > 4000000 || total > 16 * 1024 * 1024) invalid();
    const metadata = await require('sharp')(bytes, {limitInputPixels: LIMITS.maxSide ** 2}).metadata();
    const declared = data.slice(11, data.indexOf(';'));
    const layers = scene.layers.filter(layer => layer.assetId === id);
    if (metadata.format !== declared || (metadata.pages || 1) !== 1 || metadata.width > 1600 || metadata.height > 1600 ||
        !layers.length || layers.some(layer => layer.width !== metadata.width || layer.height !== metadata.height)) invalid();
  }
  const images = {}, mediaAssets = {}, created = [];
  try {
    for (const id of ids) {
      if (signal?.aborted) throw new ReferenceMotionError('REFERENCE_CANCELLED', 'Reference analysis was cancelled.', 499);
      const stored = await persistImage({id: userId}, result.images[id]);
      if (!assets.validRef(stored.ref)) invalid();
      created.push(stored.ref); images[id] = stored.mediaData; mediaAssets[id] = stored.ref;
    }
    if (signal?.aborted) throw new ReferenceMotionError('REFERENCE_CANCELLED', 'Reference analysis was cancelled.', 499);
    return {state: 'REVIEW_REQUIRED', reconstructionScope: scene.version === 4 ? 'TRACKED_ARTWORK_AND_QUALIFIED_TEXT' : scene.layers.some(layer => layer.vector) ? 'GROUPED_VECTOR_ARTWORK' : 'PLANAR_IMAGE_LAYERS_ONLY',
      exactRecreationGuaranteed: false, scene, images, mediaAssets, analysis,
      admission: {...admitted, width: scene.width, height: scene.height, sourceSha256: sourceHash,
        rawSourceRetained: false, audioRetained: false, analysisMode: 'local', cloudVideoSent: false,
        processingLocation: 'OWNER_PC', processingMs: Math.min(240000, Math.max(0, Number(source.processingMs) || 0))}, analysisCredits: 0};
  } catch (error) {
    if (created.length) await discardAssets(userId, created).catch(() => {});
    throw error;
  }
}

function createPCClient({broker: injected, env = process.env, persistImage, discardAssets} = {}) {
  const configured = env.SC_REFERENCE_MOTION === 'true' && env.SC_REFERENCE_PROCESSOR === 'pc';
  const broker = injected || (configured ? require('./pc-broker').createBroker({token: env.SC_REFERENCE_PC_TOKEN}) : null);
  function status() {return {processingLocation: 'OWNER_PC', workerOnline: !!broker?.online(), beta: true};}
  async function processReference(input, {plan, userId, signal, releaseInput} = {}) {
    if (!userId || typeof userId !== 'string') throw new ReferenceMotionError('REFERENCE_AUTH_REQUIRED', 'Sign in before reference analysis.', 401);
    if (!broker?.online()) throw new ReferenceMotionError('REFERENCE_WORKER_OFFLINE', 'The free beta processing PC is offline. Keep your file and try again when it is available. No credits were charged.', 503);
    if (input?.ownerPcConsent !== true) throw new ReferenceMotionError('REFERENCE_PC_CONSENT_REQUIRED', 'Allow private processing on the ShortsCraft beta PC before uploading.', 422);
    if (input.analysisMode && input.analysisMode !== 'local') throw new ReferenceMotionError('REFERENCE_PC_LOCAL_ONLY', 'Only local pixel analysis is available in this free beta.', 422);
    const decoded = validateInput(input), sourceHash = crypto.createHash('sha256').update(decoded.bytes).digest('hex'), trimToSeconds = decoded.trimToSeconds;
    let payload = Buffer.from(JSON.stringify({input, plan: ['pro', 'promax'].includes(plan) ? plan : 'free', userId}));
    // The dispatcher retains only one encoded request, not two additional
    // complete copies through the whole multi-minute analysis.
    decoded.bytes.fill(0); decoded.bytes = null; input = null; releaseInput?.();
    const pending = broker.submit('analyze', payload, {signal});
    payload.fill(0); payload = null;
    const response = await pending, result = parseBody(response);
    response.body.fill(0); response.body = null;
    return acceptAnalysis(result, {userId, plan, sourceHash, trimToSeconds, signal, persistImage, discardAssets});
  }
  async function exportReference(document, {height = 480, watermark = true, signal} = {}) {
    if (!broker?.online()) throw new ReferenceMotionError('REFERENCE_WORKER_OFFLINE', 'The free beta processing PC is offline. Your saved project is unchanged.', 503);
    const scene = validateScene(document.scene), ids = assetIds(scene), images = document.images;
    if (![480, 720, 1080, 1440].includes(height) || typeof watermark !== 'boolean' || !plain(images) || Object.keys(images).length !== ids.length) invalid();
    let bytes = 0;
    for (const id of ids) {
      const data = images[id];
      if (typeof data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > 5500000) invalid();
      bytes += data.length;
    }
    if (bytes > 23 * 1024 * 1024) invalid('This edited project exceeds the free beta transport budget.');
    const started = performance.now();
    let payload = Buffer.from(JSON.stringify({document: {scene, images}, options: {height, watermark}}));
    const pending = broker.submit('render', payload, {signal});
    payload.fill(0); payload = null;
    const response = await pending;
    const buffer = response?.body;
    if (response?.contentType !== 'video/mp4' || !Buffer.isBuffer(buffer) || buffer.length < 1024 || buffer.length > 32 * 1024 * 1024 || buffer.toString('ascii', 4, 8) !== 'ftyp') invalid('The beta worker did not return a valid bounded MP4.');
    const even = n => Math.max(2, Math.round(n / 2) * 2), short = Math.min(scene.width, scene.height);
    return {buffer, metrics: {width: even(scene.width / short * height), height: even(scene.height / short * height), fps: 30, frames: scene.durationFrames, audioRetained: false, renderMs: performance.now() - started}};
  }
  return {broker, status, processReference, exportReference, close: () => broker?.close()};
}
module.exports = {createPCClient, acceptAnalysis, parseBody};
