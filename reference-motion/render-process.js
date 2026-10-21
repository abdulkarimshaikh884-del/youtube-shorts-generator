'use strict';

// The entire checked-in render (including webpack and browser launch) runs in
// an owned process family. A timeout is not a race that leaves Chrome writing
// into a scratch directory after its caller has already removed that directory.
const {spawn} = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {validateScene, assetIds} = require('./schema');
const {ReferenceMotionError} = require('./admission');
const WORKER = path.join(__dirname, 'render-worker.js');
const DEADLINE_MS = 180000, MAX_INPUT_BYTES = 72 * 1024 * 1024, MAX_DIAGNOSTIC_BYTES = 64 * 1024;
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
function invalid(message) {throw new ReferenceMotionError('REFERENCE_RENDER_INPUT_INVALID', message, 422);}
function inside(root, file) {const relative = path.relative(root, file); return relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);}
function plain(value) {return value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));}
function fields(value, allowed) {return plain(value) && Object.keys(value).every(key => allowed.includes(key));}

function workerEnvironment(env = process.env) {
  const allowed = new Set(['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','LANG','LC_ALL','HOME','USERPROFILE','LOCALAPPDATA','APPDATA',
    'PROGRAMFILES','PROGRAMFILES(X86)','PUPPETEER_CACHE_DIR','PUPPETEER_EXECUTABLE_PATH','PUPPETEER_DOWNLOAD_PATH',
    'XDG_CACHE_HOME','XDG_CONFIG_HOME','XDG_RUNTIME_DIR','NODE_ENV']);
  // In particular, no NODE_OPTIONS/NODE_PATH, provider keys, database URL,
  // cookies or HTTP proxy credentials are inherited by the renderer or Chrome.
  return Object.fromEntries(Object.entries(env).filter(([key]) => allowed.has(key.toUpperCase())));
}

function validateJob(document, options = {}) {
  if (!fields(document, ['scene','images']) || !fields(options, ['output','height','watermark','stills','stillsOnly','signal'])) invalid('Render requires a controlled scene and options.');
  const scene = validateScene(document.scene), images = document.images, ids = assetIds(scene);
  if (!plain(images) || Object.keys(images).length !== ids.length || ids.some(id => !Object.hasOwn(images, id))) invalid('Missing private image planes.');
  let total = 0;
  for (const id of ids) {
    const value = images[id];
    if (typeof value !== 'string' || value.length > 5500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) invalid('Unsafe private image plane.');
    total += value.length;
  }
  const {output, height = 480, watermark = true, stills = [], stillsOnly = false} = options;
  const resolved = typeof output === 'string' && path.isAbsolute(output) && !/[\u0000-\u001f]/.test(output) ? path.resolve(output) : '';
  const audit = path.resolve(__dirname, '../audit_results/reference-motion');
  if (!resolved || path.extname(resolved).toLowerCase() !== '.mp4' || ![path.resolve(os.tmpdir()), audit].some(root => inside(root, resolved))) invalid('Render output must stay in private temporary or reference audit storage.');
  if (![480,720,1080,1440].includes(height) || typeof watermark !== 'boolean' || typeof stillsOnly !== 'boolean' || !Array.isArray(stills) || stills.length > 12 || stills.some(frame => !Number.isInteger(frame) || frame < 0 || frame >= scene.durationFrames)) invalid('Invalid controlled render resolution or evidence frames.');
  const short = Math.min(scene.width,scene.height), even = value => Math.max(2,Math.round(value / 2) * 2);
  const outputWidth = even(scene.width / short * height), outputHeight = even(scene.height / short * height);
  // Short-edge resolution must not turn an otherwise bounded but extremely
  // narrow canvas into hundreds of megapixels inside Chrome/FFmpeg.
  if (outputWidth > 8192 || outputHeight > 8192 || outputWidth * outputHeight > 16777216) invalid('Reference aspect ratio exceeds the controlled render pixel budget.');
  if (stillsOnly && !stills.length) invalid('Still-only rendering requires an evidence frame.');
  const job = {document: {scene, images}, options: {output: resolved, height, watermark, stills, stillsOnly}};
  const encoded = JSON.stringify(job);
  if (total > MAX_INPUT_BYTES || Buffer.byteLength(encoded) > MAX_INPUT_BYTES) invalid('Private render input exceeds its bounded transport.');
  return {job, encoded};
}

async function checkOutputLocation(filename) {
  // Existing parents and the destination itself cannot be symlink/junction
  // aliases into another owner's files. New evidence directories may be absent.
  let current = path.resolve(filename);
  for (;;) {
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !samePath(await fs.realpath(current), current)) invalid('Aliased render output location refused.');
      if (current !== filename && !stat.isDirectory()) invalid('Render output parent is not a directory.');
    } catch (error) {if (error.code !== 'ENOENT') throw error;}
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
}

function validateMetrics(value, job) {
  const fieldsAllowed = ['width','height','frames','fps','audioRetained','renderMs'];
  const scene = job.document.scene, even = n => Math.max(2, Math.round(n / 2) * 2), short = Math.min(scene.width,scene.height);
  return fields(value, fieldsAllowed) && Object.keys(value).length === fieldsAllowed.length &&
    value.width === even(scene.width / short * job.options.height) && value.height === even(scene.height / short * job.options.height) &&
    value.frames === scene.durationFrames && value.fps === scene.fps && value.audioRetained === false &&
    typeof value.renderMs === 'number' && Number.isFinite(value.renderMs) && value.renderMs >= 0 && value.renderMs <= DEADLINE_MS + 30000;
}

function killTree(child, {platform = process.platform, spawnImpl = spawn} = {}) {
  if (!Number.isSafeInteger(child.pid) || child.pid <= 0) return Promise.resolve(false);
  if (platform !== 'win32') {
    // The worker alone is started as a detached process group on POSIX; never
    // target the app's own group or discover/kill unrelated Chrome processes.
    try {process.kill(-child.pid, 'SIGKILL'); return Promise.resolve(true);}
    catch (error) {if (error.code === 'ESRCH') return Promise.resolve(true); try {child.kill('SIGKILL');} catch {} return Promise.resolve(false);}
  }
  return new Promise(resolve => {
    let killer, done = false;
    const finish = ok => {if (done) return; done = true; if (!ok && child.exitCode === null) {try {child.kill('SIGKILL');} catch {}} resolve(ok);};
    try {
      killer = spawnImpl('taskkill.exe', ['/PID',String(child.pid),'/T','/F'], {shell:false,windowsHide:true,stdio:'ignore',env:workerEnvironment()});
      killer.once('error', () => finish(false)); killer.once('close', code => finish(code === 0));
    } catch {finish(false);}
  });
}

function renderInWorker(document, options = {}, dependencies = {}) {
  const {job, encoded} = validateJob(document, options), signal = options.signal;
  const spawnImpl = dependencies.spawnImpl || spawn;
  const timeoutMs = Math.min(DEADLINE_MS, Math.max(10, dependencies.timeoutMs || DEADLINE_MS));
  return new Promise((resolve, reject) => {
    let child, failure, message, closed = false, settled = false, stopping, diagnosticBytes = 0, timer;
    const cancelled = () => signal?.reason instanceof Error ? signal.reason : new ReferenceMotionError('REFERENCE_RENDER_CANCELLED','Reference render was cancelled.',499);
    const finish = async (error, metrics) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      // The process close event and completed tree termination both precede
      // resolution. Callers can now safely remove owned scratch/output files.
      if (stopping) await stopping;
      error ? reject(error) : resolve(metrics);
    };
    const stop = error => {
      failure ||= error;
      if (!child || closed || stopping) return;
      stopping = killTree(child, dependencies).then(ok => {
        if (!ok) failure = new ReferenceMotionError('REFERENCE_RENDER_TERMINATION_FAILED','Render stopped but process-family termination could not be confirmed.',503);
      });
    };
    const abort = () => stop(cancelled());
    if (signal?.aborted) {void finish(cancelled()); return;}
    // Includes startup, bundling, browser launch, composition discovery, all
    // evidence stills, encoding and browser shutdown—not just renderMedia().
    timer = setTimeout(() => stop(new ReferenceMotionError('REFERENCE_RENDER_TIMEOUT','Reference render exceeded its whole-process time budget.',504)), timeoutMs);
    signal?.addEventListener('abort', abort, {once:true});
    try {
      child = spawnImpl(process.execPath, [WORKER], {cwd:__dirname,shell:false,windowsHide:true,detached:process.platform !== 'win32',stdio:['pipe','pipe','pipe','ipc'],env:workerEnvironment()});
    } catch {void finish(new ReferenceMotionError('REFERENCE_RENDER_UNAVAILABLE','The controlled reference renderer could not start.',503)); return;}
    for (const stream of [child.stdout,child.stderr]) stream.on('data', chunk => {
      diagnosticBytes += chunk.length;
      if (diagnosticBytes > MAX_DIAGNOSTIC_BYTES) stop(new ReferenceMotionError('REFERENCE_RENDER_OUTPUT_LIMIT','Reference renderer exceeded its diagnostic limit.',503));
    });
    child.stdin.on('error', () => {});
    child.on('message', value => {
      if (message || !fields(value,['success','metrics','code']) || Buffer.byteLength(JSON.stringify(value)) > 4096 || value.success !== true || !validateMetrics(value.metrics,job)) {
        stop(new ReferenceMotionError('REFERENCE_RENDER_FAILED','The controlled renderer did not return verified completion data.',503)); return;
      }
      message = value;
    });
    child.once('error', () => {failure ||= new ReferenceMotionError('REFERENCE_RENDER_UNAVAILABLE','The controlled reference renderer could not start.',503);});
    child.once('close', code => {
      closed = true;
      void finish(failure || (code !== 0 || !message ? new ReferenceMotionError('REFERENCE_RENDER_FAILED','The controlled reference renderer could not complete.',503) : null),message?.metrics);
    });
    if (signal?.aborted) abort();
    child.stdin.end(encoded);
  });
}

module.exports = {renderInWorker, validateJob, checkOutputLocation, workerEnvironment, validateMetrics, killTree, DEADLINE_MS, MAX_INPUT_BYTES};
