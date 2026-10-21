'use strict';

// This file never loads the site's .env. A PC worker has no database/provider
// credentials and its one broker token is encrypted for the signed-in Windows
// user with DPAPI. Neither command-line arguments nor logs contain that token.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');

const LIVE_ORIGINS = new Set(['https://shortscraft.online', 'https://www.shortscraft.online',
  'https://youtube-shorts-generator-yngg.onrender.com']);
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
function fields(value, allowed) {return plain(value) && Object.keys(value).every(key => allowed.includes(key));}
function validateBaseUrl(value, {allowLoopback = false} = {}) {
  let url;
  try {url = new URL(value);} catch {throw Error('Invalid broker origin.');}
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(LIVE_ORIGINS.has(url.origin) || (allowLoopback && loopback && url.protocol === 'http:'))) {
    throw Error('Only the fixed ShortsCraft HTTPS broker origins are allowed.');
  }
  return url.origin;
}
function validateSetup(value, options) {
  if (!fields(value, ['baseUrl', 'token', 'pythonPath', 'ffmpegPath', 'ffprobePath']) ||
      typeof value.token !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(value.token)) throw Error('Invalid private PC worker setup.');
  for (const key of ['pythonPath', 'ffmpegPath', 'ffprobePath']) {
    const item = value[key];
    if (key !== 'pythonPath' && item === undefined) continue;
    if (typeof item !== 'string' || !path.isAbsolute(item) || /[\u0000-\u001f]/.test(item)) throw Error('Worker executable paths must be absolute local paths.');
  }
  return {...value, baseUrl: validateBaseUrl(value.baseUrl, options)};
}
function configDirectory(env = process.env) {
  if (!env.LOCALAPPDATA || !path.isAbsolute(env.LOCALAPPDATA)) throw Error('Windows LOCALAPPDATA is unavailable.');
  return path.join(env.LOCALAPPDATA, 'ShortsCraft', 'reference-pc-worker');
}
function childEnvironment(env = process.env) {
  const allowed = new Set(['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','LOCALAPPDATA','USERPROFILE','HOME',
    'PUPPETEER_CACHE_DIR','PUPPETEER_EXECUTABLE_PATH','APPDATA','PROGRAMFILES','PROGRAMFILES(X86)']);
  return Object.fromEntries(Object.entries(env).filter(([key]) => allowed.has(key.toUpperCase())));
}
function powershell(script, input, {run = spawn, timeoutMs = 15000} = {}) {
  return new Promise((resolve, reject) => {
    let child, chunks = [], total = 0, settled = false;
    const finish = (error, value) => {if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value);};
    const timer = setTimeout(() => {child?.kill(); finish(Error('Windows credential operation timed out.'));}, timeoutMs);
    try {child = run('powershell.exe', ['-NoProfile','-NonInteractive','-Command', script],
      {shell: false, windowsHide: true, stdio: ['pipe','pipe','pipe'], env: childEnvironment()});}
    catch {finish(Error('Windows credential operation is unavailable.')); return;}
    child.stdout.on('data', chunk => {total += chunk.length; if (total > 16384) {child.kill(); finish(Error('Credential response exceeded its limit.'));} else chunks.push(chunk);});
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.once('error', () => finish(Error('Windows credential operation is unavailable.')));
    child.once('close', code => code === 0 ? finish(null, Buffer.concat(chunks).toString('utf8').trim()) : finish(Error('Windows credential operation failed.')));
    child.stdin.end(input);
  });
}
const ENCRYPT_SCRIPT = "$ErrorActionPreference='Stop'; $v=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString -String $v -AsPlainText -Force; [Console]::Out.Write((ConvertFrom-SecureString -SecureString $s))";
const DECRYPT_SCRIPT = "$ErrorActionPreference='Stop'; $v=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString -String $v; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}";
async function windowsReparseCheck(paths) {
  // lstat rejects junctions/symlinks, but not every Windows reparse tag is
  // represented as a symbolic link by Node. Check native attributes as well.
  const script = "$ErrorActionPreference='Stop'; $v=ConvertFrom-Json ([Console]::In.ReadToEnd()); foreach($p in $v){if(([int][IO.File]::GetAttributes([string]$p) -band 1024) -ne 0){throw 'Reparse point refused'}}; [Console]::Out.Write('safe')";
  if (await powershell(script, JSON.stringify(paths)) !== 'safe') throw Error('Reparse-point worker configuration directory refused.');
}
async function safeDirectory(directory, {create = true, filesystem = fs, platform = process.platform,
  nativeReparseCheck = windowsReparseCheck} = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || /[\u0000-\u001f]/.test(directory)) throw Error('Invalid private worker configuration directory.');
  const resolved = path.resolve(directory), checked = new Set();
  async function checkAncestry(start, allowMissing) {
    let current = start;
    for (let count = 0; ; count++) {
      if (count > 64) throw Error('Worker configuration ancestry is too deep.');
      try {
        const stat = await filesystem.lstat(current);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Aliased worker configuration directory refused.');
        checked.add(current);
      } catch (error) {if (!(allowMissing && error.code === 'ENOENT')) throw error;}
      const parent = path.dirname(current); if (parent === current) break; current = parent;
    }
  }
  // Reject a linked ancestor *before* creating anything through it.
  await checkAncestry(resolved, create);
  if (platform === 'win32') await nativeReparseCheck([...checked]);
  if (create) await filesystem.mkdir(resolved, {recursive: true, mode: 0o700});
  const canonical = path.resolve(await filesystem.realpath(resolved));
  await checkAncestry(resolved, false);
  await checkAncestry(canonical, false);
  if (platform === 'win32') await nativeReparseCheck([...checked]);
  const sameName = platform === 'win32' ? canonical.toLowerCase() === resolved.toLowerCase() : canonical === resolved;
  if (!sameName) {
    // MSIX can redirect LocalAppData writes into the signed-in app's
    // LocalCache without creating a reparse point. 8.3 names can differ too.
    // Accept a canonical spelling only when both names open the SAME real
    // directory (nonzero Windows volume/file IDs), never merely a prefix.
    const [originalStat, canonicalStat] = await Promise.all([
      filesystem.stat(resolved, {bigint: true}), filesystem.stat(canonical, {bigint: true})]);
    if (platform !== 'win32' || originalStat.dev !== canonicalStat.dev || originalStat.ino !== canonicalStat.ino ||
        originalStat.ino === 0n || canonicalStat.ino === 0n) throw Error('Aliased worker configuration directory refused.');
  }
  return canonical;
}
async function saveConfig(setup, {directory = configDirectory(), allowLoopback = false, encrypt = value => powershell(ENCRYPT_SCRIPT, value), platform = process.platform} = {}) {
  if (platform !== 'win32') throw Error('This private beta configuration uses Windows DPAPI only.');
  const value = validateSetup(setup, {allowLoopback});
  for (const key of ['pythonPath','ffmpegPath','ffprobePath']) if (value[key] && !(await fs.stat(value[key])).isFile()) throw Error('Worker executable is not a file.');
  await safeDirectory(directory);
  const encryptedToken = await encrypt(value.token);
  if (!/^[A-Za-z0-9+/=]+$/.test(encryptedToken) || encryptedToken.length < 64 || encryptedToken.length > 8192 || encryptedToken.includes(value.token)) throw Error('Invalid Windows encrypted credential.');
  const stored = {kind: 'shortscraft-reference-pc-worker-v1', workerId: crypto.randomUUID(), baseUrl: value.baseUrl,
    pythonPath: value.pythonPath, ffmpegPath: value.ffmpegPath, ffprobePath: value.ffprobePath, encryptedToken};
  const filename = path.join(directory, 'config.json');
  // Never overwrite a running beta's credential in-place.
  await fs.writeFile(filename, JSON.stringify(stored, null, 2), {flag: 'wx', mode: 0o600});
  return {filename, workerId: stored.workerId, baseUrl: stored.baseUrl};
}
async function loadConfig({directory = configDirectory(), allowLoopback = false, decrypt = value => powershell(DECRYPT_SCRIPT, value), platform = process.platform} = {}) {
  if (platform !== 'win32') throw Error('This beta worker uses Windows DPAPI only.');
  await safeDirectory(directory, {create: false});
  const filename = path.join(directory, 'config.json'), stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw Error('Unsafe private worker configuration.');
  const value = JSON.parse(await fs.readFile(filename, 'utf8'));
  if (!fields(value, ['kind','workerId','baseUrl','pythonPath','ffmpegPath','ffprobePath','encryptedToken']) ||
      value.kind !== 'shortscraft-reference-pc-worker-v1' || !/^[a-f0-9-]{36}$/.test(value.workerId) ||
      typeof value.encryptedToken !== 'string' || value.encryptedToken.length > 8192) throw Error('Invalid private worker configuration.');
  const token = await decrypt(value.encryptedToken);
  const setup = validateSetup({baseUrl: value.baseUrl, token, pythonPath: value.pythonPath,
    ...(value.ffmpegPath ? {ffmpegPath: value.ffmpegPath} : {}), ...(value.ffprobePath ? {ffprobePath: value.ffprobePath} : {})}, {allowLoopback});
  return {...setup, workerId: value.workerId, directory};
}
async function readPrivateStdin(stream = process.stdin) {
  let text = '';
  for await (const chunk of stream) {text += chunk; if (Buffer.byteLength(text) > 16384) throw Error('Private setup exceeded its limit.');}
  return JSON.parse(text);
}
if (require.main === module) {
  (async () => {
    if (process.argv[2] !== 'init-stdin' || process.argv.slice(3).some(value => value !== '--dev-loopback')) throw Error('Use init-stdin with private JSON on stdin, never a token argument.');
    const result = await saveConfig(await readPrivateStdin(), {allowLoopback: process.argv.includes('--dev-loopback')});
    process.stdout.write(JSON.stringify({success: true, workerId: result.workerId, baseUrl: result.baseUrl}) + '\n');
  })().catch(() => {process.stderr.write('Private PC worker setup failed. No credential was printed.\n'); process.exitCode = 1;});
}
module.exports = {LIVE_ORIGINS, fields, validateBaseUrl, validateSetup, configDirectory, childEnvironment,
  powershell, saveConfig, loadConfig, readPrivateStdin, safeDirectory, windowsReparseCheck};
