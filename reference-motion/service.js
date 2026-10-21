'use strict';

// Local is the default. Explicit per-upload consent plus a server-side feature
// flag is required before a trimmed, silent clip reaches the fixed Gemini host.
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { LIMITS, ReferenceMotionError, validateInput, admitProbe } = require('./admission');
const {stopOwnedProcess}=require('./process-stop');
const WORKER = path.join(__dirname, 'analyze-worker.py');
let active = false;

function workerEnvironment() {
  const allowed = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL']);
  return { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toUpperCase()))),
    PYTHONIOENCODING: 'utf-8', OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1',
    PIP_NO_INDEX: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' };
}

function runProcess(executable, args, { signal, input, maxBytes = 512 * 1024, run = spawn } = {}) {
  return new Promise((resolve, reject) => {
    let child, stopped, settled = false, killing = false, stdoutBytes = 0, stderrBytes = 0;
    const stop=()=>{if(!killing&&child){killing=true;stopOwnedProcess(child);}};
    const chunks = [];
    const finish = (error, value) => {
      if (settled) return; settled = true; signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => {
      stopped = signal?.reason instanceof ReferenceMotionError ? signal.reason :
        new ReferenceMotionError('REFERENCE_CANCELLED', 'Reference analysis was cancelled.', 499);
      stop();
    };
    if (signal?.aborted) return finish(signal.reason instanceof ReferenceMotionError ? signal.reason :
      new ReferenceMotionError('REFERENCE_CANCELLED', 'Reference analysis was cancelled.', 499));
    try {
      child = run(executable, args, { cwd: __dirname, shell: false, windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'], env: workerEnvironment() });
    } catch { return finish(new ReferenceMotionError('REFERENCE_DEPENDENCY_UNAVAILABLE', 'A local video processing dependency is unavailable.', 503)); }
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', chunk => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxBytes) { stopped = new ReferenceMotionError('REFERENCE_OUTPUT_TOO_LARGE', 'Local analysis exceeded its output limit.', 413); stop(); }
      else chunks.push(chunk);
    });
    child.stderr.on('data', chunk => {
      stderrBytes += chunk.length;
      if (stderrBytes > 32 * 1024) { stopped = new ReferenceMotionError('REFERENCE_WORKER_FAILED', 'Local video processing produced excessive diagnostics.', 503); stop(); }
    });
    child.stdin.on('error', () => { /* The process close event owns failure. */ });
    child.on('error', () => finish(stopped || new ReferenceMotionError('REFERENCE_DEPENDENCY_UNAVAILABLE', 'A local video processing dependency is unavailable.', 503)));
    // Hold the concurrency slot until the terminated process has actually closed.
    child.on('close', code => stopped ? finish(stopped) : code !== 0
      ? finish(new ReferenceMotionError('REFERENCE_WORKER_FAILED', 'Local video processing could not complete this reference.', 422))
      : finish(null, Buffer.concat(chunks).toString('utf8')));
    child.stdin.end(input === undefined ? '' : input);
  });
}

async function removeScratch(directory) {
  const resolved = path.resolve(directory), parent = path.resolve(os.tmpdir());
  if (path.dirname(resolved) !== parent || !/^shortscraft-reference-[A-Za-z0-9]+$/.test(path.basename(resolved))) {
    throw new ReferenceMotionError('REFERENCE_SCRATCH_INVALID', 'Unsafe reference scratch path refused.', 503);
  }
  const marker = JSON.parse(await fs.readFile(path.join(resolved, 'owner.json'), 'utf8'));
  if (marker.directory !== resolved || marker.kind !== 'reference-motion-private-v1') throw new Error('Private scratch marker mismatch.');
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 75 });
}

function parseJson(value, stage) {
  try { return JSON.parse(value); }
  catch { throw new ReferenceMotionError('REFERENCE_WORKER_INVALID', `Local ${stage} returned an invalid document.`, 503); }
}

function assertBoundedAnalysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > 256 * 1024) {
    throw new ReferenceMotionError('REFERENCE_WORKER_INVALID', 'Local analysis returned invalid metadata.', 503);
  }
  const inspect = (item, depth = 0) => {
    if (depth > 14) throw new ReferenceMotionError('REFERENCE_WORKER_INVALID', 'Local analysis metadata is nested too deeply.', 503);
    if (typeof item === 'string' && (item.length > 2000 || /(?:data:|https?:\/\/|[A-Za-z]:[\\/]|\/Users\/|\/home\/)/i.test(item))) {
      throw new ReferenceMotionError('REFERENCE_WORKER_INVALID', 'Local analysis metadata contains unsupported references.', 503);
    }
    if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) {
      if (/^(?:path|directory|filename|token|secret|password|apiKey)$/i.test(key)) throw new ReferenceMotionError('REFERENCE_WORKER_INVALID', 'Local analysis metadata contains internal fields.', 503);
      inspect(child, depth + 1);
    }
  };
  inspect(value); return value;
}

function createService({ run = runProcess, validateScene, persistImage, discardAssets,
  ffprobePath = 'ffprobe', ffmpegPath = 'ffmpeg', pythonPath, deadlineMs = LIMITS.timeoutMs,
  allowPartialForDiagnostics = false, renderSerialise, geminiPlanner, geminiEnabled,
  semanticVerify, onSemanticEvidence } = {}) {
  async function processReference(input, { plan, userId, signal } = {}) {
    if (!userId || typeof userId !== 'string') throw new ReferenceMotionError('REFERENCE_AUTH_REQUIRED', 'Sign in before reference analysis.', 401);
    if (active) throw new ReferenceMotionError('REFERENCE_BUSY', 'Local reference analysis is busy. Retry shortly; no credits were charged.', 429);
    const admittedInput = validateInput(input), python = pythonPath || process.env.DESIGN_PIPELINE_PYTHON;
    const hasPython = !!python && path.isAbsolute(python) && fsSync.existsSync(python) && fsSync.existsSync(WORKER);
    const cloud = admittedInput.analysisMode === 'gemini';
    if (cloud && !(geminiEnabled === undefined ? require('./gemini-reference').configured() : geminiEnabled === true)) {
      throw new ReferenceMotionError('REFERENCE_GEMINI_UNAVAILABLE', 'Gemini reference analysis is not enabled on this server. No private clip was sent.', 503);
    }
    if (!cloud && !hasPython) {
      throw new ReferenceMotionError('REFERENCE_ENGINE_UNAVAILABLE', 'Local reference analysis is not configured on this host.', 503);
    }
    active = true;
    let directory, completed = false;
    const createdAssets = [], controller = new AbortController();
    const abort = () => controller.abort(new ReferenceMotionError('REFERENCE_CANCELLED', 'Reference analysis was cancelled.', 499));
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new ReferenceMotionError('REFERENCE_TIMEOUT', 'Local reference analysis exceeded its time limit.', 504)), Math.min(LIMITS.timeoutMs, Math.max(1000, deadlineMs)));
    const started = Date.now();
    try {
      directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shortscraft-reference-'));
      await fs.writeFile(path.join(directory, 'owner.json'), JSON.stringify({ kind: 'reference-motion-private-v1', directory: path.resolve(directory) }), { flag: 'wx' });
      const video = path.join(directory, `source.${admittedInput.extension}`), framesDirectory = path.join(directory, 'frames'), outputDirectory = path.join(directory, 'output');
      await fs.writeFile(video, admittedInput.bytes, { flag: 'wx' });
      await fs.mkdir(framesDirectory); await fs.mkdir(outputDirectory);
      const probe = parseJson(await run(ffprobePath, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', video], { signal: controller.signal }), 'media probe');
      const admission = admitProbe(probe, plan, admittedInput.trimToSeconds);
      const filters = `fps=30,scale=w='min(iw,${LIMITS.maxSide})':h='min(ih,${LIMITS.maxSide})':force_original_aspect_ratio=decrease:force_divisible_by=2`;
      await run(ffmpegPath, ['-v', 'error', '-nostdin', '-threads', '1', '-protocol_whitelist', 'file,pipe', '-i', video,
        '-map', `0:${admission.sourceVideoStreamIndex}`, '-an', '-sn', '-dn', '-t', String(admission.durationSeconds), '-vf', filters,
        '-frames:v', String(admission.durationFrames), '-threads', '1', path.join(framesDirectory, 'frame-%06d.png')], { signal: controller.signal, maxBytes: 1024 });
      const frames = (await fs.readdir(framesDirectory)).filter(name => /^frame-\d{6}\.png$/.test(name)).sort();
      if (frames.length !== admission.durationFrames) throw new ReferenceMotionError('REFERENCE_FRAME_COUNT_INVALID', 'The decoded video timing could not be verified.');
      const first = await require('sharp')(path.join(framesDirectory, frames[0]), { limitInputPixels: LIMITS.maxSide ** 2 }).metadata();
      let worker, candidate;
      if (cloud) {
        // Re-encode only the admitted first 5/10 seconds. Never forward original
        // audio, metadata, attachments, full over-limit input or local paths.
        const normalized = path.join(directory, 'analysis.mp4');
        await run(ffmpegPath, ['-v','error','-nostdin','-threads','1','-protocol_whitelist','file,pipe','-i',video,
          '-map',`0:${admission.sourceVideoStreamIndex}`,'-an','-sn','-dn','-map_metadata','-1','-t',String(admission.durationSeconds),
          '-vf',filters,'-frames:v',String(admission.durationFrames),'-c:v','libx264','-preset','veryfast','-crf','26',
          '-maxrate','2M','-bufsize','4M','-pix_fmt','yuv420p','-threads','1',normalized], {signal:controller.signal,maxBytes:1024});
        const stat = await fs.lstat(normalized);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > require('./gemini-reference').MAX_VIDEO) {
          throw new ReferenceMotionError('REFERENCE_GEMINI_VIDEO_LIMIT','The normalized clip exceeds the video analysis budget.',413);
        }
        candidate = await require('./semantic-engine').createCandidate({planner:geminiPlanner || require('./gemini-reference').createPlanner(),
          videoBytes:await fs.readFile(normalized),width:first.width,height:first.height,durationFrames:admission.durationFrames,
          framesDirectory,directory,python:hasPython?python:undefined,run,ffmpegPath,signal:controller.signal,renderSerialise,accountPlan:plan,
          verify:semanticVerify,onEvidence:onSemanticEvidence});
        if (candidate.accepted) worker = candidate.worker;
        else if (!hasPython) {
          throw new ReferenceMotionError('REFERENCE_RECONSTRUCTION_INCOMPLETE',
            'Gemini analyzed the video, but its native reconstruction did not pass verification and no local grouped adapter is available. No project was created.',422);
        }
      }
      if (!worker) {
        worker = parseJson(await run(python, ['-I', '-B', '-u', WORKER], { signal: controller.signal, maxBytes: 1024 * 1024,
          input: JSON.stringify({ version: 1, framesDirectory, outputDirectory, width: first.width, height: first.height,
            fps: LIMITS.fps, durationFrames: admission.durationFrames, sourceHasAudio: admission.sourceHasAudio }) }), 'motion analysis');
        if (worker.success === true && candidate) {
          worker.analysis = require('./semantic-engine').attachProviderAnalysis(worker.analysis,candidate.provider,
            {...candidate.semantic,reconstruction:'MEASURED_LOCAL_RECONSTRUCTION'},started);
          worker.analysis.warnings = [...(worker.analysis.warnings||[]).slice(0,19),
            'Gemini native reconstruction was not certified. This project uses measured local groups; words inside image groups are not native editable text.'];
        }
      }
      if (worker.success !== true) throw new ReferenceMotionError('REFERENCE_RECONSTRUCTION_UNSUPPORTED', 'This reference could not be reconstructed reliably. No analysis credits were charged.');
      const analysis = require('./project').cleanAnalysis(assertBoundedAnalysis(worker.analysis));
      // A rejected measured candidate can itself be too complex for the saved
      // scene contract. Report its bounded failed visual evidence before trying
      // to admit that geometry; never disguise it as a finished project or a
      // dependency outage. Diagnostic operators may still inspect it separately.
      if (analysis.quality?.visualComparison === 'FAIL' && allowPartialForDiagnostics !== true) {
        throw new ReferenceMotionError('REFERENCE_RECONSTRUCTION_INCOMPLETE',
          'The reconstructed animation did not pass comparison with the reference. No finished project or analysis charge was created.', 422,
          { analysis, admission: { ...admission, rawSourceRetained: false, audioRetained: false } });
      }
      const scene = (validateScene || require('./schema').validateScene)(worker.scene);
      if (scene.durationFrames !== admission.durationFrames || scene.fps !== LIMITS.fps || scene.width !== first.width || scene.height !== first.height) {
        throw new ReferenceMotionError('REFERENCE_SCENE_INVALID', 'The reconstructed scene did not match the admitted video.');
      }
      const files = worker.assets;
      // HTTP 200 / valid geometry is not visual acceptance. Only operator-side
      // evidence tools may inspect failed partial reconstructions as projects.
      const quality = analysis.quality;
      const nativeTextCount = scene.layers.filter(layer => layer.text).length;
      const nativeNoSourceProof = quality?.textRemoval === 'NATIVE_SCENE_NO_SOURCE_RASTER' &&
        quality.hiddenBackgroundMaxDelta === 0 && require('./schema').assetIds(scene).length === 0 &&
        analysis.metadata?.provider === 'gemini' && analysis.semantic?.reconstruction === 'NATIVE_RENDER_VERIFIED';
      if (scene.version === 4 && (quality?.nativeTextCount !== nativeTextCount ||
          (nativeTextCount > 0 && ((!nativeNoSourceProof && quality.textRemoval !== 'MASK_EXCLUDED_FLAT_BACKGROUND') || !['PARTIAL_NATIVE', 'NATIVE_MEASURED'].includes(quality.nativeText))))) {
        throw new ReferenceMotionError('REFERENCE_RECONSTRUCTION_INCOMPLETE',
          'Native text did not include matching source-removal evidence. No project or analysis charge was created.', 422);
      }
      const comparedAllFrames = quality?.comparedFrameCount === scene.durationFrames && quality.failedFrameCount === 0 &&
        quality.maxMeanAbsoluteError < 12 && quality.maxChangedPixelFractionOver30 < 0.12 &&
        (!scene.layers.some(layer=>layer.vector || layer.text) || (quality.minForegroundRecall >= .90 && quality.minForegroundPrecision >= .90));
      if ((quality?.visualComparison !== 'PASS' || !comparedAllFrames) && allowPartialForDiagnostics !== true) {
        throw new ReferenceMotionError('REFERENCE_RECONSTRUCTION_INCOMPLETE',
          'The reconstructed animation did not pass comparison with the reference. No finished project or analysis charge was created.', 422,
          { analysis, admission: { ...admission, rawSourceRetained: false, audioRetained: false } });
      }
      if (!Array.isArray(files) || files.length > 12) throw new ReferenceMotionError('REFERENCE_ASSETS_INVALID', 'The reconstructed assets are incomplete.');
      if (Buffer.byteLength(JSON.stringify({ scene, analysis })) > 248 * 1024) {
        throw new ReferenceMotionError('REFERENCE_PROJECT_TOO_LARGE', 'The reconstructed editable timeline exceeds the existing saved-project limit. No project or analysis charge was created.', 413);
      }
      const images = {}, mediaAssets = {}, seen = new Set(), verifiedAssets = [];
      const persist = persistImage || require('./assets').upload;
      let outputBytes = 0;
      for (const asset of files) {
        if (!asset || !/^[A-Za-z0-9_-]{1,40}$/.test(asset.id) || seen.has(asset.id) || !/^card-(?:[1-9]|1[0-2])\.png$/.test(asset.filename)) {
          throw new ReferenceMotionError('REFERENCE_ASSETS_INVALID', 'The local worker returned an invalid asset reference.');
        }
        seen.add(asset.id);
        const assetPath = path.join(outputDirectory, asset.filename), stat = await fs.lstat(assetPath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw new ReferenceMotionError('REFERENCE_ASSETS_INVALID', 'A local card asset exceeded its safe bounds.');
        outputBytes += stat.size;
        if (outputBytes > 16 * 1024 * 1024) throw new ReferenceMotionError('REFERENCE_OUTPUT_TOO_LARGE', 'Reconstructed cards exceeded the output limit.', 413);
        const bytes = await fs.readFile(assetPath), metadata = await require('sharp')(bytes, { limitInputPixels: LIMITS.maxSide ** 2 }).metadata();
        if (metadata.format !== 'png' || metadata.width !== asset.width || metadata.height !== asset.height || (metadata.pages || 1) !== 1) {
          throw new ReferenceMotionError('REFERENCE_ASSETS_INVALID', 'The actual card image did not match its manifest.');
        }
        verifiedAssets.push({ id: asset.id, bytes });
      }
      // The schema owns the asset-id relationship; no extra hidden raster source
      // may be smuggled into the editable project or sent to another account.
      const referenced = new Set(require('./schema').assetIds(scene));
      if (referenced.size !== seen.size || [...seen].some(id => !referenced.has(id))) throw new ReferenceMotionError('REFERENCE_ASSETS_INVALID', 'Scene assets and reconstructed cards did not match.');
      if (controller.signal.aborted) throw controller.signal.reason;
      // Validate every asset and relationship before committing any private bytes.
      for (const asset of verifiedAssets) {
        if (controller.signal.aborted) throw controller.signal.reason;
        const stored = await persist({ id: userId }, 'data:image/png;base64,' + asset.bytes.toString('base64'));
        createdAssets.push(stored.ref); mediaAssets[asset.id] = stored.ref; images[asset.id] = stored.mediaData;
      }
      if (controller.signal.aborted) throw controller.signal.reason;
      completed = true;
      return { state: 'REVIEW_REQUIRED', reconstructionScope: scene.version === 4 ? 'TRACKED_ARTWORK_AND_QUALIFIED_TEXT' : scene.layers.some(layer=>layer.vector)?'GROUPED_VECTOR_ARTWORK':'PLANAR_IMAGE_LAYERS_ONLY', exactRecreationGuaranteed: false,
        scene, images, mediaAssets, analysis, admission: { ...admission, width: first.width, height: first.height,
        sourceSha256: crypto.createHash('sha256').update(admittedInput.bytes).digest('hex'), rawSourceRetained: false,
        audioRetained: false, analysisMode: admittedInput.analysisMode, cloudVideoSent: cloud,
        processingMs: Date.now() - started }, analysisCredits: 0 };
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (!completed && createdAssets.length) {
        const discard = discardAssets || require('./assets').discard;
        await discard(userId, createdAssets).catch(() => {});
      }
      try { if (directory) await removeScratch(directory); }
      finally { active = false; }
    }
  }
  return { processReference, busy: () => active };
}

const defaultService = createService();
module.exports = { createService, processReference: defaultService.processReference, busy: () => active,
  runProcess, workerEnvironment, removeScratch, assertBoundedAnalysis };
