'use strict';
// Bridge actual video understanding to controlled native reconstruction. The
// model cannot certify itself: an independent encoded render gate must pass.
const fs=require('node:fs/promises'),path=require('node:path');
const {compilePlan,validatePlan}=require('./semantic-plan');
const {verifySemanticReconstruction}=require('./semantic-quality');
const safeText=(value,max)=>String(value).replace(/(?:https?:\/\/|data:|file:|[A-Za-z]:[\\/])\S*/gi,'[reference]').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
function semanticReport(plan,reconstruction='NOT_CERTIFIED') {
  return {summary:safeText(plan.analysis.summary,1500),motionSummary:safeText(plan.analysis.motionSummary,2000),confidence:plan.analysis.confidence,
    confidenceSource:'MODEL_ESTIMATE',unsupportedFeatures:[...plan.analysis.unsupportedFeatures],cuts:[...plan.analysis.cuts],reconstruction,
    elements:plan.elements.map(element=>({id:element.id,label:safeText(element.label,100),type:element.type,keyframeCount:element.keyframes.length}))};
}
function attachProviderAnalysis(analysis,provider,semantic,started) {
  const original=analysis.metadata||{};
  return {...analysis,semantic,metadata:{...original,provider:'gemini',model:provider.model,
    modelInvocations:(original.modelInvocations||0)+provider.modelInvocations,networkRequests:(original.networkRequests||0)+provider.networkRequests,
    inputTokens:provider.inputTokens,outputTokens:provider.outputTokens,thinkingTokens:provider.thinkingTokens,totalTokens:provider.totalTokens,
    elapsedSeconds:Math.round((Date.now()-started)/1000*1000)/1000}};
}
async function createCandidate({planner,videoBytes,width,height,durationFrames,framesDirectory,directory,python,run,ffmpegPath,signal,renderSerialise,accountPlan,verify=verifySemanticReconstruction,onEvidence}={}) {
  const started=Date.now(),provided=await planner.plan({videoBytes,width,height,durationFrames,signal});
  let plan=provided.plan,semantic=semanticReport(plan),measurement=null;
  try {
    // Refuse unsupported photographic/effect plans before geometric fitting;
    // those can only use the existing genuinely measured grouped-asset path.
    compilePlan(plan,{width,height,durationFrames});
    if(python){
      const measuredDirectory=path.join(directory,'semantic-measurement');await fs.mkdir(measuredDirectory);
      const response=JSON.parse(await run(python,['-I','-B','-u',path.join(__dirname,'semantic-measure-worker.py')],{signal,maxBytes:512*1024,input:JSON.stringify({plan,framesDirectory,width,height,fps:30,durationFrames,outputDirectory:measuredDirectory})}));
      if(response.success===true){plan=validatePlan(response.plan,{width,height,durationFrames});measurement=response.measurement;}
    }
    const scene=compilePlan(plan,{width,height,durationFrames}),workDirectory=path.join(directory,'semantic-quality');
    const deps=renderSerialise?{render:(document,options)=>renderSerialise(()=>require('./render').renderReference(document,options),accountPlan,{signal})}:{};
    const verified=await verify({scene,framesDirectory,workDirectory,ffmpegPath,signal},deps);
    const nativeCount=scene.layers.filter(layer=>layer.text).length;
    semantic=semanticReport(plan,verified.quality.visualComparison==='PASS'?'NATIVE_RENDER_VERIFIED':'NOT_CERTIFIED');
    const quality={...verified.quality,nativeTextCount:nativeCount,
      textRemoval:nativeCount&&verified.evidence.allHiddenBackgroundMaxDelta===0?'NATIVE_SCENE_NO_SOURCE_RASTER':'NOT_RUN',
      hiddenBackgroundMaxDelta:verified.evidence.allHiddenBackgroundMaxDelta};
    const analysis=attachProviderAnalysis({method:'gemini-video-native-reconstruction-v1',scope:'Gemini video analysis, measured native primitives and actual all-frame render comparison',frameCount:durationFrames,fps:30,width,height,anchorFrame:0,cards:[],backgroundConfidence:verified.evidence.flatBorderFraction,
      quality,warnings:['Gemini confidence describes its interpretation, not reconstruction quality. Acceptance uses independently rendered frames.',
        'Only supported native geometry and readable words are reconstructed. No source video or photographic background is hidden inside the scene.',
        'Occluded objects, photographic assets, perspective, unsupported effects and audio are not certified. Review the actual output before export.'],
      metadata:{modelInvocations:0,networkRequests:0,modelDownloads:0,tracking:measurement?'Gemini semantic identity plus actual foreground pixel measurements':'Gemini semantic plan; independent rendered-frame verification'}},provided.metadata,semantic,started);
    await onEvidence?.({plan,scene,analysis,measurement,verification:verified.evidence,workDirectory});
    return {accepted:quality.visualComparison==='PASS',worker:{success:quality.visualComparison==='PASS',scene,assets:[],analysis},provider:provided.metadata,semantic};
  }catch(error){
    if(signal?.aborted)throw signal.reason||error;
    // Provider/key/quota errors occurred before this try and remain explicit.
    // Only a valid analysis with unsupported or nonmatching geometry may try a
    // measured local adapter; never replace it with a generic preset.
    if(error instanceof SyntaxError||String(error?.code||'').startsWith('SC_REFERENCE_PLAN')||error?.code==='SC_REFERENCE_SCHEMA'||String(error?.code||'').startsWith('REFERENCE_VISUAL_')){
      await onEvidence?.({plan,semantic,measurement,rejectedCode:error.code||'INVALID_MEASURED_OUTPUT'});
      return {accepted:false,worker:null,provider:provided.metadata,semantic,rejectedCode:error.code||'INVALID_MEASURED_OUTPUT'};
    }
    throw error;
  }
}
module.exports={createCandidate,semanticReport,attachProviderAnalysis};
