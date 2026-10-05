// Shared by the browser, Express and the isolated preview server.
(function (root) {
  "use strict";
  var routes = Object.freeze({
    settings: "/account", creations: "/account/creations",
    edit: "/account/edit-profile", account: "/account/credits",
    appearance: "/account/appearance", notifications: "/account/notifications",
    stars: "/account/earnings", support: "/account/support",
    referrals: "/account/referrals", followers: "/account/followers",
    following: "/account/following", logout: "/account/logout"
  });
  if (typeof module === "object" && module.exports) module.exports = routes;
  else root.SC_ACCOUNT_ROUTES = routes;
})(typeof window === "object" ? window : globalThis);
