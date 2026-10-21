'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createBroker, safeWorkerError, INPUT_BYTES, ANALYSIS_BYTES } = require('../reference-motion/pc-broker');
const { install } = require('../reference-motion/pc-worker-routes');

const token = 'a'.repeat(43), workerId = 'pc-worker-123';
const auth = { Authorization: `Bearer ${token}` };
const document = Buffer.from('{"private":"not-for-status-or-errors"}');
const accepted = Buffer.from('{"success":true}');
function rejectsCode(promise, code) { return assert.rejects(promise, error => error.code === code); }
function claimed(broker, kind = 'analyze', options) {
  broker.claim(workerId);
  const pending = broker.submit(kind, document, options);
  pending.catch(() => {});
  return { pending, job: broker.claim(workerId) };
}
async function server(t, options = {}) {
  const broker = createBroker({ token, ...options });
  const app = express(); install(app, { broker, enabled: true });
  const listener = app.listen(0, '127.0.0.1');
  await new Promise(resolve => listener.once('listening', resolve));
  const url = `http://127.0.0.1:${listener.address().port}/api/reference-motion/worker`;
  t.after(async () => { broker.close(); listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); });
  const request = (path, { method = 'POST', body = {}, headers = {} } = {}) => fetch(url + path, {
    method, headers: { ...auth, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body) } : {})
  });
  return { broker, request, url };
}

test('requires a strong configured token and constant-time digest authentication', () => {
  assert.throws(() => createBroker({ token: 'short' }), /at least 43/);
  assert.throws(() => createBroker({ token: 'x'.repeat(43) + '!' }), /URL-safe/);
  const broker = createBroker({ token });
  assert.equal(broker.authenticate(`Bearer ${token}`), true);
  assert.equal(broker.authenticate(`Bearer ${'b'.repeat(43)}`), false);
  assert.equal(broker.authenticate(token), false);
  broker.close(); assert.equal(broker.authenticate(`Bearer ${token}`), false);
});

test('offline admission, heartbeat freshness and sanitized status', async () => {
  let time = 100;
  const broker = createBroker({ token, now: () => time });
  await rejectsCode(broker.submit('analyze', document), 'REFERENCE_WORKER_OFFLINE');
  assert.deepEqual(broker.status(), { online: false, busy: false });
  assert.equal(broker.claim(workerId), null);
  assert.equal(broker.online(), true);
  time += 29_999; assert.equal(broker.online(), true);
  time += 1; assert.equal(broker.online(), false);
  assert.throws(() => broker.claim('../../invalid-worker'), /identifier/);
  assert.equal(JSON.stringify(broker.status()).includes('private'), false);
  broker.close();
});

test('one global job, atomic claim, unpredictable lease and single-use input', async () => {
  const broker = createBroker({ token });
  const { pending, job } = claimed(broker);
  assert.match(job.id, /^[a-f0-9-]{36}$/);
  assert.match(job.lease, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(broker.claim('another-worker'), null);
  await rejectsCode(broker.submit('render', document), 'REFERENCE_BUSY');
  assert.equal(broker.matchesLease(job.id, 'b'.repeat(43)), false);
  assert.throws(() => broker.input(job.id, 'b'.repeat(43)), error => error.status === 404);
  assert.deepEqual(broker.input(job.id, job.lease), document);
  assert.throws(() => broker.input(job.id, job.lease), error => error.status === 404);
  broker.releaseInput(job.id, job.lease);
  assert.equal(broker.pulse(job.id, job.lease), true);
  broker.complete(job.id, job.lease, accepted, 'application/json');
  assert.deepEqual(await pending, { body: accepted, contentType: 'application/json' });
  assert.deepEqual(broker.status(), { online: true, busy: false });
  assert.throws(() => broker.complete(job.id, job.lease, accepted), error => error.status === 404);
  broker.close();
});

test('abort, expiry and close reject waiting callers and erase unsent inputs', async () => {
  let time = 1_000;
  const broker = createBroker({ token, now: () => time });
  const controller = new AbortController();
  const { pending, job } = claimed(broker, 'analyze', { signal: controller.signal });
  controller.abort(); await rejectsCode(pending, 'REFERENCE_CANCELLED');
  assert.equal(broker.matchesLease(job.id, job.lease), false);
  const second = claimed(broker);
  time += 240_000;
  assert.equal(broker.status().busy, false);
  await rejectsCode(second.pending, 'REFERENCE_TIMEOUT');
  const third = claimed(broker);
  broker.close(); await rejectsCode(third.pending, 'REFERENCE_WORKER_OFFLINE');
  assert.equal(broker.status().online, false);
});

test('real deadline timer expires without a status poll', async () => {
  const broker = createBroker({ token, timeoutMs: 10 });
  const { pending } = claimed(broker);
  const keepAlive = setTimeout(() => {}, 50);
  await rejectsCode(pending, 'REFERENCE_TIMEOUT');
  clearTimeout(keepAlive); broker.close();
});

test('ten jobs per rolling hour with no queue or duplicate completion', async () => {
  let time = 100;
  const broker = createBroker({ token, now: () => time });
  for (let count = 0; count < 10; count++) {
    const { pending, job } = claimed(broker);
    broker.complete(job.id, job.lease, accepted); await pending;
  }
  await rejectsCode(broker.submit('analyze', document), 'REFERENCE_PC_RATE_LIMITED');
  time += 3_600_000;
  const { pending, job } = claimed(broker);
  broker.complete(job.id, job.lease, accepted); await pending; broker.close();
});

test('input limits, safe JSON result validation and actual MP4 container signature', async () => {
  const broker = createBroker({ token }); broker.claim(workerId);
  await rejectsCode(broker.submit('analyze', Buffer.alloc(INPUT_BYTES + 1)), 'REFERENCE_INPUT_TOO_LARGE');
  await rejectsCode(broker.submit('analyze', Buffer.from('bad-json')), 'REFERENCE_INPUT_INVALID');
  await rejectsCode(broker.submit('unsupported', document), 'REFERENCE_PC_KIND_INVALID');
  const { pending, job } = claimed(broker, 'render');
  assert.throws(() => broker.complete(job.id, job.lease, accepted, 'application/json'), error => error.status === 415);
  assert.throws(() => broker.complete(job.id, job.lease, accepted, 'video/mp4'), error => error.code === 'REFERENCE_WORKER_INVALID');
  const mp4 = Buffer.from('0000ftypisom');
  broker.complete(job.id, job.lease, mp4, 'video/mp4');
  assert.deepEqual((await pending).body, mp4); broker.close();
});

test('worker failures never forward paths, tokens, arbitrary messages or details', async () => {
  const value = safeWorkerError({ code: 'SECRET_CODE', message: 'C:/secret/token', details: { password: token } });
  assert.equal(value.code, 'REFERENCE_WORKER_FAILED'); assert.equal(value.details, undefined);
  const broker = createBroker({ token }); const { pending, job } = claimed(broker);
  broker.fail(job.id, job.lease, { code: 'REFERENCE_TOO_LONG', message: 'private', details: {
    originalDurationSeconds: 5.3, allowedSeconds: 5, canTrimToSeconds: 5, requiredPlan: 'pro', token,
    maximumSourceSeconds: Infinity, error: 'C:/private/image.png'
  } });
  await assert.rejects(pending, failure => {
    assert.deepEqual(failure.details, { originalDurationSeconds: 5.3, allowedSeconds: 5, canTrimToSeconds: 5, requiredPlan: 'pro' });
    assert.equal(JSON.stringify(failure).includes(token), false); return true;
  }); broker.close();
});

test('an old response close cannot release a newer completion reservation', async () => {
  const broker = createBroker({ token }); const { pending, job } = claimed(broker);
  const first = broker.beginComplete(job.id, job.lease);
  assert.equal(broker.cancelComplete(job.id, job.lease, first), true);
  const second = broker.beginComplete(job.id, job.lease);
  assert.equal(broker.cancelComplete(job.id, job.lease, first), false);
  assert.throws(() => broker.beginComplete(job.id, job.lease), error => error.status === 404);
  assert.throws(() => broker.complete(job.id, job.lease, accepted, 'application/json', first), error => error.status === 404);
  broker.complete(job.id, job.lease, accepted, 'application/json', second);
  await pending; broker.close();
});

test('HTTP authenticates before parsing even malformed or oversized request declarations', async t => {
  const { request, broker } = await server(t);
  const unauthorized = await request('/claim', { body: '{invalid', headers: { Authorization: `Bearer ${'b'.repeat(43)}` } });
  assert.equal(unauthorized.status, 401); assert.equal(broker.online(), false);
  assert.equal((await request('/claim', { body: '{invalid' })).status, 400);
  assert.equal((await request('/claim', { body: { workerId, extra: 'private' } })).status, 400);
  assert.equal((await request('/claim', { body: { workerId } })).status, 204);
  assert.equal(broker.online(), true);
});

test('HTTP claims atomically and enforces bearer plus lease on every job route', async t => {
  const { broker, request } = await server(t);
  broker.claim(workerId); const pending = broker.submit('analyze', document); pending.catch(() => {});
  const claims = await Promise.all([request('/claim', { body: { workerId } }), request('/claim', { body: { workerId: 'second' } })]);
  assert.deepEqual(claims.map(response => response.status).sort(), [200, 204]);
  const job = await claims.find(response => response.status === 200).json();
  const path = `/jobs/${job.id}`;
  for (const suffix of ['/input', '/pulse', '/complete', '/fail']) {
    const response = await request(path + suffix, { method: suffix === '/input' ? 'GET' : 'POST', body: '{invalid', headers: { 'X-Reference-Lease': 'b'.repeat(43) } });
    assert.equal(response.status, 404);
  }
  const headers = { 'X-Reference-Lease': job.lease };
  const input = await request(path + '/input', { method: 'GET', headers });
  assert.equal(input.status, 200); assert.equal(await input.text(), document.toString());
  assert.equal((await request(path + '/input', { method: 'GET', headers })).status, 404);
  assert.equal((await request(path + '/pulse', { headers })).status, 200);
  assert.equal((await request(path + '/complete', { body: accepted, headers })).status, 204);
  assert.deepEqual((await pending).body, accepted);
  assert.equal((await request(path + '/complete', { body: accepted, headers })).status, 404);
});

test('HTTP rejects completion MIME, declared length and malformed JSON without losing a retry', async t => {
  const { broker, request, url } = await server(t); const { pending, job } = claimed(broker);
  const path = `/jobs/${job.id}/complete`, headers = { 'X-Reference-Lease': job.lease };
  assert.equal((await request(path, { body: 'not-mp4', headers: { ...headers, 'Content-Type': 'video/mp4' } })).status, 415);
  const largeStatus = await new Promise((resolve, reject) => {
    const req = http.request(url + path, { method: 'POST', headers: { ...auth, ...headers, 'Content-Type': 'application/json', 'Content-Length': ANALYSIS_BYTES + 1 } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    }); req.on('error', reject); req.end();
  });
  assert.equal(largeStatus, 413);
  assert.equal((await request(path, { body: '{broken', headers })).status, 422);
  assert.equal((await request(path, { body: accepted, headers })).status, 204);
  await pending;
});

test('HTTP reserves completion before parsing and rejects a racing upload', async t => {
  const { broker, request, url } = await server(t); const { pending, job } = claimed(broker);
  const path = `/jobs/${job.id}/complete`, headers = { ...auth, 'X-Reference-Lease': job.lease, 'Content-Type': 'application/json' };
  const body = Buffer.from('{"success":true}');
  let firstRequest;
  const firstResponse = new Promise((resolve, reject) => {
    firstRequest = http.request(url + path, { method: 'POST', headers: { ...headers, 'Content-Length': body.length } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    }); firstRequest.on('error', reject); firstRequest.write(body.subarray(0, 1));
  });
  for (let tries = 0; tries < 30; tries++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    try { broker.beginComplete(job.id, job.lease); broker.cancelComplete(job.id, job.lease); }
    catch { break; }
  }
  const racing = await request(path, { body, headers });
  assert.equal(racing.status, 404);
  firstRequest.end(body.subarray(1));
  assert.equal(await firstResponse, 204); await pending;
});

test('HTTP fail endpoint uses safe trim fields and clears the job', async t => {
  const { broker, request } = await server(t); const { pending, job } = claimed(broker);
  const response = await request(`/jobs/${job.id}/fail`, { headers: { 'X-Reference-Lease': job.lease }, body: {
    code: 'REFERENCE_TOO_LONG', details: { originalDurationSeconds: 5.3, allowedSeconds: 5, token }
  } });
  assert.equal(response.status, 204);
  await assert.rejects(pending, failure => failure.code === 'REFERENCE_TOO_LONG' && !JSON.stringify(failure).includes(token));
  assert.equal(broker.status().busy, false);
});

test('HTTP cancellation stops an in-progress completion body and frees admission', async t => {
  const { broker, url } = await server(t);
  const controller = new AbortController();
  const { pending, job } = claimed(broker, 'analyze', { signal: controller.signal });
  let upload;
  const stopped = new Promise(resolve => {
    upload = http.request(`${url}/jobs/${job.id}/complete`, { method: 'POST', headers: {
      ...auth, 'X-Reference-Lease': job.lease, 'Content-Type': 'application/json', 'Content-Length': 100_000
    } }, response => { response.resume(); response.on('end', () => resolve('response')); });
    upload.on('error', () => resolve('stopped')); upload.write('{');
  });
  for (let tries = 0; tries < 30; tries++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    try { const reservation = broker.beginComplete(job.id, job.lease); broker.cancelComplete(job.id, job.lease, reservation); }
    catch { break; }
  }
  controller.abort();
  await rejectsCode(pending, 'REFERENCE_CANCELLED');
  assert.equal(await stopped, 'stopped');
  assert.equal(broker.status().busy, false);
  upload.destroy();
});

test('HTTP actual chunked result body is bounded without trusting Content-Length', async t => {
  const { broker, request, url } = await server(t); const { pending, job } = claimed(broker);
  const path = `/jobs/${job.id}/complete`;
  const status = await new Promise((resolve, reject) => {
    const upload = http.request(url + path, { method: 'POST', headers: {
      ...auth, 'X-Reference-Lease': job.lease, 'Content-Type': 'application/json'
    } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    upload.on('error', reject);
    (async () => {
      const chunk = Buffer.alloc(1024 * 1024, 0x20);
      for (let count = 0; count < 26; count++) {
        if (!upload.write(chunk)) await new Promise(done => upload.once('drain', done));
      }
      upload.end(Buffer.from('x'));
    })().catch(reject);
  });
  assert.equal(status, 413);
  assert.equal((await request(path, { body: accepted, headers: { 'X-Reference-Lease': job.lease } })).status, 204);
  await pending;
});

test('disabled worker routes do not authenticate or consume a payload', async t => {
  const broker = createBroker({ token }); const app = express(); install(app, { broker, enabled: false });
  const listener = app.listen(0, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
  t.after(async () => { broker.close(); listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); });
  const response = await fetch(`http://127.0.0.1:${listener.address().port}/api/reference-motion/worker/claim`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{broken'
  });
  assert.equal(response.status, 404); assert.equal(broker.online(), false);
});
