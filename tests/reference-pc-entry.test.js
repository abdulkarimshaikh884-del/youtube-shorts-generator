'use strict';
// These are executable UI state/handler contracts, not real model or render
// certification. Browser and live worker QA must be reported separately.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const esbuild = require(require.resolve('esbuild', {paths: [path.join(root, 'remotion')]}));
const editorSource = fs.readFileSync(path.join(root, 'remotion/src/ReferenceEditor.tsx'), 'utf8');
const editorCode = esbuild.transformSync(editorSource.replace(/^import .*;\r?\n/gm, ''), {loader: 'tsx', jsx: 'transform', target: 'es2020'}).code;
const flush = () => new Promise(resolve => setImmediate(resolve));
const pc = online => ({enabled: true, maxDurationSeconds: 5, processingLocation: 'OWNER_PC', workerOnline: online, beta: true});
const sampleFile = {name: 'private-reference.mp4', size: 1024};
const sampleDoc = {scene: {width: 720, height: 1280, fps: 30, durationFrames: 150, background: '#ffffff', layers: [{id: 'card', label: 'Grouped card', assetId: 'card', visible: true, offset: {x: 0, y: 0}, scale: 1, rotation: 0, opacity: 1, zIndex: 1}]}, images: {}, mediaAssets: {}, analysis: {}};

function nodes(tree, predicate) {
  const result = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {node.forEach(walk); return;}
    if (predicate(node)) result.push(node);
    walk(node.props && node.props.children);
  }
  walk(tree); return result;
}
function text(node) {if (Array.isArray(node)) return node.map(text).join(''); if (node && typeof node === 'object') return text(node.props && node.props.children); return node == null || typeof node === 'boolean' ? '' : String(node);}
function editorHarness({online = false, consent = false, doc = null, file = sampleFile, acknowledged = true, request} = {}) {
  const values = [pc(online), {id: 'owner'}, {maxHeight: 480}, doc, doc ? 'card' : '', file, '', '', '', '', false, false, false, acknowledged, '', 480, 0, null, 'local', false, false, consent];
  const refs = [], effects = [], listeners = new Map(), requests = [];
  let stateIndex = 0, refIndex = 0, interval, tree;
  const sandbox = {
    React: {Component: class {}, Fragment: 'fragment', createElement(type, props, ...children) {return {type, props: {...props, children}};}},
    useState(initial) {const i = stateIndex++; if (!(i in values)) values[i] = initial; return [values[i], next => {values[i] = typeof next === 'function' ? next(values[i]) : next;}];},
    useRef(initial) {const i = refIndex++; return refs[i] || (refs[i] = {current: i === 0 ? 'owner' : initial});},
    useEffect(fn) {effects.push(fn);}, createRoot() {return {render(value) {tree = value;}};},
    Player: 'Player', ReferenceMotion: 'ReferenceMotion', validateScene: scene => scene, retimeScene: scene => scene,
    fontForText: () => 'test', vectorColor: () => '#000000', multipartColor: () => '#000000', takeReferenceHandoff: async () => null,
    location: {search: '', pathname: '/reference-motion'}, history: {replaceState() {}},
    document: {visibilityState: 'visible', getElementById() {return {};}, addEventListener(name, fn) {listeners.set(name, fn);}, removeEventListener(name) {listeners.delete(name);}},
    window: {setInterval(fn, delay) {interval = fn; assert.equal(delay, 30000); return 1;}, clearInterval() {}, addEventListener(name, fn) {listeners.set(name, fn);}, removeEventListener(name) {listeners.delete(name);}},
    fetch: async (url, options = {}) => {requests.push({url, options}); return request ? request(url, options) : {ok: true, json: async () => pc(true)};},
    URL: {createObjectURL: () => 'blob:test', revokeObjectURL() {}}, URLSearchParams, AbortController, crypto: {randomUUID: () => 'uuid'},
    FileReader: class {readAsDataURL() {this.result = 'data:video/mp4;base64,AAAA'; queueMicrotask(() => this.onload());}},
    setTimeout, clearTimeout
  };
  vm.createContext(sandbox); vm.runInContext(editorCode + '\nglobalThis.__renderApp = App;', sandbox);
  function render() {stateIndex = 0; refIndex = 0; tree = sandbox.__renderApp(); return tree;}
  return {values, refs, effects, listeners, requests, sandbox, render, interval: () => interval, button(label) {const found = nodes(render(), node => node.type === 'button' && text(node).includes(label)); assert.ok(found.length, label); return found[0];}};
}

test('offline PC blocks Analyze/export but keeps file, preview, editing and Save available', () => {
  const h = editorHarness({doc: sampleDoc}); const tree = h.render();
  assert.equal(h.button('Analyze reference').props.disabled, true);
  assert.equal(h.button('Export reviewed MP4').props.disabled, true);
  assert.equal(h.button('Save project now').props.disabled, false);
  const fieldsets = nodes(tree, node => node.type === 'fieldset');
  assert.equal(fieldsets[0].props.disabled, false, 'choose file remains available');
  assert.equal(fieldsets[1].props.disabled, false, 'existing layer editing remains available');
  assert.equal(fieldsets[2].props.disabled, false, 'saved project controls are not disabled together with export');
  assert.equal(h.values[5], sampleFile);
  assert.equal(nodes(tree, node => node.type === 'Player').length, 1);
  assert.match(text(tree), /operator.*PC/i);
  assert.match(text(tree), /no audio reconstruction/i);
});

test('online PC still requires deliberate per-file processing consent', async () => {
  const h = editorHarness({online: true});
  assert.equal(h.button('Analyze reference').props.disabled, true);
  await h.button('Analyze reference').props.onClick();
  assert.match(h.values[9], /allow private processing/i); assert.equal(h.requests.length, 0);
  const checkbox = nodes(h.render(), node => node.type === 'input' && node.props['aria-label'] === 'Allow private processing on the ShortsCraft operator PC')[0];
  checkbox.props.onChange({target: {checked: true}});
  assert.equal(h.button('Analyze reference').props.disabled, false);
});

test('analyze worker-offline response preserves the selected file and existing project', async () => {
  const h = editorHarness({online: true, consent: true, doc: sampleDoc, request: async url => url === '/api/auth/me' ? {ok: true, json: async () => ({user: {id: 'owner'}})} : {ok: false, json: async () => ({success: false, code: 'REFERENCE_WORKER_OFFLINE', error: 'offline'})}});
  await h.button('Analyze reference').props.onClick();
  assert.equal(h.values[0].workerOnline, false); assert.equal(h.values[5], sampleFile); assert.equal(h.values[3], sampleDoc);
  assert.match(h.values[9], /selected video is kept/i); assert.equal(h.values[7], '');
  const request = h.requests.find(item => item.url.endsWith('/analyze'));
  assert.equal(JSON.parse(request.options.body).ownerPcConsent, true);
  assert.equal(h.button('Export reviewed MP4').props.disabled, true);
});

test('export worker-offline response does not erase saved project or report success', async () => {
  const h = editorHarness({online: true, consent: true, doc: sampleDoc, request: async url => url === '/api/auth/me' ? {ok: true, json: async () => ({user: {id: 'owner'}})} : {ok: false, json: async () => ({success: false, code: 'REFERENCE_WORKER_OFFLINE', error: 'offline'})}});
  await h.button('Export reviewed MP4').props.onClick();
  assert.equal(h.values[0].workerOnline, false); assert.equal(h.values[3], sampleDoc); assert.equal(h.values[14], '');
  assert.match(h.values[8], /export not completed/); assert.equal(h.button('Save project now').props.disabled, false);
});

test('new local file resets operator-PC consent; focus and visible heartbeat refresh worker status', async () => {
  const h = editorHarness({online: false, consent: true});
  const fileInput = nodes(h.render(), node => node.type === 'input' && node.props['aria-label'] === 'Reference video')[0];
  await fileInput.props.onChange({target: {files: [{name: 'another.webm', size: 42}]}});
  assert.equal(h.values[21], false); assert.equal(h.values[5].name, 'another.webm');
  const cleanup = h.effects[2]();
  assert.equal(typeof h.listeners.get('focus'), 'function');
  h.sandbox.document.visibilityState = 'hidden'; await h.interval()(); assert.equal(h.requests.length, 0);
  h.sandbox.document.visibilityState = 'visible'; await h.listeners.get('focus')();
  assert.equal(h.values[0].workerOnline, true); assert.equal(h.values[5].name, 'another.webm');
  cleanup(); assert.equal(h.listeners.has('focus'), false); assert.equal(h.listeners.has('visibilitychange'), false);
});

function composerHarness(status = pc(false)) {
  const source = fs.readFileSync(path.join(root, 'public/shell.js'), 'utf8');
  const start = source.indexOf('  function wireComposer() {'), end = source.indexOf('  /* ── Library sort', start);
  const elements = new Map(), created = [], calls = [], toasts = [];
  function element(name) {return {name, style: {}, hidden: false, innerHTML: 'Create animation', value: '', files: [], maxLength: 500, scrollHeight: 80, listeners: {}, classList: {toggle() {}}, addEventListener(event, fn) {this.listeners[event] = fn;}, setAttribute() {}, appendChild(child) {created.push(child);}, closest() {return null;}, focus() {}, insertAdjacentElement(position, child) {created.push(child);}};}
  for (const id of ['composer', 'composerPrompt', 'composerGo', 'composerImg', 'composerImgClear', 'composerImgName']) elements.set('#' + id, element(id));
  const label = element('imageLabel'); elements.get('#composer').querySelector = selector => selector === 'label[for="composerImg"]' ? label : null;
  const sandbox = {
    $: selector => elements.get(selector) || null,
    document: {createElement(tag) {const result = element(tag); created.push(result); return result;}},
    window: {SC_REFERENCE_HANDOFF: {MAX_BYTES: 20 * 1024 * 1024, async put(owner, file) {calls.push({kind: 'handoff', owner, file}); return 'local-token';}}, location: {href: ''}},
    fetch: async (url, options) => {calls.push({kind: 'fetch', url, options}); return {ok: true, json: async () => url.endsWith('/status') ? {...status, reconstruction: 'SUPPORTED_PLANAR_CARDS_ONLY'} : {user: {id: 'owner'}}};},
    SC_UI: {toast: message => toasts.push(message)}, localStorage: {setItem() {}}, sessionStorage: {setItem() {}, removeItem() {}},
    encodeURIComponent, Event
  };
  vm.createContext(sandbox); vm.runInContext(source.slice(start, end) + '\nwireComposer();', sandbox);
  return {sandbox, elements, created, calls, toasts};
}

test('home attachment uses local account-bound handoff, never uploads or routes video into legacy generator', async () => {
  const h = composerHarness(); await flush();
  const input = h.created.find(node => node.id === 'composerReferenceVideo'); assert.ok(input);
  input.files = [sampleFile]; input.listeners.change();
  assert.equal(h.elements.get('#composerPrompt').readOnly, true);
  assert.match(h.created.find(node => node.className === 'sh-reference-hint').textContent, /PC is offline/);
  h.elements.get('#composer').listeners.submit({preventDefault() {}}); await flush();
  assert.equal(h.sandbox.window.location.href, '/reference-motion?handoff=local-token');
  const handoff = h.calls.find(call => call.kind === 'handoff'); assert.equal(handoff.owner, 'owner'); assert.equal(handoff.file, sampleFile);
  assert.deepEqual(h.calls.filter(call => call.kind === 'fetch').map(call => call.url), ['/api/reference-motion/status', '/api/auth/me']);
});

test('feature-disabled homepage preserves existing prompt/image entry without showing reference upload', async () => {
  const h = composerHarness({enabled: false}); await flush();
  assert.equal(h.created.some(node => node.id === 'composerReferenceVideo'), false);
  h.elements.get('#composerPrompt').value = 'A line chart';
  h.elements.get('#composer').listeners.submit({preventDefault() {}});
  assert.equal(h.sandbox.window.location.href, '/editor?topic=A%20line%20chart&mode=ai');
});

test('reference project cards and stale legacy links open dedicated editor without rewriting clips', () => {
  const drafts = fs.readFileSync(path.join(root, 'public/drafts-page.js'), 'utf8');
  const legacy = fs.readFileSync(path.join(root, 'public/editor.js'), 'utf8');
  assert.match(drafts, /referenceProject \? "\/reference-motion\?draft=" : "\/editor\?draft="/);
  const guard = legacy.slice(legacy.indexOf('if (restored && Array.isArray(restored.clips) && restored.clips.some'), legacy.indexOf('if (restored && Array.isArray(restored.clips) && restored.clips.length)'));
  const saved = {id: 'private draft', clips: [{tpl: 'reference-motion', spec: {keep: true}}]};
  const snapshot = JSON.stringify(saved); let destination = '';
  vm.runInNewContext('(function () {' + guard + '})();', {restored: saved, sourceUnavailable: false, location: {replace(value) {destination = value;}}, encodeURIComponent, status() {}});
  assert.equal(destination, '/reference-motion?draft=private%20draft'); assert.equal(JSON.stringify(saved), snapshot);
});
