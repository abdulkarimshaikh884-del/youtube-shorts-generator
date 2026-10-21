'use strict';

// Outbound-only, one-job-at-a-time PC beta. The broker supplies data, never a
// path, URL, executable or source code. No listening port/tunnel is opened.
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {fields, validateBaseUrl, childEnvironment, loadConfig} = require('./pc-worker-config');
const MAX_INPUT = 29 * 1024 * 1024, MAX_RENDER_INPUT = 74 * 1024 * 1024, MAX_OUTPUT = 29 * 1024 * 1024;
const DEADLINE_MS = 180000, REQUEST_MS = 20000, PULSE_MS = 8000;
const FAILURE_CODES = new Set(['REFERENCE_PC_INPUT_INVALID','REFERENCE_PC_DEPENDENCY_UNAVAILABLE','REFERENCE_PC_MEMORY_LOW',
  'REFERENCE_PC_JOB_TIMEOUT','REFERENCE_PC_CANCELLED','REFERENCE_PC_JOB_FAILED','REFERENCE_WORKER_FAILED',
  'REFERENCE_RECONSTRUCTION_UNSUPPORTED','REFERENCE_RECONSTRUCTION_INCOMPLETE','REFERENCE_TOO_LONG',
  'REFERENCE_SOURCE_TOO_LONG','REFERENCE_INPUT_INVALID','REFERENCE_INPUT_TOO_LARGE','REFERENCE_MEDIA_INVALID',
  'REFERENCE_RENDER_FAILED','REFERENCE_RENDER_TIMEOUT','REFERENCE_DIMENSIONS_UNSUPPORTED','REFERENCE_DURATION_UNKNOWN',
  'REFERENCE_CONTAINER_INVALID','REFERENCE_DEPENDENCY_UNAVAILABLE','REFERENCE_ENGINE_UNAVAILABLE','REFERENCE_FRAME_COUNT_INVALID',
  'REFERENCE_SCENE_INVALID','REFERENCE_ASSETS_INVALID','REFERENCE_PROJECT_TOO_LARGE','REFERENCE_OUTPUT_TOO_LARGE',
  'REFERENCE_WORKER_INVALID','REFERENCE_TIMEOUT','REFERENCE_CANCELLED']);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
function failure(code) {const error = Error(code); error.code = code; return error;}
function safeCode(error) {return FAILURE_CODES.has(error?.code) ? error.code : 'REFERENCE_PC_JOB_FAILED';}
function validateClaim(value) {
  if (!fields(value, ['id','kind','lease']) || !uuid(value.id) || !['analyze','render'].includes(value.kind) ||
      typeof value.lease !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(value.lease)) throw failure('REFERENCE_PC_INPUT_INVALID');
  return value;
}
function validateInput(kind, value) {
  if (kind === 'analyze') {
    if (!fields(value, ['input','plan','userId']) || !['free','pro','promax'].includes(value.plan) ||
        typeof value.userId !== 'string' || value.userId.length < 1 || value.userId.length > 128 ||
        !fields(value.input, ['video','trimToSeconds','analysisMode','ownerPcConsent']) ||
        ![undefined,'local'].includes(value.input.analysisMode) || ![undefined,true].includes(value.input.ownerPcConsent)) throw failure('REFERENCE_PC_INPUT_INVALID');
    require('./admission').validateInput(value.input);
    return value;
  }
  if (kind !== 'render' || !fields(value, ['document','options']) || !fields(value.document, ['scene','images']) ||
      !fields(value.options, ['height','watermark']) || ![480,720,1080,1440].includes(value.options.height) ||
      typeof value.options.watermark !== 'boolean') throw failure('REFERENCE_PC_INPUT_INVALID');
  const scene = require('./schema').validateScene(value.document.scene), ids = require('./schema').assetIds(scene), images = value.document.images;
  if (!fields(images, ids) || Object.keys(images).length !== ids.length || ids.some(id => !Object.hasOwn(images, id))) throw failure('REFERENCE_PC_INPUT_INVALID');
  let bytes = 0;
  for (const id of ids) {
    if (typeof images[id] !== 'string' || images[id].length > 5500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(images[id])) throw failure('REFERENCE_PC_INPUT_INVALID');
    bytes += images[id].length;
  }
  if (bytes > MAX_RENDER_INPUT) throw failure('REFERENCE_PC_INPUT_INVALID');
  return {document: {scene, images}, options: value.options};
}
async function readBounded(response, limit) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {await response.body?.cancel(); throw failure('REFERENCE_PC_INPUT_INVALID');}
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(), chunks = []; let total = 0;
  try {
    for (;;) {const {done, value} = await reader.read(); if (done) break; total += value.length;
      if (total > limit) {await reader.cancel(); throw failure('REFERENCE_PC_INPUT_INVALID');} chunks.push(Buffer.from(value));}
    return Buffer.concat(chunks);
  } finally {reader.releaseLock();}
}
function signalWithTimeout(parent, timeoutMs) {
  const controller = new AbortController(), abort = () => controller.abort(parent?.reason || failure('REFERENCE_PC_CANCELLED'));
  if (parent?.aborted) abort(); else parent?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(() => controller.abort(failure('REFERENCE_PC_JOB_TIMEOUT')), timeoutMs);
  return {signal: controller.signal, close() {clearTimeout(timer); parent?.removeEventListener('abort', abort);}};
}
function createClient(config, {fetchImpl = fetch, allowLoopback = false, requestMs = REQUEST_MS} = {}) {
  const origin = validateBaseUrl(config.baseUrl, {allowLoopback});
  if (!uuid(config.workerId) || typeof config.token !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(config.token)) throw failure('REFERENCE_PC_INPUT_INVALID');
  async function request(route, {method = 'GET', body, lease, type = 'application/json', signal, limit = 16384} = {}) {
    if (!/^\/api\/reference-motion\/worker\/(?:claim|jobs\/[a-f0-9-]{36}\/(?:input|pulse|complete|fail))$/.test(route)) throw failure('REFERENCE_PC_INPUT_INVALID');
    const deadline = signalWithTimeout(signal, requestMs);
    try {
      const response = await fetchImpl(origin + route, {method, redirect: 'error', signal: deadline.signal,
        headers: {Authorization: `Bearer ${config.token}`, ...(lease ? {'X-Reference-Lease': lease} : {}),
          ...(body !== undefined ? {'Content-Type': type} : {})}, body});
      // Refuse synthetic/custom fetch redirects too; production fetch uses
      // redirect:error and will fail before credentials can reach another host.
      if (response.redirected || response.status >= 300 && response.status < 400) throw failure('REFERENCE_PC_INPUT_INVALID');
      const bytes = await readBounded(response, limit);
      if (response.status === 404 || response.status === 410) {const error = failure('REFERENCE_PC_CANCELLED'); error.leaseGone = true; throw error;}
      if (![200,201,202,204].includes(response.status)) {const error = failure('REFERENCE_PC_JOB_FAILED'); error.status = response.status; throw error;}
      return {status: response.status, bytes, contentType: response.headers.get('content-type') || ''};
    } finally {deadline.close();}
  }
  return {
    async claim(signal) {const reply = await request('/api/reference-motion/worker/claim', {method:'POST', body:JSON.stringify({workerId:config.workerId}), signal});
      if (reply.status === 204) return null;
      if (!reply.contentType.startsWith('application/json')) throw failure('REFERENCE_PC_INPUT_INVALID');
      return validateClaim(JSON.parse(reply.bytes));},
    async input(job, signal) {const reply = await request(`/api/reference-motion/worker/jobs/${job.id}/input`, {lease:job.lease, signal, limit:job.kind === 'render' ? MAX_RENDER_INPUT : MAX_INPUT});
      if (!reply.contentType.startsWith('application/json')) throw failure('REFERENCE_PC_INPUT_INVALID');
      return validateInput(job.kind, JSON.parse(reply.bytes));},
    async pulse(job, signal) {await request(`/api/reference-motion/worker/jobs/${job.id}/pulse`, {method:'POST',body:'{}',lease:job.lease,signal});},
    async complete(job, output, signal) {
      const render = job.kind === 'render', body = render ? output.buffer : Buffer.from(JSON.stringify(output));
      if (!Buffer.isBuffer(body) || body.length > (render ? 32 * 1024 * 1024 : MAX_OUTPUT) || render &&
          (body.length < 1024 || body.toString('ascii', 4, 8) !== 'ftyp')) throw failure('REFERENCE_PC_INPUT_INVALID');
      await request(`/api/reference-motion/worker/jobs/${job.id}/complete`, {method:'POST',body,lease:job.lease,type:render ? 'video/mp4' : 'application/json',signal});
    },
    async fail(job, error) {await request(`/api/reference-motion/worker/jobs/${job.id}/fail`, {method:'POST',body:JSON.stringify({code:safeCode(error)}),lease:job.lease});},
  };
}
function runProbe(executable, args, {run = spawn, timeoutMs = 12000} = {}) {
  return new Promise((resolve, reject) => {
    let child, chunks = [], size = 0, settled = false;
    const finish = (error, result) => {if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(result);};
    const timer = setTimeout(() => {if(child)require('./process-stop').stopOwnedProcess(child); finish(failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE'));}, timeoutMs);
    try {child = run(executable, args, {shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'], env:{...childEnvironment(),
      PYTHONIOENCODING:'utf-8',OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',PIP_NO_INDEX:'1'}});}
    catch {finish(failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE')); return;}
    child.stdout.on('data', chunk => {size += chunk.length; if (size > 16384) {require('./process-stop').stopOwnedProcess(child); finish(failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE'));} else chunks.push(chunk);});
    child.stderr.resume(); child.once('error', () => finish(failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE')));
    child.once('close', code => code === 0 ? finish(null,Buffer.concat(chunks).toString('utf8')) : finish(failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE')));
  });
}
async function doctor(config, {probe = runProbe, freeMemory = os.freemem, minimumFreeBytes = 2 * 1024 ** 3} = {}) {
  if (freeMemory() < minimumFreeBytes) throw failure('REFERENCE_PC_MEMORY_LOW');
  if (!path.isAbsolute(config.pythonPath) || !fsSync.existsSync(config.pythonPath)) throw failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE');
  const python = JSON.parse(await probe(config.pythonPath, ['-I','-B','-c',
    'import json,sys,numpy,cv2; print(json.dumps({"python":sys.version.split()[0],"numpy":numpy.__version__,"opencv":cv2.__version__}))']));
  if (!fields(python, ['python','numpy','opencv']) || Object.values(python).some(value => typeof value !== 'string' || value.length > 40)) throw failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE');
  const ffmpeg = (await probe(config.ffmpegPath || 'ffmpeg', ['-version'])).split(/\r?\n/)[0];
  const ffprobe = (await probe(config.ffprobePath || 'ffprobe', ['-version'])).split(/\r?\n/)[0];
  if (!ffmpeg.startsWith('ffmpeg version ') || !ffprobe.startsWith('ffprobe version ')) throw failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE');
  const base = path.resolve(__dirname, '../remotion');
  const dependencies = {};
  for (const name of ['@remotion/bundler','@remotion/renderer','react','react-dom','remotion']) {
    const filename = require.resolve(name + '/package.json', {paths:[base]});
    dependencies[name] = JSON.parse(await fs.readFile(filename,'utf8')).version;
  }
  const browser = await require('puppeteer').executablePath();
  if (typeof browser !== 'string' || !fsSync.existsSync(browser)) throw failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE');
  for (const file of ['analyze-worker.py','tracked-worker.py','vector-worker.py','native-text-worker.py',
    'render-worker.js','../remotion/src/ReferenceRoot.tsx','../flagship/assets/NotoSansDevanagari.ttf','fonts/LMRoman10-Regular.otf']) {
    if (!fsSync.existsSync(path.resolve(__dirname,file))) throw failure('REFERENCE_PC_DEPENDENCY_UNAVAILABLE');
  }
  await require('sharp')({create:{width:1,height:1,channels:4,background:'#00000000'}}).png().toBuffer();
  return {success:true, python, ffmpeg:ffmpeg.slice(0,160), ffprobe:ffprobe.slice(0,160), dependencies,
    freeMemoryMiB:Math.floor(freeMemory()/1024**2), providerCalls:false, nativeOcrRequired:false, inboundPort:false};
}
function defaultProcessor(config) {
  const service = require('./service').createService({pythonPath:config.pythonPath,
    ffmpegPath:config.ffmpegPath || 'ffmpeg',ffprobePath:config.ffprobePath || 'ffprobe',geminiEnabled:false,
    persistImage:async (_user, mediaData) => ({ref:{jobId:'job_'+crypto.randomBytes(16).toString('hex'),assetPath:'original.webp'},mediaData}),
    discardAssets:async () => {}});
  return async (kind, value, signal) => kind === 'analyze'
    ? service.processReference(value.input,{plan:value.plan,userId:value.userId,signal})
    : require('./render').exportReference(value.document,{...value.options,signal});
}
async function performJob(job, {client, processJob, signal, pulseMs = PULSE_MS, deadlineMs = DEADLINE_MS, log = () => {}}) {
  const deadline = signalWithTimeout(signal, deadlineMs), controller = new AbortController();
  const abort = () => controller.abort(deadline.signal.reason || failure('REFERENCE_PC_CANCELLED'));
  deadline.signal.addEventListener('abort',abort,{once:true});
  if (deadline.signal.aborted) abort();
  let pulseInFlight = false, leaseGone = false;
  const timer = setInterval(async () => {
    if (pulseInFlight || controller.signal.aborted) return;
    pulseInFlight = true;
    try {await client.pulse(job,controller.signal);}
    catch (error) {leaseGone = error.leaseGone === true; controller.abort(leaseGone ? failure('REFERENCE_PC_CANCELLED') : failure('REFERENCE_PC_JOB_FAILED'));}
    finally {pulseInFlight = false;}
  },pulseMs);
  try {
    await client.pulse(job,controller.signal);
    const input = await client.input(job,controller.signal);
    if (controller.signal.aborted) throw controller.signal.reason;
    const output = await processJob(job.kind,input,controller.signal);
    if (controller.signal.aborted) throw controller.signal.reason;
    await client.complete(job,output,controller.signal);
    log({event:'job-complete',kind:job.kind});
    return true;
  } catch (error) {
    const reported = controller.signal.aborted ? controller.signal.reason : error;
    if (!leaseGone) await client.fail(job,reported).catch(() => {});
    log({event:'job-failed',kind:job.kind,code:safeCode(reported)});
    return false;
  } finally {clearInterval(timer); deadline.close(); deadline.signal.removeEventListener('abort',abort);}
}
async function pause(ms, signal) {
  if (signal?.aborted) return;
  await new Promise(resolve => {const done = () => {clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};
    const timer = setTimeout(done,ms);signal?.addEventListener('abort',done,{once:true});});
}
async function runWorker(config, {client = createClient(config), processJob = defaultProcessor(config),
  preflight = doctor, freeMemory = os.freemem, signal, pollMs = 5000, maxIterations = Infinity, log = event => process.stdout.write(JSON.stringify(event)+'\n')} = {}) {
  const capabilities = await preflight(config);
  log({event:'worker-ready',providerCalls:false,inboundPort:false,nativeOcrRequired:false});
  let errors = 0;
  for (let iteration = 0; !signal?.aborted && iteration < maxIterations; iteration++) {
    try {
      const job = await client.claim(signal); errors = 0;
      if (job) {
        // Recheck available RAM before each heavy job, not just at startup.
        if (freeMemory() < 2 * 1024**3) {await client.fail(job,failure('REFERENCE_PC_MEMORY_LOW')); log({event:'job-failed',kind:job.kind,code:'REFERENCE_PC_MEMORY_LOW'});}
        else await performJob(job,{client,processJob,signal,log});
      }
    } catch (error) {
      if (signal?.aborted) break;
      errors = Math.min(errors+1,4); log({event:'broker-unavailable',code:safeCode(error)});
    }
    await pause(Math.min(60000,pollMs * 2**errors),signal);
  }
  return capabilities;
}
async function main() {
  if (!['doctor','run'].includes(process.argv[2]) || process.argv.slice(3).some(value => value !== '--dev-loopback')) throw failure('REFERENCE_PC_INPUT_INVALID');
  const allowLoopback = process.argv.includes('--dev-loopback'), config = await loadConfig({allowLoopback});
  if (process.argv[2] === 'doctor') {process.stdout.write(JSON.stringify(await doctor(config))+'\n');return;}
  const filename = path.join(config.directory,'worker-state.json'), stopFile = path.join(config.directory,'stop-request.json');
  const state = {kind:'shortscraft-reference-pc-worker-process-v1',pid:process.pid,
    bornAtUnixMs:Math.floor(Date.now()-process.uptime()*1000),nodePath:process.execPath,
    scriptPath:__filename,workerId:config.workerId};
  // A live lock is never stolen. A stale lock must be removed by the guarded
  // start helper after checking that its exact process no longer exists.
  await fs.writeFile(filename,JSON.stringify(state),{flag:'wx',mode:0o600});
  await fs.rm(stopFile,{force:true});
  const controller = new AbortController(), stop = () => controller.abort(failure('REFERENCE_PC_CANCELLED'));
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const stopPoll = setInterval(async () => {try {const stat=await fs.lstat(stopFile);if(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<4096){const marker=JSON.parse(await fs.readFile(stopFile,'utf8'));if(marker.kind==='shortscraft-reference-pc-worker-stop-v1'&&marker.workerId===config.workerId)stop();}}catch{}},1000);
  try {await runWorker(config,{signal:controller.signal,client:createClient(config,{allowLoopback})});}
  finally {clearInterval(stopPoll);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
    try {const saved=JSON.parse(await fs.readFile(filename,'utf8'));if(saved.pid===process.pid&&saved.workerId===config.workerId)await fs.rm(filename,{force:true});}catch{}
    await fs.rm(stopFile,{force:true});}
}
if(require.main===module)main().catch(error=>{process.stderr.write(JSON.stringify({event:'worker-stopped',code:safeCode(error)})+'\n');process.exitCode=1;});
module.exports={MAX_INPUT,MAX_RENDER_INPUT,MAX_OUTPUT,FAILURE_CODES,validateClaim,validateInput,readBounded,
  signalWithTimeout,createClient,runProbe,doctor,defaultProcessor,performJob,pause,runWorker,safeCode};
