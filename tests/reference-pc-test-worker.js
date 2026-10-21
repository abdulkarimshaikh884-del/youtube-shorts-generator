'use strict';
// Actual PC runtime, with a loopback-only transport for isolated evidence.
const assert = require('node:assert/strict');
assert.equal(process.env.SC_ISOLATED_WORKER_QA, 'true');
require('dotenv').config = () => ({parsed: {}});
assert.equal(process.env.DATABASE_URL, undefined);
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(input);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname));
  return fetchOriginal(input, options);
};
const {runWorker, createClient} = require('../reference-motion/pc-worker');
const {readPrivateStdin} = require('../reference-motion/pc-worker-config');
(async () => {
  const config = await readPrivateStdin();
  const controller = new AbortController();
  process.once('SIGTERM', () => controller.abort());
  process.once('SIGINT', () => controller.abort());
  await runWorker(config, {client: createClient(config, {allowLoopback: true}), signal: controller.signal, pollMs: 1000});
})().catch(() => {console.error('Isolated actual PC worker stopped.'); process.exitCode = 1;});
