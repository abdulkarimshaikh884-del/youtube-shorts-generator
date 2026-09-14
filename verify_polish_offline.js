/* Offline regression checks: no dotenv, database, browser or provider calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, 'public', name), 'utf8');
const shell = read('shell.js');
const authui = read('authui.js');
const detail = read('template-detail.js');
const editor = read('editor.js');

// Run the actual gallery mount function against an in-memory DOM/renderer.
let options;
const stage = { querySelector: () => null, appendChild: () => {} };
const props = { line0: 'Creator content', backgroundColor: '#123456', customBackground: true };
const tile = { dataset: { comm: '1', tpl: 'ui-tabs', lines: '["Title"]', font: 'mono', dur: '5200' }, _creatorProps: props };
const mountSource = shell.slice(shell.indexOf('  function mount(tile, force)'), shell.indexOf('  function filterTiles()'));
vm.runInNewContext(mountSource + '\nmount(tile, false);', {
  tile, currentAspect: '16:9', console,
  engine: () => ({ build: (id, opts) => { options = opts; return '<html>preview</html>'; } }),
  $: selector => selector === '.sh-stage' ? stage : null,
  document: { createElement: () => ({ setAttribute() {}, addEventListener() {} }) },
  setTimeout: () => 0
});
assert.equal(options.props, props, 'gallery passes the exact creator props');
assert.equal(options.aspect, '16:9');
assert.equal(options.font, 'mono');
assert.equal(options.dur, 5200);
assert.equal(tile.dataset.mounted, '1');

// Check the wiring from API rows into the actual mount and modal paths.
assert.match(shell, /props: ct\.props \|\| \{\}/);
assert.match(shell, /tile\._creatorProps = t\.props \|\| \{\}/);
assert.match(shell, /e\.build\(t\.tpl, \{ props: t\.props/);
// Profile cards build through one shared card builder: the row's props go
// into the card's render options, and the preview renders those options.
assert.match(authui, /opts: \{ props: t\.props \|\| \{\}/);
assert.match(authui, /e\.build\(spec\.tpl, spec\.opts \|\| \{\}\)/);
assert.match(editor, /&amp;comm=1&amp;commId=/);
assert.match(detail, /if \(!found\) \{ showCommunityProblem\(true\); return; \}/);
assert.match(detail, /if \(commId\) isComm = true/);
assert.doesNotMatch(detail, /name: "Motion Graphics Preset"/);

// Run the real publisher values serializer. The publisher is now the Lottie
// upload dialog: it publishes the stored upload by reference. A stale invalid
// schedule must not stop an immediate or draft publish, and a scheduled one
// must carry a real ISO time.
const activePublisher = authui.slice(authui.indexOf('  function setupUploadModal()'));
const valuesSource = activePublisher.slice(activePublisher.indexOf('    function values()'), activePublisher.indexOf('    function showStep('));
function serialise(visibility, schedule) {
  const fields = { publishName: 'Hook title', publishDescription: '', publishCategory: 'social', publishSchedule: schedule };
  return vm.runInNewContext(valuesSource + '\nvalues();', {
    modal: { querySelector: () => ({ value: visibility }) },
    uploaded: { id: 'lt_offlinefixture00000000', meta: {} },
    $: (selector) => ({ value: fields[selector.slice(1)] }),
    Date
  });
}
const draft = serialise('private', 'invalid');
assert.equal(draft.scheduledAt, null, 'a draft ignores a stale schedule field');
assert.equal(draft.tpl, 'lottie');
assert.equal(draft.props.doc, 'lt_offlinefixture00000000', 'the upload is published by reference');
assert.equal(draft.title, 'Hook title');
const scheduled = serialise('scheduled', '2030-01-02T10:30');
// datetime-local is the device's time zone; the payload is that moment in UTC.
assert.equal(scheduled.scheduledAt, new Date('2030-01-02T10:30').toISOString(), 'a schedule is sent as an ISO time');

// Generated routes must keep one main landmark and the theme bootstrap.
for (const name of ['index','pricing','community','tutorials','contact','about','privacy','terms','account','uploads','drafts','settings','admin','login','signup','forgot-password','reset-password','template','creator','404']) {
  const html = read(name + '.html');
  assert.equal((html.match(/<main\b|role="main"/g) || []).length, 1, name + ': one main landmark');
  assert.match(html, /theme\.js\?v=/, name + ': theme controller');
}
console.log('POLISH_OFFLINE=PASS (gallery renderer, publisher serialization, source wiring, 20 generated routes)');
