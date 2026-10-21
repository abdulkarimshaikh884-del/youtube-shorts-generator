"use strict";

// Large bodies are bounded by each route's own parser. The small global parser
// must not consume them first, otherwise those route limits are unreachable.
function usesRouteJsonParser(req) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return false;
  if (req.method === 'PUT' && /^\/api\/projects\/[^/]+\/?$/.test(req.path)) return true;
  return /^\/api\/(?:animate|export|auth\/avatar|lottie|reference-motion\/(?:analyze|assets|export)|designs\/(?:convert|publish|projects\/[^/]+))\/?$/.test(req.path);
}

module.exports = { usesRouteJsonParser };
