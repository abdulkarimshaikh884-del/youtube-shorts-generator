'use strict';

// Production export handler with isolated project/ledger/renderer adapters.
// These tests prove billing order, not model inference or real MP4 delivery.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {EventEmitter} = require('node:events');

function load(filename, substitutions = {}) {
  const full = path.resolve(__dirname, '..', filename), nativeRequire = createRequire(full), target = {exports: {}};
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), {module: target, exports: target.exports,
    require: name => Object.hasOwn(substitutions, name) ? substitutions[name] : nativeRequire(name),
    process: {env: {SC_REFERENCE_MOTION: 'true'}}, Buffer, AbortController, console, setTimeout, clearTimeout}, {filename: full});
  return target.exports;
}
const routes = load('reference-motion/routes.js');
function request({frames = 150, height = 1080, review = true, key = 'reference-billing-key-20261020'} = {}) {
  const req = new EventEmitter();
  Object.assign(req, {user: {id: 'pc-billing-owner', plan: 'free'}, protocol: 'http', path: '/api/reference-motion/export',
    body: {scene: {durationFrames: frames}, mediaAssets: {card: {jobId: 'job_' + '1'.repeat(32), assetPath: 'original.webp'}}, height, reviewAcknowledged: review},
    get(name) {return name.toLowerCase() === 'host' ? '127.0.0.1:3000' : name.toLowerCase() === 'idempotency-key' ? key : undefined;}});
  return req;
}
function response() {
  const res = new EventEmitter();
  Object.assign(res, {statusCode: 200, headers: {}, destroyed: false, writableEnded: false,
    status(status) {this.statusCode = status; return this;},
    json(body) {this.body = body; this.writableEnded = true; return this;},
    setHeader(name, value) {this.headers[name] = value;}, removeHeader(name) {delete this.headers[name];},
    end(body) {this.body = body; this.writableEnded = true; return this;}});
  return res;
}
function fixture(options = {}) {
  const calls = {charge: 0, refund: 0, render: 0, referral: 0, state: 0, project: 0, order: []};
  const entitlement = options.entitlement || {plan: 'free', maxHeight: 480, watermark: true};
  let balance = options.balance ?? 5;
  const mp4 = Buffer.alloc(1200); mp4.write('ftyp', 4, 'ascii');
  const credits = {
    entitlements: async () => entitlement,
    state: async req => {calls.state++; if (options.onState) await options.onState(req); return {left: balance, cost: {export: 1}};},
    charge: async req => {
      calls.charge++; calls.order.push('charge');
      if (options.onCharge) return options.onCharge(req);
      if (balance < 1) return {ok: false, status: 402, left: balance, need: 1};
      balance--; req._creditChargeIds = {export: 'isolated-credit-tx'}; return {ok: true, charged: 1, left: balance};
    },
    refund: async () => {calls.refund++; calls.order.push('refund'); balance++;}
  };
  const project = {
    normaliseClip: async (user, clip) => {calls.project++; if (options.privateDenied) {const error = Error('private'); error.status = 403; throw error;} return {spec: clip.spec};},
    hydrate: async (user, clip) => ({scene: clip.spec, images: {card: 'isolated-owned-image'}})
  };
  const web = load('reference-motion/web.js', {'./routes': routes, './project': project});
  const handlers = web.createHandlers({credits, projects: {}, chargeAfterRender: true,
    availability: () => ({workerOnline: options.online !== false}),
    serialise: async (run, plan, {signal}) => {assert.equal(plan, entitlement.plan); assert(signal instanceof AbortSignal); return run();},
    render: async (document, settings) => {
      calls.render++; calls.order.push('render'); calls.settings = settings;
      if (options.onRender) return options.onRender(document, settings);
      return {buffer: mp4, metrics: {renderMs: 20}};
    }, referrals: {successfulExport: async () => {calls.referral++;}}});
  return {handlers, calls, credits, mp4, balance: () => balance};
}

test('offline worker rejects before project checks, processing or credit charge', async () => {
  const {handlers, calls} = fixture({online: false}), res = response();
  await handlers.export(request(), res);
  assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'REFERENCE_WORKER_OFFLINE');
  assert.equal(calls.project, 0); assert.equal(calls.render, 0); assert.equal(calls.charge, 0); assert.equal(calls.refund, 0);
});

test('review, duration, account and private-asset boundaries precede all billing', async () => {
  for (const variant of [{review: false}, {frames: 151}, {privateDenied: true}, {guest: true}]) {
    const {handlers, calls} = fixture(variant), req = request(variant), res = response();
    if (variant.guest) req.user = null;
    await handlers.export(req, res);
    assert([401, 403, 422].includes(res.statusCode));
    assert.equal(calls.render, 0); assert.equal(calls.charge, 0); assert.equal(calls.refund, 0);
  }
});

test('not enough credits at preflight never starts a PC render', async () => {
  const {handlers, calls} = fixture({balance: 0}), res = response(); await handlers.export(request(), res);
  assert.equal(res.statusCode, 402); assert.equal(calls.render, 0); assert.equal(calls.charge, 0);
});

test('worker failure cannot debit credits or invent a refund transaction', async () => {
  const {handlers, calls, balance} = fixture({onRender: async () => {throw Error('isolated worker failed');}}), res = response();
  await handlers.export(request(), res);
  assert.equal(res.statusCode, 503); assert.equal(calls.render, 1);
  assert.equal(calls.charge, 0); assert.equal(calls.refund, 0); assert.equal(balance(), 5); assert.equal(calls.referral, 0);
});

test('disconnect before/during completed render is not charged', async () => {
  for (const early of [true, false]) {
    const res = response(), req = request();
    const {handlers, calls, mp4} = fixture({onRender: async () => {
      res.destroyed = true; res.emit('close'); return {buffer: mp4, metrics: {renderMs: 5}};
    }});
    if (early) req.aborted = true;
    await handlers.export(req, res);
    assert.equal(calls.render, early ? 0 : 1); assert.equal(calls.charge, 0); assert.equal(calls.refund, 0);
  }
});

test('completed MP4 debits exactly once after render and applies export entitlements', async () => {
  for (const entitlement of [{plan: 'free', maxHeight: 480, watermark: true}, {plan: 'pro', maxHeight: 1080, watermark: false}]) {
    const {handlers, calls, mp4, balance} = fixture({entitlement}), res = response();
    await handlers.export(request({frames: entitlement.plan === 'pro' ? 300 : 150, height: 1440}), res);
    assert.equal(res.statusCode, 200); assert.equal(res.body, mp4);
    assert.deepEqual(calls.order, ['render', 'charge']); assert.equal(calls.charge, 1); assert.equal(calls.refund, 0);
    assert.equal(calls.settings.height, entitlement.maxHeight); assert.equal(calls.settings.watermark, entitlement.watermark);
    assert.equal(res.headers['Content-Type'], 'video/mp4'); assert.equal(res.headers['X-Credits-Left'], '4');
    assert.equal(balance(), 4); assert.equal(calls.referral, 1);
  }
});

test('late insufficient credit result sends no MP4 and adds no charge/refund', async () => {
  const {handlers, calls} = fixture({onCharge: async () => ({ok: false, status: 402, left: 0, need: 1})}), res = response();
  await handlers.export(request(), res);
  assert.equal(calls.render, 1); assert.equal(calls.charge, 1); assert.equal(calls.refund, 0);
  assert.equal(res.statusCode, 402); assert.equal(res.body.success, false); assert.equal(calls.referral, 0);
});

test('disconnect while the debit transaction awaits is refunded before delivery', async () => {
  const res = response();
  const {handlers, calls} = fixture({onCharge: async req => {
    req._creditChargeIds = {export: 'isolated-mid-charge'};
    res.destroyed = true; res.emit('close'); return {ok: true, charged: 1, left: 4};
  }});
  await handlers.export(request(), res);
  assert.equal(calls.render, 1); assert.equal(calls.charge, 1); assert.equal(calls.refund, 1); assert.equal(calls.referral, 0);
});

test('existing ledger replay/conflict/refunded status survives charge-after-render unchanged', async () => {
  for (const code of ['CREDIT_OPERATION_REPLAY', 'CREDIT_IDEMPOTENCY_CONFLICT', 'CREDIT_OPERATION_REFUNDED']) {
    const {handlers, calls} = fixture({onCharge: async () => ({ok: false, status: 409, code, charged: 0, reused: true})}), res = response();
    await handlers.export(request(), res);
    assert.equal(res.statusCode, 409); assert.equal(res.body.code, code); assert.equal(res.body.charged, 0);
    assert.equal(calls.charge, 1); assert.equal(calls.refund, 0); assert.equal(calls.referral, 0);
    assert.equal(calls.render, 1, 'Ephemeral beta preserves ledger replay rejection but has no durable render-result cache');
  }
});
