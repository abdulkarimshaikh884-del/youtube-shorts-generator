'use strict';

const service = require('./service');
const { LIMITS, durationLimit, ReferenceMotionError } = require('./admission');
const enabled = () => process.env.SC_REFERENCE_MOTION === 'true';
let intakeActive = false;

function guard(req, res, write = false) {
  res.setHeader('Cache-Control', 'no-store');
  if (!enabled()) { res.status(404).json({ success: false, code: 'REFERENCE_MOTION_DISABLED' }); return false; }
  if (!req.user?.id || req.authBlocked) { res.status(401).json({ success: false, code: 'REFERENCE_AUTH_REQUIRED', error: 'Sign in before uploading a private animation reference.' }); return false; }
  const origin = req.get?.('Origin');
  if (write && ((origin && origin !== `${req.protocol}://${req.get('host')}`) || req.get?.('Sec-Fetch-Site') === 'cross-site')) {
    res.status(403).json({ success: false, code: 'REFERENCE_ORIGIN_REJECTED', error: 'Cross-origin reference uploads are not allowed.' }); return false;
  }
  return true;
}

function createHandlers({ credits, processReference = service.processReference, availability } = {}) {
  return {
    async status(req, res) {
      if (!guard(req, res)) return;
      const entitlement = await credits.entitlements(req);
      return res.json({ success: true, enabled: true, plan: entitlement.plan,
        maxDurationSeconds: durationLimit(entitlement.plan), maximumSeconds: durationLimit(entitlement.plan), maximumSourceSeconds: LIMITS.sourceSeconds,
        maximumBytes: LIMITS.inputBytes, analysisCredits: 0, localProcessingOnly: !require('./gemini-reference').configured(),
        geminiAvailable: require('./gemini-reference').configured(), geminiModel: require('./gemini-reference').configured() ? require('./gemini-reference').MODEL : null,
        reconstruction: 'SUPPORTED_PLANAR_CARDS_OR_FLAT_VECTORS', exactRecreationGuaranteed: false,
        ...(availability ? availability() : {}) });
    },
    async analyze(req, res) {
      if (!guard(req, res, true)) return;
      const controller = new AbortController();
      const abort = () => controller.abort();
      req.once?.('aborted', abort);
      const close = () => { if (!res.writableEnded) abort(); };
      res.once?.('close', close);
      try {
        const entitlement = await credits.entitlements(req);
        const result = await processReference(req.body, { userId: req.user.id, plan: entitlement.plan, signal: controller.signal,
          releaseInput: () => { req.body = undefined; } });
        if (controller.signal.aborted || res.destroyed) return;
        return res.json({ success: true, ...result });
      } catch (error) {
        if (controller.signal.aborted || res.destroyed || res.headersSent) return;
        if (error instanceof ReferenceMotionError) return res.status(error.status).json({ success: false, code: error.code,
          error: error.message, analysisCredits: 0, ...(error.details ? { details: error.details } : {}) });
        // Dependency diagnostics, image bytes and local filesystem paths stay on
        // the server, not in the response or a public download URL.
        return res.status(503).json({ success: false, code: 'REFERENCE_ANALYSIS_FAILED',
          error: 'Local reference analysis could not complete. No analysis credits were charged.', analysisCredits: 0 });
      } finally {
        req.removeListener?.('aborted', abort); res.removeListener?.('close', close);
      }
    }
  };
}

function install(app, deps) {
  const handlers = createHandlers({...deps, processReference: deps.processReference || service.createService({renderSerialise: deps.serialise}).processReference});
  app.get('/api/reference-motion/status', handlers.status);
  const json = deps.json || require('express').json({ limit: '28mb', strict: true });
  app.post('/api/reference-motion/analyze', (req, res, next) => {
    if (!guard(req, res, true)) return;
    if (intakeActive || service.busy()) return res.status(429).json({ success: false, code: 'REFERENCE_BUSY', error: 'Local analysis is busy. Retry shortly; no credits were charged.' });
    // Reserve before parsing a large base64 body, not merely after its bytes
    // have already been allocated. Releases also cover parser/rate errors.
    intakeActive = true;
    const release = () => { intakeActive = false; res.removeListener?.('finish', release); res.removeListener?.('close', release); };
    res.once('finish', release); res.once('close', release);
    return next();
  }, deps.rateLimit({ windowMs: 60_000, max: 4 }), json, handlers.analyze);
}

module.exports = { enabled, guard, createHandlers, install };
