/* ============================================================
   drafts-store.js — the browser-side project store.

   The account page promised "the editor keeps your current timeline in this
   browser, so you can close the tab and pick it up again". Nothing implemented
   that: the editor held its timeline in memory only, so closing the tab lost
   the work and the Drafts section had nothing it could ever list.

   Drafts live in localStorage because a project is only a template id, some
   strings, a colour and a duration per clip — kilobytes, not media. Storage is
   namespaced by the authenticated account: a guest can try the editor, but a
   guest visit must never appear as a fake project and one account must never
   see another account's browser-local drafts.
   ============================================================ */
(function (root) {
  "use strict";

  var KEY_PREFIX = "sc_drafts_v2_";
  var MAX = 30;            // newest kept; a browser quota is not a project archive
  var owner = "";

  function ownerKey(user) {
    if (!user || (!user.id && !user.email)) return "";
    return String(user.id || user.email).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
  }

  function key() {
    return owner ? KEY_PREFIX + owner : "";
  }

  function setOwner(user) {
    owner = ownerKey(user);
    return !!owner;
  }

  function read() {
    var storageKey = key();
    if (!storageKey) return [];
    try {
      var raw = localStorage.getItem(storageKey);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      // Corrupt or unavailable storage must not take the editor down with it.
      return [];
    }
  }

  function write(list) {
    var storageKey = key();
    if (!storageKey) return false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(list.slice(0, MAX)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function newId() {
    return "d_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  /* Newest first — every surface that lists drafts wants that order. */
  function list() {
    return read().sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  function get(id) {
    var all = read();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* Upsert by id. Returns the stored record so the caller can adopt the id it
     was given on the first save. */
  function save(draft) {
    if (!owner || !draft || !Array.isArray(draft.clips) || !draft.clips.length) return null;
    var all = read();
    var rec = {
      id: draft.id || newId(),
      name: String(draft.name || "Untitled animation").slice(0, 60),
      aspect: draft.aspect || "9:16",
      clips: draft.clips,
      updatedAt: Date.now()
    };
    var at = -1;
    for (var i = 0; i < all.length; i++) if (all[i].id === rec.id) { at = i; break; }
    if (at >= 0) {
      rec.createdAt = all[at].createdAt || rec.updatedAt;
      all[at] = rec;
    } else {
      rec.createdAt = rec.updatedAt;
      all.push(rec);
    }
    // Trim the oldest first, so an autosave never evicts what someone just made.
    all.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    write(all);
    pushOne(rec);
    return rec;
  }

  function remove(id) {
    write(read().filter(function (d) { return d.id !== id; }));
    pushDelete(id);
  }

  function rename(id, name) {
    var all = read();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i].name = String(name || "").slice(0, 60) || "Untitled animation";
        all[i].updatedAt = Date.now();
        write(all);
        pushOne(all[i]);
        return all[i];
      }
    }
    return null;
  }

  function totalMs(draft) {
    if (!draft || !draft.clips) return 0;
    return draft.clips.reduce(function (s, c) { return s + (Number(c.dur) || 0); }, 0);
  }

  /* ── account sync ──────────────────────────────────────────

     localStorage stays the synchronous source of truth: every caller here
     reads and writes it directly and expects an answer immediately, and it
     keeps working with no network. On top of that, a signed-in account gets
     its projects mirrored to the server so they reach another device — which
     is what the account page has always promised.

     Conflicts are settled by updatedAt, newest wins. That is the right rule
     for one person moving between their own devices, which is the case this
     serves; it is not a multi-writer merge and does not pretend to be. */
  var syncing = false;

  function pushOne(rec) {
    if (!owner || !rec) return;
    fetch("/api/projects/" + encodeURIComponent(rec.id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rec.name, aspect: rec.aspect, clips: rec.clips })
    }).catch(function () {
      // Offline or signed out: the local copy is still correct, and the next
      // save or sign-in pushes it. Losing a sync must never lose the work.
    });
  }

  function pushDelete(id) {
    if (!owner || !id) return;
    fetch("/api/projects/" + encodeURIComponent(id), { method: "DELETE" }).catch(function () {});
  }

  /* Pulls the account's projects, merges them with whatever this browser
     holds, then hands up anything the server has never seen. Runs once when
     the account is known. */
  function sync() {
    if (!owner || syncing) return Promise.resolve(false);
    syncing = true;
    return fetch("/api/projects", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.success || !Array.isArray(j.projects)) return false;

        var local = read();
        var byId = {};
        local.forEach(function (d) { byId[d.id] = d; });

        var localOnly = [];
        j.projects.forEach(function (remote) {
          var mine = byId[remote.id];
          if (!mine || (Number(remote.updatedAt) || 0) >= (Number(mine.updatedAt) || 0)) {
            byId[remote.id] = {
              id: remote.id, name: remote.name, aspect: remote.aspect,
              clips: remote.clips, createdAt: remote.createdAt, updatedAt: remote.updatedAt
            };
          }
        });
        var remoteIds = {};
        j.projects.forEach(function (r2) { remoteIds[r2.id] = true; });
        local.forEach(function (d) { if (!remoteIds[d.id]) localOnly.push(d); });

        var merged = Object.keys(byId).map(function (k) { return byId[k]; });
        merged.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
        write(merged);

        // Projects made before signing in, or while offline, go up once.
        if (localOnly.length) {
          return fetch("/api/projects/adopt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drafts: localOnly })
          }).then(function () { return true; }).catch(function () { return true; });
        }
        return true;
      })
      .catch(function () { return false; })
      .finally(function () { syncing = false; });
  }

  root.SC_DRAFTS = {
    list: list, get: get, save: save, remove: remove, rename: rename,
    newId: newId, totalMs: totalMs, setOwner: setOwner, sync: sync,
    get KEY() { return key(); }
  };
})(window);
