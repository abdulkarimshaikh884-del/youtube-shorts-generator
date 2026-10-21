'use strict';

// Provider output is data, not a program. This adapter never evaluates code,
// accepts asset URLs, guesses a named preset, or embeds the source movie.
const {validateScene} = require('./schema');
const {supportedText} = require('./font-coverage');
const FORMAT = 'shortscraft-reference-plan';
const LIMITS = Object.freeze({elements: 12, keyframes: 61, frames: 300, dimension: 4096, bytes: 256 * 1024, sceneBytes: 248 * 1024});
const UNSUPPORTED_FEATURES = Object.freeze(['PHOTOGRAPHIC_ASSETS', 'THREE_DIMENSIONAL', 'COMPLEX_GRADIENTS', 'PARTICLES', 'BLUR_GLOW', 'MASKING_OCCLUSION', 'CAMERA_PERSPECTIVE', 'SCENE_CUTS', 'AUDIO', 'UNREADABLE_TEXT', 'UNSUPPORTED_GLYPHS', 'OTHER']);
const FONT_IDS = ['noto-sans', 'latin-modern-roman'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const num = (minimum, maximum, integer = false) => ({type: integer ? 'integer' : 'number', minimum, maximum});
const str = (maxLength, extra = {}) => ({type: 'string', maxLength, ...extra});
const obj = properties => ({type: 'object', properties, required: Object.keys(properties), additionalProperties: false});
const nullable = schema => ({anyOf: [schema, {type: 'null'}]});
const hexSchema = str(7, {pattern: '^#[0-9a-fA-F]{6}$'});
const textSchema = obj({content: str(1024), font: {type: 'string', enum: FONT_IDS}, fontWeight: {type: 'integer', enum: [100, 200, 300, 400, 500, 600, 700, 800, 900]}, fontSize: num(1, 4096), lineHeight: num(.5, 3), letterSpacing: num(-32, 128), align: {type: 'string', enum: ['left', 'center', 'right']}, fill: hexSchema, strokeWidth: num(0, 32), strokeColor: hexSchema});
const shapeSchema = obj({kind: {type: 'string', enum: ['rectangle', 'ellipse', 'line', 'polygon']}, points: {type: 'array', minItems: 0, maxItems: 128, items: {type: 'array', minItems: 2, maxItems: 2, items: num(0, 1)}}, strokeWidth: num(0, 128), strokeColor: hexSchema});
const keySchema = obj({frame: num(0, 299, true), x: num(-16384, 16384), y: num(-16384, 16384), width: num(1, 4096), height: num(1, 4096), rotation: num(-1080, 1080), opacity: num(0, 1), fill: hexSchema, strokeWidth: nullable(num(0,128))});

// The provider can use this exact JSON Schema. Semantic cross-field checks are
// intentionally repeated below; an HTTP 200/valid JSON is not visual evidence.
const RESPONSE_SCHEMA = obj({format: {type: 'string', enum: [FORMAT]}, version: {type: 'integer', enum: [1]}, width: num(16, 4096, true), height: num(16, 4096, true), fps: {type: 'integer', enum: [30]}, durationFrames: num(1, 300, true), background: hexSchema,
  analysis: obj({summary: str(1500), motionSummary: str(2000), confidence: num(0, 1), cuts: {type: 'array', maxItems: 16, items: num(0, 299, true)}, unsupportedFeatures: {type: 'array', maxItems: UNSUPPORTED_FEATURES.length, uniqueItems: true, items: {type: 'string', enum: UNSUPPORTED_FEATURES}}}),
  elements: {type: 'array', minItems: 1, maxItems: 12, items: obj({id: str(64, {pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'}), label: str(100), type: {type: 'string', enum: ['shape', 'text']}, zIndex: num(-999, 999, true), width: num(1, 4096, true), height: num(1, 4096, true), shape: nullable(shapeSchema), text: nullable(textSchema), keyframes: {type: 'array', minItems: 1, maxItems: 61, items: keySchema}})}});

function fail(message, code = 'SC_REFERENCE_PLAN') {const error = new Error('Invalid reference semantic plan: ' + message); error.code = code; throw error;}
function object(value, fields, where) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(where + ' must be a plain object');
  const keys = Object.keys(value);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key)) || fields.some(key => !Object.prototype.hasOwnProperty.call(value, key))) fail(where + ' has missing or unsupported fields');
  if (keys.some(key => {const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor.get || descriptor.set;})) fail(where + ' cannot contain accessors');
}
function number(value, min, max, where, integer = false) {if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(where + ' exceeds its numeric bounds'); return value;}
function text(value, maximum, where, empty = false) {if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim()) || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(value)) fail(where + ' is invalid or unbounded'); return value;}
function color(value, where) {if (typeof value !== 'string' || !HEX.test(value)) fail(where + ' must be a six-digit hex color'); return value.toLowerCase();}
function bytes(value, limit, where) {let encoded; try {encoded = JSON.stringify(value);} catch {fail(where + ' cannot be serialized');} if (Buffer.byteLength(encoded, 'utf8') > limit) fail(where + ' exceeds its byte limit');}
function endpoints(values, last, where) {if (!values.length || values[0].frame !== 0 || values[values.length - 1].frame !== last) fail(where + ' must cover the first and last frames');}
function cross(a, b, c) {return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);}
function polygon(points) {
  const area = Math.abs(points.reduce((sum, point, i) => {const next = points[(i + 1) % points.length]; return sum + point[0] * next[1] - point[1] * next[0];}, 0)) / 2;
  if (area < .00001) fail('polygon has no visible area');
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .00001) fail('polygon repeats a vertex');
    for (let j = i + 2; j < points.length; j++) {
      if ((j + 1) % points.length === i) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
      if (abC * abD <= 0 && cdA * cdB <= 0 && Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) && Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))) fail('polygon self-intersects or touches a nonadjacent edge');
    }
  }
}

function validatePlan(input, expected = {}) {
  object(input, ['format', 'version', 'width', 'height', 'fps', 'durationFrames', 'background', 'analysis', 'elements'], 'plan');
  if (input.format !== FORMAT || input.version !== 1 || input.fps !== 30) fail('unsupported format, version or FPS');
  const width = number(input.width, 16, LIMITS.dimension, 'width', true), height = number(input.height, 16, LIMITS.dimension, 'height', true), durationFrames = number(input.durationFrames, 1, LIMITS.frames, 'durationFrames', true), last = durationFrames - 1;
  for (const [field, value] of Object.entries({width, height, durationFrames})) if (expected[field] !== undefined && expected[field] !== value) fail(field + ' does not match the decoded source');
  if (expected.maxFrames !== undefined && durationFrames > number(expected.maxFrames, 1, 300, 'plan frame allowance', true)) fail('duration exceeds the plan allowance');
  object(input.analysis, ['summary', 'motionSummary', 'confidence', 'cuts', 'unsupportedFeatures'], 'analysis');
  const raw = input.analysis;
  if (!Array.isArray(raw.cuts) || raw.cuts.length > 16 || raw.cuts.some((frame, index) => number(frame, 0, last, 'cut frame', true) !== frame || (index && frame <= raw.cuts[index - 1]))) fail('cuts must be ordered and bounded');
  if (!Array.isArray(raw.unsupportedFeatures) || raw.unsupportedFeatures.length > UNSUPPORTED_FEATURES.length || raw.unsupportedFeatures.some(item => !UNSUPPORTED_FEATURES.includes(item)) || new Set(raw.unsupportedFeatures).size !== raw.unsupportedFeatures.length) fail('unsupported features must use the bounded unique vocabulary');
  const analysis = {summary: text(raw.summary, 1500, 'analysis summary'), motionSummary: text(raw.motionSummary, 2000, 'motion summary'), confidence: number(raw.confidence, 0, 1, 'analysis confidence'), cuts: [...raw.cuts], unsupportedFeatures: [...raw.unsupportedFeatures]};
  if (!Array.isArray(input.elements) || !input.elements.length || input.elements.length > LIMITS.elements) fail('use 1-12 elements');
  const ids = new Set(), limit = 4 * Math.max(width, height);
  const elements = input.elements.map((element, index) => {
    const where = 'element ' + index;
    object(element, ['id', 'label', 'type', 'zIndex', 'width', 'height', 'shape', 'text', 'keyframes'], where);
    if (typeof element.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(element.id) || ids.has(element.id)) fail(where + ' needs a unique safe ID'); ids.add(element.id);
    if (!['shape', 'text'].includes(element.type)) fail(where + ' type is unsupported');
    const localWidth = number(element.width, 1, LIMITS.dimension, where + ' width', true), localHeight = number(element.height, 1, LIMITS.dimension, where + ' height', true);
    let shape = null, nativeText = null;
    if (element.type === 'shape') {
      if (element.text !== null) fail(where + ' shape cannot carry text');
      object(element.shape, ['kind', 'points', 'strokeWidth', 'strokeColor'], where + ' shape');
      const source = element.shape;
      if (!['rectangle', 'ellipse', 'line', 'polygon'].includes(source.kind) || !Array.isArray(source.points) || source.points.length > 128) fail(where + ' shape kind/points are unsupported');
      const points = source.points.map(point => {if (!Array.isArray(point) || point.length !== 2) fail(where + ' points must be normalized XY pairs'); return point.map(value => number(value, 0, 1, where + ' point'));});
      if ((['rectangle', 'ellipse'].includes(source.kind) && points.length) || (source.kind === 'line' && points.length !== 2) || (source.kind === 'polygon' && points.length < 3)) fail(where + ' shape points do not match its kind');
      if (source.kind === 'polygon') polygon(points);
      if (source.kind === 'line' && Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]) < .00001) fail(where + ' line has no length');
      const strokeWidth = number(source.strokeWidth, 0, Math.min(128, Math.min(localWidth, localHeight) / 2), where + ' stroke width');
      if (source.kind === 'line' && strokeWidth < .5) fail(where + ' line needs a visible stroke');
      shape = {kind: source.kind, points, strokeWidth, strokeColor: color(source.strokeColor, where + ' stroke color')};
    } else {
      if (element.shape !== null) fail(where + ' text cannot carry geometry');
      object(element.text, Object.keys(textSchema.properties), where + ' text');
      const source = element.text;
      const content = text(source.content, 1024, where + ' text content');
      if (!FONT_IDS.includes(source.font) || !supportedText(content, source.font)) fail(where + ' contains unsupported glyphs/font');
      if (![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(source.fontWeight) || !['left', 'center', 'right'].includes(source.align)) fail(where + ' text style is unsupported');
      nativeText = {content, font: source.font, fontWeight: source.fontWeight, fontSize: number(source.fontSize, 1, 4096, where + ' font size'), lineHeight: number(source.lineHeight, .5, 3, where + ' line height'), letterSpacing: number(source.letterSpacing, -32, 128, where + ' letter spacing'), align: source.align, fill: color(source.fill, where + ' text fill'), strokeWidth: number(source.strokeWidth, 0, 32, where + ' text stroke width'), strokeColor: color(source.strokeColor, where + ' text stroke color')};
    }
    if (!Array.isArray(element.keyframes) || element.keyframes.length < (durationFrames === 1 ? 1 : 2) || element.keyframes.length > LIMITS.keyframes) fail(where + ' keyframes are unbounded');
    let previous = -1;
    const keyframes = element.keyframes.map(key => {
      // Existing plans remain byte-compatible. An optional measured stroke is
      // canvas pixels, not canonical-plane pixels that shrink with the object.
      object(key, Object.keys(keySchema.properties).filter(field=>field!=='strokeWidth'||Object.prototype.hasOwnProperty.call(key,field)), where + ' key');
      const frame = number(key.frame, 0, last, where + ' frame', true); if (frame <= previous) fail(where + ' frames must increase strictly'); previous = frame;
      const result={frame, x: number(key.x, -limit, limit, where + ' center X'), y: number(key.y, -limit, limit, where + ' center Y'), width: number(key.width, 1, 4096, where + ' animated width'), height: number(key.height, 1, 4096, where + ' animated height'), rotation: number(key.rotation, -1080, 1080, where + ' rotation'), opacity: number(key.opacity, 0, 1, where + ' opacity'), fill: color(key.fill, where + ' key fill')};
      if(Object.prototype.hasOwnProperty.call(key,'strokeWidth'))result.strokeWidth=key.strokeWidth===null?null:number(key.strokeWidth,0,Math.min(128,result.width/2,result.height/2),where+' observed stroke width');
      return result;
    });
    const observedStrokes=keyframes.filter(key=>typeof key.strokeWidth==='number').length;
    if(observedStrokes && (observedStrokes!==keyframes.length || !shape || !['rectangle','ellipse'].includes(shape.kind)))fail('observed stroke widths must cover every rectangle or ellipse keyframe');
    endpoints(keyframes, last, where + ' keys');
    return {id: element.id, label: text(element.label, 100, where + ' label'), type: element.type, zIndex: number(element.zIndex, -999, 999, where + ' zIndex', true), width: localWidth, height: localHeight, shape, text: nativeText, keyframes};
  });
  const result = {format: FORMAT, version: 1, width, height, fps: 30, durationFrames, background: color(input.background, 'background'), analysis, elements};
  bytes(result, LIMITS.bytes, 'plan'); return result;
}

const round = value => Math.round(value * 10000) / 10000;
function mixColor(a, b, t) {return '#' + [1, 3, 5].map(index => Math.round(parseInt(a.slice(index, index + 2), 16) * (1 - t) + parseInt(b.slice(index, index + 2), 16) * t).toString(16).padStart(2, '0')).join('');}
function sampleElement(element, frame) {
  const keys = element.keyframes, bounded = Math.max(0, Math.min(keys[keys.length - 1].frame, frame));
  let left = keys[0], right = keys[keys.length - 1];
  for (let index = 1; index < keys.length; index++) if (bounded <= keys[index].frame) {left = keys[index - 1]; right = keys[index]; break;}
  const t = right.frame === left.frame ? 0 : (bounded - left.frame) / (right.frame - left.frame), result = {frame: bounded};
  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'opacity']) result[key] = left[key] * (1 - t) + right[key] * t;
  if(typeof left.strokeWidth==='number'&&typeof right.strokeWidth==='number')result.strokeWidth=left.strokeWidth*(1-t)+right.strokeWidth*t;
  result.fill = mixColor(left.fill, right.fill, t); return result;
}
function encodePath(points) {
  const prior = [0, 0], bytes = [];
  for (const point of points) for (let axis = 0; axis < 2; axis++) {
    const n = Math.round(point[axis] * 2), delta = n - prior[axis]; prior[axis] = n;
    let encoded = delta >= 0 ? delta * 2 : -delta * 2 - 1;
    while (encoded >= 128) {bytes.push((encoded & 127) | 128); encoded >>>= 7;} bytes.push(encoded);
  }
  return Buffer.from(bytes).toString('base64');
}
function perimeter(kind, width, height, inset = 0, insetY = inset) {
  if (kind === 'rectangle') return [[inset, insetY], [width - inset, insetY], [width - inset, height - insetY], [inset, height - insetY]];
  // A real elliptical contour, not a rounded raster crop. More points at large
  // radii bound the geometric chord error; the native codec is half-pixel.
  const segments = Math.max(32, Math.min(512, Math.ceil(Math.PI * Math.sqrt(Math.max(width, height) / .25))));
  return Array.from({length: segments}, (_, index) => {const angle = index / segments * Math.PI * 2; return [width / 2 + (width / 2 - inset) * Math.cos(angle), height / 2 + (height / 2 - insetY) * Math.sin(angle)];});
}
function shapeGeometry(element, sample) {
  const {shape, width, height} = element;
  const insetX=typeof sample?.strokeWidth==='number'?sample.strokeWidth*width/sample.width:shape.strokeWidth;
  const insetY=typeof sample?.strokeWidth==='number'?sample.strokeWidth*height/sample.height:shape.strokeWidth;
  if (shape.kind === 'polygon') {
    if (shape.strokeWidth) fail('stroked polygons require a separate supported outline layer', 'SC_REFERENCE_PLAN_UNSUPPORTED');
    return {paths: [encodePath(shape.points.map(point => [point[0] * width, point[1] * height]))], parts: [{paint: 0, paths: [0]}], stroke: false};
  }
  if (shape.kind === 'line') {
    const [a, b] = shape.points.map(point => [point[0] * width, point[1] * height]), dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), half = shape.strokeWidth / 2;
    const offset = [-dy / length * half, dx / length * half];
    const corners = [[a[0] + offset[0], a[1] + offset[1]], [b[0] + offset[0], b[1] + offset[1]], [b[0] - offset[0], b[1] - offset[1]], [a[0] - offset[0], a[1] - offset[1]]].map(point => [Math.max(0, Math.min(width, point[0])), Math.max(0, Math.min(height, point[1]))]);
    return {paths: [encodePath(corners)], parts: [{paint: 0, paths: [0]}], stroke: false};
  }
  const outer = encodePath(perimeter(shape.kind, width, height));
  if (!insetX && !insetY) return {paths: [outer], parts: [{paint: 0, paths: [0]}], stroke: false};
  const inner = encodePath(perimeter(shape.kind, width, height, insetX, insetY));
  return {paths: [outer, inner], parts: [{paint: 1, paths: [0]}, {paint: 0, paths: [1]}], stroke: true};
}
function compactGeometry(keys) {
  if (keys.length < 3) return keys;
  const selected = new Set([0, keys.length - 1]), pending = [[0, keys.length - 1]];
  while (pending.length) {
    const [leftIndex, rightIndex] = pending.pop(), left = keys[leftIndex], right = keys[rightIndex]; let worst = 1, chosen = -1;
    for (let index = leftIndex + 1; index < rightIndex; index++) {
      const key = keys[index], t = (key.frame - left.frame) / (right.frame - left.frame);
      const error = Math.max(...key.corners.flatMap((point, p) => point.map((value, axis) => Math.abs(value - (left.corners[p][axis] * (1 - t) + right.corners[p][axis] * t)) / .03)), Math.abs(key.opacity - (left.opacity * (1 - t) + right.opacity * t)) / .0001);
      if (error > worst) {worst = error; chosen = index;}
    }
    if (chosen !== -1) {selected.add(chosen); pending.push([leftIndex, chosen], [chosen, rightIndex]);}
  }
  return [...selected].sort((a, b) => a - b).map(index => keys[index]);
}
function compilePlan(input, expected = {}) {
  const plan = validatePlan(input, expected), last = plan.durationFrames - 1;
  if (plan.analysis.unsupportedFeatures.length || plan.analysis.cuts.length) fail('observed unsupported features/cuts cannot be silently omitted: ' + plan.analysis.unsupportedFeatures.join(', '), 'SC_REFERENCE_PLAN_UNSUPPORTED');
  const layers = plan.elements.map(element => {
    const samples = Array.from({length: plan.durationFrames}, (_, frame) => sampleElement(element, frame));
    const keyframes = compactGeometry(samples.map(sample => {
      const angle = sample.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      return {frame: sample.frame, corners: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => {const x = dx * sample.width / 2, y = dy * sample.height / 2; return [round(sample.x + x * c - y * s), round(sample.y + x * s + y * c)];}), opacity: round(sample.opacity)};
    }));
    const layer = {id: element.id, label: element.label, assetId: null, width: element.width, height: element.height, zIndex: element.zIndex, visible: true, offset: {x: 0, y: 0}, scale: 1, rotation: 0, opacity: 1, keyframes, lighting: null, vector: null, text: element.text};
    if (element.type === 'text') {
      if (element.keyframes.some(key => key.fill !== element.text.fill)) fail('animated native text fill is not supported by this scene version', 'SC_REFERENCE_PLAN_UNSUPPORTED');
    } else {
      const dynamic=samples.some(sample=>typeof sample.strokeWidth==='number');
      const geometries=dynamic?samples.map(sample=>shapeGeometry(element,sample)):[shapeGeometry(element)], colorKeyframes = [];
      for (const sample of samples) if (!colorKeyframes.length || colorKeyframes[colorKeyframes.length - 1].color !== sample.fill || sample.frame === last) colorKeyframes.push({frame: sample.frame, color: sample.fill});
      const paints = [{fill: null, colorKeyframes}];
      if (geometries.some(geometry=>geometry.stroke)) paints.push({fill: null, colorKeyframes: last ? [{frame: 0, color: element.shape.strokeColor}, {frame: last, color: element.shape.strokeColor}] : [{frame: 0, color: element.shape.strokeColor}]});
      const paths=[],shapes=[],vectorKeys=[],pathMap=new Map(),shapeMap=new Map();
      for(let index=0;index<geometries.length;index++){
        const geometry=geometries[index],refs=geometry.paths.map(encoded=>{if(!pathMap.has(encoded)){pathMap.set(encoded,paths.length);paths.push(encoded);}return pathMap.get(encoded);});
        const parts=geometry.parts.map(part=>({...part,paths:part.paths.map(local=>refs[local])})),signature=JSON.stringify(parts);
        if(!shapeMap.has(signature)){shapeMap.set(signature,shapes.length);shapes.push({parts});}
        const shape=shapeMap.get(signature),frame=dynamic?index:0;
        if(!vectorKeys.length||vectorKeys[vectorKeys.length-1].shape!==shape||frame===last)vectorKeys.push({frame,shape});
      }
      if(last&&vectorKeys[vectorKeys.length-1].frame!==last)vectorKeys.push({frame:last,shape:vectorKeys[vectorKeys.length-1].shape});
      layer.vector = {fill: null, paints, paths, shapes, keyframes:vectorKeys};
    }
    return layer;
  });
  const scene = validateScene({format: 'shortscraft-reference-motion', version: 4, width: plan.width, height: plan.height, fps: 30, durationFrames: plan.durationFrames, background: plan.background, layers});
  bytes(scene, LIMITS.sceneBytes, 'compiled scene'); return scene;
}

module.exports = {FORMAT, LIMITS, UNSUPPORTED_FEATURES, RESPONSE_SCHEMA, validatePlan, compilePlan, sampleElement};
