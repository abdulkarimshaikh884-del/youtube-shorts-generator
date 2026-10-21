"""Bounded V4 flat-artwork adapter with color-independent component identity.

The input is decoded, verified video pixels, not source programs or model output.
Tracks are *observed connected artwork*, not semantic people/products. Touching,
merging or ambiguously crossing tracks are rejected. Opaque flat paints only;
this adapter does not certify unseen geometry, gradients or contextual repair.
"""
import base64
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time

os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['OMP_NUM_THREADS'] = '1'
import cv2
import numpy as np


MAX_LAYERS = 12
MAX_PAINTS = 12
MAX_SIDE = 640
MAX_PATHS = 4096
MAX_SHAPES = 151


class Unsupported(Exception):
    def __init__(self, code, diagnostic=None):
        super().__init__(code)
        self.code = code
        self.diagnostic = diagnostic or {}


def _background(frames):
    colors, supports = [], []
    for index in sorted(set(np.linspace(0, len(frames)-1, min(9, len(frames))).astype(int))):
        image = cv2.resize(cv2.imread(str(frames[index])), (192, 108), interpolation=cv2.INTER_AREA)
        edge = np.concatenate((image[:3].reshape(-1, 3), image[-3:].reshape(-1, 3), image[:, :3].reshape(-1, 3), image[:, -3:].reshape(-1, 3)))
        bins, counts = np.unique(edge//8, axis=0, return_counts=True)
        candidate = bins[np.argmax(counts)]*8+4
        selected = np.max(np.abs(edge.astype(float)-candidate), axis=1) < 10
        supports.append(float(selected.mean()))
        if not np.any(selected):
            raise Unsupported('TRACK_BACKGROUND_UNSUPPORTED')
        colors.append(np.median(edge[selected], axis=0))
    if min(supports) < .80 or np.max(np.ptp(colors, axis=0)) > 6:
        raise Unsupported('TRACK_BACKGROUND_UNSUPPORTED')
    return np.round(np.median(colors, axis=0)).astype(np.uint8), min(supports)


def _components(image, background):
    foreground = np.max(np.abs(image.astype(np.int16)-background), axis=2) > 12
    count, labels, stats, centers = cv2.connectedComponentsWithStats(foreground.astype(np.uint8), connectivity=8)
    result = []
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] < 3:
            continue
        x, y, width, height, area = map(int, stats[index])
        component = labels == index
        if np.max(np.abs(image[component].astype(np.int16)-background)) < 32:
            continue
        moments = cv2.moments(component.astype(np.uint8), binaryImage=True)
        covariance = np.array([[moments['mu20'], moments['mu11']], [moments['mu11'], moments['mu02']]])/max(1, area)
        eigenvalues, eigenvectors = np.linalg.eigh(covariance)
        anisotropy = (eigenvalues[1]-eigenvalues[0])/max(1, eigenvalues[1])
        angle = math.atan2(eigenvectors[1, 1], eigenvectors[0, 1]) if anisotropy > .20 else 0.
        result.append({'mask': component.astype(np.uint8), 'box': (x, y, width, height),
                       'area': area, 'center': centers[index].copy(), 'angle': angle})
    if len(result) > MAX_LAYERS:
        raise Unsupported('TRACK_COMPONENT_LIMIT', {'components': len(result)})
    return result, foreground


def _predict(track, frame, size):
    latest = track['last']
    gap = frame-latest['frame']
    velocity = track['velocity']
    matrix = np.float32([[1, 0, velocity[0]*gap], [0, 1, velocity[1]*gap]])
    return cv2.warpAffine(latest['mask'], matrix, size, flags=cv2.INTER_NEAREST) > 0


def _assignment(tracks, observations, frame, size):
    """Mutual best geometry associations, with explicit merge/split rejection.

    Color does not enter any distance, eligibility gate or persistent identity.
    No identity is guessed across an ambiguous tie or unobserved long crossing.
    """
    active = [track for track in tracks if frame-track['last']['frame'] <= 3]
    scores = np.full((len(active), len(observations)), -1., np.float32)
    overlaps = np.zeros_like(scores)
    for row, track in enumerate(active):
        old = track['last']
        prediction = _predict(track, frame, size)
        predicted_center = old['center']+track['velocity']*(frame-old['frame'])
        for column, current in enumerate(observations):
            intersection = np.count_nonzero(prediction & (current['mask'] > 0))
            overlaps[row, column] = intersection/max(1, min(old['area'], current['area']))
            ratio = current['area']/old['area']
            distance = np.linalg.norm(current['center']-predicted_center)
            diagonal = math.hypot(old['box'][2], old['box'][3])
            if not .20 <= ratio <= 5 or distance > max(12, diagonal*.45):
                continue
            scale = math.sqrt(ratio)
            angle = (current['angle']-old['angle']+math.pi/2) % math.pi-math.pi/2
            cosine, sine = math.cos(angle)*scale, math.sin(angle)*scale
            matrix = np.float32([[cosine, -sine, 0], [sine, cosine, 0]])
            matrix[:, 2] = current['center']-matrix[:, :2]@old['center']
            normalized = cv2.warpAffine(old['mask'], matrix, size, flags=cv2.INTER_NEAREST) > 0
            mask = current['mask'] > 0
            iou = np.count_nonzero(normalized & mask)/max(1, np.count_nonzero(normalized | mask))
            if iou < .45:
                continue
            scores[row, column] = float(iou-.15*distance/max(8, diagonal)-.035*abs(math.log(ratio)))
    # Two previously separate visible tracks becoming one is not separation.
    if overlaps.size:
        if np.any(np.sum(overlaps > .35, axis=0) > 1):
            raise Unsupported('TRACK_MERGE_AMBIGUOUS', {'frame': frame})
        if np.any(np.sum(overlaps > .35, axis=1) > 1):
            raise Unsupported('TRACK_SPLIT_AMBIGUOUS', {'frame': frame})
    matches, used = {}, set()
    for column in range(len(observations)):
        if not active:
            break
        ranking = np.argsort(scores[:, column])[::-1]
        row = int(ranking[0])
        if scores[row, column] < .50:
            continue
        if len(ranking) > 1 and scores[row, column]-scores[ranking[1], column] < .12:
            raise Unsupported('TRACK_IDENTITY_AMBIGUOUS', {'frame': frame})
        columns = np.argsort(scores[row])[::-1]
        if int(columns[0]) != column:
            raise Unsupported('TRACK_IDENTITY_AMBIGUOUS', {'frame': frame})
        if len(columns) > 1 and scores[row, column]-scores[row, columns[1]] < .12:
            raise Unsupported('TRACK_IDENTITY_AMBIGUOUS', {'frame': frame})
        if row in used:
            raise Unsupported('TRACK_IDENTITY_AMBIGUOUS', {'frame': frame})
        matches[column] = active[row]
        used.add(row)
    # An unmatched visible old track overlapping a new shape is a failed match,
    # not permission to silently create a differently named replacement object.
    for row in range(len(active)):
        if row not in used and np.any(overlaps[row] > .25):
            raise Unsupported('TRACK_IDENTITY_UNRESOLVED', {'frame': frame})
    return matches


def _dominant_color(image, mask, background):
    x, y, width, height = cv2.boundingRect(mask)
    guard = max(1, min(7, round(min(width, height)*.08)))
    interior = cv2.erode(mask, np.ones((guard*2+1, guard*2+1), np.uint8),
                         borderType=cv2.BORDER_CONSTANT, borderValue=0) > 0
    values = image[interior]
    if len(values) < 12:
        values = image[mask > 0]
        strength = np.linalg.norm(values.astype(float)-background, axis=1)
        values = values[strength >= np.quantile(strength, .80)]
    if not len(values):
        raise Unsupported('TRACK_PAINT_UNSUPPORTED')
    bins, counts = np.unique(values//8, axis=0, return_counts=True)
    bucket = bins[np.argmax(counts)]
    core = values[np.all(values//8 == bucket, axis=1)]
    color = np.median(core, axis=0).astype(np.float32)
    if np.linalg.norm(color-background) < 20:
        raise Unsupported('TRACK_PAINT_UNSUPPORTED')
    return color


def _paint_masks(image, observation, background, track):
    mask = observation['mask'] > 0
    primary = _dominant_color(image, observation['mask'], background)
    paints = track['paints']
    if not paints:
        paints.append(primary)
        track['anchor_color'] = primary.copy()
    else:
        paints[0] = primary
    # Retain a genuinely observed original paint as an attached outline when
    # the object's interior changes hue. Codec-colored antialias fringe pixels
    # are not a license to invent additional opaque paints every frame.
    anchor = track['anchor_color']
    if np.linalg.norm(primary-anchor) > 24 and len(paints) == 1:
        paints.append(anchor.copy())
    delta = image.astype(np.float32)-background
    def fit(colors):
        best = np.full(mask.shape, 1e6, np.float32)
        labels = np.full(mask.shape, -1, np.int16)
        alpha = np.zeros(mask.shape, np.float32)
        for index, color in enumerate(colors):
            direction = color-background
            strength = np.clip(np.sum(delta*direction, axis=2)/max(1, np.sum(direction**2)), 0, 1)
            error = np.linalg.norm(delta-strength[:, :, None]*direction, axis=2)
            # Prefer the stable primary role for indistinguishable endpoints.
            better = mask & (error+index*.05 < best)
            labels[better], alpha[better] = index, strength[better]
            best[better] = error[better]+index*.05
        return labels, alpha, best
    labels, alpha, residual = fit(paints)
    # Chroma resampling can occupy most of a tiny object's rim. The rejection
    # test concerns a genuinely opaque *interior*, not already traced AA edges.
    interior_guard = max(4, min(10, round(min(observation['box'][2:])*.20)))
    interior = cv2.erode(observation['mask'], np.ones((interior_guard*2+1, interior_guard*2+1), np.uint8),
                         borderType=cv2.BORDER_CONSTANT, borderValue=0) > 0
    if np.count_nonzero(interior) >= 20 and np.mean(residual[interior] > 24) > .04:
        raise Unsupported('TRACK_GRADIENT_OR_TRANSLUCENCY_UNSUPPORTED')
    # A component-wide fade is measurable; spatially varying soft interior is
    # not representable by opaque paint parts and must not become an opaque blob.
    opacity = min(1., float(np.quantile(alpha[mask], .90)))
    return labels, alpha/max(opacity, .01), opacity, [color.copy() for color in paints]


def _contours(alpha, width, height):
    """Subpixel .5 isocontours; no low-alpha dilation or rectangular substitute."""
    padded = np.pad(alpha.astype(np.float32), 2)
    high = cv2.resize(padded, None, fx=4, fy=4, interpolation=cv2.INTER_LINEAR)
    binary = (high >= .5).astype(np.uint8)
    contours, _ = cv2.findContours(binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    result = []
    for contour in contours:
        if len(contour) < 3:
            continue
        points = (cv2.approxPolyDP(contour, .45, True)[:, 0].astype(float)+.5)/4-2
        points[:, 0] = np.clip(points[:, 0], 0, width)
        points[:, 1] = np.clip(points[:, 1], 0, height)
        points = np.round(points*2)/2
        points = points[np.any(points != np.roll(points, 1, axis=0), axis=1)]
        if len(points) < 3 or abs(cv2.contourArea(points.astype(np.float32))) < .125:
            continue
        first = min(range(len(points)), key=lambda index: (points[index, 1], points[index, 0]))
        result.append(np.concatenate((points[first:], points[:first])))
    return result


def _encode(points):
    encoded, previous = bytearray(), [0, 0]
    for index, point in enumerate(points.reshape(-1)):
        axis, value = index % 2, int(round(point*2))
        delta = value-previous[axis]
        previous[axis] = value
        number = delta*2 if delta >= 0 else -delta*2-1
        while number >= 128:
            encoded.append((number & 127) | 128)
            number >>= 7
        encoded.append(number)
    return base64.b64encode(encoded).decode('ascii')


def _raster(polygons, size):
    # Supersampled numerical-polygon proxy, never used as final SVG/MP4 evidence.
    mask = np.zeros((size[1]*8, size[0]*8), np.uint8)
    if polygons:
        contours = [np.round(points*8-.5).astype(np.int32) for points in polygons]
        cv2.drawContours(mask, contours, -1, 255, thickness=cv2.FILLED)
    return cv2.resize(mask, size, interpolation=cv2.INTER_AREA).astype(np.float32)/255


def _compact(keys, equal):
    result = []
    for key in keys:
        if not result or not equal(key, result[-1]):
            result.append(key)
    if result[-1]['frame'] != keys[-1]['frame']:
        result.append(keys[-1])
    return result


def process(request):
    started = time.monotonic()
    cv2.setNumThreads(1)
    native = None
    try:
        native = _prepare_native(request)
        try:
            return _process(request, started, native)
        except Unsupported:
            if native is None or not native['layers']:
                raise
            return _grouped_native_fallback(request, native, started)
    except Unsupported as error:
        return {'success': False, 'code': error.code, 'diagnostic': error.diagnostic,
                'analysis': {'method': 'local-connected-artwork-v4', 'metadata': {'networkRequests': 0,
                             'modelInvocations': native['metadata'].get('actualOcrCalls', 0) if native is not None else 0, 'modelDownloads': 0,
                             'elapsedSeconds': round(time.monotonic()-started, 3)}}}


def _process(request, started, native=None):
    if request.get('version') != 1:
        raise ValueError('Unsupported tracked analysis request')
    source, output = Path(request['framesDirectory']), Path(request['outputDirectory'])
    if not source.is_absolute() or not output.is_absolute() or not source.is_dir() or not output.is_dir():
        raise ValueError('Use existing server-owned frame/output directories')
    frames = sorted(source.glob('frame-*.png'))
    width, height = request['width'], request['height']
    if any(isinstance(value, bool) or not isinstance(value, int) for value in (width, height)) or min(width, height) < 64 or width*height > 2100000:
        raise ValueError('Unsupported verified video dimensions')
    if request['fps'] != 30 or len(frames) != request['durationFrames'] or not 2 <= len(frames) <= 300:
        raise ValueError('Use 2..300 actual30fps frames')
    background, background_confidence = _background(frames)
    scale = min(1., MAX_SIDE/max(width, height))
    size = (round(width*scale), round(height*scale))
    tracks, images = [], []
    for frame, filename in enumerate(frames):
        original = cv2.imread(str(filename))
        if original is None or original.shape[:2] != (height, width):
            raise ValueError('Decoded frame metadata differs from verified video')
        image = native['images'][frame] if native is not None else cv2.resize(original, size, interpolation=cv2.INTER_AREA)
        images.append(image)
        observations, _ = _components(image, background)
        matches = _assignment(tracks, observations, frame, size)
        for index, observation in enumerate(observations):
            track = matches.get(index)
            if track is None:
                if len(tracks) >= MAX_LAYERS:
                    raise Unsupported('TRACK_LAYER_LIMIT', {'frame': frame})
                track = {'id': 'object-'+str(len(tracks)+1), 'observations': {}, 'velocity': np.zeros(2), 'paints': []}
                tracks.append(track)
            elif frame-track['last']['frame'] > 1:
                track['velocity'] *= .5
            if 'last' in track:
                elapsed = frame-track['last']['frame']
                track['velocity'] = .5*track['velocity']+.5*(observation['center']-track['last']['center'])/elapsed
            observation['frame'] = frame
            track['last'] = observation
            stored = {key: value for key, value in observation.items() if key != 'mask'}
            stored['mask_bits'] = np.packbits(observation['mask'])
            track['observations'][frame] = stored
    if not tracks and not (native is not None and native['layers']):
        raise Unsupported('TRACK_FOREGROUND_UNSUPPORTED')
    composites = [value.copy() for value in native['rendered']] if native is not None else [np.full_like(image, background) for image in images]
    layers, reports = [], []
    total_paints, decoded_values = 0, 0
    source_factor = np.array([width/size[0], height/size[1]])
    card_spec = importlib.util.spec_from_file_location('reference_tracked_math', Path(__file__).with_name('analyze-worker.py'))
    card_math = importlib.util.module_from_spec(card_spec)
    card_spec.loader.exec_module(card_math)
    for track in tracks:
        observations = track['observations']
        canonical_width = max(item['box'][2] for item in observations.values())
        canonical_height = max(item['box'][3] for item in observations.values())
        canonical = (canonical_width, canonical_height)
        paths, path_map, shapes, shape_map = [], {}, [], {}
        records, shape_keys, color_history = [], [], []
        first = observations[min(observations)]
        last_box = first['box']
        for frame, image in enumerate(images):
            stored = observations.get(frame)
            observation = None if stored is None else dict(stored, mask=np.unpackbits(stored['mask_bits'], count=size[0]*size[1]).reshape(size[1], size[0]))
            parts, polygons_by_paint, opacity = [], [], 0.
            if observation is not None:
                labels, alpha, opacity, colors = _paint_masks(image, observation, background, track)
                if total_paints+len(track['paints']) > MAX_PAINTS:
                    raise Unsupported('TRACK_PAINT_LIMIT', {'frame': frame})
                x, y, local_width, local_height = observation['box']
                last_box = observation['box']
                while len(color_history) < len(colors):
                    color_history.append([])
                for paint, color in enumerate(colors):
                    hex_color = '#%02x%02x%02x' % tuple(np.clip(np.round(color[::-1]), 0, 255).astype(int))
                    color_history[paint].append({'frame': frame, 'color': hex_color})
                    coverage = np.where(labels == paint, alpha, 0)[y:y+local_height, x:x+local_width]
                    coverage = cv2.resize(coverage, canonical, interpolation=cv2.INTER_LINEAR)
                    polygons = _contours(coverage, canonical_width, canonical_height)
                    references = []
                    for polygon in polygons:
                        encoded = _encode(polygon)
                        if encoded not in path_map:
                            path_map[encoded] = len(paths)
                            paths.append(encoded)
                            decoded_values += polygon.size
                            if len(paths) > MAX_PATHS or decoded_values > 100000:
                                raise Unsupported('TRACK_GEOMETRY_LIMIT', {'frame': frame})
                        references.append(path_map[encoded])
                    if references:
                        parts.append({'paint': paint, 'paths': references})
                        polygons_by_paint.append((paint, polygons))
                if len(parts) > 512:
                    raise Unsupported('TRACK_GEOMETRY_LIMIT', {'frame': frame})
                if not parts:
                    raise Unsupported('TRACK_ALPHA_UNRESOLVED', {'frame': frame})
                # Render only the actual numeric polygons; never original image
                # pixels or a saved foreground mask into the reconstructed scene.
                local_composite = composites[frame][y:y+local_height, x:x+local_width]
                for paint, polygons in polygons_by_paint:
                    recovered = _raster(polygons, canonical)
                    recovered = cv2.resize(recovered, (local_width, local_height), interpolation=cv2.INTER_LINEAR)*opacity
                    coverage = recovered[:, :, None]
                    local_composite[:] = np.round(colors[paint]*coverage+local_composite*(1-coverage)).astype(np.uint8)
            x, y, local_width, local_height = last_box
            quad = np.float32([[x, y], [x+local_width, y], [x+local_width, y+local_height], [x, y+local_height]])*source_factor
            records.append({'frame': frame, 'quad': quad, 'opacity': opacity})
            if parts:
                signature = json.dumps(parts, separators=(',', ':'))
                if signature not in shape_map:
                    shape_map[signature] = len(shapes)
                    shapes.append({'parts': parts})
                    if len(shapes) > MAX_SHAPES:
                        raise Unsupported('TRACK_SHAPE_LIMIT', {'frame': frame})
                shape = shape_map[signature]
            else:
                shape = shape_keys[-1]['shape'] if shape_keys else 0
            shape_keys.append({'frame': frame, 'shape': shape})
        paints = []
        for history in color_history:
            if history[0]['frame'] != 0:
                history.insert(0, {'frame': 0, 'color': history[0]['color']})
            if history[-1]['frame'] != len(frames)-1:
                history.append({'frame': len(frames)-1, 'color': history[-1]['color']})
            paints.append({'fill': None, 'colorKeyframes': _compact(history, lambda a, b: a['color'] == b['color'])})
        total_paints += len(paints)
        layers.append({'id': track['id'], 'label': 'Tracked connected artwork '+str(len(layers)+1), 'assetId': None,
                       'width': canonical_width, 'height': canonical_height, 'zIndex': len(layers), 'visible': True,
                       'offset': {'x': 0, 'y': 0}, 'scale': 1, 'rotation': 0, 'opacity': 1, 'lighting': None, 'text': None,
                       'keyframes': card_math.compress_records(records, pixel_tolerance=.05),
                       'vector': {'fill': None, 'paints': paints, 'paths': paths, 'shapes': shapes,
                                  'keyframes': _compact(shape_keys, lambda a, b: a['shape'] == b['shape'])}})
        reports.append({'id': track['id'], 'confidence': round(background_confidence, 4), 'observedCoverage': 1,
                        'trackedFrameRatio': round(len(observations)/len(frames), 4), 'screenshotInternalText': 'GROUPED_NOT_NATIVE'})
    if native is not None:
        layers.extend(native['layers'])
        if len(layers) > MAX_LAYERS:
            raise Unsupported('TRACK_LAYER_LIMIT')
    comparison_images = native['originals'] if native is not None else images
    metrics = []
    for frame, (image, composite) in enumerate(zip(comparison_images, composites)):
        difference = np.abs(image.astype(float)-composite.astype(float))
        source_mask = (np.max(np.abs(image.astype(float)-background), axis=2) > 12).astype(np.uint8)
        output_mask = (np.max(np.abs(composite.astype(float)-background), axis=2) > 12).astype(np.uint8)
        kernel = np.ones((3, 3), np.uint8)
        recall = np.count_nonzero(source_mask & cv2.dilate(output_mask, kernel))/max(1, np.count_nonzero(source_mask))
        precision = np.count_nonzero(output_mask & cv2.dilate(source_mask, kernel))/max(1, np.count_nonzero(output_mask))
        if not np.any(source_mask) and not np.any(output_mask):
            recall = precision = 1.
        mse = float(np.mean(difference**2))
        metrics.append({'frame': frame, 'meanAbsoluteError': round(float(difference.mean()), 3),
                        'changedPixelFractionOver30': round(float(np.mean(difference.max(axis=2) > 30)), 4),
                        'psnrDb': round(10*math.log10(255**2/max(1e-9, mse)), 3),
                        'foregroundRecall': round(float(recall), 4), 'foregroundPrecision': round(float(precision), 4)})
        if frame in (0, len(frames)//4, len(frames)//2, len(frames)*3//4, len(frames)-1):
            cv2.imwrite(str(output/('comparison-'+str(frame).zfill(6)+'.png')),
                        np.concatenate((image, composite, np.clip(difference*3, 0, 255).astype(np.uint8)), axis=1))
    failed = [item for item in metrics if item['meanAbsoluteError'] >= 12 or item['changedPixelFractionOver30'] >= .12 or item['foregroundRecall'] < .90 or item['foregroundPrecision'] < .90]
    worst = max(metrics, key=lambda item: item['meanAbsoluteError'])
    selected = {0, len(frames)//4, len(frames)//2, len(frames)*3//4, len(frames)-1, worst['frame']}
    quality = {'state': 'REVIEW_REQUIRED', 'visualComparison': 'FAIL' if failed else 'PASS', 'exactRecreation': False,
               'nativeText': 'GROUPED_NOT_NATIVE', 'audioReconstruction': 'NOT_RUN', 'zOrder': 'REVIEW_REQUIRED',
               'objectIdentity': 'TRACKED' if tracks else 'NOT_RUN',
               'nativeTextCount': len(native['layers']) if native is not None else 0,
               'textRemoval': 'MASK_EXCLUDED_FLAT_BACKGROUND' if native is not None and native['layers'] else 'NOT_RUN',
               'comparedFrameCount': len(frames), 'comparisonWidth': size[0], 'comparisonHeight': size[1],
               'worstFrame': worst['frame'], 'meanAbsoluteError': round(float(np.mean([item['meanAbsoluteError'] for item in metrics])), 3),
               'maxMeanAbsoluteError': max(item['meanAbsoluteError'] for item in metrics),
               'maxChangedPixelFractionOver30': max(item['changedPixelFractionOver30'] for item in metrics),
               'failedFrameCount': len(failed), 'minForegroundRecall': min(item['foregroundRecall'] for item in metrics),
               'minForegroundPrecision': min(item['foregroundPrecision'] for item in metrics),
               'comparisons': [item for item in metrics if item['frame'] in selected]}
    (output/'all-frame-comparisons.json').write_text(json.dumps(metrics, separators=(',', ':')), encoding='utf-8')
    scene = {'format': 'shortscraft-reference-motion', 'version': 4, 'width': width, 'height': height, 'fps': 30,
             'durationFrames': len(frames), 'background': '#%02x%02x%02x' % tuple(background[::-1]), 'layers': layers}
    if native is not None and native['layers']:
        quality['nativeText'] = 'PARTIAL_NATIVE'
    return {'success': not failed, 'code': 'TRACK_VISUAL_QUALITY_FAIL' if failed else None, 'scene': scene, 'assets': [],
            'analysis': {'method': 'local-connected-artwork-v4', 'scope': 'Stable connected-artwork objects with observed opaque paint parts',
                         'frameCount': len(frames), 'fps': 30, 'width': width, 'height': height, 'anchorFrame': 0,
                         'backgroundConfidence': round(background_confidence, 4), 'cards': reports, 'quality': quality,
                         'warnings': ['Connected foreground groups are not semantic person/product/word identities.',
                                      'Objects have color-independent persistent IDs; edits affect all observed paint parts.',
                                      'Opaque flat paints only. Ambiguous merges, splits, crossings and complex backgrounds are rejected.',
                                      'No hidden original raster/video or inferred occluded object pixels are stored.',
                                      'Text remains grouped unless a separate native-text adapter certifies it. Audio is not reconstructed.',
                                      'Numerical polygon comparison is a proxy; actual SVG/MP4 visual review is still required.'],
                         'metadata': {'networkRequests': 0, 'modelInvocations': native['metadata'].get('actualOcrCalls', 0) if native is not None else 0, 'modelDownloads': 0,
                                      'elapsedSeconds': round(time.monotonic()-started, 3),
                                      'tracking': 'Foreground connected-component masks; color-independent geometry association; .5 alpha isocontours'}}}


def _prepare_native(request):
    """Call real local OCR only when measured disconnected ink suggests text."""
    if request.get('disableNativeText') is True:
        return None
    module_path = Path(__file__).with_name('native-text-worker.py')
    source = Path(request.get('framesDirectory', ''))
    output = Path(request.get('outputDirectory', ''))
    if not module_path.is_file() or not source.is_absolute() or not source.is_dir() or not output.is_absolute() or not output.is_dir():
        return None
    frames = sorted(source.glob('frame-*.png'))
    if not 2 <= len(frames) <= 300 or len(frames) != request.get('durationFrames') or request.get('fps') != 30:
        return None
    width, height = request['width'], request['height']
    factor = min(1., MAX_SIDE/max(width, height))
    size = (round(width*factor), round(height*factor))
    background, confidence = _background(frames)
    text_like = False
    for index in sorted(set(np.linspace(0, len(frames)-1, min(6, len(frames))).astype(int))):
        image = cv2.resize(cv2.imread(str(frames[index])), size, interpolation=cv2.INTER_AREA)
        foreground = (np.max(np.abs(image.astype(np.int16)-background), axis=2) > 12).astype(np.uint8)
        _, _, stats, _ = cv2.connectedComponentsWithStats(foreground)
        if np.count_nonzero(stats[1:, cv2.CC_STAT_AREA] >= 3) >= 4:
            text_like = True
            break
    if not text_like:
        return None
    originals = [cv2.resize(cv2.imread(str(file)), size, interpolation=cv2.INTER_AREA) for file in frames]
    destination = output/'native-text'
    destination.mkdir(exist_ok=True)
    spec = importlib.util.spec_from_file_location('reference_actual_native_text', module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    native = module.detect_native_text(originals, background, fps=30, max_keyframes=6,
                                       output_directory=destination, color_order='BGR', max_layers=3)
    cleaned = [image.copy() for image in originals]
    for image, mask in zip(cleaned, native['masks']):
        image[mask > 0] = background
    factor_to_source = np.array([width/size[0], height/size[1]])
    for layer in native['layers']:
        for key in layer['keyframes']:
            key['corners'] = (np.asarray(key['corners'])*factor_to_source).tolist()
    return dict(native, images=cleaned, originals=originals, background=background, background_confidence=confidence)


def _decode(encoded):
    raw = base64.b64decode(encoded, validate=True)
    values, prior, number, shift = [], [0, 0], 0, 0
    for byte in raw:
        number |= (byte & 127) << shift
        if byte & 128:
            shift += 7
            continue
        delta = number//2 if number % 2 == 0 else -(number+1)//2
        axis = len(values) % 2
        prior[axis] += delta
        values.append(prior[axis]/2)
        number, shift = 0, 0
    return np.asarray(values, np.float32).reshape(-1, 2)


def _sample(keys, frame, field):
    value = keys[0][field]
    for key in keys:
        if key['frame'] > frame:
            break
        value = key[field]
    return value


def _layer_pose(layer, frame):
    keys = layer['keyframes']
    left, right = keys[0], keys[-1]
    for index in range(1, len(keys)):
        if frame <= keys[index]['frame']:
            left, right = keys[index-1], keys[index]
            break
    fraction = (frame-left['frame'])/max(1, right['frame']-left['frame'])
    return (np.asarray(left['corners'], np.float32)*(1-fraction)+np.asarray(right['corners'], np.float32)*fraction,
            left['opacity']*(1-fraction)+right['opacity']*fraction)




def _grouped_native_fallback(request, native, started):
    """Native text plus explicitly *unseparated* residual color artwork.

    The V3 adapter sees only glyph-excluded pixels. Nothing from the original
    selected text is left under a native layer. This fallback never claims
    stable semantic/object identities for its remaining color groups.
    """
    output = Path(request['outputDirectory'])
    residual = output/'text-excluded-frames'
    artifacts = output/'grouped-residual'
    residual.mkdir(exist_ok=True)
    artifacts.mkdir(exist_ok=True)
    for index, image in enumerate(native['images']):
        cv2.imwrite(str(residual/('frame-'+str(index+1).zfill(6)+'.png')), image)
    path = Path(__file__).with_name('vector-worker.py')
    spec = importlib.util.spec_from_file_location('reference_grouped_residual', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    work_height, work_width = native['images'][0].shape[:2]
    work_request = dict(request, framesDirectory=str(residual), outputDirectory=str(artifacts), width=work_width, height=work_height)
    result = module.process(work_request)
    if not result.get('scene') or not result.get('analysis', {}).get('quality'):
        raise Unsupported(result.get('code', 'TRACK_GROUPED_RESIDUAL_UNSUPPORTED'))
    scene = result['scene']
    scene['version'], scene['width'], scene['height'] = 4, request['width'], request['height']
    factors = np.array([request['width']/work_width, request['height']/work_height])
    for layer in scene['layers']:
        previous = layer['vector']
        layer['id'] = 'grouped-'+layer['id']
        layer['label'] = 'Grouped artwork (unseparated)'
        layer['text'] = None
        layer['vector'] = {'fill': previous['fill'], 'paints': [{'fill': None, 'colorKeyframes': previous['colorKeyframes']}],
                           'paths': previous['paths'], 'shapes': [{'parts': [{'paint': 0, 'paths': shape['paths']}]} for shape in previous['shapes']],
                           'keyframes': previous['keyframes']}
        for key in layer['keyframes']:
            key['corners'] = (np.asarray(key['corners'])*factors).tolist()
    if len(scene['layers'])+len(native['layers']) > MAX_LAYERS:
        raise Unsupported('TRACK_LAYER_LIMIT')
    # Independent composition from only emitted numeric geometry + the actual
    # packaged-font native text raster. No original residual frame is replayed.
    size = (work_width, work_height)
    composites = [value.copy() for value in native['rendered']]
    for layer in scene['layers']:
        vector = layer['vector']
        paths = [_decode(value) for value in vector['paths']]
        source = np.float32([[0, 0], [layer['width'], 0], [layer['width'], layer['height']], [0, layer['height']]])
        cached = {}
        for frame, composite in enumerate(composites):
            corners, opacity = _layer_pose(layer, frame)
            if opacity <= 0:
                continue
            shape_index = _sample(vector['keyframes'], frame, 'shape')
            if shape_index not in cached:
                cached[shape_index] = [(part['paint'], _raster([paths[index] for index in part['paths']], (layer['width'], layer['height'])))
                                       for part in vector['shapes'][shape_index]['parts']]
            matrix = cv2.getPerspectiveTransform(source, (corners/factors).astype(np.float32))
            for paint_index, alpha in cached[shape_index]:
                color = _sample(vector['paints'][paint_index]['colorKeyframes'], frame, 'color')
                rgb = np.array([int(color[i:i+2], 16) for i in (1, 3, 5)], np.float32)[::-1]
                coverage = cv2.warpPerspective(alpha, matrix, size, flags=cv2.INTER_LINEAR)[:, :, None]*opacity
                composite[:] = np.round(rgb*coverage+composite*(1-coverage)).astype(np.uint8)
    metrics, background = [], native['background']
    for frame, (image, composite) in enumerate(zip(native['originals'], composites)):
        difference = np.abs(image.astype(float)-composite.astype(float))
        source_mask = (np.max(np.abs(image.astype(float)-background), axis=2) > 12).astype(np.uint8)
        output_mask = (np.max(np.abs(composite.astype(float)-background), axis=2) > 12).astype(np.uint8)
        kernel = np.ones((3, 3), np.uint8)
        recall = np.count_nonzero(source_mask & cv2.dilate(output_mask, kernel))/max(1, np.count_nonzero(source_mask))
        precision = np.count_nonzero(output_mask & cv2.dilate(source_mask, kernel))/max(1, np.count_nonzero(output_mask))
        if not np.any(source_mask) and not np.any(output_mask):
            recall = precision = 1.
        metrics.append({'frame': frame, 'meanAbsoluteError': round(float(difference.mean()), 3),
                        'changedPixelFractionOver30': round(float(np.mean(difference.max(axis=2) > 30)), 4),
                        'psnrDb': round(10*math.log10(255**2/max(1e-9, float(np.mean(difference**2)))), 3),
                        'foregroundRecall': round(float(recall), 4), 'foregroundPrecision': round(float(precision), 4)})
        if frame in (0, len(composites)//4, len(composites)//2, len(composites)*3//4, len(composites)-1):
            cv2.imwrite(str(output/('comparison-'+str(frame).zfill(6)+'.png')),
                        np.concatenate((image, composite, np.clip(difference*3, 0, 255).astype(np.uint8)), axis=1))
    failed = [item for item in metrics if item['meanAbsoluteError'] >= 12 or item['changedPixelFractionOver30'] >= .12 or item['foregroundRecall'] < .90 or item['foregroundPrecision'] < .90]
    worst = max(metrics, key=lambda item: item['meanAbsoluteError'])
    quality = result['analysis']['quality']
    quality.update({'state': 'REVIEW_REQUIRED', 'visualComparison': 'FAIL' if failed else 'PASS', 'nativeText': 'PARTIAL_NATIVE',
                    'objectIdentity': 'NOT_RUN', 'nativeTextCount': len(native['layers']), 'textRemoval': 'MASK_EXCLUDED_FLAT_BACKGROUND',
                    'comparisonWidth': work_width, 'comparisonHeight': work_height, 'worstFrame': worst['frame'],
                    'meanAbsoluteError': round(float(np.mean([item['meanAbsoluteError'] for item in metrics])), 3),
                    'maxMeanAbsoluteError': max(item['meanAbsoluteError'] for item in metrics),
                    'maxChangedPixelFractionOver30': max(item['changedPixelFractionOver30'] for item in metrics),
                    'failedFrameCount': len(failed), 'minForegroundRecall': min(item['foregroundRecall'] for item in metrics),
                    'minForegroundPrecision': min(item['foregroundPrecision'] for item in metrics),
                    'comparisons': [metrics[index] for index in sorted({0, len(metrics)//2, len(metrics)-1, worst['frame']})]})
    result['analysis']['method'] = 'local-native-text-grouped-artwork-v4'
    for card in result['analysis'].get('cards', []):
        card['id'] = 'grouped-'+card['id']
    result['analysis']['scope'] = 'Verified isolated native text with explicitly unseparated residual color artwork'
    result['analysis']['metadata'].update({'modelInvocations': native['metadata'].get('actualOcrCalls', 0),
                                          'elapsedSeconds': round(time.monotonic()-started, 3),
                                          'tracking': 'Actual local OCR glyph exclusion; residual artwork remains unseparated color groups'})
    result['analysis']['warnings'].insert(0, 'Native text is editable only at verified observed frames. Residual artwork has no certified stable object identity.')
    scene['layers'].extend(native['layers'])
    result['success'] = not failed
    result['code'] = 'TRACK_VISUAL_QUALITY_FAIL' if failed else None
    (output/'all-frame-comparisons.json').write_text(json.dumps(metrics, separators=(',', ':')), encoding='utf-8')
    return result


if __name__ == '__main__':
    try:
        print(json.dumps(process(json.loads(sys.stdin.read(65536))), allow_nan=False, separators=(',', ':')))
    except Exception as error:
        print(json.dumps({'success': False, 'code': 'TRACK_ANALYSIS_FAILED', 'error': type(error).__name__+': '+str(error)[:160]}))
        sys.exit(1)
