'use strict';

const { ANALYSIS_BYTES, RENDER_BYTES, validWorkerId } = require('./pc-broker');

function install(app, { broker, enabled = () => process.env.SC_REFERENCE_MOTION === 'true' && process.env.SC_REFERENCE_PROCESSOR === 'pc' } = {}) {
  if (!broker) throw new Error('A PC processing broker is required.');
  const express = require('express');
  const smallJSON = express.json({ limit: 2048, strict: true });
  const prefix = '/api/reference-motion/worker';
  function reply(res, status, code) { return res.status(status).json({ success: false, code }); }
  function auth(req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    if (!(typeof enabled === 'function' ? enabled() : enabled)) return reply(res, 404, 'REFERENCE_MOTION_DISABLED');
    if (!broker.authenticate(req.get('Authorization'))) return reply(res, 401, 'REFERENCE_PC_AUTH_REQUIRED');
    return next();
  }
  function jsonType(req, res, next) {
    if (!req.is('application/json')) return reply(res, 415, 'REFERENCE_PC_CONTENT_TYPE_INVALID');
    return next();
  }
  function lease(req, res, next) {
    if (!broker.matchesLease(req.params.id, req.get('X-Reference-Lease'))) return reply(res, 404, 'REFERENCE_PC_JOB_NOT_FOUND');
    return next();
  }
  function closedFields(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key)); }
  function safeHandler(handler) {
    return (req, res, next) => {
      try { return handler(req, res, next); }
      catch (failure) { return reply(res, failure.status >= 400 && failure.status <= 599 ? failure.status : 503, /^REFERENCE_[A-Z_]+$/.test(failure.code || '') ? failure.code : 'REFERENCE_WORKER_FAILED'); }
    };
  }
  app.post(`${prefix}/claim`, auth, jsonType, smallJSON, safeHandler((req, res) => {
    if (!closedFields(req.body, ['workerId']) || !validWorkerId(req.body.workerId)) return reply(res, 400, 'REFERENCE_PC_WORKER_INVALID');
    const job = broker.claim(req.body.workerId);
    return job ? res.json(job) : res.sendStatus(204);
  }));
  app.get(`${prefix}/jobs/:id/input`, auth, lease, safeHandler((req, res) => {
    const leaseValue = req.get('X-Reference-Lease');
    const body = broker.input(req.params.id, leaseValue);
    const stop = broker.onJobFailure(req.params.id, leaseValue, () => res.destroy());
    const release = () => { stop(); broker.releaseInput(req.params.id, leaseValue); };
    res.once('finish', release); res.once('close', release);
    res.type('application/json'); return res.send(body);
  }));
  app.post(`${prefix}/jobs/:id/pulse`, auth, lease, jsonType, smallJSON, safeHandler((req, res) => {
    if (!closedFields(req.body, []) || Object.keys(req.body).length) return reply(res, 400, 'REFERENCE_INPUT_INVALID');
    broker.pulse(req.params.id, req.get('X-Reference-Lease'));
    return res.json({ success: true });
  }));
  app.post(`${prefix}/jobs/:id/complete`, auth, lease, safeHandler((req, res, next) => {
    const leaseValue = req.get('X-Reference-Lease');
    const kind = broker.jobKind(req.params.id, leaseValue);
    const type = kind === 'render' ? 'video/mp4' : 'application/json';
    if (!req.is(type)) return reply(res, 415, 'REFERENCE_PC_CONTENT_TYPE_INVALID');
    const maximum = kind === 'render' ? RENDER_BYTES : ANALYSIS_BYTES;
    const declared = req.get('Content-Length');
    if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) < 1 || Number(declared) > maximum)) return reply(res, 413, 'REFERENCE_OUTPUT_TOO_LARGE');
    const reservation = broker.beginComplete(req.params.id, leaseValue);
    const stop = broker.onJobFailure(req.params.id, leaseValue, () => req.destroy());
    const release = () => broker.cancelComplete(req.params.id, leaseValue, reservation);
    res.once('close', release);
    return express.raw({ limit: maximum, type: () => true })(req, res, failure => {
      stop();
      if (failure) { release(); if (res.destroyed) return; return reply(res, failure.type === 'entity.too.large' ? 413 : 400, failure.type === 'entity.too.large' ? 'REFERENCE_OUTPUT_TOO_LARGE' : 'REFERENCE_INPUT_INVALID'); }
      try { broker.complete(req.params.id, leaseValue, req.body, type, reservation); return res.sendStatus(204); }
      catch (error) { release(); return reply(res, error.status || 503, error.code || 'REFERENCE_WORKER_FAILED'); }
      finally { if (Buffer.isBuffer(req.body)) req.body.fill(0); req.body = undefined; }
    });
  }));
  app.post(`${prefix}/jobs/:id/fail`, auth, lease, jsonType, smallJSON, safeHandler((req, res) => {
    if (!closedFields(req.body, ['code', 'details']) || typeof req.body.code !== 'string' || req.body.code.length > 100 ||
      (req.body.details !== undefined && (!req.body.details || typeof req.body.details !== 'object' || Array.isArray(req.body.details)))) return reply(res, 400, 'REFERENCE_INPUT_INVALID');
    broker.fail(req.params.id, req.get('X-Reference-Lease'), req.body);
    return res.sendStatus(204);
  }));
  // Keep parser diagnostics and worker-supplied values out of the site's global
  // error logger. Authentication and lease checks ran before these parsers.
  app.use(prefix, (failure, req, res, next) => {
    if (res.headersSent) return next(failure);
    return reply(res, failure.type === 'entity.too.large' ? 413 : 400,
      failure.type === 'entity.too.large' ? 'REFERENCE_INPUT_TOO_LARGE' : 'REFERENCE_INPUT_INVALID');
  });
}

module.exports = { install, installWorkerRoutes: install };
