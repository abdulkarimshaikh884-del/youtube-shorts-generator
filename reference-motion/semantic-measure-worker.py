"""Bounded pixel calibration of a semantic plan, not object-generation AI.

Only actual foreground masks on an observed flat background are fitted. A
merged/ambiguous component, unsupported shape or poor fit retains the model
track and is explicitly counted as unmeasured. Independent render comparison
is still required: these measurements never certify recreation quality.
"""
import copy
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


def finite(value, low, high):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and low <= value <= high


def rgb(value):
    if not isinstance(value, str) or len(value) != 7 or value[0] != '#':
        raise ValueError('Invalid closed-plan color')
    return np.array([int(value[index:index+2], 16) for index in (1, 3, 5)], np.float64)


def hex_color(value):
    return '#' + ''.join(format(int(round(float(channel))), '02x') for channel in np.clip(value, 0, 255))


def sample(element, frame):
    keys = element['keyframes']
    left, right = keys[0], keys[-1]
    for index in range(1, len(keys)):
        if frame <= keys[index]['frame']:
            left, right = keys[index-1], keys[index]
            break
    t = 0 if right['frame'] == left['frame'] else (frame-left['frame'])/(right['frame']-left['frame'])
    result = {'frame': frame}
    for field in ('x', 'y', 'width', 'height', 'rotation', 'opacity'):
        result[field] = float(left[field])*(1-t)+float(right[field])*t
    if finite(left.get('strokeWidth'), 0, 128) and finite(right.get('strokeWidth'), 0, 128):
        result['strokeWidth'] = float(left['strokeWidth'])*(1-t)+float(right['strokeWidth'])*t
    result['fill'] = hex_color(rgb(left['fill'])*(1-t)+rgb(right['fill'])*t)
    return result


def border_color(image):
    edge = np.concatenate((image[:2].reshape(-1, 3), image[-2:].reshape(-1, 3), image[:, :2].reshape(-1, 3), image[:, -2:].reshape(-1, 3)))
    bins, counts = np.unique(edge//8, axis=0, return_counts=True)
    dominant = bins[int(np.argmax(counts))]*8+4
    selected = np.max(np.abs(edge.astype(float)-dominant), axis=1) < 12
    if selected.mean() < .80:
        return None
    return np.median(edge[selected], axis=0)


def component_candidates(image, background):
    delta = np.max(np.abs(image.astype(np.float32)-background), axis=2)
    mask = (delta > 14).astype(np.uint8)
    count, labels, stats, centers = cv2.connectedComponentsWithStats(mask, 8)
    if count > 2048:
        return [], labels
    candidates = []
    for label in range(1, count):
        x, y, width, height, area = map(int, stats[label])
        if area < 6 or width < 2 or height < 2:
            continue
        candidates.append({'label': label, 'bbox': (x, y, width, height), 'center': centers[label], 'area': area})
    return candidates, labels


def bounds(prediction, scale):
    angle = prediction['rotation']*math.pi/180
    width = abs(prediction['width']*math.cos(angle))+abs(prediction['height']*math.sin(angle))
    height = abs(prediction['width']*math.sin(angle))+abs(prediction['height']*math.cos(angle))
    return (prediction['x']*scale-width*scale/2, prediction['y']*scale-height*scale/2, width*scale, height*scale)


def candidate_score(prediction, candidate, scale):
    px, py, pw, ph = bounds(prediction, scale)
    cx, cy, cw, ch = candidate['bbox']
    expected = max(4, math.hypot(pw, ph))
    distance = math.hypot(candidate['center'][0]-prediction['x']*scale, candidate['center'][1]-prediction['y']*scale)
    if distance > max(14, expected*.65) or cw > max(pw*1.9, pw+24) or ch > max(ph*1.9, ph+24):
        return None
    intersection = max(0, min(px+pw, cx+cw)-max(px, cx))*max(0, min(py+ph, cy+ch)-max(py, cy))
    union = pw*ph+cw*ch-intersection
    iou = intersection/max(1, union)
    if iou < .15:
        return None
    size = abs(math.log(max(1, cw)/max(1, pw)))+abs(math.log(max(1, ch)/max(1, ph)))
    return float(iou-distance/expected*.35-size*.12)


def choose_assignments(predictions, candidates, scale):
    # One actual connected component may never become two independent layers.
    # Mutual, unambiguous matching is deliberately conservative at crossings.
    choices, reverse = {}, {}
    for element_id, prediction in predictions.items():
        ranked = []
        for candidate_index, candidate in enumerate(candidates):
            score = candidate_score(prediction, candidate, scale)
            if score is not None:
                ranked.append((score, candidate_index))
                reverse.setdefault(candidate_index, []).append((score, element_id))
        ranked.sort(reverse=True)
        if ranked and ranked[0][0] > .12 and (len(ranked) == 1 or ranked[0][0]-ranked[1][0] > .10):
            choices[element_id] = ranked[0]
    result = {}
    for element_id, (score, candidate_index) in choices.items():
        competition = sorted(reverse[candidate_index], reverse=True)
        if competition[0][1] != element_id or (len(competition) > 1 and competition[0][0]-competition[1][0] <= .12):
            continue
        result[element_id] = (candidate_index, score)
    return result


def contour_mask(image, labels, candidate, background, stroke=None):
    raw = (labels == candidate['label']).astype(np.uint8)
    core = cv2.erode(raw, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT, borderValue=0).astype(bool)
    values = image[core] if np.count_nonzero(core) >= 6 else image[raw.astype(bool)]
    buckets, counts = np.unique(values//8, axis=0, return_counts=True)
    dominant = buckets[int(np.argmax(counts))]
    selected = values[np.max(np.abs(values.astype(float)-(dominant*8+4)), axis=1) <= 12]
    fill = np.median(selected, axis=0)
    direction = fill-background
    strength = float(direction@direction)
    if strength < 225:
        return None
    difference = image.astype(np.float32)-background
    alpha = (difference@direction)/strength
    residual = np.max(np.abs(difference-alpha[..., None]*direction), axis=2)
    coverage = np.where(residual <= 24, np.clip(alpha, 0, 1), 0)
    luminance = np.array([.114, .587, .299])
    fill_luminance = float(direction@luminance)
    stroke_luminance = float((stroke-background)@luminance) if stroke is not None else fill_luminance
    if min(fill_luminance, stroke_luminance) >= 32 and max(fill_luminance, stroke_luminance)/min(fill_luminance, stroke_luminance) <= 1.12:
        # 4:2:0 video edges may have badly mixed RGB chroma while their full-
        # resolution luminance coverage remains accurate. When the observed
        # palette has matching luminance, that channel identifies coverage
        # without confusing an outline-color residual with opaque halo pixels.
        reference_luminance = (fill_luminance+stroke_luminance)/2
        coverage = np.maximum(coverage, np.clip((difference@luminance)/reference_luminance, 0, 1))
    if stroke is not None:
        stroke_direction = stroke-background
        stroke_strength = float(stroke_direction@stroke_direction)
        if stroke_strength >= 225:
            stroke_alpha = (difference@stroke_direction)/stroke_strength
            stroke_residual = np.max(np.abs(difference-stroke_alpha[..., None]*stroke_direction), axis=2)
            coverage = np.maximum(coverage, np.where(stroke_residual <= 24, np.clip(stroke_alpha, 0, 1), 0))
            palette = np.stack((direction, stroke_direction), axis=1)
            if np.linalg.cond(palette) < 12:
                # Chroma-subsampled source videos mix adjacent fill and outline
                # colors. Recover their combined foreground coverage, rather
                # than rejecting that legitimate mixed edge or calling every
                # unexplained residual a solid foreground pixel.
                weights = difference@np.linalg.pinv(palette).T
                mixture_residual = np.max(np.abs(difference-weights@palette.T), axis=2)
                explained = (mixture_residual <= 28) & (np.min(weights, axis=2) >= -.15)
                coverage = np.maximum(coverage, np.where(explained, np.clip(np.sum(np.maximum(weights, 0), axis=2), 0, 1), 0))
    # A color unexplained by the fill is not automatically opaque. In
    # particular, faint contrasting-outline halos must not expand the fitted
    # silhouette as the object shrinks. Keep only measured half-coverage edges.
    coverage *= raw
    refined = (coverage >= .5).astype(np.uint8)
    contours, _ = cv2.findContours(refined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    outer = np.zeros_like(raw)
    cv2.drawContours(outer, [contour], -1, 1, cv2.FILLED)
    # Work only in the observed component's bounded ROI. Upsampling its measured
    # coverage locates subpixel half-alpha crossings rather than rounding every
    # fitted side to an integer. The offset maps OpenCV pixel centers correctly.
    x, y, width, height = candidate['bbox']
    left, top = max(0, x-2), max(0, y-2)
    right, bottom = min(image.shape[1], x+width+2), min(image.shape[0], y+height+2)
    enlarged = cv2.resize(coverage[top:bottom, left:right].astype(np.float32), None, fx=4, fy=4, interpolation=cv2.INTER_LINEAR)
    fine_contours, _ = cv2.findContours((enlarged >= .5).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if fine_contours:
        contour = max(fine_contours, key=cv2.contourArea).astype(np.float32)
        contour[..., 0] = (contour[..., 0]+.5)/4-.5+left
        contour[..., 1] = (contour[..., 1]+.5)/4-.5+top
    return contour, outer, fill


def rectangle_fit(contour):
    fit = cv2.minAreaRect(contour)
    (center_x, center_y), (width, height), angle = fit
    if min(width, height) < 8 or len(contour) < 32:
        return fit
    points = contour.reshape(-1, 2).astype(np.float64)
    centered = points-np.array([center_x, center_y])

    def projected(degrees):
        radians = math.radians(degrees)
        axes = np.array([[math.cos(radians), math.sin(radians)], [-math.sin(radians), math.cos(radians)]])
        return centered@axes.T, axes

    local, _ = projected(angle)
    angles = []
    for dimension, extent, other in ((0, width, height), (1, height, width)):
        for sign in (-1, 1):
            selected = (np.abs(local[:, dimension]-sign*extent/2) < 2) & (np.abs(local[:, 1-dimension]) < other*.38)
            if np.count_nonzero(selected) < 8:
                continue
            vx, vy, _, _ = cv2.fitLine(points[selected].astype(np.float32), cv2.DIST_HUBER, 0, .01, .01).reshape(-1)
            measured = math.degrees(math.atan2(float(vy), float(vx)))-(90 if dimension == 0 else 0)
            measured = min((measured+180*turn for turn in range(-3, 4)), key=lambda value: abs(value-angle))
            if abs(measured-angle) <= 6:
                angles.append(measured)
    if len(angles) < 3:
        return fit
    angle = float(np.median(angles))
    local, axes = projected(angle)
    edges = []
    for dimension, extent, other in ((0, width, height), (1, height, width)):
        for sign in (-1, 1):
            selected = (np.abs(local[:, dimension]-sign*extent/2) < 2) & (np.abs(local[:, 1-dimension]) < other*.38)
            if np.count_nonzero(selected) < 8:
                return fit
            edges.append(float(np.median(local[selected, dimension])))
    left, right, top, bottom = edges
    if right <= left or bottom <= top:
        return fit
    offset = np.array([(left+right)/2, (top+bottom)/2])@axes
    return ((float(center_x+offset[0]), float(center_y+offset[1])), (right-left, bottom-top), angle)


def orientation(fit, prediction, scale, previous_rotation=None):
    (x, y), (width, height), angle = fit
    target = prediction['rotation'] if previous_rotation is None else previous_rotation
    possibilities = []
    for turns in range(-5, 6):
        rotation = angle+90*turns
        w, h = (width, height) if turns % 2 == 0 else (height, width)
        # Canonical aspect and the semantic/last measured direction disambiguate
        # OpenCV's width-height flips. Geometry, not hue, carries object ID.
        aspect_error = abs(math.log(max(.5, w)/max(.5, h))-math.log(prediction['width']/prediction['height']))
        score = abs(rotation-target)/90+aspect_error*1.8+abs(rotation-prediction['rotation'])/720
        possibilities.append((score, w, h, rotation))
    _, width, height, angle = min(possibilities)
    return {'x': (float(x)+.5)/scale, 'y': (float(y)+.5)/scale, 'width': (float(width)+.25)/scale, 'height': (float(height)+.25)/scale, 'rotation': float(angle)}


def fit_component(image, labels, candidate, element, prediction, background, scale, previous_rotation=None):
    stroke = rgb(element['shape']['strokeColor'])[::-1] if element['shape'].get('strokeWidth', 0) > 0 else None
    measured = contour_mask(image, labels, candidate, background, stroke)
    if measured is None:
        return None
    contour, outer, fill = measured
    kind = element['shape']['kind']
    observed_coverage = np.count_nonzero((labels == candidate['label']) & (outer > 0))/max(1, np.count_nonzero(outer))
    expected_is_hollow = np.max(np.abs(rgb(prediction['fill'])[::-1]-background)) < 24 and element['shape'].get('strokeWidth', 0) > 0
    if observed_coverage < .75:
        if not expected_is_hollow:
            # An outline is not evidence for a solid foreground rectangle.
            return None
        fill = background.copy()
    if kind == 'ellipse':
        if len(contour) < 5:
            return None
        fit = cv2.fitEllipse(contour)
    else:
        fit = rectangle_fit(contour) if kind == 'rectangle' else cv2.minAreaRect(contour)
    # Compare the fitted geometry at pixel centers. Rounding the four fitted
    # vertices and then filling an inclusive OpenCV polygon grows small rotated
    # shapes by a complete pixel, falsely rejecting otherwise accurate fits.
    (fit_x, fit_y), (fit_width, fit_height), fit_angle = fit
    yy, xx = np.indices(outer.shape, dtype=np.float32)
    angle = math.radians(fit_angle)
    local_x = (xx-fit_x)*math.cos(angle)+(yy-fit_y)*math.sin(angle)
    local_y = -(xx-fit_x)*math.sin(angle)+(yy-fit_y)*math.cos(angle)
    half_width, half_height = (fit_width+.25)/2, (fit_height+.25)/2
    if kind == 'ellipse':
        expected = ((local_x/max(.1, half_width))**2+(local_y/max(.1, half_height))**2 <= 1).astype(np.uint8)
    else:
        expected = ((np.abs(local_x) <= half_width) & (np.abs(local_y) <= half_height)).astype(np.uint8)
    intersection = np.count_nonzero((expected > 0) & (outer > 0))
    union = np.count_nonzero((expected > 0) | (outer > 0))
    iou = intersection/max(1, union)
    if iou < (.90 if kind == 'ellipse' else .91):
        return None
    if kind == 'line':
        points = element['shape'].get('points', [])
        if len(points) != 2 or element['shape'].get('strokeWidth', 0) < .5:
            return None
        dx, dy = points[1][0]-points[0][0], points[1][1]-points[0][1]
        expected_length = math.hypot(dx*prediction['width'], dy*prediction['height'])
        if expected_length < 2:
            return None
        (center_x, center_y), (fit_width, fit_height), fit_angle = fit
        if fit_height > fit_width:
            fit_width, fit_height, fit_angle = fit_height, fit_width, fit_angle+90
        observed_length, observed_thickness = (fit_width+.25)/scale, (fit_height+.25)/scale
        ratio = observed_length/expected_length
        canonical_length = math.hypot(dx*element['width'], dy*element['height'])
        expected_thickness = element['shape']['strokeWidth']*(prediction['width']/element['width'])*(prediction['height']/element['height'])*canonical_length/expected_length*ratio
        if abs(observed_thickness-expected_thickness) > max(2/scale, expected_thickness*.30):
            return None
        local_angle = math.degrees(math.atan2(dy*prediction['height'], dx*prediction['width']))
        target_rotation = prediction['rotation'] if previous_rotation is None else previous_rotation
        rotation = min((fit_angle+180*turn-local_angle for turn in range(-7, 8)), key=lambda value: abs(value-target_rotation))
        new_width, new_height = prediction['width']*ratio, prediction['height']*ratio
        midpoint_x = ((points[0][0]+points[1][0])/2-.5)*new_width
        midpoint_y = ((points[0][1]+points[1][1])/2-.5)*new_height
        angle = math.radians(rotation)
        geometry = {'x': (center_x+.5)/scale-midpoint_x*math.cos(angle)+midpoint_y*math.sin(angle),
                    'y': (center_y+.5)/scale-midpoint_x*math.sin(angle)-midpoint_y*math.cos(angle),
                    'width': new_width, 'height': new_height, 'rotation': rotation}
    else:
        geometry = orientation(fit, prediction, scale, previous_rotation)
    if geometry['width'] < 2 or geometry['height'] < 2:
        return None
    result = dict(prediction)
    result.update(geometry)
    result['fill'] = hex_color(fill[::-1])
    if prediction['opacity'] < .98:
        target = rgb(prediction['fill'])[::-1]-background
        denominator = float(target@target)
        estimated = float((fill-background)@target/denominator) if denominator > 225 else -1
        if 0 <= estimated <= 1.05:
            result['fill'] = prediction['fill']
            result['opacity'] = max(0, min(1, estimated))
    return result, float(iou), outer


def measure_stroke(image, labels, candidate, element, record, background, scale):
    if element['shape']['kind'] not in ('rectangle', 'ellipse') or element['shape'].get('strokeWidth', 0) <= 0 or record['opacity'] < .98:
        return None
    fill = rgb(record['fill'])[::-1]-background
    stroke = rgb(element['shape']['strokeColor'])[::-1]-background
    contrast = stroke-fill
    denominator = float(contrast@contrast)
    # Same-color fill/stroke cannot identify outline thickness. Do not pretend
    # that geometry bounds or a semantic guess measured that invisible edge.
    if denominator < 3600:
        return None
    raw = (labels == candidate['label']).astype(np.uint8)
    support = cv2.dilate(raw, np.ones((5, 5), np.uint8)).astype(bool)
    if np.any((labels > 0) & (labels != candidate['label']) & support):
        return None
    observed = np.sum(image[support].astype(np.float64)-background, axis=0)
    width, height = record['width']*scale, record['height']*scale
    factor = math.pi/4 if element['shape']['kind'] == 'ellipse' else 1
    outer_area = width*height*factor
    ring_area = float((observed-fill*outer_area)@contrast/denominator)
    if not 0 < ring_area < outer_area*.8:
        return None
    error = float(np.max(np.abs(observed-fill*outer_area-contrast*ring_area))/max(1, outer_area))
    if error > 6:
        return None
    discriminant = (width+height)**2-4*ring_area/factor
    if discriminant <= 0:
        return None
    thickness = (width+height-math.sqrt(discriminant))/4/scale
    if not .05 <= thickness <= min(128, min(record['width'], record['height'])/4):
        return None
    return {'width': thickness, 'meanColorResidual': error, 'method': 'OBSERVED_COLOR_AREA_MOMENTS'}


def compact(records, maximum=61):
    def error(key, left, right, t, tolerance):
        distances = []
        for field, base in [('x', .30), ('y', .30), ('width', .40), ('height', .40), ('rotation', .20), ('opacity', .008)]:
            distances.append(abs(key[field]-(left[field]*(1-t)+right[field]*t))/(base*tolerance))
        distances.append(float(np.max(np.abs(rgb(key['fill'])-(rgb(left['fill'])*(1-t)+rgb(right['fill'])*t))))/(2*tolerance))
        if 'strokeWidth' in key:
            distances.append(abs(key['strokeWidth']-(left['strokeWidth']*(1-t)+right['strokeWidth']*t))/(.08*tolerance))
        return max(distances)
    for tolerance in [1, 1.5, 2]:
        selected = {0, len(records)-1}
        pending = [(0, len(records)-1)]
        while pending:
            left_index, right_index = pending.pop()
            left, right = records[left_index], records[right_index]
            worst, chosen = 1, None
            for index in range(left_index+1, right_index):
                t = (records[index]['frame']-left['frame'])/(right['frame']-left['frame'])
                deviation = error(records[index], left, right, t, tolerance)
                if deviation > worst:
                    worst, chosen = deviation, index
            if chosen is not None:
                selected.add(chosen)
                pending.extend([(left_index, chosen), (chosen, right_index)])
        if len(selected) <= maximum:
            return [records[index] for index in sorted(selected)], tolerance
    return None, None


def process(request):
    started = time.monotonic()
    if not isinstance(request, dict) or not isinstance(request.get('plan'), dict):
        raise ValueError('Closed semantic plan required')
    plan = copy.deepcopy(request['plan'])
    width, height, count = plan.get('width'), plan.get('height'), plan.get('durationFrames')
    if plan.get('format') != 'shortscraft-reference-plan' or plan.get('version') != 1 or plan.get('fps') != 30 or not finite(width, 16, 4096) or not finite(height, 16, 4096) or not isinstance(count, int) or not 1 <= count <= 300:
        raise ValueError('Unsupported source contract')
    if request.get('width', width) != width or request.get('height', height) != height or request.get('durationFrames', count) != count or request.get('fps', 30) != 30:
        raise ValueError('Decoded source dimensions/timing mismatch')
    if len(json.dumps(plan).encode('utf8')) > 256*1024:
        raise ValueError('Plan byte limit exceeded')
    elements = plan.get('elements')
    if not isinstance(elements, list) or not 1 <= len(elements) <= 12:
        raise ValueError('Element count exceeded')
    identifiers = [element.get('id') for element in elements]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError('Element identity is not unique')
    for element in elements:
        keys = element.get('keyframes')
        if not isinstance(keys, list) or not 1 <= len(keys) <= 61 or keys[0].get('frame') != 0 or keys[-1].get('frame') != count-1:
            raise ValueError('Invalid bounded element timeline')
        previous = -1
        observed_strokes = any(isinstance(key, dict) and key.get('strokeWidth') is not None for key in keys)
        if observed_strokes and (element.get('type') != 'shape' or element.get('shape', {}).get('kind') not in ('rectangle', 'ellipse')):
            raise ValueError('Measured stroke unsupported for this primitive')
        for key in keys:
            if not isinstance(key.get('frame'), int) or not previous < key['frame'] < count:
                raise ValueError('Invalid frame ordering')
            previous = key['frame']
            for field in ('x', 'y', 'width', 'height', 'rotation', 'opacity'):
                if not finite(key.get(field), -16384, 16384):
                    raise ValueError('Invalid numeric key')
            if key['width'] < 1 or key['height'] < 1 or not 0 <= key['opacity'] <= 1:
                raise ValueError('Invalid geometry/opacity')
            if observed_strokes and not finite(key.get('strokeWidth'), 0, min(128, key['width']/2, key['height']/2)):
                raise ValueError('Measured stroke must cover every bounded key')
            rgb(key['fill'])
    frames_root = Path(request['framesDirectory']).resolve(strict=True)
    if not frames_root.is_dir():
        raise ValueError('Frame directory missing')
    frames = sorted(frames_root.glob('frame-*.png'))
    if len(frames) != count:
        raise ValueError('Actual decoded frame count mismatch')
    scale = min(1, 768/max(width, height))
    size = (max(1, round(width*scale)), max(1, round(height*scale)))
    observations = []
    for index in sorted(set(np.linspace(0, count-1, min(count, 7)).astype(int))):
        image = cv2.imread(str(frames[index]))
        if image is None or image.shape[:2] != (height, width):
            raise ValueError('Actual decoded dimensions mismatch')
        color = border_color(cv2.resize(image, size, interpolation=cv2.INTER_AREA))
        if color is None:
            return {'success': True, 'plan': plan, 'measurement': {'method': 'SEMANTIC_GUIDED_PIXEL_FIT', 'reviewRequired': True, 'background': 'UNSUPPORTED_NONUNIFORM', 'framesCompared': 0, 'objects': [], 'modelInvocations': 0}}
        observations.append(color)
    colors = np.array(observations)
    if np.max(np.ptp(colors, axis=0)) > 8:
        return {'success': True, 'plan': plan, 'measurement': {'method': 'SEMANTIC_GUIDED_PIXEL_FIT', 'reviewRequired': True, 'background': 'UNSUPPORTED_CHANGING', 'framesCompared': 0, 'objects': [], 'modelInvocations': 0}}
    background = np.median(colors, axis=0)
    if np.max(np.abs(background-rgb(plan['background'])[::-1])) > 30:
        return {'success': True, 'plan': plan, 'measurement': {'method': 'SEMANTIC_GUIDED_PIXEL_FIT', 'reviewRequired': True, 'background': 'MODEL_BACKGROUND_MISMATCH', 'framesCompared': 0, 'objects': [], 'modelInvocations': 0}}
    plan['background'] = hex_color(background[::-1])
    active = {element['id']: element for element in elements if element.get('type') == 'shape' and isinstance(element.get('shape'), dict) and element['shape'].get('kind') in ('rectangle', 'ellipse', 'line')}
    records = {identifier: [] for identifier in active}
    decisions = {identifier: [] for identifier in active}
    stroke_observations = {identifier: [] for identifier in active}
    previous_angles = {}
    evidence = Path(request['outputDirectory']).resolve(strict=True) if request.get('outputDirectory') else None
    if evidence is not None and not evidence.is_dir():
        raise ValueError('Evidence directory must already exist')
    selected_frames = {0, count//2, count-1}
    for index, filename in enumerate(frames):
        if time.monotonic()-started > 90:
            raise TimeoutError('Bounded measurement deadline exceeded')
        source = cv2.imread(str(filename))
        if source is None or source.shape[:2] != (height, width):
            raise ValueError('Decoded frame dimensions changed')
        image = cv2.resize(source, size, interpolation=cv2.INTER_AREA)
        predictions = {identifier: sample(element, index) for identifier, element in active.items()}
        candidates, labels = component_candidates(image, background)
        assignments = choose_assignments({identifier: prediction for identifier, prediction in predictions.items() if prediction['opacity'] > .05}, candidates, scale)
        overlay = image.copy()
        for identifier, prediction in predictions.items():
            record, confidence, mask, stroke_measurement = prediction, 0., None, None
            if identifier in assignments:
                candidate_index, _ = assignments[identifier]
                fitted = fit_component(image, labels, candidates[candidate_index], active[identifier], prediction, background, scale, previous_angles.get(identifier))
                if fitted is not None:
                    record, confidence, mask = fitted
                    previous_angles[identifier] = record['rotation']
                    stroke_measurement = measure_stroke(image, labels, candidates[candidate_index], active[identifier], record, background, scale)
            records[identifier].append(record)
            decisions[identifier].append(confidence)
            stroke_observations[identifier].append(stroke_measurement)
            if evidence is not None and index in selected_frames and mask is not None:
                # The safe index, not an AI-controlled label/ID, forms filenames.
                element_index = identifiers.index(identifier)
                cv2.imwrite(str(evidence/('object-%02d-mask-%06d.png' % (element_index, index))), mask*255)
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                cv2.drawContours(overlay, contours, -1, (0, 255, 0), 1)
        if evidence is not None and index in selected_frames:
            cv2.imwrite(str(evidence/('measurement-%06d.png' % index)), overlay)
    reports = []
    for element in elements:
        identifier = element['id']
        if identifier not in active:
            reports.append({'id': identifier, 'status': 'MODEL_RETAINED_UNSUPPORTED', 'measuredFrames': 0, 'retainedModelFrames': count})
            continue
        confidence = decisions[identifier]
        measured_count = sum(value > 0 for value in confidence)
        strokes = stroke_observations[identifier]
        stroke_count = sum(value is not None for value in strokes)
        stroke_report = {'status': 'NOT_IDENTIFIABLE_OR_UNSUPPORTED', 'measuredFrames': stroke_count, 'retainedDeclaredFrames': count-stroke_count}
        if stroke_count >= min(3, count):
            # Emit every numeric key only after actual color-area measurements
            # exist. Unidentifiable frames explicitly retain the old canonical
            # thickness, rather than claiming an inferred constant was observed.
            for index, record in enumerate(records[identifier]):
                observed = strokes[index]
                fallback = element['shape']['strokeWidth']*math.sqrt(record['width']/element['width']*record['height']/element['height'])
                record['strokeWidth'] = observed['width'] if observed is not None else record.get('strokeWidth', fallback)
            palette = [rgb(record['fill']) for index, record in enumerate(records[identifier]) if confidence[index] and record['opacity'] >= .98 and np.max(np.abs(rgb(record['fill'])-rgb(element['shape']['strokeColor']))) <= 16]
            if len(palette) >= min(3, count):
                element['shape']['strokeColor'] = hex_color(np.median(palette, axis=0))
            widths = [item['width'] for item in strokes if item is not None]
            stroke_report.update({'status': 'PARTIALLY_PIXEL_MEASURED' if stroke_count < count else 'PIXEL_MEASURED', 'method': 'OBSERVED_COLOR_AREA_MOMENTS',
                                  'minimumWidth': round(min(widths), 4), 'maximumWidth': round(max(widths), 4), 'medianWidth': round(float(np.median(widths)), 4),
                                  'maximumMeanColorResidual': round(max(item['meanColorResidual'] for item in strokes if item is not None), 4),
                                  'color': element['shape']['strokeColor'], 'colorSource': 'OBSERVED_NEAR_DECLARED_PALETTE' if len(palette) >= min(3, count) else 'DECLARED_UNVERIFIED'})
        compressed, tolerance = compact(records[identifier])
        status = 'PIXEL_MEASURED' if measured_count == count else 'PARTIALLY_MEASURED' if measured_count else 'MODEL_RETAINED_UNCERTAIN'
        if compressed is None:
            status = 'MODEL_RETAINED_COMPLEX_TIMELINE'
            measured_count = 0
        elif measured_count:
            for key in compressed:
                for field in ('x', 'y', 'width', 'height', 'rotation', 'opacity', 'strokeWidth'):
                    if field not in key:
                        continue
                    key[field] = round(float(key[field]), 4)
            element['keyframes'] = compressed
        reports.append({'id': identifier, 'status': status, 'measuredFrames': measured_count, 'retainedModelFrames': count-measured_count,
                        'meanFitConfidence': round(float(np.mean([value for value in confidence if value > 0])), 4) if measured_count else 0,
                        'keyframeCount': len(element['keyframes']), 'compressionToleranceMultiplier': tolerance,
                        'strokeMeasurement': stroke_report,
                        'uncertainFramesSample': [index for index, value in enumerate(confidence) if not value][:16]})
    return {'success': True, 'plan': plan, 'measurement': {'method': 'SEMANTIC_GUIDED_PIXEL_FIT', 'reviewRequired': any(item['status'] != 'PIXEL_MEASURED' or item.get('strokeMeasurement', {}).get('status') == 'PARTIALLY_PIXEL_MEASURED' for item in reports), 'background': 'OBSERVED_UNIFORM', 'framesCompared': count, 'objects': reports,
            'modelInvocations': 0, 'networkRequests': 0, 'maximumDecodedSide': 768, 'elapsedSeconds': round(time.monotonic()-started, 3), 'visualAcceptance': 'NOT_EVALUATED'}}


if __name__ == '__main__':
    try:
        raw = sys.stdin.read(320*1024+1)
        if len(raw.encode('utf8')) > 320*1024:
            raise ValueError('Measurement request byte limit exceeded')
        print(json.dumps(process(json.loads(raw)), separators=(',', ':'), allow_nan=False))
    except Exception as error:
        print(json.dumps({'success': False, 'code': 'REFERENCE_SEMANTIC_MEASUREMENT_FAILED', 'error': type(error).__name__+': '+str(error)[:220]}))
        sys.exit(1)
