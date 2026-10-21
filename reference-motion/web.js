'use strict';
const fs = require('node:fs'), path = require('node:path');
const {enabled, guard} = require('./routes'), {durationLimit} = require('./admission');
const assets = require('./assets'), project = require('./project');
const {exportReference} = require('./render');
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'none'";

function createHandlers({credits, serialise, referrals, projects, render = exportReference, availability, chargeAfterRender = false}) {
  return {
    async upload(req, res) {
      if (!guard(req, res, true)) return;
      try {
        if (!req.body || Object.keys(req.body).some(key => key !== 'image')) throw Error('Unsupported reference asset field');
        return res.json({success: true, ...await assets.upload(req.user, req.body.image)});
      } catch (error) {return res.status(error.status || 422).json({success: false, error: error.status === 403 ? 'This private image is unavailable.' : 'Could not store this bounded PNG/JPEG/WebP image.'});}
    },
    async reopen(req, res) {
      if (!guard(req, res)) return;
      try {
        const out = await projects.get(req.user, req.params.id);
        if (out.error) return res.status(out.status || 400).json({success: false, error: out.error});
        if (out.project.clips.length !== 1 || out.project.clips[0].tpl !== 'reference-motion') return res.status(422).json({success: false, error: 'Not a standalone reference project. Your saved clips were not changed.'});
        return res.json({success: true, project: out.project, ...await project.hydrate(req.user, out.project.clips[0])});
      } catch (error) {return res.status(error.status || 422).json({success: false, error: 'This reference project or its private assets could not be opened.'});}
    },
    async export(req, res) {
      if (!guard(req, res, true)) return;
      if (availability && availability().workerOnline !== true) return res.status(503).json({success: false, code: 'REFERENCE_WORKER_OFFLINE', error: 'The free beta processing PC is offline. Your saved project is unchanged. No credits were charged.'});
      let document, ent;
      try {
        const body = req.body;
        if (!body || Object.keys(body).some(key => !['scene', 'mediaAssets', 'height', 'reviewAcknowledged'].includes(key)) || body.reviewAcknowledged !== true) throw Error('Review the reconstruction before exporting');
        ent = await credits.entitlements(req);
        // Validation, duration and ownership checks precede any charge.
        const safe = await project.normaliseClip(req.user, {tpl: 'reference-motion', spec: body.scene, props: {mediaAssets: body.mediaAssets, analysis: {}}});
        if (safe.spec.durationFrames > durationLimit(ent.plan) * 30) return res.status(422).json({success: false, code: 'REFERENCE_TOO_LONG', error: 'Free exports are limited to 5 seconds. Pro supports up to 10 seconds.'});
        document = await project.hydrate(req.user, safe);
      } catch (error) {return res.status(error.status || 422).json({success: false, error: error.status === 403 ? 'Private assets are unavailable to this account.' : 'Invalid reference export. Review the scene and its private assets.'});}
      if (res.destroyed || req.aborted) return;
      let charged = false, rendered = false;
      const controller = new AbortController(), close = () => {if (!res.writableEnded) controller.abort();};
      res.once('close', close);
      try {
        // Ephemeral free-beta jobs cannot survive a web-service restart. Debit
        // only after the actual MP4 returns; retain the existing ledger checks.
        if (chargeAfterRender) {
          const state = await credits.state(req);
          if (state.left < (state.cost?.export || 1)) return res.status(402).json({success: false, error: 'Not enough export credits.'});
        } else {
          const bill = await credits.charge(req, 'export');
          if (!bill.ok) return res.status(bill.status || 402).json({success: false, ...bill});
          charged = true;
        }
        if (controller.signal.aborted) throw Error('Reference export disconnected before queueing');
        const asked = [480, 720, 1080, 1440].includes(req.body.height) ? req.body.height : 480;
        const {buffer, metrics} = await serialise(() => {
          if (controller.signal.aborted) throw Error('Export request cancelled before render');
          return render(document, {height: Math.min(asked, ent.maxHeight), watermark: ent.watermark, signal: controller.signal});
        }, ent.plan, {signal: controller.signal});
        if (chargeAfterRender) {
          if (controller.signal.aborted || res.destroyed) throw Error('Reference export disconnected before billing');
          const bill = await credits.charge(req, 'export');
          if (!bill.ok) return res.status(bill.status || 402).json({success: false, ...bill});
          charged = true;
          if (controller.signal.aborted || res.destroyed) throw Error('Reference export disconnected during billing');
        }
        rendered = true;
        await referrals.successfulExport(req.user, req._creditChargeIds?.export).catch(() => {});
        if (res.destroyed) return;
        res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Content-Length', String(buffer.length));
        res.setHeader('Content-Disposition', 'attachment; filename="shortscraft-reference-motion.mp4"');
        res.setHeader('X-Reference-Render-Ms', String(Math.round(metrics.renderMs)));
        try {res.setHeader('X-Credits-Left', String((await credits.state(req)).left));} catch {}
        return res.end(buffer);
      } catch (error) {
        let refunded = !charged;
        if (charged && !rendered) refunded = await credits.refund(req, 'export').then(() => true).catch(() => false);
        if (res.destroyed || res.headersSent) return;
        for (const header of ['Content-Type', 'Content-Length', 'Content-Disposition', 'X-Reference-Render-Ms']) res.removeHeader?.(header);
        const offline = error?.code === 'REFERENCE_WORKER_OFFLINE';
        return res.status(503).json({success: false, ...(offline ? {code: 'REFERENCE_WORKER_OFFLINE'} : {}), refundConfirmed: refunded,
          error: !charged && chargeAfterRender ? (offline ? 'The free beta processing PC is offline. No export credits were charged.' : 'Export did not complete. No export credits were charged.') : rendered ? 'Render completed but delivery failed. No automatic duplicate render was started.' : refunded ? 'Export failed; its charge was refunded.' : 'Export failed; refund could not be confirmed. Contact support.'});
      } finally {res.removeListener('close', close);}
    }
  };
}

function install(app, deps) {
  const handlers = createHandlers(deps);
  function page(req, res, filename, type) {
    res.setHeader('Cache-Control', 'no-store');
    if (!enabled()) return res.status(404).end();
    if (!fs.existsSync(filename)) return res.status(503).end('Build the reference editor before enabling this experimental feature');
    res.setHeader('Content-Security-Policy', CSP); if (type) res.type(type);
    return res.sendFile(filename);
  }
  app.get('/reference-motion', (req, res) => page(req, res, path.join(__dirname, 'editor.html')));
  app.get('/reference-motion/editor.css', (req, res) => page(req, res, path.join(__dirname, 'editor.css'), 'css'));
  app.get('/reference-motion/editor.js', (req, res) => page(req, res, fs.existsSync(path.join(__dirname, 'editor.bundle.js')) ? path.join(__dirname, 'editor.bundle.js') : path.resolve(__dirname, '../data/reference-motion-editor.js'), 'js'));
  // A fixed OFL font, never an uploaded URL or another owner's asset. The same
  // bytes are injected by the controlled MP4 renderer to prevent OS fallback.
  app.get('/reference-motion/fonts/noto-sans.ttf', (req, res) => page(req, res, path.resolve(__dirname, '../flagship/assets/NotoSansDevanagari.ttf'), 'font/ttf'));
  app.get('/reference-motion/fonts/latin-modern-roman.otf', (req, res) => page(req, res, path.resolve(__dirname, 'fonts/LMRoman10-Regular.otf'), 'font/otf'));
  const before = (req, res, next) => {if (guard(req, res, true)) next();};
  app.post('/api/reference-motion/assets', before, deps.rateLimit({windowMs: 60000, max: 12}), deps.json.image, handlers.upload);
  app.get('/api/reference-motion/projects/:id', handlers.reopen);
  app.post('/api/reference-motion/export', before, deps.rateLimit({windowMs: 120000, max: 6}), deps.json.export, handlers.export);
  return handlers;
}
module.exports = {CSP, createHandlers, install};
