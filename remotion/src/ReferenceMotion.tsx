import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {ReferenceLayer, ReferenceScene, frameState, homographyMatrix, lightingState, vectorState, vectorColor, multipartState, multipartColor, validateScene} from '../../reference-motion/schema';
import {decodePath} from '../../reference-motion/vector-paths';

export type ReferenceMotionProps = {
  scene: ReferenceScene;
  images: Record<string, string>;
  watermark?: boolean;
  fontData?: string;
  serifFontData?: string;
};

const referenceFonts = new Map<string, Promise<void>>();
function useReferenceFont(font: 'noto-sans' | 'latin-modern-roman', data?: string) {
  const source = data || (font==='latin-modern-roman'?'/reference-motion/fonts/latin-modern-roman.otf':'/reference-motion/fonts/noto-sans.ttf');
  const family = font==='latin-modern-roman'?'SC Reference Latin Modern':'SC Reference Noto Sans';
  if (data && (!/^data:font\/(ttf|otf);base64,[A-Za-z0-9+/]+=*$/.test(data) || data.length > 6 * 1024 * 1024)) throw Error('Invalid controlled reference font');
  const [ready, setReady] = useState(false), [handle] = useState(() => delayRender('Load bundled OFL reference font'));
  useLayoutEffect(() => {
    let active = true, task = referenceFonts.get(source);
    if (!task) {
      task = (async () => {const face = new FontFace(family, `url("${source}")`, {weight: font==='latin-modern-roman'?'400':'100 900'}); await face.load(); document.fonts.add(face);})();
      referenceFonts.set(source, task); task.catch(() => referenceFonts.delete(source));
    }
    task.then(() => {if (active) {setReady(true); continueRender(handle);}}).catch(error => {if (active) cancelRender(error);});
    return () => {active = false; continueRender(handle);};
  }, [source, handle, family, font]);
  return ready;
}

function imageSource(value: string | undefined): string {
  // These values are hydrated by the authenticated app; they never come from
  // model-generated scene JSON. Reject remote fetches and active image formats.
  if (typeof value !== 'string') throw new Error('Missing private reference image asset');
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) && value.length <= 16 * 1024 * 1024) return value;
  if (/^\/(?!\/)[A-Za-z0-9_/-]+\.(png|jpe?g|webp)$/.test(value) && !value.split('/').some((part) => part === '.' || part === '..')) return value;
  throw new Error('Unsafe reference image asset');
}

// Four bounded gain coefficients affect only this image's RGB, never its alpha.
// Replacement cards therefore keep their own silhouette and do not inherit old
// lettering or a source-video rectangle. Canvas is frame-driven in both Player
// and the fixed server composition; no uploaded shaders or code are executed.
function LitImage({src, width, height, gains, label, style}: {src: string; width: number; height: number; gains: number[]; label: string; style: React.CSSProperties}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState<Uint8ClampedArray | null>(null);
  const [handle] = useState(() => delayRender('Decode private image plane for measured lighting'));
  const released = useRef(false);
  useLayoutEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      try {
        const buffer = document.createElement('canvas');
        buffer.width = width; buffer.height = height;
        const context = buffer.getContext('2d', {willReadFrequently: true});
        if (!context) throw new Error('Image-plane canvas is unavailable');
        context.drawImage(image, 0, 0, width, height);
        setPixels(context.getImageData(0, 0, width, height).data);
      } catch (error) {cancelRender(error as Error);}
    };
    image.onerror = () => {if (active) cancelRender(new Error('Cannot decode private image plane'));};
    image.src = src;
    return () => {active = false; if (!released.current) {continueRender(handle); released.current = true;}};
  }, [src, width, height, handle]);
  useLayoutEffect(() => {
    if (!pixels || !canvas.current) return;
    const context = canvas.current.getContext('2d');
    if (!context) {cancelRender(new Error('Image-plane canvas is unavailable')); return;}
    const result = new ImageData(new Uint8ClampedArray(pixels), width, height);
    const [tl, tr, br, bl] = gains;
    for (let y = 0; y < height; y++) {
      const v = y / Math.max(1, height - 1), left = tl * (1 - v) + bl * v, right = tr * (1 - v) + br * v;
      for (let x = 0; x < width; x++) {
        const u = x / Math.max(1, width - 1), gain = left * (1 - u) + right * u, offset = (y * width + x) * 4;
        result.data[offset] = Math.round(pixels[offset] * gain);
        result.data[offset + 1] = Math.round(pixels[offset + 1] * gain);
        result.data[offset + 2] = Math.round(pixels[offset + 2] * gain);
      }
    }
    context.putImageData(result, 0, 0);
    if (!released.current) {continueRender(handle); released.current = true;}
  }, [pixels, gains, width, height, handle]);
  return <canvas ref={canvas} width={width} height={height} role="img" aria-label={label} style={style}/>;
}

function ImagePlane({layer, src, frame}: {layer: ReferenceLayer; src: string; frame: number}) {
  const state = frameState(layer, frame);
  const matrix = homographyMatrix(layer.width, layer.height, state.corners);
  const style: React.CSSProperties = {position: 'absolute', top: 0, left: 0, width: layer.width, height: layer.height, maxWidth: 'none', objectFit: 'fill', transformOrigin: '0px 0px', transform: `matrix3d(${matrix.join(',')})`, opacity: state.opacity, zIndex: layer.zIndex, visibility: state.visible ? 'visible' : 'hidden'};
  if (layer.lighting) return <LitImage key={src} src={src} width={layer.width} height={layer.height} gains={lightingState(layer, frame)} label={layer.label} style={style}/>;
  return <Img src={src} alt={layer.label} style={style}/>;
}

function VectorPlane({layer,frame}:{layer:ReferenceLayer;frame:number}) {
  const state=frameState(layer,frame),matrix=homographyMatrix(layer.width,layer.height,state.corners);
  const paths=useMemo(()=>layer.vector!.paths.map(value=>{
    const coordinates=decodePath(value,layer.width,layer.height);let d='';
    for(let i=0;i<coordinates.length;i+=2)d+=(i?'L':'M')+coordinates[i]+','+coordinates[i+1];
    return d+'Z';
  }),[layer.vector?.paths,layer.width,layer.height]);
  const multipart = 'paints' in layer.vector!;
  const shape = multipart ? multipartState(layer, frame)! : vectorState(layer,frame)!;
  return <svg role="img" aria-label={layer.label} width={layer.width} height={layer.height} viewBox={`0 0 ${layer.width} ${layer.height}`} style={{position:'absolute',left:0,top:0,overflow:'visible',transformOrigin:'0px 0px',transform:`matrix3d(${matrix.join(',')})`,opacity:state.opacity,zIndex:layer.zIndex,visibility:state.visible?'visible':'hidden'}}>
    {'parts' in shape ? shape.parts.map((part,index)=><path key={index} d={part.paths.map(index=>paths[index]).join('')} fill={multipartColor(layer,part.paint,frame)} fillRule="evenodd"/>) : <path d={shape.paths.map(index=>paths[index]).join('')} fill={vectorColor(layer,frame)} fillRule="evenodd"/>}
  </svg>;
}

function TextPlane({layer, frame, fontData}: {layer: ReferenceLayer; frame: number; fontData?: string}) {
  const text = layer.text!, ready = useReferenceFont(text.font, fontData);
  const family = text.font==='latin-modern-roman'?'SC Reference Latin Modern':'SC Reference Noto Sans';
  const state = frameState(layer, frame), matrix = homographyMatrix(layer.width, layer.height, state.corners);
  // Only shrink long user edits into the existing plane, never expand them past
  // its bounds. Measurement uses the same loaded font in Player and MP4 export.
  const size = useMemo(() => {
    if (!ready) return text.fontSize;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Native text measurement unavailable');
    ctx.font = `${text.fontWeight} ${text.fontSize}px "${family}"`;
    const lines = text.content.split('\n');
    const widest = Math.max(1, ...lines.map(line => ctx.measureText(line).width + Math.max(0, line.length - 1) * text.letterSpacing));
    return text.fontSize * Math.min(1, layer.width / (widest + text.strokeWidth * 2), layer.height / Math.max(1, lines.length * text.fontSize * text.lineHeight + text.strokeWidth * 2));
  }, [ready, text, layer.width, layer.height, family]);
  if (!ready) return null;
  const fit = size / text.fontSize, pad = text.strokeWidth * fit;
  const x = text.align === 'center' ? layer.width / 2 : text.align === 'right' ? layer.width - pad : pad;
  return <svg role="img" aria-label={layer.label} width={layer.width} height={layer.height} viewBox={`0 0 ${layer.width} ${layer.height}`} style={{position:'absolute',left:0,top:0,overflow:'hidden',transformOrigin:'0px 0px',transform:`matrix3d(${matrix.join(',')})`,opacity:state.opacity,zIndex:layer.zIndex,visibility:state.visible?'visible':'hidden'}}>
    <text x={x} y={size+pad} fontFamily={family} fontSize={size} fontWeight={text.fontWeight} letterSpacing={text.letterSpacing*fit} textAnchor={text.align==='center'?'middle':text.align==='right'?'end':'start'} fill={text.fill} stroke={text.strokeColor} strokeWidth={text.strokeWidth*fit} paintOrder="stroke fill" style={{whiteSpace:'pre'}}>{text.content.split('\n').map((line,index)=><tspan key={index} x={x} dy={index ? size * text.lineHeight : 0}>{line}</tspan>)}</text>
  </svg>;
}

// One controlled image plane per observed card. Its screenshot contents remain
// grouped, not falsely advertised as reconstructed native text. There is no
// hidden original movie or duplicate flat background inside this composition.
export const ReferenceMotion: React.FC<ReferenceMotionProps> = ({scene: input, images, watermark = false, fontData, serifFontData}) => {
  const scene = useMemo(() => validateScene(input), [input]);
  const sources = useMemo(() => {
    const result: Record<string, string> = {};
    for (const layer of scene.layers) if(layer.assetId!==null) result[layer.assetId] = imageSource(images[layer.assetId]);
    return result;
  }, [scene, images]);
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  if (fps !== scene.fps) throw new Error('Reference preview/export FPS does not match scene');
  return <AbsoluteFill style={{backgroundColor: scene.background, overflow: 'hidden'}}><div style={{position: 'absolute', top: 0, left: 0, width: scene.width, height: scene.height, transformOrigin: '0px 0px', transform: `scale(${width / scene.width},${height / scene.height})`}}>
    {scene.layers.map((layer) => layer.text ? <TextPlane key={layer.id+':'+layer.text.font} layer={layer} frame={frame} fontData={layer.text.font==='latin-modern-roman'?serifFontData:fontData}/> : layer.vector ? <VectorPlane key={layer.id} layer={layer} frame={frame}/> : <ImagePlane key={layer.id} layer={layer} src={sources[layer.assetId!]} frame={frame}/>)}
    {watermark ? <div style={{position: 'absolute', right: Math.max(12, scene.width * 0.025), bottom: Math.max(12, scene.height * 0.018), padding: '8px 12px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontSize: Math.max(14, scene.width * 0.025), fontWeight: 700, borderRadius: 6, zIndex: 1000}}>ShortsCraft</div> : null}
  </div></AbsoluteFill>;
};
