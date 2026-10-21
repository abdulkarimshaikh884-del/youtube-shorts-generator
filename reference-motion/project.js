'use strict';
const {validateScene,assetIds} = require('./schema');
const {durationLimit, ReferenceMotionError} = require('./admission');
const assets = require('./assets');

function invalid(message) {const error = new Error('Invalid reference project: ' + message); error.status = 422; throw error;}
function plain(value) {return value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));}
function fields(value, allowed, where, required = []) {if (!plain(value) || Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) invalid(where + ' has unsupported or missing fields');}
function count(value, maximum, where, integer = false) {if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum || (integer && !Number.isInteger(value))) invalid(where + ' must be bounded numeric data'); return value;}
function label(value, maximum, where) {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u001f\u007f]|(?:https?:|data:|file:|[A-Za-z]:[\\/])|(?:^|\s)\/(?:Users|home|tmp|var|private)\//i.test(value)) invalid(where + ' must not contain paths, URLs or embedded bytes');
  return value;
}
function choice(value, allowed, where) {if (!allowed.includes(value)) invalid(where + ' is unsupported'); return value;}
function cleanAnalysis(value) {
  fields(value, ['method', 'scope', 'frameCount', 'fps', 'width', 'height', 'anchorFrame', 'backgroundConfidence', 'cards', 'warnings', 'quality', 'metadata', 'semantic'], 'analysis');
  const out = {};
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (key === 'method' || key === 'scope') out[key] = label(item, key === 'method' ? 80 : 250, key);
    else if (['frameCount', 'anchorFrame'].includes(key)) out[key] = count(item, 300, key, true);
    else if (key === 'fps') out[key] = choice(item, [30], key);
    else if (['width', 'height'].includes(key)) out[key] = count(item, 4096, key, true);
    else if (key === 'backgroundConfidence') out[key] = count(item, 1, key);
    else if (key === 'warnings') {
      if (!Array.isArray(item) || item.length > 20) invalid('too many warnings'); out[key] = item.map((warning) => label(warning, 500, 'warning'));
    } else if (key === 'cards') {
      if (!Array.isArray(item) || item.length > 12) invalid('too many card reports');
      out[key] = item.map((card) => {
        fields(card, ['id', 'confidence', 'observedCoverage', 'trackedFrameRatio', 'lightingObservedRatio', 'medianReprojectionErrorPixels', 'anchorFeatures', 'geometryInferredFromSharedAspect', 'partialVisibility', 'screenshotInternalText'], 'card report');
        const clean = {};
        for (const field of Object.keys(card)) {
          if (field === 'id') clean[field] = label(card[field], 64, field);
          else if (['confidence', 'observedCoverage', 'trackedFrameRatio', 'lightingObservedRatio'].includes(field)) clean[field] = count(card[field], 1, field);
          else if (field === 'medianReprojectionErrorPixels') clean[field] = count(card[field], 4096, field);
          else if (field === 'anchorFeatures') clean[field] = count(card[field], 100000, field, true);
          else if (field === 'geometryInferredFromSharedAspect' || field === 'partialVisibility') {if (typeof card[field] !== 'boolean') invalid('geometry/visibility flag must be boolean'); clean[field] = card[field];}
          else clean[field] = choice(card[field], ['GROUPED_NOT_NATIVE'], field);
        }
        return clean;
      });
    } else if (key === 'quality') {
      fields(item, ['state', 'visualComparison', 'exactRecreation', 'nativeText', 'audioReconstruction', 'zOrder', 'comparisons', 'comparedFrameCount', 'comparisonWidth', 'comparisonHeight', 'worstFrame', 'meanAbsoluteError', 'maxMeanAbsoluteError', 'maxChangedPixelFractionOver30', 'failedFrameCount','minForegroundRecall','minForegroundPrecision','objectIdentity','nativeTextCount','textRemoval','hiddenBackgroundMaxDelta'], 'quality');
      const clean = {};
      for (const field of Object.keys(item)) {
        if (field === 'state') clean[field] = choice(item[field], ['READY_TO_EDIT', 'REVIEW_REQUIRED', 'FLAT_IMAGE_ONLY', 'FAILED'], field);
        else if (field === 'visualComparison') clean[field] = choice(item[field], ['PASS', 'FAIL', 'NOT_RUN'], field);
        else if (field === 'exactRecreation') {if (item[field] !== false) invalid('exact recreation is not certified'); clean[field] = false;}
        else if (field === 'nativeText') clean[field] = choice(item[field], ['NOT_RUN', 'GROUPED_NOT_NATIVE', 'NOT_RETAINED', 'PARTIAL_NATIVE', 'NATIVE_MEASURED'], field);
        else if (field === 'audioReconstruction') clean[field] = choice(item[field], ['NOT_RUN', 'GROUPED_NOT_NATIVE', 'NOT_RETAINED'], field);
        else if (field === 'objectIdentity') clean[field] = choice(item[field], ['TRACKED', 'AMBIGUOUS', 'NOT_RUN'], field);
        else if (field === 'textRemoval') clean[field] = choice(item[field], ['MASK_EXCLUDED_FLAT_BACKGROUND', 'NATIVE_SCENE_NO_SOURCE_RASTER', 'NOT_RUN', 'FAIL'], field);
        else if (field === 'hiddenBackgroundMaxDelta') clean[field] = count(item[field], 255, field);
        else if (field === 'nativeTextCount') clean[field] = count(item[field], 12, field, true);
        else if (field === 'zOrder') clean[field] = choice(item[field], ['REVIEW_REQUIRED', 'NOT_RUN'], field);
        else if (['comparedFrameCount', 'failedFrameCount'].includes(field)) clean[field] = count(item[field], 300, field, true);
        else if (field === 'worstFrame') clean[field] = count(item[field], 299, field, true);
        else if (['comparisonWidth', 'comparisonHeight'].includes(field)) clean[field] = count(item[field], 4096, field, true);
        else if (['meanAbsoluteError', 'maxMeanAbsoluteError'].includes(field)) clean[field] = count(item[field], 255, field);
        else if (['maxChangedPixelFractionOver30','minForegroundRecall','minForegroundPrecision'].includes(field)) clean[field] = count(item[field], 1, field);
        else {
          if (!Array.isArray(item[field]) || item[field].length > 12) invalid('too many comparison samples');
          clean[field] = item[field].map((comparison) => {
            fields(comparison, ['frame', 'meanAbsoluteError', 'psnrDb', 'changedPixelFractionOver30', 'foregroundRecall', 'foregroundPrecision'], 'comparison', ['frame', 'meanAbsoluteError', 'psnrDb', 'changedPixelFractionOver30']);
            const result = {frame: count(comparison.frame, 299, 'comparison frame', true), meanAbsoluteError: count(comparison.meanAbsoluteError, 255, 'mean absolute error'), psnrDb: count(comparison.psnrDb, 200, 'PSNR'), changedPixelFractionOver30: count(comparison.changedPixelFractionOver30, 1, 'changed-pixel fraction')};
            for (const field of ['foregroundRecall', 'foregroundPrecision']) if (Object.prototype.hasOwnProperty.call(comparison, field)) result[field] = count(comparison[field], 1, field);
            return result;
          });
        }
      }
      out[key] = clean;
    } else if (key === 'semantic') {
      fields(item, ['summary','motionSummary','confidence','confidenceSource','unsupportedFeatures','cuts','reconstruction','elements'], 'semantic analysis', ['summary','motionSummary','confidence','confidenceSource','unsupportedFeatures','cuts','reconstruction','elements']);
      if(!Array.isArray(item.unsupportedFeatures)||item.unsupportedFeatures.length>12||!Array.isArray(item.cuts)||item.cuts.length>16||!Array.isArray(item.elements)||item.elements.length>12)invalid('semantic report exceeds its count limits');
      out.semantic={summary:label(item.summary,1500,'semantic summary'),motionSummary:label(item.motionSummary,2000,'motion summary'),confidence:count(item.confidence,1,'semantic confidence'),confidenceSource:choice(item.confidenceSource,['MODEL_ESTIMATE'],'confidence source'),
        reconstruction:choice(item.reconstruction,['NOT_CERTIFIED','NATIVE_RENDER_VERIFIED','MEASURED_LOCAL_RECONSTRUCTION'],'reconstruction'),
        unsupportedFeatures:item.unsupportedFeatures.map(feature=>choice(feature,require('./semantic-plan').UNSUPPORTED_FEATURES,'unsupported feature')),cuts:item.cuts.map(frame=>count(frame,299,'cut frame',true)),
        elements:item.elements.map(element=>{fields(element,['id','label','type','keyframeCount'],'semantic element',['id','label','type','keyframeCount']);return {id:label(element.id,64,'element id'),label:label(element.label,100,'element label'),type:choice(element.type,['shape','text'],'element type'),keyframeCount:count(element.keyframeCount,61,'keyframe count',true)};})};
    } else if (key === 'metadata') {
      fields(item, ['networkRequests', 'modelInvocations', 'modelDownloads', 'elapsedSeconds', 'tracking','provider','model','inputTokens','outputTokens','thinkingTokens','totalTokens'], 'metadata');
      const clean = {};
      for (const field of Object.keys(item)) clean[field] = field === 'provider' ? choice(item[field],['gemini'],'provider') : field === 'model' ? choice(item[field],['gemini-3.8-flash'],'model') : field === 'tracking' ? label(item[field], 250, field) : count(item[field], /Tokens$/.test(field)?1000000:field === 'elapsedSeconds' ? 600 : 10000, field, field !== 'elapsedSeconds');
      out[key] = clean;
    }
  }
  if (Buffer.byteLength(JSON.stringify(out), 'utf8') > 32768) invalid('analysis metadata exceeds 32 KiB');
  return out;
}
function mediaReferences(scene, value) {
  if (!plain(value)) invalid('private media references must be a record');
  const ids = assetIds(scene);
  if (Object.keys(value).length !== ids.length || Object.keys(value).some((key) => !ids.includes(key)) || ids.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) invalid('private media IDs must match exactly the used image planes');
  const result = {};
  for (const key of ids) {if (!assets.validRef(value[key])) invalid('private media reference is invalid'); result[key] = {jobId: value[key].jobId, assetPath: value[key].assetPath};}
  return result;
}
async function normaliseClip(user, clip, {enforcePlan = false} = {}) {
  if (!user?.id) {const error = new Error('Sign in to access a private reference project'); error.status = 401; throw error;}
  if (!clip || clip.tpl !== 'reference-motion') invalid('not a reference motion clip');
  if (enforcePlan && process.env.SC_REFERENCE_MOTION !== 'true') throw new ReferenceMotionError('REFERENCE_MOTION_DISABLED', 'Reference reconstruction is disabled on this server.', 404);
  const scene = validateScene(clip.spec);
  if (enforcePlan && scene.durationFrames > durationLimit(user.plan) * scene.fps) throw new ReferenceMotionError('REFERENCE_TOO_LONG', 'This reference project exceeds your current plan duration. Free allows 5 seconds; Pro allows 10 seconds.');
  fields(clip.props, ['mediaAssets', 'analysis'], 'project properties', ['mediaAssets', 'analysis']);
  const mediaAssets = mediaReferences(scene, clip.props.mediaAssets), analysis = cleanAnalysis(clip.props.analysis);
  const safe = {tpl: 'reference-motion', dur: scene.durationFrames / scene.fps * 1000, spec: scene, props: {mediaAssets, analysis}};
  if (Buffer.byteLength(JSON.stringify([safe]), 'utf8') > 256 * 1024) {const error = new Error('Reference project exceeds the existing 256 KiB project limit'); error.status = 413; throw error;}
  // Do not rely on is_public or a guessed job ID. The canonical resolver checks
  // user_id on every referenced private asset, including saved-project writes.
  await Promise.all(Object.values(mediaAssets).map((reference) => assets.resolve(user, reference)));
  return safe;
}
async function hydrate(user, clip) {
  const safe = await normaliseClip(user, clip);
  const images = {};
  await Promise.all(Object.entries(safe.props.mediaAssets).map(async ([id, reference]) => {images[id] = await assets.resolve(user, reference);}));
  return {scene: safe.spec, images, mediaAssets: safe.props.mediaAssets, analysis: safe.props.analysis};
}
module.exports = {normaliseClip, hydrate, cleanAnalysis, mediaReferences};
