import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, PlayerRef} from '@remotion/player';
import {ReferenceMotion} from './ReferenceMotion';
import {ReferenceLayer, ReferenceScene, retimeScene, validateScene, vectorColor, multipartColor} from '../../reference-motion/schema';
import {take as takeReferenceHandoff} from '../../public/reference-handoff';
import {fontForText} from '../../reference-motion/font-coverage';

type AssetRef = {jobId: string; assetPath: string};
type Doc = {scene: ReferenceScene; images: Record<string, string>; mediaAssets: Record<string, AssetRef>; analysis: Record<string, any>};
type User = {id: string};
type ServiceStatus = {enabled: boolean; maxDurationSeconds: number; plan?: string; scope?: string; geminiAvailable?: boolean; geminiModel?: string | null; processingLocation?: string; workerOnline?: boolean; beta?: boolean};
const API = '/api/reference-motion';
const PAGE = '/reference-motion';
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const initialId = new URLSearchParams(location.search).get('draft') || '';
const OFFLINE_MESSAGE = 'The ShortsCraft processing PC is offline. Your selected video is kept in this tab; no new analysis or export can start. Saved projects can still be previewed, edited and saved. Retry when the PC is online.';
function processingUnavailable(service: ServiceStatus | null): boolean {
  return !service?.enabled || (service.processingLocation === 'OWNER_PC' && service.workerOnline !== true);
}

async function api(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<any> {
  const response = await fetch(path, {method, headers: {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body), signal});
  const result = await response.json();
  if (!response.ok || result.success === false) throw Object.assign(new Error(result.error || 'Request failed'), result);
  return result;
}
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('This local file could not be read')); reader.readAsDataURL(file);});
}
async function readVideo(file: File): Promise<string> {
  const encoded = await readFile(file), marker = encoded.indexOf(';base64,');
  if (marker < 0) throw new Error('The selected video could not be encoded');
  // Browsers sometimes report x-m4v or application/octet-stream for an MP4.
  // This normalizes the transport label only; server signature/probe checks
  // remain responsible for identifying the real uploaded container and time.
  return 'data:video/' + (/\.webm$/i.test(file.name) ? 'webm' : 'mp4') + ';base64,' + encoded.slice(marker + 8);
}
function documentFrom(result: any): Doc {
  return {scene: validateScene(result.scene), images: result.images || {}, mediaAssets: result.mediaAssets || {}, analysis: result.analysis || {}};
}
class PreviewBoundary extends React.Component<{children: React.ReactNode; resetKey: ReferenceScene}, {error: string}> {
  state = {error: ''};
  static getDerivedStateFromError(error: Error) {return {error: error.message};}
  componentDidUpdate(previous: {resetKey: ReferenceScene}) {if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({error: ''});}
  render() {return this.state.error ? <p className="error" role="alert">Preview failed: {this.state.error}. No flat video was substituted.</p> : this.props.children;}
}

function App() {
  const [service, setService] = useState<ServiceStatus | null>(null), [user, setUser] = useState<User | null>(null), [credits, setCredits] = useState<any>(null);
  const [doc, setDoc] = useState<Doc | null>(null), [selected, setSelected] = useState(''), [file, setFile] = useState<File | null>(null), [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState(''), [status, setStatus] = useState('Checking your account and reference-analysis availability…'), [error, setError] = useState(''), [locked, setLocked] = useState(false);
  const [trimOffered, setTrimOffered] = useState(false), [trimmed, setTrimmed] = useState(false), [acknowledged, setAcknowledged] = useState(false), [download, setDownload] = useState(''), [height, setHeight] = useState(480), [reviewFrame, setReviewFrame] = useState(0), [failedAnalysis, setFailedAnalysis] = useState<Record<string, any> | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'local' | 'gemini'>('local'), [cloudConsent, setCloudConsent] = useState(false);
  const [sourcePending, setSourcePending] = useState(false);
  const [ownerPcConsent, setOwnerPcConsent] = useState(false);
  const owner = useRef<string | null>(null), latest = useRef<Doc | null>(null), id = useRef(initialId), revision = useRef(0), saved = useRef(0), boot = useRef(false), inFlightSave = useRef<Promise<void> | null>(null);
  const active = useRef<AbortController | null>(null), sourceObject = useRef(''), exportObject = useRef(''), player = useRef<PlayerRef>(null), video = useRef<HTMLVideoElement>(null);
  latest.current = doc;

  function clearDownload() {if (exportObject.current) URL.revokeObjectURL(exportObject.current); exportObject.current = ''; setDownload('');}
  function commit(next: Doc) {
    next.scene = validateScene(next.scene);
    latest.current = next; setDoc(next); revision.current++; setAcknowledged(false); clearDownload();
    setError(''); setStatus(owner.current ? 'Changes waiting to save…' : 'Local preview only · sign in to save');
  }
  async function checkOwner() {
    const me = await api('/api/auth/me');
    if (!owner.current || me.user?.id !== owner.current) throw new Error('Your signed-in account changed. Reopen this editor before continuing.');
  }
  async function saveNow(): Promise<void> {
    if (!boot.current || locked || !owner.current || !latest.current) return;
    if (inFlightSave.current) {await inFlightSave.current; if (saved.current < revision.current) return saveNow(); return;}
    const run = async () => {while (saved.current < revision.current) {
      const current = latest.current!, version = revision.current;
      const scene = validateScene(current.scene); await checkOwner();
      if (!id.current) id.current = 'ref_' + crypto.randomUUID().replace(/-/g, '');
      setStatus('Saving to your account…');
      await api('/api/projects/' + encodeURIComponent(id.current), 'PUT', {name: 'Reference animation', aspect: scene.width >= scene.height ? '16:9' : '9:16', clips: [{tpl: 'reference-motion', dur: scene.durationFrames / scene.fps * 1000, spec: scene, props: {mediaAssets: current.mediaAssets, analysis: current.analysis}}]});
      saved.current = version; history.replaceState(null, '', PAGE + '?draft=' + encodeURIComponent(id.current)); setStatus(saved.current === revision.current ? 'Saved to your account' : 'Saving newer changes…');
    }};
    const job = run(); inFlightSave.current = job;
    try {await job;} catch (cause) {setStatus('Not saved to the server'); setError((cause as Error).message); throw cause;} finally {if (inFlightSave.current === job) inFlightSave.current = null;}
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {try {
      const [st, me, cr] = await Promise.all([api(API + '/status'), api('/api/auth/me'), api('/api/credits')]); if (cancelled) return;
      setService({...st, maxDurationSeconds: st.maximumSeconds || st.maxDurationSeconds || 5}); setUser(me.user || null); owner.current = me.user?.id || null; setCredits(cr); setHeight(Math.min(720, cr.maxHeight || 480));
      if (!st.enabled) throw new Error('Reference reconstruction is not enabled on this server. Existing templates and projects are unchanged.');
      if (id.current) {const result = await api(API + '/projects/' + encodeURIComponent(id.current)); if (cancelled) return; const opened = documentFrom(result); latest.current = opened; setDoc(opened); setSelected(opened.scene.layers[0].id); setStatus('Saved reference project reopened from your account');}
      else {
        const token = new URLSearchParams(location.search).get('handoff');
        if (token && me.user?.id) {
          const pending = await takeReferenceHandoff(token, me.user.id); if (cancelled) return;
          history.replaceState(null, '', PAGE);
          if (pending) await chooseVideo(pending);
          else {setError('The selected video handoff expired or belongs to another signed-in account. Choose the file again.'); setStatus('No video was uploaded');}
        } else setStatus(me.user ? 'Choose a short reference video to start' : 'Log in before uploading a private reference');
      }
    } catch (cause) {if (cancelled) return; setError((cause as Error).message); setStatus('Nothing was overwritten'); setLocked(!!id.current);} finally {boot.current = true;}})();
    return () => {cancelled = true; active.current?.abort(); if (sourceObject.current) URL.revokeObjectURL(sourceObject.current); if (exportObject.current) URL.revokeObjectURL(exportObject.current);};
  }, []);
  useEffect(() => {if (!doc || !user || locked || busy || !boot.current) return; const timer = setTimeout(() => saveNow().catch(() => {}), 800); return () => clearTimeout(timer);}, [doc, user, locked, busy]);
  useEffect(() => {
    let cancelled = false, checking = false;
    async function refreshAvailability() {
      if (document.visibilityState === 'hidden' || checking) return;
      checking = true;
      try {
        const st = await api(API + '/status');
        if (!cancelled) {setService({...st, maxDurationSeconds: st.maximumSeconds || st.maxDurationSeconds || 5}); if (st.processingLocation === 'OWNER_PC' && st.workerOnline === true) setError(current => current === OFFLINE_MESSAGE ? '' : current);}
      } catch (_) {
        // A failed heartbeat cannot leave a formerly-online PC enabled. Do not
        // discard the user's file, project, edits or completed MP4 download.
        if (!cancelled) setService(current => current?.processingLocation === 'OWNER_PC' ? {...current, workerOnline: false} : current);
      } finally {checking = false;}
    }
    const timer = window.setInterval(refreshAvailability, 30000);
    window.addEventListener('focus', refreshAvailability);
    document.addEventListener('visibilitychange', refreshAvailability);
    return () => {cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', refreshAvailability); document.removeEventListener('visibilitychange', refreshAvailability);};
  }, []);
  async function chooseVideo(next: File | undefined) {
    if (!next || busy) return;
    // Consent belongs to this file, not to the browser session or saved draft.
    // Even an invalid newly selected file revokes the previous cloud choice.
    setAnalysisMode('local'); setCloudConsent(false); setOwnerPcConsent(false);
    try {
      if (next.size > MAX_VIDEO_BYTES) throw new Error('Use an MP4 or WebM video below 20 MiB.');
      if (!/\.(mp4|webm)$/i.test(next.name)) throw new Error('Choose an MP4 or WebM file. The server checks the actual video, not only its name.');
      if (sourceObject.current) URL.revokeObjectURL(sourceObject.current); sourceObject.current = URL.createObjectURL(next);
      setFile(next); setSourceUrl(sourceObject.current); setSourcePending(true); setAcknowledged(false); clearDownload(); setTrimOffered(false); setTrimmed(false); setFailedAnalysis(null); setError(''); setStatus('Local reference selected · it is not uploaded until you choose Analyze');
    } catch (cause) {setError((cause as Error).message);}
  }
  function keepPreviousProject() {
    if (busy) return;
    if (sourceObject.current) URL.revokeObjectURL(sourceObject.current);
    sourceObject.current = ''; setFile(null); setSourceUrl(''); setSourcePending(false);
    setAnalysisMode('local'); setCloudConsent(false); setOwnerPcConsent(false); setFailedAnalysis(null); setError('');
    setAcknowledged(false); clearDownload(); setStatus('Previous project kept · review it before exporting');
  }
  async function analyze(trimToSeconds?: number) {
    if (!file || busy || !service?.enabled || !owner.current) return;
    if (processingUnavailable(service)) {setError(OFFLINE_MESSAGE); return;}
    if (service.processingLocation === 'OWNER_PC' && !ownerPcConsent) {setError('Review and allow private processing on the ShortsCraft operator PC before uploading this reference.'); return;}
    if (analysisMode === 'gemini' && (!service.geminiAvailable || !cloudConsent)) {setError('Confirm that the analyzed silent clip may be sent to Google before choosing Gemini analysis.'); return;}
    const controller = new AbortController(); active.current = controller; setBusy('analysis'); setError(''); setTrimOffered(false); setFailedAnalysis(null);
    try {
      await saveNow(); await checkOwner(); setStatus(service.processingLocation === 'OWNER_PC' ? 'Uploading privately for analysis on the ShortsCraft operator PC. This beta works only while that PC is online and may take several minutes…' : analysisMode === 'gemini' ? 'Uploading privately, then sending the duration-limited silent clip to Gemini for video analysis and verifying the reconstruction…' : 'Uploading and analyzing the actual video frames locally on the server. This may take a minute…');
      const result = await api(API + '/analyze', 'POST', {video: await readVideo(file), ...(trimToSeconds ? {trimToSeconds} : {}), ...(service.processingLocation === 'OWNER_PC' ? {ownerPcConsent: true} : {}), ...(analysisMode === 'gemini' && cloudConsent ? {analysisMode: 'gemini', cloudConsent: true} : {})}, controller.signal);
      if (controller.signal.aborted) return;
      const next = documentFrom(result); id.current = ''; revision.current = 0; saved.current = 0; history.replaceState(null, '', PAGE);
      commit(next); setSourcePending(false); setSelected(next.scene.layers[0].id); setTrimmed(!!trimToSeconds); setReviewFrame(0); if (result.credits) setCredits(result.credits);
      setStatus('Analysis complete · review the reconstruction and its measured differences');
    } catch (cause) {
      const failure = cause as any;
      if (failure.name === 'AbortError') setStatus('Analysis request cancelled · your existing project was kept');
      else if (failure.code === 'REFERENCE_WORKER_OFFLINE') {setService(current => current ? {...current, workerOnline: false} : current); setError(OFFLINE_MESSAGE); setStatus('Processing PC offline · selected reference kept · existing project unchanged');}
      else {setError(failure.message); setStatus('Reference was not converted · existing project kept'); if (failure.details?.analysis && typeof failure.details.analysis === 'object') setFailedAnalysis(failure.details.analysis); if (failure.code === 'REFERENCE_TOO_LONG' || failure.state === 'REFERENCE_TOO_LONG') setTrimOffered((service?.maxDurationSeconds || 5) === 5); if (failure.credits) setCredits(failure.credits);}
    } finally {if (active.current === controller) active.current = null; setBusy('');}
  }
  function editLayer(patch: Partial<ReferenceLayer>) {
    const current = latest.current; if (!current) return;
    try {commit({...current, scene: {...current.scene, layers: current.scene.layers.map((layer) => layer.id === selected ? {...layer, ...patch} : layer)}});} catch (cause) {setError((cause as Error).message);}
  }
  function editText(content: string) {
    const layer = latest.current?.scene.layers.find(entry => entry.id === selected);
    if (!layer?.text) return;
    const font = fontForText(content, layer.text.font);
    if (!font) {setError('This text contains characters not supported by the bundled fonts. No system-font fallback was substituted.'); return;}
    editLayer({text: {...layer.text, content, font}});
  }
  function changeDuration(seconds: number) {
    const current = latest.current; if (!current) return;
    try {if (!Number.isFinite(seconds) || seconds < 1 / 30 || seconds > (service?.maxDurationSeconds || 5)) throw new Error('Duration exceeds your current plan limit'); const scene = retimeScene(current.scene, Math.round(seconds * 30)); commit({...current, scene}); if (reviewFrame >= scene.durationFrames) seek(scene.durationFrames - 1);} catch (cause) {setError((cause as Error).message);}
  }
  async function replaceImage(next: File | undefined) {
    const current = latest.current, layer = current?.scene.layers.find((entry) => entry.id === selected);
    if (!next || !current || !layer || layer.text || (!layer.assetId && !(layer.vector && 'paints' in layer.vector)) || busy) return;
    setBusy('asset'); setError('');
    try {
      if (next.size > 4 * 1024 * 1024 || !/^image\/(png|jpeg|webp)$/.test(next.type)) throw new Error('Use a PNG, JPEG or WebP image below 4 MiB');
      await checkOwner(); const result = await api(API + '/assets', 'POST', {image: await readFile(next)});
      if (!result.ref || !result.mediaData) throw new Error('The server did not store a private replacement asset');
      const assetId = layer.assetId || 'replacement_' + crypto.randomUUID().replace(/-/g, '');
      const layers = current.scene.layers.map(entry => entry.id === layer.id ? {...entry, assetId, vector: null} : entry);
      commit({...current, scene: {...current.scene, layers}, images: {...current.images, [assetId]: result.mediaData}, mediaAssets: {...current.mediaAssets, [assetId]: result.ref}});
      setStatus('Layer image replaced · its measured motion was preserved');
    } catch (cause) {setError((cause as Error).message);} finally {setBusy('');}
  }
  async function exportVideo() {
    if (!latest.current || !acknowledged || sourcePending || busy) return;
    if (processingUnavailable(service)) {setError(OFFLINE_MESSAGE); return;}
    setBusy('export'); setError(''); clearDownload();
    try {
      await checkOwner(); await saveNow(); const current = latest.current!;
      setStatus(service?.processingLocation === 'OWNER_PC' ? 'Rendering the reviewed editable layers to MP4 on the ShortsCraft operator PC…' : 'Rendering the reviewed editable planes to MP4…');
      const response = await fetch(API + '/export', {method: 'POST', headers: {'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID()}, body: JSON.stringify({scene: validateScene(current.scene), mediaAssets: current.mediaAssets, height, reviewAcknowledged: true})});
      if (!response.ok) {const failure = await response.json(); if (failure.credits) setCredits(failure.credits); throw Object.assign(new Error(failure.error || 'Export failed'), failure);}
      const blob = await response.blob(); if (!blob.type.includes('video/mp4') || !blob.size) throw new Error('Export did not return a valid MP4 download');
      exportObject.current = URL.createObjectURL(blob); setDownload(exportObject.current); setStatus('MP4 ready · the editable reconstruction was rendered, not the original video'); setCredits(await api('/api/credits'));
    } catch (cause) {if ((cause as any).code === 'REFERENCE_WORKER_OFFLINE') {setService(current => current ? {...current, workerOnline: false} : current); setError(OFFLINE_MESSAGE); setStatus('Processing PC offline · project unchanged · export not completed');} else {setError((cause as Error).message); setStatus('Export not completed');}} finally {setBusy('');}
  }
  function seek(frame: number) {
    if (!doc) return;
    const n = Math.max(0, Math.min(doc.scene.durationFrames - 1, Math.round(frame)));
    setReviewFrame(n); player.current?.seekTo(n);
    if (video.current && !sourcePending) {
      // The local source keeps its original speed after the editable scene is
      // retimed. Compare the matching observed source frame, not the same wall
      // clock second of two differently timed animations.
      const sourceFrames = Number.isInteger(doc.analysis.frameCount) && doc.analysis.frameCount > 0 ? doc.analysis.frameCount : doc.scene.durationFrames;
      const sourceSeconds = (doc.scene.durationFrames === 1 ? 0 : n * (sourceFrames - 1) / (doc.scene.durationFrames - 1)) / 30;
      video.current.pause(); video.current.currentTime = Math.min(sourceSeconds, Number.isFinite(video.current.duration) ? video.current.duration : sourceSeconds);
    }
  }
  const layer = doc?.scene.layers.find((entry) => entry.id === selected), displayAnalysis = failedAnalysis || (!sourcePending ? doc?.analysis : undefined), quality = displayAnalysis?.quality || {}, warnings: string[] = Array.isArray(displayAnalysis?.warnings) ? displayAnalysis!.warnings.filter((value: unknown) => typeof value === 'string') : [];
  const semantic = displayAnalysis?.semantic;
  const maxOffset = doc ? Math.max(doc.scene.width, doc.scene.height) * 4 : 8192;
  const ownerPc = service?.processingLocation === 'OWNER_PC', workerOffline = ownerPc && service.workerOnline !== true;
  return <>
    <header><a className="brand" href="/">ShortsCraft</a><span className="beta">Reference Motion · experimental</span><nav><a href="/animations">Library</a><a href="/drafts">My Projects</a>{user ? <a href="/account">My account</a> : <a href={'/login?next=' + encodeURIComponent(location.pathname + location.search)}>Log in</a>}</nav></header>
    <main><div className="intro"><div><h1>Reference-to-editable motion</h1><p>Upload a short reference. Review what was actually reconstructed.</p></div><p className="credit">{service ? `${service.plan || 'Current plan'} · up to ${service.maxDurationSeconds}s per reference` : 'Checking plan…'}<br/>{credits ? `${credits.left} credits left · export ${credits.cost?.export || 1} credit` : ''}</p></div>
      {ownerPc && <div className="panel" role="status"><strong>Operator-PC beta · {workerOffline ? 'processing offline' : 'processing online'}</strong><p>{workerOffline ? OFFLINE_MESSAGE : 'Reference analysis and MP4 rendering run privately on the ShortsCraft operator’s PC, not on a 24/7 cloud processor. Processing pauses when that PC is offline. Saved project editing remains available.'}</p></div>}
      {locked ? <div className="panel error" role="alert"><h2>Project not opened</h2><p>{error}</p><p>Its saved clips were not changed.</p><a href="/drafts">Back to My Projects</a></div> : <div className="work">
        <aside><fieldset disabled={!!busy || !service?.enabled}><legend>1. Choose a reference</legend><label>MP4 or WebM · up to 20 MiB<input aria-label="Reference video" type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={(event) => chooseVideo(event.target.files?.[0])}/></label>{file && <p className="filename">{file.name}</p>}<p className="note">Free: up to 5 seconds. Pro: up to 10 seconds. Longer references are rejected; trimming is never silent.</p>
          {ownerPc ? <><p className="note" id="owner-pc-upload-notice">Your reference is uploaded privately to ShortsCraft and processed on the ShortsCraft operator’s PC. Audio is not reconstructed. Card images, logos and words may remain one grouped layer; this is not an exact editable clone of arbitrary video. No Google video analysis is used in this beta.</p><label className="checkbox"><input aria-label="Allow private processing on the ShortsCraft operator PC" aria-describedby="owner-pc-upload-notice" type="checkbox" checked={ownerPcConsent} onChange={event => setOwnerPcConsent(event.target.checked)}/>I allow this reference to be processed privately on the ShortsCraft operator’s PC.</label></> : service?.geminiAvailable ? <><label>Analysis mode<select aria-label="Reference analysis mode" value={analysisMode} onChange={event => {setAnalysisMode(event.target.value === 'gemini' ? 'gemini' : 'local'); setCloudConsent(false);}}><option value="local">Local pixel analysis · no Google upload</option><option value="gemini">Gemini video understanding · optional</option></select></label>{analysisMode === 'gemini' && <><p className="note" id="gemini-upload-notice">The analyzed, duration-limited clip is sent without audio to Google for {service.geminiModel || 'Gemini'} video understanding. Your original file is first uploaded privately to ShortsCraft for validation. Gemini interpretation is not a guarantee of exact editable reconstruction.</p><label className="checkbox"><input aria-label="Allow this reference clip to be sent to Google" aria-describedby="gemini-upload-notice" type="checkbox" checked={cloudConsent} onChange={event => setCloudConsent(event.target.checked)}/>I allow this reference clip to be sent to Google for analysis.</label></>}</> : <p className="note">Local pixel analysis only. Google video analysis is not enabled on this server.</p>}
          <button className="primary full" disabled={!file || !user || processingUnavailable(service) || (ownerPc && !ownerPcConsent) || (analysisMode === 'gemini' && !cloudConsent)} onClick={() => analyze()}>Analyze reference</button>{trimOffered && <button className="full" disabled={processingUnavailable(service) || (ownerPc && !ownerPcConsent) || (analysisMode === 'gemini' && !cloudConsent)} onClick={() => analyze(5)}>Trim to the first 5 seconds and analyze</button>}{!user && <p className="note">Log in to upload, store private assets and save your work.</p>}</fieldset>
          {busy === 'analysis' && <button className="full" onClick={() => active.current?.abort()}>Cancel analysis request</button>}
          <p className="status" role="status">{busy === 'asset' ? 'Storing private replacement image…' : status}</p>{error && <p className="error" role="alert">{error}</p>}
          <p className="scope">Current scope: supported rotating image cards and simple flat-background motion. Card text, photos and logos usually stay grouped. Native text is editable only where independently reconstructed and verified. Ambiguous overlaps, fine detail and font differences need review. No audio reconstruction or universal exact-video cloning.</p>
          {doc && <><fieldset disabled={!!busy}><legend>2. Adjust editable layers</legend><label>Editable layer<select aria-label="Image plane" value={selected} onChange={(event) => setSelected(event.target.value)}>{doc.scene.layers.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
            {layer && <>
              <label className="checkbox"><input type="checkbox" checked={layer.visible} onChange={(event) => editLayer({visible: event.target.checked})}/>Visible</label>
              <div className="two"><label>Offset X<input type="number" min={-maxOffset} max={maxOffset} step="1" value={layer.offset.x} onChange={(event) => editLayer({offset: {...layer.offset, x: +event.target.value}})}/></label><label>Offset Y<input type="number" min={-maxOffset} max={maxOffset} step="1" value={layer.offset.y} onChange={(event) => editLayer({offset: {...layer.offset, y: +event.target.value}})}/></label></div>
              <div className="two"><label>Scale<input type="number" min="0.05" max="4" step="0.05" value={layer.scale} onChange={(event) => editLayer({scale: +event.target.value})}/></label><label>Rotation °<input type="number" min="-360" max="360" step="1" value={layer.rotation} onChange={(event) => editLayer({rotation: +event.target.value})}/></label></div>
              <label>Opacity<input type="range" min="0" max="1" step="0.01" value={layer.opacity} onChange={(event) => editLayer({opacity: +event.target.value})}/></label><label>Layer order<input type="number" min="-999" max="999" step="1" value={layer.zIndex} onChange={(event) => editLayer({zIndex: +event.target.value})}/></label>
              {layer.text ? <>
                <label>Text content<textarea aria-label="Text content" maxLength={500} rows={3} value={layer.text.content} onChange={event=>editText(event.target.value)}/></label>
                <div className="two"><label>Text size<input aria-label="Text size" type="number" min="1" max="512" value={layer.text.fontSize} onChange={event=>editLayer({text:{...layer.text!,fontSize:+event.target.value}})}/></label><label>Text color<input aria-label="Text color" type="color" value={layer.text.fill} onChange={event=>editLayer({text:{...layer.text!,fill:event.target.value}})}/></label></div>
                <p className="note">Native editable words. Original glyphs were excluded from the reconstructed artwork; long edits shrink to fit this text plane. The bundled font may differ from the source.</p>
              </> : layer.vector ? <>
                <label>Artwork color<input aria-label="Artwork color" type="color" value={'paints' in layer.vector ? multipartColor(layer,0,reviewFrame) : vectorColor(layer,reviewFrame)} onChange={(event)=>editLayer({vector:{...layer.vector!,fill:event.target.value}})}/></label>
                {'paints' in layer.vector ? <><p className="note">One tracked object with multiple internal paints. Move, hide, recolor or replace it across the whole animation. Touching/occluded objects may remain grouped.</p><label>Replace object image<input aria-label="Replace object image" type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>replaceImage(event.target.files?.[0])}/></label></> : <p className="note">Legacy color-group contours. Individual words and stable object identity were not reconstructed in this version.</p>}
              </> : <><label>Replace whole card<input aria-label="Replace whole card" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => replaceImage(event.target.files?.[0])}/></label><p className="note">The replacement fills this layer's original bounds and follows the same corner animation. Internal text is not separately editable.</p></>}
            </>}
            <label>Background color<input type="color" value={doc.scene.background} onChange={(event) => commit({...doc, scene: {...doc.scene, background: event.target.value, layers: doc.scene.layers.map((layer) => layer.id === 'background-plane' ? {...layer, visible: false} : layer)}})}/></label><p className="note">Choosing a color replaces the inferred background image with a flat canvas. Show the background plane again to restore its original gradient.</p><label>Duration / playback speed<input aria-label="Duration seconds" type="number" min="0.1" max={service?.maxDurationSeconds || 5} step="0.1" value={Number((doc.scene.durationFrames / 30).toFixed(3))} onChange={(event) => changeDuration(+event.target.value)}/></label><p className="note">Changing duration retimes the measured motion. Native corner keyframes remain data, never uploaded code.</p>
          </fieldset><fieldset disabled={!!busy || sourcePending}><legend>3. Review, save and export</legend><label className="checkbox"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/>I reviewed the reconstruction and understand the grouped layers and quality warnings.</label><label>Export resolution<select value={height} onChange={(event) => setHeight(+event.target.value)}>{[480, 720, 1080, 1440].filter((value) => value <= (credits?.maxHeight || 480)).map((value) => <option key={value} value={value}>{value}px short edge</option>)}</select></label><button className="full" disabled={!user} onClick={() => saveNow().catch(() => {})}>Save project now</button><button className="primary full" disabled={!acknowledged || !user || sourcePending || processingUnavailable(service)} onClick={exportVideo}>{busy === 'export' ? 'Rendering MP4…' : 'Export reviewed MP4'}</button>{download && <a className="download" href={download} download="shortscraft-reference-motion.mp4">Download MP4</a>}</fieldset></>}
        </aside>
        <section className="results">{sourcePending && doc && <div className="panel" role="status"><p>Previous project shown below. The newly selected reference has not been reconstructed. Export and matching-timestamp comparison are disabled until analysis succeeds.</p><button disabled={!!busy} onClick={keepPreviousProject}>Keep previous project instead</button></div>}<div className="compare"><div className="panel"><h2>Source reference</h2>{sourceUrl ? <video ref={video} src={sourceUrl} controls playsInline/> : <div className="empty">Choose the original local video to compare it. Private source video is not embedded in the reconstructed project.</div>}{trimmed && <p className="note">Analysis uses only the first 5 seconds you explicitly selected.</p>}</div><div className="panel"><h2>Editable reconstruction</h2>{doc ? <PreviewBoundary resetKey={doc.scene}><Player ref={player} component={ReferenceMotion} inputProps={{scene: doc.scene, images: doc.images, watermark: credits?.watermark !== false}} compositionWidth={doc.scene.width} compositionHeight={doc.scene.height} fps={30} durationInFrames={doc.scene.durationFrames} controls loop style={{width: '100%', aspectRatio: `${doc.scene.width}/${doc.scene.height}`}}/></PreviewBoundary> : <div className="empty">The measured editable reconstruction appears here after analysis. No preset animation or hidden source video is used.</div>}</div></div>
          {doc && <div className="panel seek"><label>Review matching timestamp<input aria-label="Review frame" type="range" min="0" max={doc.scene.durationFrames - 1} step="1" value={reviewFrame} onChange={(event) => seek(+event.target.value)}/></label><span>{(reviewFrame / 30).toFixed(2)}s · frame {reviewFrame}</span></div>}
          {displayAnalysis && <section className="panel analysis"><h2>{failedAnalysis ? 'Reference analysis · reconstruction rejected' : 'Actual analysis and quality'}</h2><div className="quality"><span>State: {quality.state || 'REVIEW_REQUIRED'}</span><span>Initial visual comparison: {quality.visualComparison || 'NOT_RUN'}</span><span>{displayAnalysis.cards?.length || doc?.scene.layers.length || 0} measured groups · {displayAnalysis.frameCount || doc?.scene.durationFrames || 0} source frames</span></div><p>{displayAnalysis.scope || 'Grouped image planes only'}</p>{failedAnalysis ? <p className="error">No finished editable project was created. These measurements describe the rejected attempt, not a successful conversion.</p> : <p className="note">Comparison scores describe the initial reconstruction, before your edits. Review the current preview again before export.</p>}
            {semantic && <div className="semantic-analysis"><h3>Gemini interpretation</h3><p>{typeof semantic.summary === 'string' ? semantic.summary : 'No semantic summary was retained.'}</p>{typeof semantic.motionSummary === 'string' && <p>{semantic.motionSummary}</p>}<p className="note">Model estimate, not visual verification: {typeof semantic.confidence === 'number' && Number.isFinite(semantic.confidence) ? `${Math.round(semantic.confidence * 100)}%` : 'not available'}. Reconstruction evidence: {semantic.reconstruction === 'NATIVE_RENDER_VERIFIED' ? 'native render compared with the source' : semantic.reconstruction === 'MEASURED_LOCAL_RECONSTRUCTION' ? 'local pixel reconstruction; Gemini supplied interpretation only' : 'not certified'}.</p>{Array.isArray(semantic.unsupportedFeatures) && semantic.unsupportedFeatures.length > 0 && <p className="note">Not independently reconstructed: {semantic.unsupportedFeatures.filter((feature: unknown) => typeof feature === 'string').map((feature: string) => feature.toLowerCase().replace(/_/g, ' ')).join(', ')}.</p>}{Array.isArray(semantic.cuts) && semantic.cuts.length > 0 && <p className="note">Observed scene cuts: {semantic.cuts.length}. Scene analysis does not itself prove those transitions were recreated.</p>}</div>}
            <ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul><details><summary>Measured analysis report</summary><pre>{JSON.stringify(displayAnalysis, null, 2)}</pre></details></section>}
        </section>
      </div>}
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App/>);
