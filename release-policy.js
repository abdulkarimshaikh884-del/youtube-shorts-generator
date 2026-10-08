"use strict";

// This release is Free-only. Gateway credentials or admin feature flags must
// not accidentally enable money flows. Reopening requires a reviewed release
// after ledger reconciliation, payout transitions and gateway tests pass.
const monetizationEnabled = false;
const permissions = require("./permissions");
const message = "Payments, Stars donations, paid unlocks and payouts are Coming Soon. Free features remain available.";
const unavailable = () => ({ success: false, error: message, code: "MONETIZATION_COMING_SOON", status: 503 });

function middleware(req, res, next) {
  if (monetizationEnabled || !["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
  const moneyRoute = /^\/api\/(?:auth\/star|razorpay\/(?:order|verify)|stars\/(?:donate|withdraw|purchase\/(?:order|verify))|admin\/(?:withdrawals\/[^/]+\/process|stars\/transactions\/[^/]+\/reverse|star-packs(?:\/[^/]+)?))\/?$/i.test(req.path);
  const starAdjustment = /^\/api\/admin\/users\/[^/]+\/balance\/?$/i.test(req.path) && String(req.body?.type || "stars").toLowerCase() === "stars";
  if (!moneyRoute && !starAdjustment) return next();
  if (!req.user) return res.status(401).json({ success: false, error: "Please log in first." });
  if (req.path.startsWith("/api/admin/")) {
    const permission = starAdjustment ? "users.balance_adjust" : req.path.includes("withdrawals/") ? "withdrawals.manage" : req.path.includes("transactions/") ? "stars.manage" : "star_packs.manage";
    if (!permissions.can(req.user, permission)) return res.status(403).json({ success: false, error: "Permission denied." });
  }
  res.set("Cache-Control", "no-store");
  return res.status(503).json(unavailable());
}

module.exports = { monetizationEnabled, message, unavailable, middleware };
