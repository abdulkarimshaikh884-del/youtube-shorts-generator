(function () {
  "use strict";
  if (window.SC_FINISHING || window.top !== window) return;
  window.SC_FINISHING = true;
  var track = document.createElement("div");
  track.className = "sc-load-track";
  track.hidden = true;
  track.setAttribute("role", "status");
  track.setAttribute("aria-live", "polite");
  var label = document.createElement("span");
  label.className = "sc-load-label";
  track.appendChild(label);
  document.body.appendChild(track);
  var pending = 0, delay;
  function settled() {
    pending = Math.max(0, pending - 1);
    if (pending) return;
    clearTimeout(delay);
    track.hidden = true;
    label.textContent = "";
  }
  // Observe the original promise without replacing its response, error,
  // signal, credentials or options. No new requests or production records.
  var originalFetch = window.fetch;
  if (originalFetch) window.fetch = function () {
    var request = originalFetch.apply(this, arguments);
    var url;
    try { url = new URL(arguments[0] instanceof Request ? arguments[0].url : String(arguments[0]), location.href); } catch (_) { return request; }
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return request;
    if (++pending === 1) delay = setTimeout(function () {
      if (pending) { track.hidden = false; label.textContent = "Loading data…"; }
    }, 240);
    request.then(settled, settled);
    return request;
  };
  // Remove stale indicator on browser back/forward cache restoration.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) { clearTimeout(delay); track.hidden = true; label.textContent = ""; }
  });
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!reduced.matches && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("sc-enter");
        observer.unobserve(entry.target);
      });
    }, {threshold:0.08});
    document.querySelectorAll(".sh-workflow-sec,.sh-pricing-prev,.sh-ce-sec,.sh-finale,.pg-plans,.ds-header,.pf-detail-head").forEach(function (el) { observer.observe(el); });
  }
})();
