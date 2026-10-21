'use strict';

// Contract fixtures only: these are not evidence of real video inference.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const sharp = require('sharp');
const {createPCClient, acceptAnalysis, parseBody} = require('../reference-motion/pc-client');

const userId = 'reference-pc-contract-owner';
const original = Buffer.from('0000ftypisom');
const sourceHash = crypto.createHash('sha256').update(original).digest('hex');
const baseOptions = {userId, plan: 'free', sourceHash};
const fresh = value => structuredClone(value);
const ref = index => ({jobId: 'job_' + index.toString(16).padStart(32, '0'), assetPath: 'original.webp'});
function layer(id, assetId, frameCount = 4) {
  return {id, label: id, assetId, width: 64, height: 64, zIndex: 1, visible: true,
    offset: {x: 0, y: 0}, scale: 1, rotation: 0, opacity: 1,
    keyframes: [0, frameCount - 1].map(frame => ({frame, corners: [[0, 0], [64, 0], [64, 64], [0, 64]], opacity: 1}))};
}
async function fixture({count = 1, format = 'png'} = {}) {
  const encoded = await sharp({create: {width: 64, height: 64, channels: 4, background: '#1a8cdd'}})[format]().toBuffer();
  const image = `data:image/${format};base64,` + encoded.toString('base64');
  const scene = {format: 'shortscraft-reference-motion', version: 1, width: 128, height: 64, fps: 30, durationFrames: 4,
    background: '#ffffff', layers: Array.from({length: count}, (_, index) => layer('card-' + index, 'asset-' + index))};
  return {state: 'REVIEW_REQUIRED', exactRecreationGuaranteed: false, analysisCredits: 0, scene,
    images: Object.fromEntries(scene.layers.map(item => [item.assetId, image])),
    analysis: {method: 'Unit contract pixels only', frameCount: 4, fps: 30, width: 128, height: 64,
      metadata: {networkRequests: 0, modelInvocations: 0, modelDownloads: 0},
      quality: {state: 'REVIEW_REQUIRED', visualComparison: 'PASS', comparedFrameCount: 4, failedFrameCount: 0,
        exactRecreation: false, maxMeanAbsoluteError: 1, maxChangedPixelFractionOver30: .01}},
    admission: {sourceSha256: sourceHash, analysisMode: 'local', cloudVideoSent: false, rawSourceRetained: false,
      audioRetained: false, sourceHasAudio: false, sourceWidth: 128, sourceHeight: 64,
      sourceVideoStreamIndex: 0, originalDurationSeconds: 4 / 30, width: 128, height: 64, processingMs: 20}};
}
function persistence() {
  const writes = [], deleted = [];
  return {writes, deleted,
    persistImage: async (user, mediaData) => {writes.push({user, mediaData}); return {ref: ref(writes.length), mediaData};},
    discardAssets: async (owner, refs) => {deleted.push({owner, refs});}};
}
async function rejectWithoutWrite(value, options = {}) {
  const storage = persistence();
  await assert.rejects(acceptAnalysis(value, {...baseOptions, ...storage, ...options}));
  assert.equal(storage.writes.length, 0, 'No private raster is written before complete result validation');
}

test('valid bounded grouped result persists only owner-scoped references', async () => {
  const value = await fixture({count: 2}), storage = persistence();
  const result = await acceptAnalysis(value, {...baseOptions, ...storage});
  assert.equal(result.state, 'REVIEW_REQUIRED'); assert.equal(result.exactRecreationGuaranteed, false);
  assert.equal(result.reconstructionScope, 'PLANAR_IMAGE_LAYERS_ONLY');
  assert.equal(result.admission.processingLocation, 'OWNER_PC'); assert.equal(result.admission.sourceSha256, sourceHash);
  assert.equal(result.analysisCredits, 0); assert.equal(storage.writes.length, 2);
  assert(storage.writes.every(write => write.user.id === userId));
  assert.deepEqual(result.mediaAssets, {'asset-0': ref(1), 'asset-1': ref(2)});
  assert.equal(storage.deleted.length, 0);
});

test('source fingerprint, cloud flags and plan/frame admission are mandatory before writes', async () => {
  const base = await fixture();
  for (const mutate of [
    value => {value.admission.sourceSha256 = '0'.repeat(64);},
    value => {value.admission.cloudVideoSent = true;},
    value => {value.admission.analysisMode = 'gemini';},
    value => {value.admission.rawSourceRetained = true;},
    value => {value.admission.audioRetained = true;},
    value => {value.admission.originalDurationSeconds = 6;},
    value => {value.admission.width = 127;},
    value => {value.scene.durationFrames = 3; value.scene.layers[0].keyframes[1].frame = 2;},
    value => {value.scene.width = 2000; value.admission.width = 2000;}
  ]) {const changed = fresh(base); mutate(changed); await rejectWithoutWrite(changed);}
});

test('frame coverage, actual quality failures and provider claims cannot become saved assets', async () => {
  const base = await fixture();
  for (const mutate of [
    value => {value.analysis.frameCount = 3;},
    value => {value.analysis.quality.visualComparison = 'FAIL';},
    value => {value.analysis.quality.comparedFrameCount = 3;},
    value => {value.analysis.quality.failedFrameCount = 1;},
    value => {value.analysis.quality.maxMeanAbsoluteError = 12;},
    value => {value.analysis.quality.maxChangedPixelFractionOver30 = .12;},
    value => {value.analysis.metadata.networkRequests = 1;},
    value => {value.analysis.metadata.provider = 'gemini';},
    value => {value.state = 'READY_TO_EDIT';},
    value => {value.exactRecreationGuaranteed = true;},
    value => {value.analysisCredits = 1;}
  ]) {const changed = fresh(base); mutate(changed); await rejectWithoutWrite(changed);}
});

test('all returned images are checked before the first write, including IDs and private URL rejection', async () => {
  const base = await fixture({count: 2});
  for (const mutate of [
    value => {delete value.images['asset-1'];},
    value => {value.images.extra = value.images['asset-0'];},
    value => {value.images['asset-1'] = 'https://private.example/other-user.webp';},
    value => {value.images['asset-1'] = 'file:///C:/private/asset.png';},
    value => {value.images['asset-1'] = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';},
    value => {value.images['asset-1'] = 'data:image/png;base64,' + Buffer.from('invalid raster').toString('base64');}
  ]) {const changed = fresh(base); mutate(changed); await rejectWithoutWrite(changed);}
});

test('actual raster dimensions and MIME must match the declared image plane', async () => {
  const base = await fixture();
  const tiny = await sharp({create: {width: 1, height: 1, channels: 3, background: '#ffffff'}}).png().toBuffer();
  const small = fresh(base); small.images['asset-0'] = 'data:image/png;base64,' + tiny.toString('base64');
  await rejectWithoutWrite(small);
  const wrongMIME = fresh(base); wrongMIME.images['asset-0'] = wrongMIME.images['asset-0'].replace('data:image/png;', 'data:image/jpeg;');
  await rejectWithoutWrite(wrongMIME);
});

test('a later persistence failure or cancellation cleans up only new owner assets', async () => {
  const base = await fixture({count: 2}), storage = persistence();
  let count = 0;
  await assert.rejects(acceptAnalysis(base, {...baseOptions, ...storage, persistImage: async (user, mediaData) => {
    count++; if (count === 2) throw Error('Isolated second write failed'); return storage.persistImage(user, mediaData);
  }}), /second write failed/);
  assert.deepEqual(storage.deleted, [{owner: userId, refs: [ref(1)]}]);
  const controller = new AbortController(), cancelled = persistence();
  await assert.rejects(acceptAnalysis(base, {...baseOptions, ...cancelled, signal: controller.signal,
    persistImage: async (user, mediaData) => {const stored = await cancelled.persistImage(user, mediaData); controller.abort(); return stored;}
  }), error => error.code === 'REFERENCE_CANCELLED');
  assert.equal(cancelled.writes.length, 1);
  assert.deepEqual(cancelled.deleted, [{owner: userId, refs: [ref(1)]}]);
});

test('parseBody rejects wrong type, invalid JSON and non-object output', () => {
  for (const response of [null, {body: '{}', contentType: 'application/json'},
    {body: Buffer.from('{}'), contentType: 'text/html'},
    {body: Buffer.from('invalid'), contentType: 'application/json'},
    {body: Buffer.from('[]'), contentType: 'application/json'}]) assert.throws(() => parseBody(response));
});

test('client requires private PC consent, rejects cloud mode and pins input hash to worker result', async () => {
  const value = await fixture(), storage = persistence(), submissions = [];
  const broker = {online: () => true, submit: async (kind, payload, options) => {
    submissions.push({kind, payload: JSON.parse(payload.toString()), options});
    return {body: Buffer.from(JSON.stringify(value)), contentType: 'application/json'};
  }};
  const client = createPCClient({broker, ...storage});
  const input = {video: 'data:video/mp4;base64,' + original.toString('base64')};
  await assert.rejects(client.processReference(input, {userId, plan: 'free'}), error => error.code === 'REFERENCE_PC_CONSENT_REQUIRED');
  await assert.rejects(client.processReference({...input, ownerPcConsent: true, analysisMode: 'gemini'}, {userId, plan: 'free'}), error => error.code === 'REFERENCE_PC_LOCAL_ONLY');
  let released = false;
  const result = await client.processReference({...input, ownerPcConsent: true}, {userId, plan: 'free', releaseInput: () => {released = true;}});
  assert.equal(released, true); assert.equal(submissions.length, 1); assert.equal(submissions[0].kind, 'analyze');
  assert.equal(submissions[0].payload.userId, userId); assert.equal(result.admission.sourceSha256, sourceHash);
  assert.equal(input.video, 'data:video/mp4;base64,' + original.toString('base64'), 'Caller input is not mutated');
});

test('offline admission performs no persistence or dispatch', async () => {
  const storage = persistence(); let calls = 0;
  const client = createPCClient({broker: {online: () => false, submit: () => {calls++;}}, ...storage});
  await assert.rejects(client.processReference({ownerPcConsent: true}, {userId}), error => error.code === 'REFERENCE_WORKER_OFFLINE');
  assert.equal(calls, 0); assert.equal(storage.writes.length, 0);
});

test('render transport validates controlled images and real MP4 signature before returning', async () => {
  const value = await fixture(), document = {scene: value.scene, images: value.images};
  let calls = 0;
  const broker = {online: () => true, submit: async () => {calls++; return {contentType: 'video/mp4', body: Buffer.alloc(1200)};}};
  const client = createPCClient({broker});
  await assert.rejects(client.exportReference(document), /valid bounded MP4/); assert.equal(calls, 1);
  await assert.rejects(client.exportReference({...document, images: {'asset-0': 'https://another-user/private.png'}})); assert.equal(calls, 1);
  await assert.rejects(client.exportReference(document, {height: 999})); assert.equal(calls, 1);
  const mp4 = Buffer.alloc(1200); mp4.write('ftyp', 4, 'ascii');
  broker.submit = async (kind, payload) => {assert.equal(kind, 'render'); const job = JSON.parse(payload); assert.deepEqual(job.options, {height: 480, watermark: true}); return {contentType: 'video/mp4', body: mp4};};
  const result = await client.exportReference(document);
  assert.equal(result.buffer, mp4); assert.deepEqual({width: result.metrics.width, height: result.metrics.height, frames: result.metrics.frames}, {width: 960, height: 480, frames: 4});
});

test('private asset writes/readbacks and cleanup retain account and unpublished predicates', async () => {
  const queries = [], rows = [];
  const database = {async query(sql, params) {
    queries.push({sql, params});
    if (sql.includes('pg_advisory_xact_lock')) return {rows: []};
    if (sql.includes('coalesce(sum(byte_size)')) return {rows: [{bytes: 0}]};
    if (sql.startsWith('insert into')) {rows.push({jobId: params[0], assetPath: params[1], userId: params[2], bytes: params[3], public: false}); return {rows: []};}
    if (sql.startsWith('select content')) {
      assert.match(sql, /user_id=\$3/);
      return {rows: rows.filter(row => row.jobId === params[0] && row.assetPath === params[1] && row.userId === params[2]).map(row => ({content: row.bytes}))};
    }
    if (sql.startsWith('delete from')) {
      assert.match(sql, /user_id = \$3 and is_public = false/);
      const index = rows.findIndex(row => row.jobId === params[0] && row.assetPath === params[1] && row.userId === params[2] && !row.public);
      if (index < 0) return {rowCount: 0}; rows.splice(index, 1); return {rowCount: 1};
    }
    throw Error('Unexpected isolated asset query');
  }, async tx(run) {return run(this);}};
  const target = {exports: {}}, filename = path.resolve(__dirname, '../reference-motion/assets.js'), nativeRequire = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {module: target, exports: target.exports, Buffer,
    require: name => name === '../db' ? database : nativeRequire(name)}, {filename});
  const assets = target.exports, base = await fixture();
  const stored = await assets.upload({id: userId}, base.images['asset-0']);
  assert.equal(assets.validRef(stored.ref), true); assert.equal(stored.ref.assetPath, 'original.webp');
  assert.match(stored.mediaData, /^data:image\/webp;base64,/);
  assert.equal(await assets.resolve({id: userId}, stored.ref), stored.mediaData);
  await assert.rejects(assets.resolve({id: 'different-owner'}, stored.ref), error => error.status === 403);
  assert.equal(assets.validRef({...stored.ref, assetPath: '../../private.png'}), false);
  assert.equal(assets.validRef({...stored.ref, url: 'https://private.example/image'}), false);
  rows[0].public = true;
  assert.equal((await assets.discard(userId, [stored.ref])).removed, 0, 'Published assets cannot be removed by temporary-job cleanup');
  rows[0].public = false;
  assert.equal((await assets.discard('different-owner', [stored.ref])).removed, 0);
  assert.equal((await assets.discard(userId, [stored.ref])).removed, 1);
  assert(queries.some(query => query.sql.includes('is_public) values') && query.sql.includes('false)')));
});
