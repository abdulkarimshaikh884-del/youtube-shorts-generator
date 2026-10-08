"use strict";

// Large bodies are bounded by each route's own parser. The small global parser
// must not consume them first, otherwise those route limits are unreachable.
function usesRouteJsonParser(req) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return false;
  return /^\/api\/(?:animate|export|auth\/avatar|lottie|designs\/(?:convert|publish|projects\/[^/]+))\/?$/.test(req.path);
}

module.exports = { usesRouteJsonParser };
