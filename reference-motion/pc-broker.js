'use strict';

const crypto = require('node:crypto');
const { ReferenceMotionError } = require('./admission');

const INPUT_BYTES = 29 * 1024 * 1024;
const ANALYSIS_BYTES = 26 * 1024 * 1024;
const RENDER_BYTES = 32 * 1024 * 1024;
const SAFE_ERRORS = Object.freeze({
  REFERENCE_INPUT_INVALID: [422, 'The reference input is invalid.'],
  REFERENCE_INPUT_TOO_LARGE: [413, 'Reference videos must be 20 MiB or smaller.'],
  REFERENCE_CONTAINER_INVALID: [422, 'The reference is not a valid MP4 or WebM video.'],
  REFERENCE_MEDIA_INVALID: [422, 'The reference video could not be decoded.'],
  REFERENCE_DIMENSIONS_UNSUPPORTED: [422, 'The reference dimensions are not supported.'],
  REFERENCE_DURATION_UNKNOWN: [422, 'The reference duration could not be verified.'],
  REFERENCE_SOURCE_TOO_LONG: [422, 'Reference uploads are limited to 10 seconds.'],
  REFERENCE_TOO_LONG: [422, 'Free references are limited to 5 seconds. Choose an explicit first-5-seconds trim or use Pro for up to 10 seconds.'],
  REFERENCE_DEPENDENCY_UNAVAILABLE: [503, 'The PC worker is missing a processing dependency.'],
  REFERENCE_ENGINE_UNAVAILABLE: [503, 'The PC reference engine is unavailable.'],
  REFERENCE_RECONSTRUCTION_UNSUPPORTED: [422, 'This reference could not be reconstructed reliably.'],
  REFERENCE_RECONSTRUCTION_INCOMPLETE: [422, 'The reconstruction did not pass its quality checks.'],
  REFERENCE_FRAME_COUNT_INVALID: [422, 'The reference timing could not be verified.'],
  REFERENCE_SCENE_INVALID: [422, 'The reconstructed scene could not be validated.'],
  REFERENCE_ASSETS_INVALID: [422, 'The reconstructed assets could not be validated.'],
  REFERENCE_PROJECT_TOO_LARGE: [413, 'The reconstructed timeline exceeds the project limit.'],
  REFERENCE_OUTPUT_TOO_LARGE: [413, 'The reference result exceeds the output limit.'],
  REFERENCE_WORKER_INVALID: [503, 'The PC worker returned an invalid result.'],
  REFERENCE_WORKER_FAILED: [503, 'The PC worker could not complete this reference.'],
  REFERENCE_PC_MEMORY_LOW: [503, 'The processing PC does not currently have enough free memory. Retry when it is available.'],
  REFERENCE_PC_JOB_TIMEOUT: [504, 'The PC processing time limit was exceeded.'],
  REFERENCE_PC_CANCELLED: [499, 'PC reference processing was cancelled.'],
  REFERENCE_PC_INPUT_INVALID: [422, 'The PC processing input could not be validated.'],
  REFERENCE_PC_JOB_FAILED: [503, 'The PC worker could not complete this job.'],
  REFERENCE_RENDER_FAILED: [503, 'The PC worker could not render this project.'],
  REFERENCE_RENDER_TIMEOUT: [504, 'The PC rendering time limit was exceeded.'],
  REFERENCE_TIMEOUT: [504, 'The reference processing time limit was exceeded.'],
  REFERENCE_CANCELLED: [499, 'Reference processing was cancelled.']
});

function error(code, message, status) { return new ReferenceMotionError(code, message, status); }
function unavailable() { return error('REFERENCE_WORKER_OFFLINE', 'The beta processing PC is offline. Try again when it is online; no processing charge was made.', 503); }
function invalidJob() { return error('REFERENCE_PC_JOB_NOT_FOUND', 'The processing job is no longer available.', 404); }
function validWorkerId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value); }
function safeWorkerError(value) {
  const code = value && Object.hasOwn(SAFE_ERRORS, value.code) ? value.code : 'REFERENCE_WORKER_FAILED';
  const [status, message] = SAFE_ERRORS[code];
  const result = error(code, message, status);
  if (['REFERENCE_TOO_LONG', 'REFERENCE_SOURCE_TOO_LONG'].includes(code) && value?.details && typeof value.details === 'object') {
    const details = {};
    for (const key of ['originalDurationSeconds', 'allowedSeconds', 'maximumSourceSeconds', 'canTrimToSeconds']) {
      const number = value.details[key];
      if (typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 600) details[key] = number;
    }
    if (value.details.requiredPlan === 'pro') details.requiredPlan = 'pro';
    if (Object.keys(details).length) result.details = details;
  }
  return result;
}

function createBroker({ token, now = Date.now, randomBytes = crypto.randomBytes,
  timeoutMs = 240_000, heartbeatMs = 30_000, maxJobsPerHour = 10 } = {}) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
    throw new Error('SC_REFERENCE_PC_TOKEN must be a securely generated URL-safe token of at least 43 characters.');
  }
  const tokenDigest = crypto.createHash('sha256').update(token).digest();
  let closed = false, lastSeen = null, current = null;
  const admitted = [];
  const safeDuration = Math.min(240_000, Math.max(1, timeoutMs));

  function authenticate(authorization) {
    if (closed || typeof authorization !== 'string' || authorization.length > 256 || !authorization.startsWith('Bearer ')) return false;
    const supplied = authorization.slice(7);
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(supplied)) return false;
    const digest = crypto.createHash('sha256').update(supplied).digest();
    return crypto.timingSafeEqual(tokenDigest, digest);
  }
  function clear(job, failure, result) {
    if (!job || current !== job) return;
    current = null;
    clearTimeout(job.timer);
    job.signal?.removeEventListener('abort', job.abort);
    // Never zero bytes while an HTTP socket is still sending them. Such a
    // buffer is released after transmission; otherwise erase our owned input.
    if (job.input && !job.inputSending) job.input.fill(0);
    job.input = null; job.lease = null;
    if (failure) {
      for (const listener of job.failureListeners) { try { listener(); } catch { /* Owned transport cleanup is best-effort. */ } }
    }
    job.failureListeners.clear();
    if (failure) job.reject(failure); else job.resolve(result);
  }
  function expire() {
    if (current && now() >= current.deadline) clear(current, error('REFERENCE_TIMEOUT', 'The beta processing time limit was exceeded. Retry the reference.', 504));
  }
  function online() { return !closed && lastSeen !== null && now() - lastSeen >= 0 && now() - lastSeen < heartbeatMs; }
  function status() { expire(); return { online: online(), busy: Boolean(current) }; }
  function heartbeat(workerId) {
    if (closed || !validWorkerId(workerId)) throw error('REFERENCE_PC_WORKER_INVALID', 'Invalid worker identifier.', 400);
    lastSeen = now();
  }
  function leased(id, lease) {
    expire();
    const job = current;
    if (!job || job.id !== id || !job.lease || typeof lease !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(lease)) throw invalidJob();
    const a = Buffer.from(job.lease), b = Buffer.from(lease);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw invalidJob();
    return job;
  }
  function matchesLease(id, lease) { try { leased(id, lease); return true; } catch { return false; } }
  function jobKind(id, lease) { return leased(id, lease).kind; }
  function submit(kind, payload, { signal } = {}) {
    expire();
    if (kind !== 'analyze' && kind !== 'render') return Promise.reject(error('REFERENCE_PC_KIND_INVALID', 'Unsupported reference processing operation.', 400));
    if (!online()) return Promise.reject(unavailable());
    if (current) return Promise.reject(error('REFERENCE_BUSY', 'The beta processing PC is busy. Retry shortly; no credits were charged.', 429));
    if (signal?.aborted) return Promise.reject(error('REFERENCE_CANCELLED', 'Reference processing was cancelled.', 499));
    const time = now();
    while (admitted.length && admitted[0] <= time - 3_600_000) admitted.shift();
    if (admitted.length >= maxJobsPerHour) return Promise.reject(error('REFERENCE_PC_RATE_LIMITED', 'The beta processing limit has been reached. Try again later; no credits were charged.', 429));
    let input;
    try {
      if (Buffer.isBuffer(payload) && payload.length > INPUT_BYTES) throw error('REFERENCE_INPUT_TOO_LARGE', 'The processing input exceeds the beta limit.', 413);
      input = Buffer.isBuffer(payload) ? Buffer.from(payload) : Buffer.from(JSON.stringify(payload));
      if (!input.length || input.length > INPUT_BYTES) throw error('REFERENCE_INPUT_TOO_LARGE', 'The processing input exceeds the beta limit.', 413);
      const document = JSON.parse(input.toString('utf8'));
      if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('object required');
    } catch (failure) {
      input?.fill(0);
      return Promise.reject(failure instanceof ReferenceMotionError ? failure : error('REFERENCE_INPUT_INVALID', 'The processing input must be valid JSON.', 422));
    }
    admitted.push(time);
    return new Promise((resolve, reject) => {
      const job = { id: crypto.randomUUID(), kind, input, inputTaken: false, inputSending: false,
        deadline: time + safeDuration, lease: null, receiving: false, signal, resolve, reject, failureListeners: new Set() };
      job.abort = () => clear(job, error('REFERENCE_CANCELLED', 'Reference processing was cancelled.', 499));
      current = job;
      job.timer = setTimeout(() => clear(job, error('REFERENCE_TIMEOUT', 'The beta processing time limit was exceeded. Retry the reference.', 504)), safeDuration);
      job.timer.unref?.();
      signal?.addEventListener('abort', job.abort, { once: true });
      if (signal?.aborted) job.abort();
    });
  }
  function claim(workerId) {
    heartbeat(workerId); expire();
    if (!current || current.lease) return null;
    current.lease = randomBytes(32).toString('base64url');
    return { id: current.id, kind: current.kind, lease: current.lease };
  }
  function input(id, lease) {
    const job = leased(id, lease);
    if (!job.input || job.inputTaken) throw invalidJob();
    job.inputTaken = true; job.inputSending = true;
    return job.input;
  }
  function releaseInput(id, lease) {
    let job; try { job = leased(id, lease); } catch { return false; }
    job.input = null; job.inputSending = false;
    return true;
  }
  function pulse(id, lease) { leased(id, lease); lastSeen = now(); return true; }
  function onJobFailure(id, lease, listener) {
    const job = leased(id, lease);
    job.failureListeners.add(listener);
    return () => job.failureListeners.delete(listener);
  }
  function beginComplete(id, lease) {
    const job = leased(id, lease);
    if (job.receiving) throw invalidJob();
    job.receiving = randomBytes(16).toString('base64url');
    return job.receiving;
  }
  function cancelComplete(id, lease, reservation) {
    let job; try { job = leased(id, lease); } catch { return false; }
    if (reservation !== undefined && job.receiving !== reservation) return false;
    job.receiving = false; return true;
  }
  function complete(id, lease, payload, contentType, reservation) {
    const job = leased(id, lease);
    if (reservation !== undefined && job.receiving !== reservation) throw invalidJob();
    const expected = job.kind === 'render' ? 'video/mp4' : 'application/json';
    const limit = job.kind === 'render' ? RENDER_BYTES : ANALYSIS_BYTES;
    if (contentType !== undefined && contentType !== expected) throw error('REFERENCE_PC_CONTENT_TYPE_INVALID', 'Unexpected processing result type.', 415);
    if (!Buffer.isBuffer(payload) || payload.length < 1 || payload.length > limit) throw error('REFERENCE_OUTPUT_TOO_LARGE', 'The processing result exceeds its safe size limit.', 413);
    if (expected === 'application/json') {
      try { const value = JSON.parse(payload.toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required'); }
      catch { throw error('REFERENCE_WORKER_INVALID', 'The PC worker returned an invalid JSON result.', 422); }
    } else if (payload.length < 12 || payload.subarray(4, 8).toString('ascii') !== 'ftyp') {
      throw error('REFERENCE_WORKER_INVALID', 'The PC worker returned an invalid MP4 result.', 422);
    }
    clear(job, null, { body: Buffer.from(payload), contentType: expected });
    return true;
  }
  function fail(id, lease, failure) { const job = leased(id, lease); clear(job, safeWorkerError(failure)); return true; }
  function close() { closed = true; if (current) clear(current, unavailable()); tokenDigest.fill(0); }
  return { authenticate, online, status, heartbeat, submit, claim, input, releaseInput, pulse,
    matchesLease, jobKind, onJobFailure, beginComplete, cancelComplete, complete, fail, close };
}

module.exports = { createBroker, safeWorkerError, validWorkerId, INPUT_BYTES, ANALYSIS_BYTES, RENDER_BYTES };
