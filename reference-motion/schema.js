'use strict';

// A closed data contract. Uploaded video/model output never becomes JavaScript,
// CSS, JSX or an asset URL. Asset hydration is an authenticated server concern.
const FORMAT = 'shortscraft-reference-motion';
const {decodePath} = require('./vector-paths');
const {supportedText} = require('./font-coverage');
const LIMITS = Object.freeze({layers: 12, frames: 300, keys: 301, dimension: 4096, bytes: 2 * 1024 * 1024});
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ROOT_KEYS = ['format', 'version', 'width', 'height', 'fps', 'durationFrames', 'background', 'layers'];
const LAYER_KEYS = ['id', 'label', 'assetId', 'width', 'height', 'zIndex', 'visible', 'offset', 'scale', 'rotation', 'opacity', 'keyframes'];

function fail(message) {
  const error = new Error('Invalid reference motion: ' + message);
  error.code = 'SC_REFERENCE_SCHEMA';
  throw error;
}
function object(value, fields, where) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(where + ' must be an object');
  const actual = Object.keys(value);
  if (actual.length !== fields.length || actual.some((field) => !fields.includes(field)) || fields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))) fail(where + ' has missing or unsupported fields');
}
function number(value, min, max, where, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(where + ' is outside its numeric limits');
  return value;
}
function identifier(value, where) {
  if (typeof value !== 'string' || !ID.test(value)) fail(where + ' must be a safe identifier');
  return value;
}
function quad(corners, limit, where) {
  if (!Array.isArray(corners) || corners.length !== 4) fail(where + ' needs TL, TR, BR, BL corners');
  const result = corners.map((p) => {
    if (!Array.isArray(p) || p.length !== 2) fail(where + ' needs two-dimensional points');
    return [number(p[0], -limit, limit, where), number(p[1], -limit, limit, where)];
  });
  // Convex, consistently ordered quads only: no bow-ties, duplicate corners,
  // zero-area crops or concave geometry that a single homography cannot map.
  const cross = result.map((a, i) => {
    const b = result[(i + 1) % 4], c = result[(i + 2) % 4];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  });
  if (cross.some((v) => Math.abs(v) < 0.01) || cross.some((v) => Math.sign(v) !== Math.sign(cross[0]))) fail(where + ' is degenerate, crossed or concave');
  const area = Math.abs(result.reduce((sum, a, i) => {const b = result[(i + 1) % 4]; return sum + a[0] * b[1] - b[0] * a[1];}, 0)) / 2;
  if (area < 0.25) fail(where + ' has insufficient area');
  return result;
}

function validateScene(input) {
  object(input, ROOT_KEYS, 'scene');
  if (input.format !== FORMAT || ![1, 2, 3, 4].includes(input.version)) fail('unsupported format/version');
  const width = number(input.width, 16, LIMITS.dimension, 'width', true);
  const height = number(input.height, 16, LIMITS.dimension, 'height', true);
  if (input.fps !== 30) fail('fps must be 30');
  const durationFrames = number(input.durationFrames, 1, LIMITS.frames, 'durationFrames', true);
  if (typeof input.background !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(input.background)) fail('background must be a six-digit hex color');
  if (!Array.isArray(input.layers) || input.layers.length < 1 || input.layers.length > LIMITS.layers) fail('use 1–12 image planes');
  const limit = 4 * Math.max(width, height), seen = new Set();
  let lightingPixels = 0, paintCount = 0;
  const layers = input.layers.map((layer, index) => {
    const where = 'layer ' + index;
    object(layer, input.version === 4 ? LAYER_KEYS.concat('lighting', 'vector', 'text') : input.version === 3 ? LAYER_KEYS.concat('lighting', 'vector') : input.version === 2 ? LAYER_KEYS.concat('lighting') : LAYER_KEYS, where);
    const id = identifier(layer.id, where + ' id');
    if (seen.has(id)) fail('duplicate layer ID');
    seen.add(id);
    if (typeof layer.label !== 'string' || !layer.label.trim() || layer.label.length > 100 || /[\u0000-\u001f\u007f]/.test(layer.label)) fail(where + ' label is invalid');
    const isVector = input.version >= 3 && layer.vector !== null;
    const isText = input.version === 4 && layer.text !== null;
    if (isVector && isText) fail(where + ' cannot contain both vector artwork and native text');
    const assetId = isVector || isText ? (layer.assetId === null ? null : fail(where + ' native layer cannot hide a raster asset')) : identifier(layer.assetId, where + ' assetId');
    const planeWidth = number(layer.width, 1, LIMITS.dimension, where + ' width', true);
    const planeHeight = number(layer.height, 1, LIMITS.dimension, where + ' height', true);
    const zIndex = number(layer.zIndex, -999, 999, where + ' zIndex', true);
    if (typeof layer.visible !== 'boolean') fail(where + ' visible must be boolean');
    object(layer.offset, ['x', 'y'], where + ' offset');
    const offset = {x: number(layer.offset.x, -limit, limit, where + ' x offset'), y: number(layer.offset.y, -limit, limit, where + ' y offset')};
    const scale = number(layer.scale, 0.05, 4, where + ' scale');
    const rotation = number(layer.rotation, -360, 360, where + ' rotation');
    const opacity = number(layer.opacity, 0, 1, where + ' opacity');
    if (!Array.isArray(layer.keyframes) || layer.keyframes.length < (durationFrames === 1 ? 1 : 2) || layer.keyframes.length > LIMITS.keys) fail(where + ' needs ordered, bounded keyframes');
    let previous = -1;
    const keyframes = layer.keyframes.map((key, k) => {
      const keyWhere = where + ' key ' + k;
      object(key, ['frame', 'corners', 'opacity'], keyWhere);
      const frame = number(key.frame, 0, durationFrames - 1, keyWhere + ' frame', true);
      if (frame <= previous) fail(where + ' keyframes must increase strictly');
      previous = frame;
      return {frame, corners: quad(key.corners, limit, keyWhere), opacity: number(key.opacity, 0, 1, keyWhere + ' opacity')};
    });
    if (keyframes[0].frame !== 0 || keyframes[keyframes.length - 1].frame !== durationFrames - 1) fail(where + ' keyframes must cover the first and last frames');
    const result = {id, label: layer.label, assetId, width: planeWidth, height: planeHeight, zIndex, visible: layer.visible, offset, scale, rotation, opacity, keyframes};
    if (input.version >= 2) {
      result.lighting = null;
      if (layer.lighting !== null) {
        if (isVector || isText) fail('native artwork cannot carry a raster lighting effect');
        lightingPixels += planeWidth * planeHeight;
        if (planeWidth * planeHeight > 2100000 || lightingPixels > 8500000) fail('lit image planes exceed the decoded-pixel budget');
        object(layer.lighting, ['type', 'keyframes'], where + ' lighting');
        if (layer.lighting.type !== 'bilinear-gain') fail(where + ' lighting type is unsupported');
        const keys = layer.lighting.keyframes;
        if (!Array.isArray(keys) || keys.length < (durationFrames === 1 ? 1 : 2) || keys.length > LIMITS.keys) fail(where + ' lighting needs bounded keyframes');
        let previous = -1;
        result.lighting = {type: 'bilinear-gain', keyframes: keys.map((key) => {
          object(key, ['frame', 'gains'], where + ' lighting key');
          const frame = number(key.frame, 0, durationFrames - 1, where + ' lighting frame', true);
          if (frame <= previous) fail(where + ' lighting frames must increase strictly');
          previous = frame;
          if (!Array.isArray(key.gains) || key.gains.length !== 4) fail(where + ' lighting needs TL TR BR BL gains');
          return {frame, gains: key.gains.map((gain) => number(gain, .4, 1.6, where + ' lighting gain'))};
        })};
        if (keys[0].frame !== 0 || keys[keys.length - 1].frame !== durationFrames - 1) fail(where + ' lighting must cover the first and last frames');
      }
    }
    if (input.version === 3) result.vector = isVector ? validateVector(layer.vector, planeWidth, planeHeight, durationFrames, where) : null;
    if (input.version === 4) {
      result.vector = isVector ? validateMultipartVector(layer.vector, planeWidth, planeHeight, durationFrames, where) : null;
      result.text = isText ? validateText(layer.text, where) : null;
      paintCount += result.vector ? result.vector.paints.length : 0;
      if (paintCount > 12) fail('tracked objects exceed the total paint budget');
    }
    // Valid endpoints alone do not guarantee that interpolated planes stay
    // convex. Check every frame this bounded renderer can actually display.
    for (let frame = 0; frame < durationFrames; frame++) quad(frameState(result, frame).corners, 131072, where + ' interpolated frame ' + frame);
    return result;
  });
  const result = {format: FORMAT, version: input.version, width, height, fps: 30, durationFrames, background: input.background, layers};
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > LIMITS.bytes) fail('scene exceeds its data limit');
  return result;
}

function frameState(layer, frame) {
  if (!Number.isFinite(frame)) fail('frame is not finite');
  const keys = layer.keyframes;
  const value = Math.min(keys[keys.length - 1].frame, Math.max(keys[0].frame, frame));
  let left = keys[0], right = keys[keys.length - 1];
  for (let i = 1; i < keys.length; i++) {
    if (value <= keys[i].frame) {left = keys[i - 1]; right = keys[i]; break;}
  }
  const t = right.frame === left.frame ? 0 : (value - left.frame) / (right.frame - left.frame);
  const corners = left.corners.map((point, i) => [point[0] + (right.corners[i][0] - point[0]) * t, point[1] + (right.corners[i][1] - point[1]) * t]);
  const center = corners.reduce((sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4], [0, 0]);
  const angle = layer.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const transformed = corners.map((point) => {
    const x = (point[0] - center[0]) * layer.scale, y = (point[1] - center[1]) * layer.scale;
    return [center[0] + x * c - y * s + layer.offset.x, center[1] + x * s + y * c + layer.offset.y];
  });
  const opacity = layer.visible ? layer.opacity * (left.opacity + (right.opacity - left.opacity) * t) : 0;
  return {corners: transformed, opacity, visible: layer.visible && opacity > 0};
}

function compactTimeline(keys, deviation) {
  if (keys.length < 3) return keys;
  const selected = new Set([0, keys.length-1]), pending = [[0, keys.length-1]];
  while (pending.length) {
    const [left, right] = pending.pop(); let worst = 1, chosen = -1;
    for (let index = left+1; index < right; index++) {
      const error = deviation(keys[index], keys[left], keys[right], (keys[index].frame-keys[left].frame)/(keys[right].frame-keys[left].frame));
      if (error > worst) {worst = error; chosen = index;}
    }
    if (chosen >= 0) {selected.add(chosen); pending.push([left,chosen],[chosen,right]);}
  }
  return [...selected].sort((a,b)=>a-b).map(index=>keys[index]);
}

function validateVector(input, width, height, durationFrames, where) {
  object(input, ['fill', 'colorKeyframes', 'paths', 'shapes', 'keyframes'], where + ' vector');
  if (input.fill!==null && (typeof input.fill !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(input.fill))) fail('vector fill must be a hex color or no override');
  if(!Array.isArray(input.colorKeyframes)||input.colorKeyframes.length<(durationFrames===1?1:2)||input.colorKeyframes.length>LIMITS.keys)fail('vector color timing is unbounded');
  let lastColor=-1;
  const colorKeyframes=input.colorKeyframes.map(key=>{object(key,['frame','color'],'vector color key');number(key.frame,0,durationFrames-1,'color frame',true);if(key.frame<=lastColor)fail('color frames must increase');lastColor=key.frame;if(typeof key.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(key.color))fail('invalid vector key color');return {frame:key.frame,color:key.color};});
  if(colorKeyframes[0].frame!==0||colorKeyframes[colorKeyframes.length-1].frame!==durationFrames-1)fail('vector colors must cover endpoints');
  if (!Array.isArray(input.shapes) || input.shapes.length < 1 || input.shapes.length > 151) fail('vector shapes exceed their count limit');
  if(!Array.isArray(input.paths)||!input.paths.length||input.paths.length>4096)fail('vector path count exceeded');
  let total = 0;
  const paths=input.paths.map(path=>{total+=decodePath(path,width,height).length;if(total>100000)fail('vector vertex budget exceeded');return path;});
  const shapes = input.shapes.map(shape => {
    object(shape, ['paths'], where + ' vector shape');
    if(!Array.isArray(shape.paths)||!shape.paths.length||shape.paths.length>512)fail('vector contour count exceeded');
    const refs=shape.paths.map(index=>number(index,0,paths.length-1,'vector path index',true));
    if(new Set(refs).size!==refs.length)fail('duplicate vector contours');
    return {paths:refs};
  });
  if (!Array.isArray(input.keyframes) || input.keyframes.length < (durationFrames===1?1:2) || input.keyframes.length > LIMITS.keys) fail('vector timeline needs bounded keyframes');
  let previous = -1;
  const keyframes = input.keyframes.map(key=>{
    object(key,['frame','shape'],'vector key');number(key.frame,0,durationFrames-1,'vector frame',true);number(key.shape,0,shapes.length-1,'vector shape index',true);
    if(key.frame<=previous)fail('vector frames must increase');previous=key.frame;return {frame:key.frame,shape:key.shape};
  });
  if(keyframes[0].frame!==0 || keyframes[keyframes.length-1].frame!==durationFrames-1)fail('vector timeline must cover first and last frame');
  return {fill:input.fill,colorKeyframes,paths,shapes,keyframes};
}

function color(value, where, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) fail(where + ' must be a six-digit hex color');
  return value;
}

function validateColorTimeline(input, durationFrames, where) {
  if (!Array.isArray(input) || input.length < (durationFrames === 1 ? 1 : 2) || input.length > LIMITS.keys) fail(where + ' needs bounded color timing');
  let previous = -1;
  const result = input.map(key => {
    object(key, ['frame', 'color'], where + ' color key');
    const frame = number(key.frame, 0, durationFrames - 1, where + ' color frame', true);
    if (frame <= previous) fail(where + ' color frames must increase strictly');
    previous = frame;
    return {frame, color: color(key.color, where + ' key color')};
  });
  if (result[0].frame !== 0 || result[result.length - 1].frame !== durationFrames - 1) fail(where + ' colors must cover the first and last frames');
  return result;
}

// V4 keeps identity on the layer, not on a global RGB bucket. Each measured
// object owns its paint roles and ordered parts; changing hue does not create a
// new editable object. This is closed geometry data, never uploaded SVG/JS/CSS.
function validateMultipartVector(input, width, height, durationFrames, where) {
  object(input, ['fill', 'paints', 'paths', 'shapes', 'keyframes'], where + ' tracked vector');
  const fill = color(input.fill, where + ' object fill', true);
  if (!Array.isArray(input.paints) || !input.paints.length || input.paints.length > 12) fail(where + ' needs 1-12 bounded paints');
  const paints = input.paints.map((paint, index) => {
    object(paint, ['fill', 'colorKeyframes'], where + ' paint ' + index);
    return {fill: color(paint.fill, where + ' paint fill', true), colorKeyframes: validateColorTimeline(paint.colorKeyframes, durationFrames, where + ' paint ' + index)};
  });
  if (!Array.isArray(input.paths) || !input.paths.length || input.paths.length > 4096) fail(where + ' vector path count exceeded');
  let total = 0;
  const paths = input.paths.map(path => {total += decodePath(path, width, height).length; if (total > 100000) fail(where + ' vector vertex budget exceeded'); return path;});
  if (!Array.isArray(input.shapes) || !input.shapes.length || input.shapes.length > 151) fail(where + ' vector shapes exceed their count limit');
  const shapes = input.shapes.map(shape => {
    object(shape, ['parts'], where + ' vector shape');
    if (!Array.isArray(shape.parts) || !shape.parts.length || shape.parts.length > 512) fail(where + ' vector parts exceed their count limit');
    let references = 0;
    const parts = shape.parts.map(part => {
      object(part, ['paint', 'paths'], where + ' vector part');
      const paint = number(part.paint, 0, paints.length - 1, where + ' part paint', true);
      if (!Array.isArray(part.paths) || !part.paths.length || part.paths.length > 512) fail(where + ' vector contours exceed their count limit');
      references += part.paths.length;
      if (references > 512) fail(where + ' total vector contours exceed their count limit');
      const refs = part.paths.map(index => number(index, 0, paths.length - 1, where + ' vector path index', true));
      if (new Set(refs).size !== refs.length) fail(where + ' duplicate vector contours');
      return {paint, paths: refs};
    });
    return {parts};
  });
  if (!Array.isArray(input.keyframes) || input.keyframes.length < (durationFrames === 1 ? 1 : 2) || input.keyframes.length > LIMITS.keys) fail(where + ' vector timeline needs bounded keyframes');
  let previous = -1;
  const keyframes = input.keyframes.map(key => {
    object(key, ['frame', 'shape'], where + ' vector key');
    const frame = number(key.frame, 0, durationFrames - 1, where + ' vector frame', true), shape = number(key.shape, 0, shapes.length - 1, where + ' vector shape index', true);
    if (frame <= previous) fail(where + ' vector frames must increase strictly');
    previous = frame;
    return {frame, shape};
  });
  if (keyframes[0].frame !== 0 || keyframes[keyframes.length - 1].frame !== durationFrames - 1) fail(where + ' vector timeline must cover the first and last frames');
  return {fill, paints, paths, shapes, keyframes};
}

function validateText(input, where) {
  object(input, ['content', 'font', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'align', 'fill', 'strokeWidth', 'strokeColor'], where + ' native text');
  // Literal text may include explicit line breaks and even HTML-looking words;
  // the renderer must use a React text child, never innerHTML or a CSS string.
  if (typeof input.content !== 'string' || input.content.length > 1024 || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(input.content) || input.content.split('\n').length > 20) fail(where + ' text content is invalid or unbounded');
  if (!['noto-sans', 'latin-modern-roman'].includes(input.font)) fail(where + ' text font is not bundled');
  if (!supportedText(input.content, input.font)) fail(where + ' text has unsupported glyphs for the selected bundled font');
  if (![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(input.fontWeight)) fail(where + ' text font weight is unsupported');
  if (!['left', 'center', 'right'].includes(input.align)) fail(where + ' text alignment is unsupported');
  return {content: input.content, font: input.font, fontWeight: input.fontWeight,
    fontSize: number(input.fontSize, 1, 4096, where + ' text font size'),
    lineHeight: number(input.lineHeight, .5, 3, where + ' text line height'),
    letterSpacing: number(input.letterSpacing, -32, 128, where + ' text letter spacing'),
    align: input.align, fill: color(input.fill, where + ' text fill'),
    strokeWidth: number(input.strokeWidth, 0, 32, where + ' text stroke width'), strokeColor: color(input.strokeColor, where + ' text stroke color')};
}

function vectorState(layer, frame) {
  if (!Number.isFinite(frame)) fail('vector frame is not finite');
  if (!layer.vector || layer.vector.paints) return null;
  const keys = layer.vector.keyframes;
  let selected = keys[0].shape;
  for (const key of keys) {if (key.frame > frame) break; selected = key.shape;}
  return layer.vector.shapes[selected];
}

function vectorColor(layer,frame) {
  if(!Number.isFinite(frame)||!layer.vector||layer.vector.paints)fail('invalid vector color request');
  if(layer.vector.fill!==null)return layer.vector.fill;
  const keys=layer.vector.colorKeyframes;let selected=keys[0].color;
  // Observed paint changes are frame measurements, not guessed easing.
  for(const key of keys){if(key.frame>frame)break;selected=key.color;}
  return selected;
}

function multipartState(layer, frame) {
  if (!Number.isFinite(frame)) fail('tracked vector frame is not finite');
  if (!layer.vector || !layer.vector.paints) return null;
  let selected = layer.vector.keyframes[0].shape;
  for (const key of layer.vector.keyframes) {if (key.frame > frame) break; selected = key.shape;}
  return layer.vector.shapes[selected];
}

function multipartColor(layer, paintIndex, frame) {
  if (!Number.isFinite(frame) || !layer.vector || !layer.vector.paints) fail('invalid tracked vector color request');
  number(paintIndex, 0, layer.vector.paints.length - 1, 'paint index', true);
  if (layer.vector.fill !== null) return layer.vector.fill;
  const paint = layer.vector.paints[paintIndex];
  if (paint.fill !== null) return paint.fill;
  let selected = paint.colorKeyframes[0].color;
  for (const key of paint.colorKeyframes) {if (key.frame > frame) break; selected = key.color;}
  return selected;
}

function assetIds(scene) {return [...new Set(scene.layers.map(layer=>layer.assetId).filter(id=>typeof id==='string'))];}

function retimeScene(input, durationFrames) {
  const scene = validateScene(input);
  number(durationFrames, 1, LIMITS.frames, 'retimed durationFrames', true);
  return validateScene({...scene, durationFrames, layers: scene.layers.map((layer) => {
    // Sample the measured corner track without baking user adjustments into
    // it a second time. Offsets, visibility, scale and opacity remain editable.
    const plain = {...layer, offset: {x: 0, y: 0}, scale: 1, rotation: 0, opacity: 1, visible: true};
    const result = {...layer, keyframes: Array.from({length: durationFrames}, (_, frame) => {
      const sourceFrame = durationFrames === 1 ? 0 : frame * (scene.durationFrames - 1) / (durationFrames - 1);
      const sampled = frameState(plain, sourceFrame);
      return {frame, corners: sampled.corners.map(point=>point.map(value=>Math.round(value*10000)/10000)), opacity: Math.round(sampled.opacity*10000)/10000};
    })};
    // A 10s retime must not expand the same measured curve into megabytes of
    // repeated floating-point JSON and make the existing project unsaveable.
    result.keyframes = compactTimeline(result.keyframes, (key,left,right,t) => Math.max(
      ...key.corners.map((point,index)=>Math.hypot(...point.map((value,axis)=>value-(left.corners[index][axis]*(1-t)+right.corners[index][axis]*t)))/.01),
      Math.abs(key.opacity-(left.opacity*(1-t)+right.opacity*t))/.0002));
    if (layer.lighting) {
      const keys = Array.from({length: durationFrames}, (_, frame) => ({frame, gains: lightingState(layer, durationFrames === 1 ? 0 : frame * (scene.durationFrames - 1) / (durationFrames - 1)).map(value=>Math.round(value*10000)/10000)}));
      result.lighting = {type: 'bilinear-gain', keyframes: compactTimeline(keys, (key,left,right,t)=>Math.max(...key.gains.map((value,index)=>Math.abs(value-(left.gains[index]*(1-t)+right.gains[index]*t))))/.0002)};
    }
    if (layer.vector && layer.vector.paints) {
      const keys = [];
      for (let frame = 0; frame < durationFrames; frame++) {
        const sourceFrame = durationFrames === 1 ? 0 : frame * (scene.durationFrames - 1) / (durationFrames - 1);
        const shape = layer.vector.shapes.indexOf(multipartState(layer, sourceFrame));
        if (!keys.length || keys[keys.length - 1].shape !== shape || frame === durationFrames - 1) keys.push({frame, shape});
      }
      const observed = {...layer, vector: {...layer.vector, fill: null, paints: layer.vector.paints.map(paint => ({...paint, fill: null}))}};
      const paints = layer.vector.paints.map((paint, index) => {
        const colorKeyframes = [];
        for (let frame = 0; frame < durationFrames; frame++) {
          const color = multipartColor(observed, index, durationFrames === 1 ? 0 : frame * (scene.durationFrames - 1) / (durationFrames - 1));
          if (!colorKeyframes.length || colorKeyframes[colorKeyframes.length - 1].color !== color || frame === durationFrames - 1) colorKeyframes.push({frame, color});
        }
        return {...paint, colorKeyframes};
      });
      result.vector = {...layer.vector, keyframes: keys, paints};
    } else if (layer.vector) {
      const keys = [];
      for (let frame=0;frame<durationFrames;frame++) {
        const sourceFrame = durationFrames===1?0:frame*(scene.durationFrames-1)/(durationFrames-1);
        const shape = layer.vector.shapes.indexOf(vectorState(layer,sourceFrame));
        if(!keys.length || keys[keys.length-1].shape!==shape || frame===durationFrames-1)keys.push({frame,shape});
      }
      const colors=[];
      const original={...layer,vector:{...layer.vector,fill:null}};
      for(let frame=0;frame<durationFrames;frame++){
        const color=vectorColor(original,durationFrames===1?0:frame*(scene.durationFrames-1)/(durationFrames-1));
        if(!colors.length||colors[colors.length-1].color!==color||frame===durationFrames-1)colors.push({frame,color});
      }
      result.vector = {...layer.vector,keyframes:keys,colorKeyframes:colors};
    }
    return result;
  })});
}

function lightingState(layer, frame) {
  if (!Number.isFinite(frame)) fail('lighting frame is not finite');
  if (!layer.lighting) return [1, 1, 1, 1];
  const keys = layer.lighting.keyframes;
  const value = Math.max(keys[0].frame, Math.min(keys[keys.length - 1].frame, frame));
  let left = keys[0], right = keys[keys.length - 1];
  for (let index = 1; index < keys.length; index++) if (value <= keys[index].frame) {left = keys[index-1]; right = keys[index]; break;}
  const t = right.frame === left.frame ? 0 : (value-left.frame)/(right.frame-left.frame);
  return left.gains.map((gain, index) => gain+(right.gains[index]-gain)*t);
}

function solve(matrix, rhs) {
  const rows = matrix.map((row, i) => row.concat(rhs[i]));
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let i = col + 1; i < 8; i++) if (Math.abs(rows[i][col]) > Math.abs(rows[pivot][col])) pivot = i;
    if (Math.abs(rows[pivot][col]) < 1e-10) fail('homography cannot be solved');
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    for (let j = col; j <= 8; j++) rows[col][j] /= divisor;
    for (let i = 0; i < 8; i++) if (i !== col) {
      const factor = rows[i][col];
      for (let j = col; j <= 8; j++) rows[i][j] -= factor * rows[col][j];
    }
  }
  return rows.map((row) => row[8]);
}

function homographyMatrix(width, height, corners) {
  number(width, 1, LIMITS.dimension, 'homography width');
  number(height, 1, LIMITS.dimension, 'homography height');
  const target = quad(corners, 131072, 'homography corners');
  const source = [[0, 0], [width, 0], [width, height], [0, height]], matrix = [], rhs = [];
  source.forEach(([x, y], i) => {
    const [u, v] = target[i];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.push(v);
  });
  const h = solve(matrix, rhs);
  const values = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1];
  if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e9)) fail('unstable homography');
  // A pole through the source rectangle is not a valid visible image plane.
  const denominators = source.map(([x, y]) => h[6] * x + h[7] * y + 1);
  if (denominators.some((v) => Math.abs(v) < 1e-7 || Math.sign(v) !== Math.sign(denominators[0]))) fail('homography crosses the camera plane');
  return values;
}

module.exports = {FORMAT, LIMITS, validateScene, frameState, lightingState, vectorState, vectorColor, multipartState, multipartColor, assetIds, retimeScene, homographyMatrix};
