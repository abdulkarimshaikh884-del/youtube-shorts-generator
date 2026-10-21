'use strict';

const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const {validateScene,assetIds} = require('./schema');
const base = path.resolve(__dirname, '../remotion');
const dep = name => require(require.resolve(name, {paths: [base]}));
let bundle;

// Only the checked-in component is bundled. All customer content is validated
// data and authenticated raster assets, never source code or a remote URL.
async function renderReferenceCore({scene: raw, images}, {output, height = 480, watermark = true, stills = [], stillsOnly = false, signal} = {}) {
  const scene = validateScene(raw), started = performance.now();
  if (!output || ![480, 720, 1080, 1440].includes(height)) throw Error('Invalid controlled reference render options');
  if (!Array.isArray(stills) || stills.length > 12 || stills.some(n => !Number.isInteger(n) || n < 0 || n >= scene.durationFrames)) throw Error('Invalid evidence frames');
  const ids = assetIds(scene);
  if (!images || Object.keys(images).length !== ids.length) throw Error('Missing private image planes');
  for (const id of ids) {
    const value = images[id];
    if (typeof value !== 'string' || value.length > 5500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('Unsafe private plane');
    const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
    if (bytes.length > 4000000) throw Error('Private plane exceeds its render limit');
    const meta = await require('sharp')(bytes, {limitInputPixels: 16000000}).metadata();
    if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages || 1) > 1) throw Error('Unsupported private plane');
  }
  let browser, timer;
  const renderer = dep('@remotion/renderer'), {cancel, cancelSignal} = renderer.makeCancelSignal();
  const abort = () => cancel();
  signal?.addEventListener('abort', abort, {once: true});
  try {
    if (signal?.aborted) throw Error('Reference export cancelled');
    if (!bundle) bundle = dep('@remotion/bundler').bundle({entryPoint: path.join(base, 'src/ReferenceRoot.tsx'), publicDir: path.join(__dirname, 'empty-public')}).catch(error => {bundle = null; throw error;});
    const serveUrl = await bundle;
    browser = await renderer.openBrowser('chrome', {browserExecutable: await require('puppeteer').executablePath()});
    timer = setTimeout(cancel, 180000);
    const fontData = scene.layers.some(layer => layer.text?.font==='noto-sans') ? 'data:font/ttf;base64,' + (await fs.readFile(path.resolve(__dirname, '../flagship/assets/NotoSansDevanagari.ttf'))).toString('base64') : undefined;
    const serifFontData = scene.layers.some(layer => layer.text?.font==='latin-modern-roman') ? 'data:font/otf;base64,' + (await fs.readFile(path.resolve(__dirname, 'fonts/LMRoman10-Regular.otf'))).toString('base64') : undefined;
    const inputProps = {scene, images, watermark: watermark === true, fontData, serifFontData};
    const selected = await renderer.selectComposition({serveUrl, id: 'ReferenceMotion', inputProps, puppeteerInstance: browser});
    const short = Math.min(scene.width, scene.height), even = n => Math.max(2, Math.round(n / 2) * 2);
    const composition = {...selected, width: even(scene.width / short * height), height: even(scene.height / short * height)};
    const options = {serveUrl, composition, inputProps, puppeteerInstance: browser, cancelSignal, logLevel: 'error'};
    await fs.mkdir(path.dirname(output), {recursive: true});
    for (const frame of stills) await renderer.renderStill({...options, frame, imageFormat: 'png', output: path.join(path.dirname(output), `frame-${frame}.png`)});
    if (!stillsOnly) await renderer.renderMedia({...options, codec: 'h264', muted: true, pixelFormat: 'yuv420p', crf: 18, concurrency: 1, outputLocation: output});
    return {width: composition.width, height: composition.height, frames: scene.durationFrames, fps: scene.fps, audioRetained: false, renderMs: performance.now() - started};
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    if (browser) await browser.close({silent: true}).catch(() => {});
  }
}

async function renderReference({scene, images}, options) {
  // Hydrated projects also contain private storage references and analysis.
  // Preserve the existing public API's projection: only the controlled scene
  // and resolved raster bytes cross the strict child-worker boundary.
  return require('./render-process').renderInWorker({scene, images}, options);
}

async function exportReference(document, options) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-reference-export-'));
  try {
    const output = path.join(directory, 'video.mp4'), metrics = await renderReference(document, {...options, output});
    const buffer = await fs.readFile(output);
    if (buffer.length < 1024 || buffer.toString('ascii', 4, 8) !== 'ftyp') throw Error('No valid reference MP4 was rendered');
    return {buffer, metrics};
  } finally {
    if (path.dirname(directory) === path.resolve(os.tmpdir()) && /^sc-reference-export-[A-Za-z0-9]+$/.test(path.basename(directory))) await fs.rm(directory, {recursive: true, force: true});
  }
}
module.exports = {renderReference, exportReference, renderReferenceCore};
