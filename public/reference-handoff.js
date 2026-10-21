/* One-use, current-account-scoped Blob handoff. No base64/localStorage quota,
   no video bytes in URLs, no automatic network upload, five-minute expiry. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SC_REFERENCE_HANDOFF = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var MAX_BYTES = 20 * 1024 * 1024, TTL = 5 * 60 * 1000;
  function validToken(token) { return typeof token === 'string' && /^[a-f0-9-]{36}$/.test(token); }
  function validRecord(record, owner, now) {
    return !!record && typeof owner === 'string' && !!owner && record.owner === owner &&
      typeof record.at === 'number' && Number.isFinite(record.at) && now >= record.at && now - record.at <= TTL &&
      record.blob instanceof Blob && record.blob.size > 0 && record.blob.size <= MAX_BYTES &&
      typeof record.name === 'string' && record.name.length <= 250 && /\.(mp4|webm)$/i.test(record.name);
  }
  function open() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') return reject(new Error('Private video handoff is unavailable. Open Reference Motion and choose your file there.'));
      var request = indexedDB.open('shortscraft-reference-handoff', 1);
      request.onupgradeneeded = function () { request.result.createObjectStore('pending'); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(new Error('Could not prepare private video handoff. Choose your file in Reference Motion instead.')); };
      request.onblocked = function () { reject(new Error('Close the other reference upload tab and retry.')); };
    });
  }
  async function put(owner, file) {
    var record = {owner: owner, at: Date.now(), blob: file, name: file && file.name};
    if (!validRecord(record, owner, Date.now())) throw new Error('Choose an MP4/WebM video below 20 MiB while signed in.');
    var token = crypto.randomUUID(), db = await open();
    try { await new Promise(function (resolve, reject) {
      var tx = db.transaction('pending', 'readwrite'), store = tx.objectStore('pending');
      // At most one pending local Blob; replacing it drops the previous handoff,
      // including one left by an account that has since signed out.
      store.clear(); store.put(record, token);
      tx.oncomplete = resolve; tx.onerror = tx.onabort = function () { reject(new Error('Could not retain the selected video locally.')); };
    }); return token; } finally { db.close(); }
  }
  async function take(token, owner) {
    if (!validToken(token) || typeof owner !== 'string' || !owner) return null;
    var db = await open();
    try { return await new Promise(function (resolve, reject) {
      var tx = db.transaction('pending', 'readwrite'), store = tx.objectStore('pending'), request = store.get(token), found = null;
      request.onsuccess = function () { found = request.result; store.clear(); };
      tx.oncomplete = function () { resolve(validRecord(found, owner, Date.now()) ? new File([found.blob], found.name, {type: /\.webm$/i.test(found.name) ? 'video/webm' : 'video/mp4'}) : null); };
      tx.onerror = tx.onabort = function () { reject(new Error('Could not read the selected private video. Choose it again.')); };
    }); } finally { db.close(); }
  }
  return {put: put, take: take, validToken: validToken, validRecord: validRecord, MAX_BYTES: MAX_BYTES, TTL: TTL};
}));
