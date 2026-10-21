"""Pixel-measured vector reconstruction for flat-background motion graphics.

Not semantic segmentation, native OCR or a universal inverse renderer. Color
groups are explicitly grouped vector artwork. No raster/video replay is put in
the output. Contours, holes, alpha changes and measured similarity transforms
are closed numeric data. All-frame foreground and appearance gates stay honest.
"""
import json
import base64
import math
import os
from pathlib import Path
import sys
import time

os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['OMP_NUM_THREADS'] = '1'
import cv2
import numpy as np


def background_probe(frames):
    observations = []
    supports = []
    for index in sorted(set(np.linspace(0, len(frames)-1, min(9, len(frames))).astype(int))):
        image = cv2.imread(str(frames[index]))
        image = cv2.resize(image, (192, 108), interpolation=cv2.INTER_AREA)
        edge = np.concatenate((image[:3].reshape(-1, 3), image[-3:].reshape(-1, 3), image[:, :3].reshape(-1, 3), image[:, -3:].reshape(-1, 3)))
        bins, counts = np.unique(edge//8, axis=0, return_counts=True)
        color = bins[np.argmax(counts)]
        selected = np.max(np.abs(edge.astype(float)-(color*8+4)), axis=1) < 10
        supports.append(float(selected.mean()))
        observations.append(np.median(edge[selected], axis=0))
    colors = np.array(observations)
    if min(supports) < .80 or np.max(np.ptp(colors, axis=0)) > 6:
        return None
    return np.round(np.median(colors, axis=0)).astype(np.uint8), min(supports)


def palette_from(frames, background, size):
    samples, core_samples, supports = [], [], {}
    for index in sorted(set(np.linspace(0, len(frames)-1, min(10, len(frames))).astype(int))):
        image = cv2.resize(cv2.imread(str(frames[index])), size, interpolation=cv2.INTER_AREA)
        delta = np.max(np.abs(image.astype(float)-background), axis=2)
        neighborhood = np.ones((3, 3), np.uint8)
        local_range = cv2.dilate(image, neighborhood).astype(np.int16)-cv2.erode(image, neighborhood).astype(np.int16)
        core = (delta > 30) & (np.max(local_range, axis=2) <= 5)
        core_values = image[core][::max(1, np.count_nonzero(core)//5000)]
        core_samples.append(core_values)
        for bucket in np.unique(core_values//8, axis=0):
            key = tuple(map(int, bucket))
            supports[key] = supports.get(key, 0)+1
        all_values = image[delta > 30]
        samples.append(all_values[::max(1, len(all_values)//3000)])
    values = np.concatenate(samples)
    core_values = np.concatenate(core_samples)
    if len(values) < 20:
        return []
    quantized = (values//8).astype(np.int32)
    codes = quantized[:, 0]*1024+quantized[:, 1]*32+quantized[:, 2]
    histogram = np.bincount(codes, minlength=32768)
    active = np.flatnonzero(histogram)
    counts = histogram[active]
    candidates = np.stack([np.bincount(codes, weights=values[:, channel], minlength=32768)[active]/counts for channel in range(3)], axis=1)
    colors = []
    def add(candidate):
        if len(colors) < 12 and np.linalg.norm(candidate-background) >= 35 and not any(np.linalg.norm(candidate-color) < 30 for color in colors):
            colors.append(candidate)
    # Repeated uniform interior colors are genuine observed fills. Preserve
    # dark fills separately from brighter collinear outline colors.
    core_bins, core_counts = np.unique(core_values//8, axis=0, return_counts=True)
    for index in np.argsort(core_counts)[::-1]:
        if supports.get(tuple(map(int, core_bins[index])), 0) < 3 or core_counts[index] < 20:
            continue
        core = core_values[np.all(core_values//8 == core_bins[index], axis=1)]
        add(np.median(core, axis=0))
        if len(colors) >= 8:
            break
    # Thin text/outline colors may have no eroded interior. Select measured
    # RGB convex-direction extrema, not dozens of antialias gray intermediates.
    eligible = candidates[counts >= max(10, len(values)*.001)]
    if len(eligible):
        import itertools
        delta = eligible-background
        for direction in itertools.product((-1, 0, 1), repeat=3):
            if direction == (0, 0, 0):
                continue
            projection = delta@np.array(direction)
            index = int(np.argmax(projection))
            if projection[index] > 35:
                add(eligible[index])
    return np.array(colors, np.float32)


def separate_colors(image, background, colors):
    delta = image.astype(np.float32)-background
    foreground = np.max(np.abs(delta), axis=2) > 12
    best = np.full(foreground.shape, 1e9, np.float32)
    labels = np.full(foreground.shape, -1, np.int16)
    alpha = np.zeros(foreground.shape, np.float32)
    for index, color in enumerate(colors):
        direction = color-background
        strength = np.clip(np.sum(delta*direction, axis=2)/max(1, np.sum(direction**2)), 0, 1)
        error = np.linalg.norm(delta-strength[:, :, None]*direction, axis=2)+(1-strength)*.25
        better = foreground & (strength > .01) & (error < best)
        labels[better] = index
        alpha[better] = strength[better]
        best[better] = error[better]
    labels[best > 35] = -1
    return labels, alpha, foreground


def adapt_colors(image, background, colors, previous_labels):
    """Follow measured hue changes only in isolated, uniform moving regions.

    A palette learned at a few times missed intermediate cyan-to-green frames.
    Require strong spatial identity plus a uniform observed interior; never
    reassign a textured or multicolor component as a single opaque color.
    """
    result = colors.copy()
    if previous_labels is None:
        return result
    foreground = (np.max(np.abs(image.astype(float)-background), axis=2) > 12).astype(np.uint8)
    count, components, stats, _ = cv2.connectedComponentsWithStats(foreground)
    prior_counts = np.bincount(previous_labels[previous_labels >= 0], minlength=len(colors))
    for component in range(1, count):
        if stats[component, cv2.CC_STAT_AREA] < 40:
            continue
        left, top, width, height = stats[component, :4]
        region = components[top:top+height, left:left+width] == component
        prior = previous_labels[top:top+height, left:left+width]
        known = prior[region]
        known = known[known >= 0]
        if len(known) < np.count_nonzero(region)*.70:
            continue
        groups, counts = np.unique(known, return_counts=True)
        group = int(groups[np.argmax(counts)])
        if counts.max()/len(known) < .80:
            continue
        old_count = prior_counts[group]
        if counts.max()/max(1, old_count) < .80:
            continue
        # The component touches its own ROI boundary. OpenCV's default erosion
        # border would retain that boundary, so a thin differently colored
        # outline contaminated the supposedly uniform interior. Exclude it
        # explicitly rather than relaxing the uniformity or visual gates.
        # Chroma subsampling can spread an outline several pixels inward.
        # Measure a scale-aware interior (bounded to eight pixels), not the
        # contaminated rim; the removed rim itself is still traced/rendered.
        guard = max(2, min(8, round(min(width, height)*.10)))
        core = cv2.erode(region.astype(np.uint8), np.ones((guard*2+1, guard*2+1), np.uint8),
                         borderType=cv2.BORDER_CONSTANT, borderValue=0) > 0
        values = image[top:top+height, left:left+width][core]
        if len(values) < 20:
            continue
        observed = np.median(values, axis=0)
        # Lossy VP9/H.264 can vary an otherwise uniform fill by 9..13 RGB
        # levels. Estimate its robust observed center rather than freezing the
        # hue track because of those codec blocks. Large gradients/textures
        # still fail this fit; independent all-frame appearance/coverage gates
        # below are unchanged and decide acceptance, not this estimator.
        residual = np.abs(values.astype(float)-observed)
        if np.max(np.median(residual, axis=0)) > 5 or np.max(np.percentile(residual, 95, axis=0)) > 16:
            continue
        if np.linalg.norm(observed-background) > 35:
            result[group] = observed
    return result


def measure(mask):
    moments = cv2.moments(mask, binaryImage=True)
    area = moments['m00']
    if area < 3:
        return None
    center = np.array([moments['m10']/area, moments['m01']/area])
    covariance = np.array([[moments['mu20'], moments['mu11']], [moments['mu11'], moments['mu02']]])/area
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    anisotropy = (eigenvalues[1]-eigenvalues[0])/max(1, eigenvalues[1])
    angle = math.atan2(eigenvectors[1, 1], eigenvectors[0, 1]) if anisotropy > .15 else 0
    return center, area, angle


def similarity(template, current_mask, current_measure):
    old_center, old_area, old_angle = template['measure']
    center, area, angle = current_measure
    scale = math.sqrt(area/old_area)
    if not .15 < scale < 6:
        return None
    difference = angle-old_angle
    difference = (difference+math.pi/2) % math.pi-math.pi/2
    c, s = math.cos(difference)*scale, math.sin(difference)*scale
    matrix = np.array([[c, -s, 0], [s, c, 0]], np.float32)
    matrix[:, 2] = center-matrix[:, :2]@old_center
    proposed = cv2.warpAffine(template['mask'], matrix, (current_mask.shape[1], current_mask.shape[0]), flags=cv2.INTER_NEAREST) > 0
    current = current_mask > 0
    union = np.count_nonzero(proposed | current)
    overlap = np.count_nonzero(proposed & current)/max(1, union)
    return (matrix, overlap)


def contours_for(mask):
    # Trace pixel *boundaries*, not pixel-center contour lines. The old method
    # discarded one-pixel strokes/points as zero-area polygons (and failed real
    # fade/reveal frames). A 2x cell expansion preserves their actual footprint.
    expanded = cv2.resize(mask, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)
    expanded = cv2.dilate(expanded, np.ones((2, 2), np.uint8))
    contours, _ = cv2.findContours(expanded, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    polygons = []
    for contour in contours:
        if abs(cv2.contourArea(contour)) < .25:
            continue
        points = cv2.approxPolyDP(contour, .75, True)[:, 0].astype(np.float32)/2
        points[:, 0] = np.clip(points[:, 0], 0, mask.shape[1])
        points[:, 1] = np.clip(points[:, 1], 0, mask.shape[0])
        if len(points) >= 3:
            polygons.append(points)
    return polygons


def shape_data(polygons):
    return {'vertices': [float(value) for polygon in polygons for point in polygon for value in point],
            'ends': np.cumsum([len(polygon) for polygon in polygons]).astype(int).tolist()}


def encode_path(points):
    encoded = bytearray()
    previous = [0, 0]
    for index, point in enumerate(points):
        axis = index % 2
        value = int(round(point*2))
        delta = value-previous[axis]
        previous[axis] = value
        number = delta*2 if delta >= 0 else -delta*2-1
        while number >= 128:
            encoded.append((number & 127) | 128)
            number >>= 7
        encoded.append(number)
    return base64.b64encode(encoded).decode('ascii')


def mask_from_shape(shape, size):
    vertices = np.array(shape['vertices'], np.float32).reshape(-1, 2)
    start = 0
    polygons = []
    for end in shape['ends']:
        polygons.append(np.round(vertices[start:end]*2).astype(np.int32))
        start = end
    mask = np.zeros((size[1]*2, size[0]*2), np.uint8)
    if polygons:
        cv2.drawContours(mask, polygons, -1, 255, thickness=cv2.FILLED)
    return cv2.resize(mask, size, interpolation=cv2.INTER_AREA)


def process(request):
    started = time.monotonic()
    cv2.setNumThreads(1)
    if request.get('version') != 1:
        raise ValueError('Unsupported vector analysis request')
    source, output = Path(request['framesDirectory']), Path(request['outputDirectory'])
    if not source.is_absolute() or not output.is_absolute() or not source.is_dir() or not output.is_dir():
        raise ValueError('Use existing server-owned frame and output directories')
    frames = sorted(source.glob('frame-*.png'))
    if not 2 <= len(frames) <= 300 or len(frames) != request['durationFrames'] or request['fps'] != 30:
        raise ValueError('Use 2..300 actual 30fps frames')
    width, height = request['width'], request['height']
    if any(isinstance(value, bool) or not isinstance(value, int) for value in (width, height)) or min(width, height) < 64 or width*height > 2100000:
        raise ValueError('Unsupported verified video dimensions')
    measured_background = background_probe(frames)
    if measured_background is None:
        return {'success': False, 'code': 'VECTOR_BACKGROUND_UNSUPPORTED'}
    background, confidence = measured_background
    factor = min(1, 384/max(width, height))
    size = (max(16, round(width*factor)), max(16, round(height*factor)))
    colors = palette_from(frames, background, size)
    if len(colors) == 0:
        return {'success': False, 'code': 'VECTOR_FOREGROUND_UNSUPPORTED'}
    anchor_colors = colors.copy()
    def empty_group():
        return {'templates': [], 'records': [], 'shapeKeys': [], 'colorKeys': [], 'observed': 0}
    groups = [empty_group() for _ in colors]
    all_metrics = []
    previous_labels = None
    canvas_corners = np.float32([[0, 0], [size[0], 0], [size[0], size[1]], [0, size[1]]])
    to_source = np.array([width/size[0], height/size[1]])
    for frame, filename in enumerate(frames):
        original = cv2.imread(str(filename))
        if original is None or original.shape[:2] != (height, width):
            raise ValueError('Decoded frame metadata differs from verified video')
        image = cv2.resize(original, size, interpolation=cv2.INTER_AREA)
        colors = adapt_colors(image, background, colors, previous_labels)
        # A fill may change hue while its outline retains the original color.
        # Keep the observed palette endpoints available instead of converting
        # both fill and outline to the new fill color. Newly needed groups have
        # an explicitly invisible history, never a copy of prior source frames.
        for anchor_color in anchor_colors:
            if min(np.linalg.norm(anchor_color-color) for color in colors) <= 20:
                continue
            if len(colors) >= 12:
                return {'success': False, 'code': 'VECTOR_PALETTE_UNSUPPORTED'}
            colors = np.concatenate((colors, anchor_color[None]))
            group = empty_group()
            group['records'] = [{'frame': prior, 'quad': canvas_corners*to_source, 'opacity': 0}
                                for prior in range(frame)]
            group['shapeKeys'] = [{'frame': 0, 'shape': 0}]
            color_hex = '#%02x%02x%02x' % tuple(anchor_color[::-1].astype(int))
            group['colorKeys'] = [{'frame': 0, 'color': color_hex}]
            groups.append(group)
        labels, alpha, actual_foreground = separate_colors(image, background, colors)
        previous_labels = labels
        composite = np.empty_like(image)
        composite[:] = background
        reconstructed_foreground = np.zeros(image.shape[:2], np.uint8)
        for index, group in enumerate(groups):
            color_hex = '#%02x%02x%02x' % tuple(colors[index][::-1].astype(int))
            if not group['colorKeys'] or group['colorKeys'][-1]['color'] != color_hex:
                group['colorKeys'].append({'frame': frame, 'color': color_hex})
            mask = (labels == index).astype(np.uint8)*255
            measurement = measure(mask)
            matrix = np.float32([[1, 0, 0], [0, 1, 0]])
            shape_index = group['shapeKeys'][-1]['shape'] if group['shapeKeys'] else 0
            opacity = 0
            if measurement is not None:
                opacity = float(np.quantile(alpha[mask > 0], .90))
                group['observed'] += 1
                candidates = []
                for position in range(max(0, len(group['templates'])-5), len(group['templates'])):
                    fitted = similarity(group['templates'][position], mask, measurement)
                    if fitted is not None:
                        candidates.append((fitted[1], position, fitted[0]))
                best = max(candidates, key=lambda item: item[0]) if candidates else None
                if best is not None and best[0] >= .965:
                    _, shape_index, matrix = best
                else:
                    polygons = contours_for(mask)
                    if polygons:
                        data = shape_data(polygons)
                        if len(data['vertices']) > 8192 or len(data['ends']) > 512 or len(group['templates']) >= 151:
                            return {'success': False, 'code': 'VECTOR_COMPLEXITY_UNSUPPORTED',
                                    'diagnostic': {'frame': frame, 'group': index, 'coordinateCount': len(data['vertices']),
                                                   'contourCount': len(data['ends']), 'templates': len(group['templates'])}}
                        shape_index = len(group['templates'])
                        group['templates'].append({'mask': mask_from_shape(data, size), 'measure': measurement, 'data': data})
                    else:
                        opacity = 0
            quad = cv2.transform(canvas_corners[None], matrix)[0]*to_source
            group['records'].append({'frame': frame, 'quad': quad, 'opacity': opacity})
            if not group['shapeKeys'] or group['shapeKeys'][-1]['shape'] != shape_index:
                group['shapeKeys'].append({'frame': frame, 'shape': shape_index})
            if opacity > 0 and group['templates']:
                recovered = cv2.warpAffine(group['templates'][shape_index]['mask'], matrix, size, flags=cv2.INTER_LINEAR)
                coverage = recovered.astype(np.float32)[:, :, None]/255*opacity
                composite = np.round(colors[index]*coverage+composite*(1-coverage)).astype(np.uint8)
                reconstructed_foreground |= (recovered > 32).astype(np.uint8)
        absolute = np.abs(composite.astype(float)-image.astype(float))
        halo = np.ones((3, 3), np.uint8)
        source_mask = actual_foreground.astype(np.uint8)
        # Explicit small-object coverage gate: a mostly black output cannot pass
        # merely because the requested drawing occupies few canvas pixels.
        recall = float(np.count_nonzero(source_mask & cv2.dilate(reconstructed_foreground, halo))/max(1, np.count_nonzero(source_mask))) if np.any(source_mask) else 1.
        precision = float(np.count_nonzero(reconstructed_foreground & cv2.dilate(source_mask, halo))/max(1, np.count_nonzero(reconstructed_foreground))) if np.any(reconstructed_foreground) else (1. if not np.any(source_mask) else 0.)
        mse = float(np.mean((composite.astype(float)-image.astype(float))**2))
        all_metrics.append({'frame': frame, 'meanAbsoluteError': round(float(absolute.mean()), 3), 'psnrDb': round(10*math.log10(255**2/max(1e-9, mse)), 3),
                            'changedPixelFractionOver30': round(float(np.mean(absolute.max(axis=2) > 30)), 4), 'foregroundRecall': recall, 'foregroundPrecision': precision})
        if frame in (0, len(frames)//4, len(frames)//2, len(frames)*3//4, len(frames)-1):
            cv2.imwrite(str(output/('comparison-'+str(frame).zfill(6)+'.png')), np.concatenate((image, composite, np.clip(absolute*3, 0, 255).astype(np.uint8)), axis=1))
    import importlib.util
    location = Path(__file__).resolve().parent/'analyze-worker.py'
    spec = importlib.util.spec_from_file_location('reference_card_math', location)
    card_math = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(card_math)
    layers = []
    cards = []
    for index, group in enumerate(groups):
        if not group['templates']:
            continue
        keys = group['shapeKeys']
        if keys[-1]['frame'] != len(frames)-1:
            keys.append({'frame': len(frames)-1, 'shape': keys[-1]['shape']})
        color_keys = group['colorKeys']
        if color_keys[-1]['frame'] != len(frames)-1:
            color_keys.append({'frame': len(frames)-1, 'color': color_keys[-1]['color']})
        identity = 'vector-'+str(index+1)
        # Share observed contour paths across shape/reveal frames. This retains
        # native numeric geometry instead of flattening to frames or relaxing
        # the website's existing 256 KiB saved-project limit.
        paths, path_ids, shapes = [], {}, []
        for template in group['templates']:
            data, begin, references = template['data'], 0, []
            for end in data['ends']:
                points = data['vertices'][begin*2:end*2]
                pairs = [points[i:i+2] for i in range(0, len(points), 2)]
                first = min(range(len(pairs)), key=lambda i: (pairs[i][1], pairs[i][0]))
                pairs = pairs[first:]+pairs[:first]
                points = [value for pair in pairs for value in pair]
                identity_key = json.dumps(points, separators=(',', ':'))
                if identity_key not in path_ids:
                    path_ids[identity_key] = len(paths)
                    paths.append(encode_path(points))
                references.append(path_ids[identity_key])
                begin = end
            shapes.append({'paths': references})
        layers.append({'id': identity, 'label': 'Grouped vector artwork '+str(index+1), 'assetId': None,
                       'width': size[0], 'height': size[1], 'zIndex': index, 'visible': True,
                       'offset': {'x': 0, 'y': 0}, 'scale': 1, 'rotation': 0, 'opacity': 1, 'lighting': None,
                       'keyframes': card_math.compress_records(group['records'], pixel_tolerance=.1),
                       'vector': {'fill': None, 'colorKeyframes': color_keys,
                                  'paths': paths, 'shapes': shapes, 'keyframes': keys}})
        cards.append({'id': identity, 'confidence': round(confidence, 4), 'observedCoverage': 1, 'trackedFrameRatio': round(group['observed']/len(frames), 4),
                      'screenshotInternalText': 'GROUPED_NOT_NATIVE'})
    scene = {'format': 'shortscraft-reference-motion', 'version': 3, 'width': width, 'height': height, 'fps': 30,
             'durationFrames': len(frames), 'background': '#%02x%02x%02x' % tuple(background[::-1]), 'layers': layers}
    failed = [item for item in all_metrics if item['meanAbsoluteError'] >= 12 or item['changedPixelFractionOver30'] >= .12 or item['foregroundRecall'] < .90 or item['foregroundPrecision'] < .90]
    worst = max(all_metrics, key=lambda item: item['meanAbsoluteError'])
    chosen = {0, len(frames)//4, len(frames)//2, len(frames)*3//4, len(frames)-1, worst['frame']}
    comparisons = [{key: item[key] for key in ('frame', 'meanAbsoluteError', 'psnrDb', 'changedPixelFractionOver30')} for item in all_metrics if item['frame'] in chosen]
    (output/'all-frame-comparisons.json').write_text(json.dumps(all_metrics, separators=(',', ':')), encoding='utf-8')
    quality = {'state': 'REVIEW_REQUIRED', 'visualComparison': 'FAIL' if failed else 'PASS', 'exactRecreation': False,
               'nativeText': 'GROUPED_NOT_NATIVE', 'audioReconstruction': 'NOT_RUN', 'zOrder': 'REVIEW_REQUIRED',
               'comparedFrameCount': len(frames), 'comparisonWidth': size[0], 'comparisonHeight': size[1], 'worstFrame': worst['frame'],
               'meanAbsoluteError': round(float(np.mean([item['meanAbsoluteError'] for item in all_metrics])), 3),
               'maxMeanAbsoluteError': max(item['meanAbsoluteError'] for item in all_metrics),
               'maxChangedPixelFractionOver30': max(item['changedPixelFractionOver30'] for item in all_metrics), 'failedFrameCount': len(failed),
               'minForegroundRecall': round(min(item['foregroundRecall'] for item in all_metrics), 4),
               'minForegroundPrecision': round(min(item['foregroundPrecision'] for item in all_metrics), 4), 'comparisons': comparisons}
    return {'success': bool(layers), 'scene': scene, 'assets': [], 'analysis': {'method': 'local-flat-vector-v1',
            'scope': 'Measured animated vector color groups; not semantic object separation or native OCR text', 'frameCount': len(frames),
            'fps': 30, 'width': width, 'height': height, 'anchorFrame': 0, 'backgroundConfidence': round(confidence, 4), 'cards': cards,
            'warnings': ['Artwork is grouped by observed color, not independently identified characters, products or words.',
                         'Text outlines remain vector artwork, not native editable text. Color, visibility, motion offset and scale are editable.',
                         'No raster source, video sequence or original foreground remains in the background.',
                         'Flat background and limited palette only. Gradients, reflections, glows and complex footage need other adapters.',
                         'Layer order and unobserved occlusion are not semantically certified.', 'Audio is not reconstructed.'],
            'quality': quality, 'metadata': {'networkRequests': 0, 'modelInvocations': 0, 'modelDownloads': 0,
                                          'elapsedSeconds': round(time.monotonic()-started, 3),
                                          'tracking': 'Observed color alpha masks, traced contours/holes and mask-verified moment similarity'}}}


if __name__ == '__main__':
    try:
        print(json.dumps(process(json.loads(sys.stdin.read(65536))), allow_nan=False, separators=(',', ':')))
    except Exception as error:
        print(json.dumps({'success': False, 'code': 'VECTOR_ANALYSIS_FAILED', 'error': type(error).__name__+': '+str(error)[:160]}))
        sys.exit(1)
