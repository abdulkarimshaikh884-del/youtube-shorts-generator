'use strict';

const {guard} = require('./routes');

// Mount ONE instance across analyze/export/assets, after account middleware but
// before route body parsers. The free web host holds at most one accepted
// browser reference request while the owner PC performs the expensive work.
function createRequestGate({busy = () => false, online} = {}) {
  let active = null;
  return function referenceRequestGate(req, res, next) {
    if (req.method !== 'POST') return next();
    if (!guard(req, res, true)) return;
    const route = String(req.originalUrl || req.baseUrl || req.path || '').split('?')[0].replace(/\/+$/, '');
    if (online && route !== '/api/reference-motion/assets' && online() !== true) {
      return res.status(503).json({success: false, code: 'REFERENCE_WORKER_OFFLINE',
        error: 'The free beta processing PC is offline. Keep your file and try again when it is available. No credits were charged.'});
    }
    if (active || busy()) {
      return res.status(429).json({success: false, code: 'REFERENCE_BUSY',
        error: 'Reference processing is busy. Retry shortly; no credits were charged.'});
    }
    const reservation = {};
    active = reservation;
    const release = () => {
      if (active === reservation) active = null;
      res.removeListener('finish', release); res.removeListener('close', release);
    };
    res.once('finish', release); res.once('close', release);
    try {return next();}
    catch (failure) {release(); throw failure;}
  };
}

module.exports = {createRequestGate};
