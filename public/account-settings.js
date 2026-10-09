(function () {
  "use strict";
  var host = document.getElementById("igPaneSettings");
  var routes = window.SC_ACCOUNT_ROUTES;
  if (!host || !routes) return;
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

  // Native links load dedicated URL pages. Move existing controls only once;
  // the settings menu must never contain expandable forms or duplicate IDs.
  var titles = {creations:"Creations",edit:"Edit profile",account:"Account & Earnings",appearance:"Appearance",notifications:"Notifications",stars:"Account & Earnings",support:"Help & support",referrals:"Referral",followers:"Followers",following:"Following",logout:"Log out"};
  var original = host.querySelector(".pf-settings-list");
  var menu = document.createElement("nav");
  menu.className = "pf-settings-list";
  menu.setAttribute("data-page-menu", "");
  menu.setAttribute("aria-label", "Settings options");
  var detail = document.createElement("section");
  detail.id = "accountDetail";
  detail.className = "pf-settings pf-detail";
  detail.hidden = true;
  detail.setAttribute("aria-labelledby", "accountPageHeading");
  var pageHead = document.createElement("header");
  pageHead.className = "pf-detail-head";
  var back = document.createElement("a");
  back.href = routes.settings;
  back.className = "ig-btn ig-btn-secondary pf-detail-back";
  back.setAttribute("aria-label", "Back to Settings");
  back.title = "Back to Settings";
  back.textContent = "←";
  var heading = document.createElement("h1");
  heading.id = "accountPageHeading";
  pageHead.append(back, heading);
  detail.appendChild(pageHead);
  var views = {};
  var inline = {};
  Array.from(original.children).forEach(function (group) {
    var name = group.getAttribute("data-settings-group");
    if (!name || !routes[name]) { menu.appendChild(group); return; }
    if (name === "appearance" || name === "logout") { inline[name] = group; return; }
    var description = group.querySelector("small");
    var link = document.createElement("a");
    link.className = "pf-setting-row pf-setting-standalone pf-setting-link";
    link.href = routes[name];
    link.setAttribute("data-settings-link", name);
    var label = document.createElement("span");
    var title = document.createElement("strong");
    title.textContent = titles[name];
    label.appendChild(title);
    if (description) label.appendChild(description.cloneNode(true));
    var arrow = document.createElement("span");
    arrow.className = "pf-chevron";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";
    link.append(label, arrow);
    if (name !== "stars") menu.appendChild(link);
    var panel = document.createElement("section");
    panel.className = "pf-page-panel pf-setting-content";
    panel.setAttribute("data-settings-page", name);
    panel.hidden = true;
    if (group.tagName === "DETAILS") {
      var summary = group.querySelector("summary");
      if (summary) summary.remove();
      while (group.firstChild) panel.appendChild(group.firstChild);
    } else {
      group.classList.remove("pf-setting-standalone");
      group.removeAttribute("data-settings-group");
      panel.appendChild(group);
    }
    views[name] = panel;
    detail.appendChild(panel);
  });
  // One account overview followed by earnings and the existing transaction ledger.
  if (views.account && views.stars) {
    var overview = document.createElement("h2"); overview.textContent = "Account overview";
    views.account.prepend(overview);
    while (views.stars.firstChild) views.account.appendChild(views.stars.firstChild);
    var history = document.createElement("section"); history.className = "pf-transaction-history";
    history.innerHTML = '<h2>Transaction history</h2><p class="pf-setting-note">Your credit activity, Stars records and purchases. Money features are Coming Soon.</p><div id="accountTransactionList" aria-live="polite"><p>Loading history…</p></div><button type="button" class="ig-btn ig-btn-secondary" id="accountTransactionMore" hidden>Show more</button>';
    views.account.appendChild(history);
    views.stars.remove(); views.stars = views.account;
  }
  ["appearance", "logout"].forEach(function (name) { if (inline[name]) menu.appendChild(inline[name]); });
  original.replaceWith(menu);
  host.after(detail);
  ["followers", "following"].forEach(function (name) {
    var pane = document.querySelector('[data-ig-pane="' + name + '"]');
    if (!pane) return;
    pane.classList.add("is-active");
    pane.hidden = false;
    pane.setAttribute("data-settings-page", name);
    views[name] = pane;
    detail.appendChild(pane);
  });
  detail.querySelectorAll("[data-ig-back]").forEach(function (button) { button.remove(); });
  var referral = document.getElementById("referralSettings");
  if (referral) { referral.removeAttribute("aria-labelledby"); referral.setAttribute("aria-label", "Referral details"); }
  var current = Object.keys(routes).find(function (name) { return routes[name] === location.pathname.replace(/\/$/, ""); }) || "settings";
  if (current === "stars") { location.replace(routes.account + location.search); return; }
  if (current === "appearance" || current === "logout") { location.replace(routes.settings); return; }
  var legacy = location.hash.slice(1);
  if (legacy === "edit-profile" || legacy === "profile") legacy = "edit";
  if (current === "settings" && new URLSearchParams(location.search).has("verify") && !legacy) legacy = "referrals";
  if (routes[legacy]) {
    location.replace(routes[legacy] + location.search);
    return;
  }
  window.SC_ACCOUNT_NAV = {current:current,navigate:function (name) {
    if (routes[name] && routes[name] !== location.pathname) location.assign(routes[name]);
  }};
  window.addEventListener("hashchange", function () {
    var name = location.hash.slice(1);
    if (name === "edit-profile" || name === "profile") name = "edit";
    if (routes[name]) location.replace(routes[name] + location.search);
  });
  if (current !== "settings") {
    host.hidden = true;
    host.classList.remove("is-active");
    var profile = document.querySelector(".ig-header");
    if (profile) profile.hidden = true;
    detail.hidden = false;
    Object.keys(views).filter(function (name) { return name !== "stars"; }).forEach(function (name) { views[name].hidden = name !== current; });
    heading.textContent = titles[current];
    if (current === "notifications") {
      detail.classList.add("pf-notifications-page");
      var markRead = document.getElementById("accountNotificationsRead");
      if (markRead) pageHead.appendChild(markRead);
    }
    document.title = titles[current] + " — ShortsCraft";
  } else Object.keys(views).forEach(function (name) { views[name].hidden = true; });

  document.querySelectorAll('#accountGuest a[href^="/login"], #accountGuest a[href^="/signup"]').forEach(function (link) {
    var target = new URL(link.href);
    target.searchParams.set("next", location.pathname + location.search + location.hash);
    link.setAttribute("href", target.pathname + target.search);
  });
})();
