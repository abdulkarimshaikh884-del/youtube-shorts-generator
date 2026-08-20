/* ============================================================
   drafts-store.js — the browser-side project store.

   The account page promised "the editor keeps your current timeline in this
   browser, so you can close the tab and pick it up again". Nothing implemented
   that: the editor held its timeline in memory only, so closing the tab lost
   the work and the Drafts section had nothing it could ever list.

   This is that store. Drafts live in localStorage because a project is only a
   template id, some strings, a colour and a duration per clip — kilobytes, not
   media — and keeping them client-side means an anonymous visitor keeps their
   work without an account. Publishing to the community is still the way to put
   something on the account itself, and that is what /uploads reads.
   ============================================================ */
(function (root) {
  "use strict";

  var KEY = "sc_drafts_v1";
  var MAX = 30;            // newest kept; a browser quota is not a project archive

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      // Corrupt or unavailable storage must not take the editor down with it.
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
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
    if (!draft || !Array.isArray(draft.clips) || !draft.clips.length) return null;
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
    return rec;
  }

  function remove(id) {
    write(read().filter(function (d) { return d.id !== id; }));
  }

  function rename(id, name) {
    var all = read();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i].name = String(name || "").slice(0, 60) || "Untitled animation";
        all[i].updatedAt = Date.now();
        write(all);
        return all[i];
      }
    }
    return null;
  }

  function totalMs(draft) {
    if (!draft || !draft.clips) return 0;
    return draft.clips.reduce(function (s, c) { return s + (Number(c.dur) || 0); }, 0);
  }

  root.SC_DRAFTS = {
    list: list, get: get, save: save, remove: remove, rename: rename,
    newId: newId, totalMs: totalMs, KEY: KEY
  };
})(window);
