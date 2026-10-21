'use strict';
const fs = require('node:fs'), path = require('node:path');
const base = path.resolve(__dirname, '../remotion');
fs.mkdirSync(path.resolve(__dirname, '../data'), {recursive: true});
require(require.resolve('esbuild', {paths: [base]})).build({entryPoints: [path.join(base, 'src/ReferenceEditor.tsx')], bundle: true, platform: 'browser', format: 'iife', minify: true, define: {'process.env.NODE_ENV': '"production"'}, outfile: path.resolve(__dirname, '../data/reference-motion-editor.js')}).then(() => {
  // Release artifact is built and reviewed locally. The 512 MB public service
  // serves this bundle; it never installs or invokes the PC's render runtime.
  fs.copyFileSync(path.resolve(__dirname, '../data/reference-motion-editor.js'), path.join(__dirname, 'editor.bundle.js'));
}).catch((error) => {console.error(error.message); process.exitCode = 1;});
