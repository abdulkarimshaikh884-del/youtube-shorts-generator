'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const express = require('express');
const http = require('node:http');
const {createRequestGate} = require('../reference-motion/pc-request-gate');

process.env.SC_REFERENCE_MOTION = 'true';
const paths = ['/api/reference-motion/analyze', '/api/reference-motion/export', '/api/reference-motion/assets'];
async function harness(t, options = {}) {
  const counters = {parsed: 0, hydrated: 0}, held = [];
  const app = express();
  app.use((req, res, next) => {if (req.get('X-Test-Account') === 'owner') req.user = {id: 'isolated-gate-owner'}; next();});
  app.use(paths, createRequestGate(options));
  const parser = express.json({limit: '28mb'});
  app.post(paths, (req, res, next) => {counters.parsed++; parser(req, res, next);}, (req, res) => {
    counters.hydrated++; if (req.body?.hold) {held.push(res); return;}
    return res.json({success: true});
  });
  const listener = app.listen(0, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
  t.after(async () => {for (const res of held) if (!res.destroyed) res.end(); listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve));});
  const origin = `http://127.0.0.1:${listener.address().port}`;
  const post = (route, body = '{}', headers = {}) => fetch(origin + route, {method: 'POST', headers: {
    'Content-Type': 'application/json', 'X-Test-Account': 'owner', ...headers
  }, body});
  return {origin, post, counters, held};
}
function bareRequest(path = paths[0], method = 'POST') {
  return {method, originalUrl: path, protocol: 'http', user: {id: 'isolated-owner'}, get: name => name.toLowerCase() === 'host' ? '127.0.0.1' : undefined};
}
function bareResponse() {
  const res = new EventEmitter(); res.setHeader = () => {}; res.status = status => {res.statusCode = status; return res;}; res.json = value => {res.body = value; return res;}; return res;
}

test('real HTTP simultaneous large request is rejected before parser or asset hydration', async t => {
  const {post, counters, held} = await harness(t, {online: () => true});
  const first = post(paths[0], '{"hold":true}');
  for (let count = 0; !held.length && count < 50; count++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(held.length, 1); assert.equal(counters.parsed, 1);
  for (const route of paths) {
    const second = await post(route, 'x'.repeat(1024 * 1024));
    assert.equal(second.status, 429); assert.equal((await second.json()).code, 'REFERENCE_BUSY');
  }
  assert.equal(counters.parsed, 1); assert.equal(counters.hydrated, 1);
  held[0].json({success: true}); assert.equal((await first).status, 200);
  assert.equal((await post(paths[1])).status, 200); assert.equal(counters.parsed, 2);
});

test('offline analysis/export reject before parsing, while private asset editing remains available', async t => {
  const {post, counters} = await harness(t, {online: () => false});
  for (const route of paths.slice(0, 2)) {
    const response = await post(route, '{invalid'); assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'REFERENCE_WORKER_OFFLINE');
  }
  assert.equal(counters.parsed, 0); assert.equal(counters.hydrated, 0);
  assert.equal((await post(paths[2])).status, 200); assert.equal(counters.parsed, 1);
});

test('worker busy, account failures and cross-origin failures cannot consume the shared slot', async t => {
  let busy = true;
  const {post, counters} = await harness(t, {busy: () => busy});
  assert.equal((await post(paths[0], '{invalid')).status, 429);
  busy = false;
  assert.equal((await post(paths[0], '{invalid', {'X-Test-Account': 'guest'})).status, 401);
  assert.equal((await post(paths[0], '{invalid', {Origin: 'https://different.example'})).status, 403);
  assert.equal(counters.parsed, 0);
  assert.equal((await post(paths[0])).status, 200); assert.equal(counters.parsed, 1);
});

test('actual client disconnect releases its request slot', async t => {
  const {origin, post, counters, held} = await harness(t);
  const req = http.request(origin + paths[0], {method: 'POST', headers: {'X-Test-Account': 'owner', 'Content-Type': 'application/json'}});
  req.on('error', () => {}); req.end('{"hold":true}');
  for (let count = 0; !held.length && count < 50; count++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(held.length, 1); req.destroy();
  for (let count = 0; !held[0].destroyed && count < 50; count++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await post(paths[1])).status, 200); assert.equal(counters.parsed, 2);
});

test('an earlier response close cannot release a later reservation; finish/close cleanup is exact', () => {
  const gate = createRequestGate(), a = bareResponse(), b = bareResponse(), rejected = bareResponse(); let admitted = 0;
  gate(bareRequest(), a, () => admitted++); a.emit('finish');
  gate(bareRequest(paths[1]), b, () => admitted++);
  a.emit('close');
  gate(bareRequest(paths[2]), rejected, () => admitted++);
  assert.equal(rejected.statusCode, 429); assert.equal(admitted, 2);
  b.emit('close');
  gate(bareRequest(), bareResponse(), () => admitted++); assert.equal(admitted, 3);
  assert.equal(a.listenerCount('finish'), 0); assert.equal(a.listenerCount('close'), 0);
});

test('next throwing releases the slot and non-POST calls never reserve it', () => {
  const gate = createRequestGate();
  assert.throws(() => gate(bareRequest(), bareResponse(), () => {throw Error('isolated downstream failure');}), /downstream failure/);
  let calls = 0;
  gate(bareRequest(paths[0], 'GET'), bareResponse(), () => calls++);
  gate(bareRequest(), bareResponse(), () => calls++); assert.equal(calls, 2);
});

test('disabled feature gate does not call downstream code or hold a slot', () => {
  const gate = createRequestGate(); process.env.SC_REFERENCE_MOTION = 'false';
  try {
    const res = bareResponse(); gate(bareRequest(), res, () => assert.fail('Disabled feature reached parser'));
    assert.equal(res.statusCode, 404);
  } finally {process.env.SC_REFERENCE_MOTION = 'true';}
  let called = false; gate(bareRequest(), bareResponse(), () => {called = true;}); assert.equal(called, true);
});
