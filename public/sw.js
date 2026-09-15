/* ShortsCraft service worker: device notifications only.

   It does not cache pages or intercept requests; the site works exactly as
   it does without it. Its one job is to show a notification the server
   pushes, and to open the right page when it is tapped. */

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });

function safeUrl(url) {
  // Only ever open a page on this site.
  try {
    var u = new URL(url || "/", self.location.origin);
    return u.origin === self.location.origin ? u.href : self.location.origin + "/";
  } catch (e) {
    return self.location.origin + "/";
  }
}

self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  var title = data.title || "ShortsCraft";
  var options = {
    body: data.body || "You have a new notification.",
    icon: "/favicon-192.png",
    badge: "/favicon-48.png",
    tag: data.tag || data.id || undefined,
    data: { url: safeUrl(data.url), id: data.id || "" }
  };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      // Someone looking at the site right now gets it in the page's own bell
      // instead of a system banner on top of what they are doing.
      var focused = list.filter(function (c) { return c.focused || c.visibilityState === "visible"; });
      list.forEach(function (c) { c.postMessage({ type: "sc-notification", title: title, body: options.body, url: options.data.url }); });
      if (focused.length) return;
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then(function (c) { return c && "navigate" in c ? c.navigate(target) : c; });
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
