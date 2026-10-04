(function () {
  "use strict";
  var host = document.getElementById("igPaneSettings");
  if (!host) return;
  // Move, rather than clone: existing IDs, form handlers and server contracts
  // remain the single source of truth. This runs before authui binds them.
  ["edit", "account", "stars", "support"].forEach(function (name) {
    var pane = document.querySelector('[data-ig-pane="' + name + '"]');
    var slot = host.querySelector('[data-settings-slot="' + name + '"]');
    if (!pane || !slot) return;
    pane.hidden = false;
    pane.classList.add("is-active");
    pane.setAttribute("role", "region");
    pane.removeAttribute("aria-labelledby");
    pane.setAttribute("aria-label", {edit:"Edit profile",account:"Account and credits",stars:"Earnings and Stars",support:"Support requests"}[name]);
    slot.appendChild(pane);
  });
  // The consolidated Settings logout is the only one needed in these panels.
  var legacyLogout = document.querySelector("#igPaneAccount .ig-danger-zone");
  if (legacyLogout) legacyLogout.remove();
  var starsBack = document.querySelector("#igPaneStars [data-ig-back]");
  if (starsBack) starsBack.remove();
  var hub = document.querySelector(".sh-profile-hub");
  if (hub) hub.hidden = true;
  document.querySelectorAll('#accountGuest a[href^="/login"], #accountGuest a[href^="/signup"]').forEach(function (link) {
    var target = new URL(link.href);
    target.searchParams.set("next", location.pathname + location.search + location.hash);
    link.setAttribute("href", target.pathname + target.search);
  });
})();
