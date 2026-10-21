'use strict';
// Real public routes -> authenticated outbound PC -> actual CV/Remotion ->
// private SQL save/reload -> actual MP4. Never production data or providers.
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const path = require('node:path'), crypto = require('node:crypto');
const {spawn, execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:3382';
const allowed = new Set(['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE','HOME','PROGRAMFILES','PROGRAMW6432','LANG','LC_ALL','PUPPETEER_EXECUTABLE_PATH','SC_QA_PORTABLE_PG']);
const operatingEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toUpperCase())));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  require('./helpers/isolated-postgres').assertIsolatedPostgres();
  const source = path.resolve(process.argv[2] || '');
  assert(path.isAbsolute(source) && /\.mp4$/i.test(source));
  const output = path.join(root, 'audit_results/reference-motion/pc-beta-' + Date.now());
  await fs.mkdir(output, {recursive: true});
  const token = crypto.randomBytes(32).toString('base64url');
  const report = {scope: 'Actual isolated HTTP broker and outbound PC worker, fresh source analysis, actual SQL and MP4; no mocked CV/model/render', output, checks: [], serverPeakRssBytes: 0};
  const server = spawn(process.execPath, ['--require', path.join(__dirname, 'reference-pc-test-server-preload.js'), 'server.js'], {
    cwd: root, windowsHide: true, stdio: ['ignore','pipe','pipe'], env: {...operatingEnv,
      DATABASE_URL: 'postgresql://shortscraft_app:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa?sslmode=disable',
      PORT: '3382', BASE_URL: base, PUBLIC_SITE_URL: base, ALLOWED_ORIGINS: base, NODE_ENV: 'development',
      SC_ISOLATED_POSTGRES_QA: 'true', DISABLE_RATE_LIMIT: 'true', SC_REFERENCE_MOTION: 'true', SC_REFERENCE_PROCESSOR: 'pc', SC_REFERENCE_PC_TOKEN: token,
      SC_REFERENCE_GEMINI: 'false', REFERRALS_ENABLED: 'false', CREDITS_SECRET: 'local-reference-pc-proof-only-not-production'}});
  let lines = '', errors = '', worker, workerLog = '';
  server.stdout.on('data', chunk => {lines += chunk; let index; while ((index = lines.indexOf('\n')) >= 0) {const line = lines.slice(0,index); lines = lines.slice(index+1); if (line.startsWith('{"qaMemory"')) {try {report.serverPeakRssBytes = Math.max(report.serverPeakRssBytes, JSON.parse(line).rss);} catch {}}}});
  server.stderr.on('data', chunk => {errors = (errors + chunk).slice(-10000);});
  const cookie = new Map(), otherCookie = new Map();
  async function request(url, body, method = body === undefined ? 'GET' : 'POST', headers = {}, jar = cookie) {
    const response = await fetch(base + url, {method, headers: {Origin: base, 'Content-Type': 'application/json', Cookie: [...jar].map(([key,value])=>key+'='+value).join('; '), ...headers},
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(260000)});
    for (const item of response.headers.getSetCookie()) {const first = item.split(';')[0], at = first.indexOf('='); jar.set(first.slice(0,at), first.slice(at+1));}
    const bytes = Buffer.from(await response.arrayBuffer()); return {status: response.status, headers: response.headers, bytes, json: () => JSON.parse(bytes.toString())};
  }
  function pass(name, details = {}) {report.checks.push({name, status: 'PASS', ...details}); console.log('PASS ' + name);}
  async function balance() {const out = await request('/api/credits'); assert.equal(out.status,200); return out.json().left;}
  async function account(jar, role) {
    const email = 'refqa_pc_' + role + '_' + crypto.randomBytes(6).toString('hex') + '@example.invalid';
    const password = crypto.randomBytes(20).toString('base64url');
    let out = await request('/api/auth/signup', {email, password, handle: 'pc' + crypto.randomBytes(7).toString('hex')}, 'POST', {}, jar);
    assert.equal(out.status,200,out.bytes.toString().slice(0,200));
    out = await request('/api/auth/login', {email,password}, 'POST', {}, jar); assert.equal(out.status,200);
    return {email,password};
  }
  try {
    let ready = false;
    for (let index = 0; index < 50; index++) {try {const out = await request('/api/health'); if (out.status === 200) {ready = true; break;}} catch {} await pause(250);}
    assert(ready, 'Isolated release server did not become ready: ' + errors.slice(-500));
    const owner = await account(cookie,'owner'); await account(otherCookie,'other');
    let out = await request('/api/reference-motion/status'); assert.equal(out.status,200); assert.equal(out.json().workerOnline,false);
    const video = await fs.readFile(source), input = {video: 'data:video/mp4;base64,'+video.toString('base64'), trimToSeconds: 5, ownerPcConsent: true};
    out = await request('/api/reference-motion/analyze', input); assert.equal(out.status,503); assert.equal(out.json().code,'REFERENCE_WORKER_OFFLINE');
    pass('Offline worker fails closed without a charge or file handoff');
    worker = spawn(process.execPath, [path.join(__dirname,'reference-pc-test-worker.js')], {cwd: root, windowsHide: true, stdio: ['pipe','pipe','pipe'], env: {...operatingEnv, SC_ISOLATED_WORKER_QA: 'true'}});
    for (const pipe of [worker.stdout, worker.stderr]) pipe.on('data', chunk => {workerLog = (workerLog + chunk).slice(-16000);});
    worker.stdin.end(JSON.stringify({baseUrl: base, token, workerId: crypto.randomUUID(), pythonPath: path.resolve(process.env.DESIGN_PIPELINE_PYTHON || path.join('C:/Users/karim/kiroai/shortscraft/data/engine-venv/Scripts/python.exe'))}));
    let online = false;
    for (let index = 0; index < 60; index++) {out = await request('/api/reference-motion/status'); if (out.json().workerOnline === true) {online = true; break;} await pause(500);}
    assert(online,'Actual PC doctor/worker did not become available: '+workerLog);
    const before = await balance();
    out = await request('/api/reference-motion/analyze', {...input, ownerPcConsent: false}); assert.equal(out.status,422); assert.equal(await balance(),before);
    pass('PC privacy consent enforced by server, not just UI');
    const started = Date.now(); out = await request('/api/reference-motion/analyze',input);
    const analysis = out.json(); await fs.writeFile(path.join(output,'actual-api-analysis.json'),JSON.stringify(analysis,null,2));
    assert.equal(out.status,200,JSON.stringify(analysis).slice(0,800));
    assert.equal(analysis.scene.version,2); assert.equal(analysis.scene.durationFrames,150);
    assert.equal(analysis.analysis.quality.visualComparison,'PASS'); assert.equal(analysis.analysis.quality.failedFrameCount,0);
    assert.equal(analysis.admission.processingLocation,'OWNER_PC'); assert.equal(analysis.admission.cloudVideoSent,false);
    assert.equal(analysis.state,'REVIEW_REQUIRED'); assert.equal(analysis.exactRecreationGuaranteed,false); assert.equal(await balance(),before);
    pass('Fresh real 5s sample passes all-frame CV gate through actual outbound worker',{elapsedSeconds:(Date.now()-started)/1000,quality:analysis.analysis.quality});
    const projectId = 'pcqa_' + crypto.randomBytes(12).toString('hex');
    const document = {name: 'PC beta real reference',aspect:'9:16',clips:[{tpl:'reference-motion',dur:5000,spec:analysis.scene,props:{mediaAssets:analysis.mediaAssets,analysis:analysis.analysis}}]};
    out = await request('/api/projects/'+projectId,document,'PUT'); assert.equal(out.status,200,out.bytes.toString().slice(0,700));
    out = await request('/api/reference-motion/projects/'+projectId); assert.equal(out.status,200); assert.deepEqual(out.json().scene,analysis.scene);
    const changed = structuredClone(document), layer = changed.clips[0].spec.layers.find(item=>item.id==='plane-3'); assert(layer); layer.offset.x=200; layer.rotation=5;
    out = await request('/api/projects/'+projectId,changed,'PUT'); assert.equal(out.status,200);
    out = await request('/api/reference-motion/projects/'+projectId); assert.deepEqual(out.json().scene,changed.clips[0].spec);
    pass('Actual owner-private SQL preserves measured layers and move/rotation edits on reload');
    out = await request('/api/reference-motion/projects/'+projectId,undefined,'GET',{},otherCookie); assert.equal(out.status,404);
    out = await request('/api/projects/'+projectId,document,'PUT',{},otherCookie); assert.equal(out.status,403);
    const firstRef=Object.values(analysis.mediaAssets)[0];
    out = await request('/api/design-assets/'+firstRef.jobId+'/'+firstRef.assetPath,undefined,'GET',{},otherCookie); assert.notEqual(out.status,200);
    out = await request('/api/reference-motion/projects/'+projectId,undefined,'GET',{},new Map()); assert.equal(out.status,401);
    pass('Other account and guest cannot open project, save its assets, or read private raster bytes');
    await request('/api/projects/'+projectId,document,'PUT');
    const exportBody={scene:analysis.scene,mediaAssets:analysis.mediaAssets,height:480,reviewAcknowledged:true};
    out=await request('/api/reference-motion/export',{...exportBody,reviewAcknowledged:false}); assert.equal(out.status,422); assert.equal(await balance(),before);
    const exportedAt=Date.now();
    out=await request('/api/reference-motion/export',exportBody,'POST',{'Idempotency-Key':'pcqa-'+crypto.randomUUID()});
    assert.equal(out.status,200,out.bytes.toString().slice(0,300)); assert.match(out.headers.get('content-type'),/video\/mp4/);
    const movie=path.join(output,'actual-pc-export.mp4'); await fs.writeFile(movie,out.bytes);
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',movie],{encoding:'utf8',windowsHide:true}));
    const stream=probe.streams.find(item=>item.codec_type==='video'); assert.equal(stream.codec_name,'h264'); assert.equal(Number(stream.nb_frames),150); assert.equal(Number(stream.duration),5);
    assert.equal(await balance(),before-1); assert.equal(probe.streams.filter(item=>item.codec_type==='audio').length,0);
    pass('Actual worker MP4 is H264 / 150frames / 5s, no audio; one credit charged only after completion',{elapsedSeconds:(Date.now()-exportedAt)/1000,width:stream.width,height:stream.height});
    await fs.writeFile(path.join(output,'browser-fixture.json'),JSON.stringify({...owner,projectId,editorUrl:base+'/reference-motion?draft='+projectId},null,2));
    // Maximum allowed transport, deliberately invalid MP4: real worker ffprobe
    // rejects it. This is a memory/admission probe, not model/render evidence.
    const padding=Buffer.alloc(20*1024*1024); padding.writeUInt32BE(24,0); padding.write('ftyp',4); padding.write('isom',8);
    out=await request('/api/reference-motion/analyze',{video:'data:video/mp4;base64,'+padding.toString('base64'),ownerPcConsent:true});
    assert.notEqual(out.status,200); assert.equal(await balance(),before-1);
    await pause(1000);
    pass('Real 20MiB transport rejected by actual media probe without billing',{status:out.status,serverPeakRssMiB:Math.ceil(report.serverPeakRssBytes/1024**2)});
    assert(report.serverPeakRssBytes < 480*1024**2,'Dispatcher exceeded safe free-server process RSS envelope');
    report.status='PASS'; report.state='REVIEW_REQUIRED';
  } catch(error) {report.status='FAIL'; report.error=error.message; report.workerEvents=workerLog.split('\n').filter(line=>line.includes('"event"')).slice(-15); throw error;}
  finally {
    // Retain process only when explicitly needed for bounded browser inspection.
    if (process.env.SC_KEEP_REFERENCE_PC_QA === 'true' && report.status==='PASS') {
      report.ownedProcesses={serverPid:server.pid,workerPid:worker?.pid};
      process.stdin.resume();
      process.stdin.on('data', chunk => {
        if (chunk.toString().trim() === 'stop') {worker?.kill(); server.kill(); process.stdin.pause();}
      });
    } else {worker?.kill(); server.kill();}
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({status:report.status,output,serverPeakRssMiB:Math.ceil(report.serverPeakRssBytes/1024**2),checks:report.checks.length,error:report.error}));
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
