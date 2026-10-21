"""Bounded, local planar-card reference reconstruction.

This is classical CV, not an AI segmentation claim. Each screenshot/card stays
one editable image plane. Hidden content is recovered only where it was actually
observed in another frame; uncertain or unobserved pixels remain transparent.
No network, model downloads, arbitrary code or source-name matching is used.
"""
import json
import math
import os
from pathlib import Path
import sys
import time

# Worker-local CPU budget; small four-variable solves must not start dozens of
# BLAS threads while FFmpeg/Remotion share this low-memory machine.
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['OMP_NUM_THREADS'] = '1'
import cv2
import numpy as np


def account_tracked_attempt(result, attempt):
    """Fallback output must not erase real earlier OCR inference/limitations."""
    calls = (attempt or {}).get('analysis', {}).get('metadata', {}).get('modelInvocations', 0)
    if calls and result.get('analysis'):
        metadata = result['analysis'].setdefault('metadata', {})
        metadata['modelInvocations'] = metadata.get('modelInvocations', 0)+calls
        warnings = result['analysis'].setdefault('warnings', [])
        warnings.insert(0, 'An actual local OCR/native-text attempt did not qualify for this complete clip. Returned artwork remains grouped, not native editable words.')
    return result


def ordered_box(points):
    points = np.asarray(points, np.float32)
    center = points.mean(axis=0)
    angles = np.arctan2(points[:, 1]-center[1], points[:, 0]-center[0])
    result = points[np.argsort(angles)]
    # The longest edge is the card's horizontal axis. Orient left-to-right.
    lengths = np.linalg.norm(np.roll(result, -1, axis=0)-result, axis=1)
    index = int(np.argmax(lengths))
    if result[(index+1) % 4, 0] < result[index, 0]:
        index = (index+2) % 4
    return np.roll(result, -index, axis=0)


def polygon_mask(quad, shape):
    result = np.zeros(shape[:2], np.uint8)
    cv2.fillConvexPoly(result, np.round(quad).astype(np.int32), 255)
    return result


def discover_cards(image):
    """Large, approximately rectangular flat-color surfaces, any hue.

    This discovery gate intentionally does not support characters, photos as a
    full-frame background, deforming subjects, arbitrary camera motion or 3D.
    """
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    background_rows = np.median(gray[:, -max(3, width//30):], axis=1)
    relative_light = ((gray.astype(float) > background_rows[:, None]+10) & (hsv[:, :, 1] < 65)).astype(np.uint8)*255
    masks = [('dark', cv2.inRange(gray, 0, 40)),
             ('light', relative_light)]
    # Discover saturated hue families from observed pixels, not a red-card rule.
    hue_hist = np.bincount(hsv[:, :, 0][(hsv[:, :, 1] > 100) & (hsv[:, :, 2] > 70)], minlength=180)
    chosen = []
    for hue in np.argsort(hue_hist)[::-1]:
        if hue_hist[hue] < width*height*.002:
            break
        if any(min(abs(int(hue)-prior), 180-abs(int(hue)-prior)) < 20 for prior in chosen):
            continue
        chosen.append(int(hue))
        delta = np.minimum(abs(hsv[:, :, 0].astype(int)-int(hue)), 180-abs(hsv[:, :, 0].astype(int)-int(hue)))
        masks.append(('hue-'+str(hue), ((delta < 17) & (hsv[:, :, 1] > 90) & (hsv[:, :, 2] > 70)).astype(np.uint8)*255))
        if len(chosen) == 5:
            break
    proposals = []
    for family, mask in masks:
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
        for label in range(1, count):
            x, y, bw, bh, area = stats[label]
            if area < width*height*.018 or max(bw, bh) < width*.40:
                continue
            yy, xx = np.where(labels == label)
            rectangle = cv2.minAreaRect(np.column_stack((xx, yy)).astype(np.float32))
            sides = sorted(rectangle[1])
            if sides[0] < width*.09 or sides[1] < width*.40 or sides[1] > width*1.25:
                continue
            aspect = sides[1]/max(1., sides[0])
            fill = area / max(1., sides[0]*sides[1])
            if aspect < 1.20 or aspect > 4.2 or fill < .40:
                continue
            quad = ordered_box(cv2.boxPoints(rectangle))
            if abs(quad[1, 0]-quad[0, 0]) < sides[1]*.55:
                continue
            proposals.append({'quad': quad, 'family': family, 'fill': float(fill),
                              'area': int(area), 'aspect': float(aspect)})
    proposals.sort(key=lambda item: item['area'], reverse=True)
    unique = []
    for item in proposals:
        center = item['quad'].mean(axis=0)
        if any(np.linalg.norm(center-prior['quad'].mean(axis=0)) < width*.15 for prior in unique):
            continue
        unique.append(item)
    # Occlusion shortens a visible color component. Infer shared aspect only if
    # at least two observed high-fill rectangles agree; mark this assumption.
    reliable = [item['aspect'] for item in unique if item['fill'] > .65 and 1.35 < item['aspect'] < 2.15]
    common_aspect = float(np.median(reliable)) if len(reliable) >= 2 else None
    if common_aspect:
        for item in unique:
            q = item['quad']
            long = np.linalg.norm(q[1]-q[0])
            short = np.linalg.norm(q[3]-q[0])
            if item['aspect'] > common_aspect*1.08:
                q[2:] += (q[3]-q[0])/max(short, 1.)*(long/common_aspect-short)
                item['aspectInferred'] = True
    return sorted(unique, key=lambda item: item['quad'].mean(axis=0)[1])


def similarity_matrix(source, target):
    if len(source) < 4:
        return None, None
    return cv2.estimateAffinePartial2D(np.asarray(source, np.float32), np.asarray(target, np.float32),
                                     method=cv2.RANSAC, ransacReprojThreshold=2.0,
                                     maxIters=1500, confidence=.995, refineIters=10)


def clipped_card_proposals(image, card_width, card_height):
    """Infer clipped planar rectangles only from two actual boundary segments.

    The shared dimensions come from other observed card planes, not a template
    name or hardcoded source coordinates. Hidden rectangle geometry is marked
    inferred. No unseen texture is synthesized.
    """
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    detected = cv2.createLineSegmentDetector(0).detect(gray)[0]
    if detected is None:
        return []
    lines = []
    for entry in detected:
        p, q = entry[0][:2], entry[0][2:]
        length = np.linalg.norm(q-p)
        if length < width*.15 or not (max(p[1], q[1]) < height*.32 or min(p[1], q[1]) > height*.70):
            continue
        direction = (q-p)/length
        if direction[0] < 0:
            p, q, direction = q, p, -direction
        lines.append((p, q, direction, length))

    def samples(p, q, normal):
        positions = np.linspace(p, q, 24)
        inside_points = np.round(positions+normal*4).astype(int)
        outside_points = np.round(positions-normal*4).astype(int)
        valid = np.ones(24, bool)
        for coords in (inside_points, outside_points):
            valid &= (coords[:, 0] >= 0) & (coords[:, 0] < width) & (coords[:, 1] >= 0) & (coords[:, 1] < height)
        inside = image[inside_points[valid, 1], inside_points[valid, 0]].astype(float)
        outside = image[outside_points[valid, 1], outside_points[valid, 0]].astype(float)
        if len(inside) < 12:
            return None
        return float(np.median(np.linalg.norm(inside-outside, axis=1))), np.median(inside, axis=0)

    proposals = []
    for p, q, u, length in lines:
        if length < width*.25 or abs(u[0]) < .40:
            continue
        v = np.array([-u[1], u[0]], np.float32)
        for r, s, other, other_length in lines:
            if abs(np.dot(u, other)) > .12:
                continue
            matrix = np.column_stack((u, -other))
            if abs(np.linalg.det(matrix)) < .5:
                continue
            t = np.linalg.solve(matrix, r-p)[0]
            corner = p+t*u
            if min(np.linalg.norm(corner-p), np.linalg.norm(corner-q)) > width*.18 or min(np.linalg.norm(corner-r), np.linalg.norm(corner-s)) > width*.18:
                continue
            # Need actual segments extending from the inferred top-left corner
            # along the card axes, not intersecting internal text baselines.
            pu = np.dot(np.array([p, q])-corner, u)
            pv = np.dot(np.array([r, s])-corner, v)
            if pu.min() < -20 or pu.max() > card_width+30 or pv.min() < -20 or pv.max() > card_height+30:
                continue
            a = samples(p, q, v)
            b = samples(r, s, u)
            if a is None or b is None or min(a[0], b[0]) < 30 or np.linalg.norm(a[1]-b[1]) > 55:
                continue
            quad = np.float32([corner, corner+u*card_width, corner+u*card_width+v*card_height, corner+v*card_height])
            mask = polygon_mask(quad, image.shape)
            visible = np.count_nonzero(mask)/(card_width*card_height)
            if not .04 < visible < .65:
                continue
            if any(np.linalg.norm(quad.mean(axis=0)-item['quad'].mean(axis=0)) < width*.2 for item in proposals):
                continue
            proposals.append({'quad': quad, 'family': 'clipped-boundary', 'fill': float(visible),
                              'area': int(np.count_nonzero(mask)), 'aspect': card_width/card_height,
                              'aspectInferred': True, 'boundaryContrast': round(min(a[0], b[0]), 3)})
    return proposals


def apply_matrix(quad, matrix):
    return cv2.transform(quad[None].astype(np.float32), matrix)[0]


def rectified_texture(gray, quad):
    destination = np.float32([[0, 0], [159, 0], [159, 99], [0, 99]])
    matrix = cv2.getPerspectiveTransform(quad.astype(np.float32), destination)
    values = cv2.warpPerspective(gray, matrix, (160, 100)).astype(float)
    valid = cv2.warpPerspective(np.ones(gray.shape, np.uint8)*255, matrix, (160, 100)) > 254
    high = cv2.GaussianBlur(values, (0, 0), .7)-cv2.GaussianBlur(values, (0, 0), 2.5)
    return high, valid


def texture_agreement(anchor, candidate):
    left, left_mask = anchor
    right, right_mask = candidate
    valid = left_mask & right_mask & (np.abs(left) > 1)
    # Lower portions can be covered by the next stacked card; compare observed
    # intrinsic upper content, not other layers baked into the anchor frame.
    valid[65:] = False
    if np.count_nonzero(valid) < 150:
        return 0.
    a, b = left[valid], right[valid]
    return float(np.dot(a, b)/max(1., np.linalg.norm(a)*np.linalg.norm(b)))


def compress_records(records, pixel_tolerance=.25, opacity_tolerance=.001):
    """RDP against the renderer's linear corner/opacity interpolation.

    Every omitted integer frame is checked, rather than evenly dropping keys.
    The caller replaces its records with the interpolated result before asset
    extraction and actual all-frame reconstruction verification.
    """
    selected = {0, len(records)-1}
    pending = [(0, len(records)-1)]
    while pending:
        start, end = pending.pop()
        if end-start <= 1:
            continue
        left, right = records[start], records[end]
        worst_error, worst_index = 0., None
        for index in range(start+1, end):
            ratio = (index-start)/(end-start)
            expected = left['quad']*(1-ratio)+right['quad']*ratio
            geometric = float(np.linalg.norm(expected-records[index]['quad'], axis=1).max())/pixel_tolerance
            opacity = abs(left.get('opacity', 1)*(1-ratio)+right.get('opacity', 1)*ratio-records[index].get('opacity', 1))/opacity_tolerance
            error = max(geometric, opacity)
            if error > worst_error:
                worst_error, worst_index = error, index
        if worst_error > 1 and worst_index is not None:
            selected.add(worst_index)
            pending.extend([(start, worst_index), (worst_index, end)])
    indices = sorted(selected)
    keys = [{'frame': records[index]['frame'], 'corners': [[round(float(value), 4) for value in point] for point in records[index]['quad']],
             'opacity': records[index].get('opacity', 1)} for index in indices]
    for start, end in zip(indices, indices[1:]):
        left = np.float32(keys[indices.index(start)]['corners'])
        right = np.float32(keys[indices.index(end)]['corners'])
        for index in range(start, end+1):
            ratio = (index-start)/(end-start)
            records[index]['quad'] = left*(1-ratio)+right*ratio
            records[index]['opacity'] = records[start].get('opacity', 1)*(1-ratio)+records[end].get('opacity', 1)*ratio
    return keys


def frame_features(frames):
    """Bounded descriptors only; never retain the decoded video in RAM."""
    # The installed OpenCV 4.11 binding accepts descriptorType positionally.
    detector = cv2.SIFT_create(2400, 3, .018, 15, 1.6, cv2.CV_8U)
    result = []
    for filename in frames:
        image = cv2.imread(str(filename), cv2.IMREAD_GRAYSCALE)
        ratio = min(1., 480/image.shape[1])
        if ratio < 1:
            image = cv2.resize(image, None, fx=ratio, fy=ratio, interpolation=cv2.INTER_AREA)
        keys, descriptors = detector.detectAndCompute(image, None)
        points = np.float32([key.pt for key in keys]).reshape(-1, 2)/ratio
        result.append((points, descriptors))
    return result


def track_plane(frames, anchor_index, proposal, features, allow_partial=False):
    """Independent frame-to-anchor SIFT/RANSAC; no accumulated optical drift."""
    all_points, all_descriptors = features[anchor_index]
    # Keep points sufficiently inside the measured rectangle.
    selected = np.array([cv2.pointPolygonTest(proposal['quad'], tuple(map(float, point)), True) > 5
                         for point in all_points])
    keypoints = all_points[selected]
    descriptors = all_descriptors[selected] if all_descriptors is not None else None
    if descriptors is None or len(keypoints) < 8:
        return None
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    records = []
    for index, filename in enumerate(frames):
        if index == anchor_index:
            records.append({'frame': index, 'quad': proposal['quad'].copy(), 'inliers': len(keypoints),
                            'matchCount': len(keypoints), 'error': 0., 'observed': True})
            continue
        target_keys, target_desc = features[index]
        matches = matcher.knnMatch(descriptors, target_desc, k=2) if target_desc is not None else []
        accepted = [pair[0] for pair in matches if len(pair) == 2 and pair[0].distance < .68*pair[1].distance]
        # Mutual nearest matching avoids reusing repetitive letters/features.
        seen = set()
        accepted = [match for match in sorted(accepted, key=lambda m:m.distance)
                    if match.trainIdx not in seen and not seen.add(match.trainIdx)]
        source = np.float32([keypoints[m.queryIdx] for m in accepted])
        target = np.float32([target_keys[m.trainIdx] for m in accepted])
        matrix, inliers = similarity_matrix(source, target)
        if matrix is None or inliers is None or np.count_nonzero(inliers) < 4:
            records.append({'frame': index, 'quad': None, 'inliers': 0, 'matchCount': len(accepted),
                            'error': None, 'observed': False})
            continue
        keep = inliers[:, 0].astype(bool)
        if np.ptp(source[keep], axis=0).min() < 8:
            records.append({'frame': index, 'quad': None, 'inliers': int(keep.sum()), 'matchCount': len(accepted),
                            'error': None, 'observed': False})
            continue
        transformed = cv2.transform(source[keep][None], matrix)[0]
        error = float(np.median(np.linalg.norm(transformed-target[keep], axis=1)))
        scale = float(np.linalg.norm(matrix[:, 0]))
        if not .45 < scale < 2.2 or error > 2.5:
            records.append({'frame': index, 'quad': None, 'inliers': int(keep.sum()),
                            'matchCount': len(accepted), 'error': error, 'observed': False})
            continue
        records.append({'frame': index, 'quad': apply_matrix(proposal['quad'], matrix),
                        'inliers': int(keep.sum()), 'matchCount': len(accepted), 'error': error,
                        'observed': True})
    good = [record for record in records if record['observed']]
    if len(good) < (3 if allow_partial else max(3, len(records)*.25)):
        return None
    # Fill short tracking gaps by measured-neighbor interpolation, explicitly
    # counted. Never fabricate trajectories for a mostly untracked plane.
    for record in records:
        if record['quad'] is not None:
            continue
        before = next((prior for prior in reversed(good) if prior['frame'] < record['frame']), None)
        after = next((prior for prior in good if prior['frame'] > record['frame']), None)
        if before and after and after['frame']-before['frame'] <= 8:
            ratio = (record['frame']-before['frame'])/(after['frame']-before['frame'])
            record['quad'] = before['quad']*(1-ratio)+after['quad']*ratio
    if any(record['quad'] is None for record in records):
        # An anchor feature may become occluded near the clip edge. Bridge from
        # an adjacent measured frame, keeping independent RANSAC inlier/error
        # checks. This is not a guessed oscillation/easing curve.
        for direction in (-1, 1):
            indices = range(anchor_index-1, -1, -1) if direction < 0 else range(anchor_index+1, len(frames))
            for index in indices:
                if records[index]['quad'] is not None:
                    continue
                previous = records[index-direction]
                if previous['quad'] is None:
                    continue
                previous_points, previous_desc = features[index-direction]
                selected = np.array([cv2.pointPolygonTest(previous['quad'].astype(np.float32), tuple(map(float, p)), True) > 5
                                     for p in previous_points])
                local_points = previous_points[selected]
                local_desc = previous_desc[selected] if previous_desc is not None else None
                target_points, target_desc = features[index]
                if local_desc is None or target_desc is None or len(local_points) < 4:
                    continue
                pairs = matcher.knnMatch(local_desc, target_desc, k=2)
                matched = [pair[0] for pair in pairs if len(pair) == 2 and pair[0].distance < .64*pair[1].distance]
                if len(matched) < 4:
                    continue
                local = np.float32([local_points[m.queryIdx] for m in matched])
                target = np.float32([target_points[m.trainIdx] for m in matched])
                matrix, inliers = similarity_matrix(local, target)
                if matrix is None or np.count_nonzero(inliers) < 4:
                    continue
                keep = inliers[:, 0].astype(bool)
                if np.ptp(local[keep], axis=0).min() < 8:
                    continue
                error = float(np.median(np.linalg.norm(cv2.transform(local[keep][None], matrix)[0]-target[keep], axis=1)))
                if error > 2 or not .8 < np.linalg.norm(matrix[:, 0]) < 1.2:
                    continue
                records[index].update(quad=apply_matrix(previous['quad'], matrix), inliers=int(keep.sum()),
                                      error=error, observed=True, neighborBridged=True)
        good = [record for record in records if record['observed']]
        if any(record['quad'] is None for record in records):
            if not allow_partial:
                return None
            for record in records:
                if record['quad'] is None:
                    # Unknown motion is NOT extrapolated into the canvas. An
                    # unobserved clipped card is hidden and explicitly scored
                    # by the complete-frame comparison gate below.
                    nearest = min(good, key=lambda observed:abs(observed['frame']-record['frame']))
                    record['quad'] = nearest['quad'].copy()
                    record['opacity'] = 0
    good = [record for record in records if record['observed']]
    if not allow_partial and len(good)/len(records) < .80:
        return None
    if allow_partial:
        anchor_gray = cv2.imread(str(frames[anchor_index]), cv2.IMREAD_GRAYSCALE)
        anchor_texture = rectified_texture(anchor_gray, proposal['quad'])
        for record in records:
            if record.get('opacity', 1) == 0:
                continue
            candidate = cv2.imread(str(frames[record['frame']]), cv2.IMREAD_GRAYSCALE)
            agreement = texture_agreement(anchor_texture, rectified_texture(candidate, record['quad']))
            if agreement < .75:
                # Repeated typefaces can produce RANSAC matches on a different
                # card. Never turn that match into a duplicate foreground card.
                record['opacity'] = 0
                record['observed'] = False
        good = [record for record in records if record['observed']]
        if len(good) < 3:
            return None
    return {'proposal': proposal, 'records': records, 'anchorFeatures': len(keypoints),
            'observedRatio': len(good)/len(records), 'medianError': float(np.median([r['error'] for r in good]))}


def recover_assets(frames, tracks, output):
    """Rectified temporal consensus, rejecting pixels covered by another plane.

    Overlap order is determined by per-frame feature support and boundary color
    residual against each plane's anchor observation. Ambiguous ordering remains
    a review warning; it is not called independently validated z-order.
    """
    assets = []
    for index, track in enumerate(tracks):
        anchor_index = track['anchorIndex']
        q = track['proposal']['quad']
        width = max(24, round(np.linalg.norm(q[1]-q[0])))
        height = max(24, round(np.linalg.norm(q[3]-q[0])))
        destination = np.float32([[0, 0], [width-1, 0], [width-1, height-1], [0, height-1]])
        samples = []
        validity = []
        for frame_index in sorted(set([anchor_index] + list(range(0, len(frames), max(1, len(frames)//20))))):
            record = track['records'][frame_index]
            if record.get('opacity', 1) == 0:
                continue
            image = cv2.imread(str(frames[frame_index]), cv2.IMREAD_COLOR)
            matrix = cv2.getPerspectiveTransform(record['quad'].astype(np.float32), destination)
            valid = np.ones(image.shape[:2], np.uint8)*255
            # Initial order: later/lower discovered cards are foreground. This
            # matches a stack only if appearance verification later agrees.
            for other in tracks[index+1:]:
                if other['records'][frame_index].get('opacity', 1) != 0:
                    cv2.fillConvexPoly(valid, np.round(other['records'][frame_index]['quad']).astype(np.int32), 0)
            warped = cv2.warpPerspective(image, matrix, (width, height), flags=cv2.INTER_LINEAR,
                                         borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
            visible = cv2.warpPerspective(valid, matrix, (width, height), flags=cv2.INTER_NEAREST,
                                         borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            samples.append(warped)
            validity.append(visible > 0)
        sample_array = np.stack(samples).astype(np.float32)
        valid_array = np.stack(validity)
        # Select per-pixel temporal median only from actually visible samples.
        sample_array[~valid_array] = np.nan
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)
            median = np.nanmedian(sample_array, axis=0)
        coverage = np.any(valid_array, axis=0)
        rgb = np.nan_to_num(median).astype(np.uint8)
        alpha = coverage.astype(np.uint8)*255
        # Rounded corners are a geometric approximation for this supported card
        # class, NOT a learned object mask or measured alpha-matting result.
        radius = max(1, round(min(width, height)*.025))
        round_mask = np.ones((height, width), np.uint8)*255
        for cx, cy, sx, sy in [(radius, radius, 0, 0), (width-radius-1, radius, width-radius, 0),
                              (radius, height-radius-1, 0, height-radius),
                              (width-radius-1, height-radius-1, width-radius, height-radius)]:
            yy, xx = np.indices((radius, radius))
            absolute_x = xx+sx; absolute_y = yy+sy
            round_mask[sy:sy+radius, sx:sx+radius] = np.where((absolute_x-cx)**2+(absolute_y-cy)**2 <= radius**2, 255, 0)
        alpha = np.minimum(alpha, round_mask)
        rgba = cv2.cvtColor(rgb, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = alpha
        filename = 'card-'+str(index+1)+'.png'
        if not cv2.imwrite(str(output/filename), rgba):
            raise RuntimeError('Could not write an extracted image plane')
        track['assetWidth'] = width
        track['assetHeight'] = height
        track['coverage'] = float(coverage.mean())
        track['assetPixels'] = rgba
        assets.append({'id': 'asset-'+str(index+1), 'filename': filename, 'width': width, 'height': height})
    return assets


def lighting_basis(width, height):
    """Four-corner gain field: bounded lighting, incapable of encoding text."""
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    xx /= max(1, width-1)
    yy /= max(1, height-1)
    return np.stack(((1-xx)*(1-yy), xx*(1-yy), xx*yy, (1-xx)*yy), axis=-1)


def fit_lighting(image, track, foreground, index):
    """Robust fit to actually visible, rectified pixels; no residual imagery.

    Fit at low resolution: lighting is deliberately low frequency. Occluder
    polygons are mapped into that small plane, not allocated at video size for
    every object. Missing observations are reported, not called measured light.
    """
    record = track['records'][index]
    if record.get('opacity', 1) < .99:
        return None
    asset = track['assetPixels']
    ah, aw = asset.shape[:2]
    width = min(128, aw)
    height = max(12, round(ah*width/aw))
    reference = cv2.resize(asset, (width, height), interpolation=cv2.INTER_AREA)
    destination = np.float32([[0, 0], [width-1, 0], [width-1, height-1], [0, height-1]])
    matrix = cv2.getPerspectiveTransform(record['quad'].astype(np.float32), destination)
    observed = cv2.warpPerspective(image, matrix, (width, height))
    # An all-white source coverage plane rejects pixels outside the video.
    valid = cv2.warpPerspective(np.ones(image.shape[:2], np.uint8)*255, matrix, (width, height), flags=cv2.INTER_NEAREST)
    for other in foreground:
        other_record = other['records'][index]
        if other_record.get('opacity', 1) > .01:
            corners = cv2.perspectiveTransform(other_record['quad'].astype(np.float32)[None], matrix)[0]
            cv2.fillConvexPoly(valid, np.round(corners).astype(np.int32), 0)
    valid = cv2.erode(valid, np.ones((3, 3), np.uint8)) > 254
    valid &= reference[:, :, 3] > 254
    valid[:2] = False
    valid[-2:] = False
    valid[:, :2] = False
    valid[:, -2:] = False
    base = cv2.cvtColor(cv2.GaussianBlur(reference[:, :, :3], (3, 3), 0), cv2.COLOR_BGR2GRAY).astype(np.float32)
    target = cv2.cvtColor(cv2.GaussianBlur(observed, (3, 3), 0), cv2.COLOR_BGR2GRAY).astype(np.float32)
    valid &= (base > 25) & (target > 10)
    if np.count_nonzero(valid) < 60:
        return None
    design = lighting_basis(width, height)[valid]*base[valid, None]
    values = target[valid]
    weights = np.ones(len(values), np.float32)
    for _ in range(4):
        weighted = design*weights[:, None]
        gains = np.linalg.solve(design.T@weighted+np.eye(4)*100,
                                weighted.T@values+np.ones(4)*100)
        gains = np.clip(gains, .4, 1.6)
        residual = np.abs(design@gains-values)
        weights = np.minimum(1., 8/np.maximum(residual, 1))
    return gains


def compress_lighting(values, tolerance=.005):
    """RDP on measured gains, bounded at every integer frame like geometry."""
    selected = {0, len(values)-1}
    pending = [(0, len(values)-1)]
    while pending:
        left, right = pending.pop()
        if right-left <= 1:
            continue
        worst, worst_index = 0, None
        for index in range(left+1, right):
            ratio = (index-left)/(right-left)
            error = float(np.max(np.abs(values[index]-(values[left]*(1-ratio)+values[right]*ratio))))
            if error > worst:
                worst, worst_index = error, index
        if worst > tolerance:
            selected.add(worst_index)
            pending.extend(((left, worst_index), (worst_index, right)))
    keys = [{'frame': index, 'gains': np.round(values[index], 4).tolist()} for index in sorted(selected)]
    for left, right in zip(keys, keys[1:]):
        for frame in range(left['frame'], right['frame']+1):
            ratio = (frame-left['frame'])/(right['frame']-left['frame'])
            values[frame] = np.array(left['gains'])*(1-ratio)+np.array(right['gains'])*ratio
    return keys


def measure_lighting(frames, tracks):
    for track in tracks:
        track['lightingValues'] = []
    for index, filename in enumerate(frames):
        image = cv2.imread(str(filename), cv2.IMREAD_COLOR)
        for position, track in enumerate(tracks):
            track['lightingValues'].append(fit_lighting(image, track, tracks[position+1:], index))
    for track in tracks:
        values = track['lightingValues']
        known = [index for index, value in enumerate(values) if value is not None]
        track['lightingObservedRatio'] = len(known)/len(values)
        if not known:
            track['lightingValues'] = [np.ones(4) for _ in values]
        else:
            # Missing observations interpolate neighboring measurements; never
            # serialize a full source frame or color residual as an "effect".
            track['lightingValues'] = np.array([np.interp(np.arange(len(values)), known,
                                                          [values[index][corner] for index in known])
                                                for corner in range(4)]).T
        track['lightingKeys'] = compress_lighting(track['lightingValues'])


def render_frame(image, tracks, index, background):
    composite = np.empty_like(image)
    composite[:] = background
    for track in tracks:
        if track['records'][index].get('opacity', 1) == 0:
            continue
        rgba = track['assetPixels']
        height, width = rgba.shape[:2]
        if 'lightingValues' in track:
            rgba = rgba.copy()
            if 'lightingBasis' not in track:
                track['lightingBasis'] = lighting_basis(width, height)
            gains = np.einsum('ijk,k->ij', track['lightingBasis'], track['lightingValues'][index], optimize=False)
            rgba[:, :, :3] = np.clip(np.round(rgba[:, :, :3]*gains[:, :, None]), 0, 255).astype(np.uint8)
        quad = track['records'][index]['quad']
        source = np.float32([[0, 0], [width-1, 0], [width-1, height-1], [0, height-1]])
        matrix = cv2.getPerspectiveTransform(source, quad.astype(np.float32))
        warped = cv2.warpPerspective(rgba, matrix, (image.shape[1], image.shape[0]), flags=cv2.INTER_LINEAR)
        alpha = warped[:, :, 3:4].astype(np.float32)/255.
        composite = np.round(warped[:, :, :3]*alpha+composite*(1-alpha)).astype(np.uint8)
    return composite


def process(request):
    started = time.monotonic()
    cv2.setNumThreads(1)
    cv2.setRNGSeed(1701)
    if request.get('version') != 1:
        raise ValueError('Unsupported analysis request')
    source = Path(request['framesDirectory'])
    output = Path(request['outputDirectory'])
    if not source.is_absolute() or not output.is_absolute() or not source.is_dir() or not output.is_dir():
        raise ValueError('Use existing server-owned absolute input and output directories')
    frames = sorted(source.glob('frame-*.png'))
    if not 2 <= len(frames) <= 600:
        raise ValueError('Reference analysis requires 2..600 decoded frames')
    width, height = request['width'], request['height']
    fps = request['fps']
    duration_frames = request['durationFrames']
    if any(isinstance(v, bool) or not isinstance(v, int) for v in (width, height, fps, duration_frames)):
        raise ValueError('Use integer decoded video metadata')
    if width < 64 or height < 64 or width*height > 2_100_000 or fps not in (24, 25, 30, 60) or duration_frames != len(frames):
        raise ValueError('Unsupported video dimensions, FPS or frame count')
    # Prefer color-independent identity and qualified actual OCR. Ambiguous
    # components are rejected; older adapters remain explicitly grouped.
    tracked_candidate = None
    if fps == 30 and len(frames) <= 300:
        import importlib.util
        location = Path(__file__).resolve().parent/'tracked-worker.py'
        if location.is_file():
            spec = importlib.util.spec_from_file_location('reference_tracked_adapter', location)
            tracked = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(tracked)
            tracked_candidate = tracked.process(request)
            if tracked_candidate.get('success') and tracked_candidate['analysis']['quality']['visualComparison'] == 'PASS':
                return tracked_candidate
    # Route from measured image evidence, not source names/prompts. The vector
    # adapter handles observed flat-color artwork; textured card scenes retain
    # the existing V2 tracker. Failed vector attempts are never relabeled PASS.
    vector_candidate = None
    if fps == 30 and len(frames) <= 300:
        import importlib.util
        location = Path(__file__).resolve().parent/'vector-worker.py'
        spec = importlib.util.spec_from_file_location('reference_vector_adapter', location)
        vector = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(vector)
        vector_candidate = vector.process(request)
        if vector_candidate.get('success') and vector_candidate['analysis']['quality']['visualComparison'] == 'PASS':
            return account_tracked_attempt(vector_candidate, tracked_candidate)
    candidates = []
    for index in sorted(set([0, len(frames)//4, len(frames)//2, len(frames)*3//4])):
        image = cv2.imread(str(frames[index]), cv2.IMREAD_COLOR)
        if image is None or image.shape[:2] != (height, width):
            raise ValueError('Decoded frames do not match verified video metadata')
        proposals = discover_cards(image)
        candidates.append((sum(item['area'] for item in proposals), index, proposals))
    _, anchor_index, proposals = max(candidates, key=lambda item:item[0])
    if not 2 <= len(proposals) <= 11:
        if vector_candidate and vector_candidate.get('success'):
            return account_tracked_attempt(vector_candidate, tracked_candidate)
        return {'success': False, 'code': 'UNSUPPORTED_REFERENCE', 'error': 'No reliable multi-card planar motion was found.',
                'quality': {'state': 'FLAT_IMAGE_ONLY', 'method': 'local-planar-cards-v1'}}
    # A clipped component's min-area rectangle measures only its visible part.
    # When multiple fully observed cards establish a shared size, extend only
    # border-clipped smaller rectangles from their observed top-left corner.
    observed_sizes = [(np.linalg.norm(item['quad'][1]-item['quad'][0]), np.linalg.norm(item['quad'][3]-item['quad'][0]))
                      for item in proposals if item['fill'] > .65 and not item.get('aspectInferred')]
    if len(observed_sizes) >= 2:
        common_w, common_h = np.median(observed_sizes, axis=0)
        for proposal in proposals:
            quad = proposal['quad']
            current_w = np.linalg.norm(quad[1]-quad[0])
            current_h = np.linalg.norm(quad[3]-quad[0])
            clipped = np.any(quad[:, 0] < 0) or np.any(quad[:, 0] >= width) or np.any(quad[:, 1] < 0) or np.any(quad[:, 1] >= height)
            if clipped and current_w < common_w*.85:
                u, v = (quad[1]-quad[0])/current_w, (quad[3]-quad[0])/current_h
                origin = quad[0].copy()
                proposal['quad'] = np.float32([origin, origin+u*common_w, origin+u*common_w+v*common_h, origin+v*common_h])
                proposal['aspectInferred'] = True
    tracks = []
    features = frame_features(frames)
    for proposal in proposals:
        result = track_plane(frames, anchor_index, proposal, features)
        if result:
            result['anchorIndex'] = anchor_index
            tracks.append(result)
    if len(tracks) < 2:
        return {'success': False, 'code': 'UNSUPPORTED_REFERENCE', 'error': 'Image planes could not be tracked reliably.',
                'quality': {'state': 'FLAT_IMAGE_ONLY', 'method': 'local-planar-cards-v1'}}
    common_width = float(np.median([np.linalg.norm(track['proposal']['quad'][1]-track['proposal']['quad'][0]) for track in tracks]))
    common_height = float(np.median([np.linalg.norm(track['proposal']['quad'][3]-track['proposal']['quad'][0]) for track in tracks]))
    # Clipped planes can be absent at the main anchor. Discover actual boundary
    # evidence at multiple times and measure those independent image planes.
    for local_anchor in sorted(set([0, len(frames)//4, len(frames)//2, len(frames)*3//4, len(frames)-1])):
        image = cv2.imread(str(frames[local_anchor]), cv2.IMREAD_COLOR)
        for proposal in clipped_card_proposals(image, common_width, common_height):
            if len(tracks) >= 11:
                break
            def overlap(prior):
                a = proposal['quad'].astype(np.float32)
                b = prior['records'][local_anchor]['quad'].astype(np.float32)
                area, _ = cv2.intersectConvexConvex(a, b)
                return area/max(1., min(cv2.contourArea(a), cv2.contourArea(b)))
            if any(overlap(prior) > .70 for prior in tracks):
                continue
            measured = track_plane(frames, local_anchor, proposal, features, allow_partial=True)
            if measured:
                measured['anchorIndex'] = local_anchor
                measured['partialVisibility'] = True
                tracks.append(measured)
    tracks.sort(key=lambda track:float(track['proposal']['quad'].mean(axis=0)[1]))
    for track in tracks:
        track['keyframes'] = compress_records(track['records'])
    assets = recover_assets(frames, tracks, output)
    measure_lighting(frames, tracks)
    # Estimate the uncovered background from actual border observations. A
    # nonuniform background cannot be silently replaced by a flat-color claim.
    edge_pixels = []
    row_profiles = []
    for index in range(0, len(frames), max(1, len(frames)//10)):
        image = cv2.imread(str(frames[index]), cv2.IMREAD_COLOR)
        mask = np.zeros((height, width), np.uint8)
        mask[:, :max(1, width//30)] = 255
        mask[:, -max(1, width//30):] = 255
        for track in tracks:
            if track['records'][index].get('opacity', 1) != 0:
                cv2.fillConvexPoly(mask, np.round(track['records'][index]['quad']).astype(np.int32), 0)
        edge_pixels.append(image[mask > 0])
        profile = np.full((height, 3), np.nan, np.float32)
        for row in range(height):
            # Use only observed uncovered right-border pixels. Replicating this
            # measured row profile is a declared simple-background assumption,
            # not full-frame source imagery or contextual inpainting.
            values = image[row, -max(3, width//30):][mask[row, -max(3, width//30):] > 0]
            if len(values):
                profile[row] = np.median(values, axis=0)
        row_profiles.append(profile)
    pixels = np.concatenate(edge_pixels)
    background = np.median(pixels, axis=0).astype(np.uint8)
    bg_delta = np.linalg.norm(pixels.astype(float)-background, axis=1)
    bg_confidence = float(np.mean(bg_delta < 18))
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)
        profile = np.nanmedian(np.stack(row_profiles), axis=0)
    for channel in range(3):
        known = np.flatnonzero(np.isfinite(profile[:, channel]))
        if not len(known):
            profile[:, channel] = background[channel]
        else:
            profile[:, channel] = np.interp(np.arange(height), known, profile[known, channel])
    profile = cv2.GaussianBlur(profile[:, None, :], (1, 0), sigmaX=0, sigmaY=3)[:, 0, :]
    background_image = np.repeat(np.clip(profile, 0, 255).astype(np.uint8)[:, None, :], width, axis=1)
    background_rgba = cv2.cvtColor(background_image, cv2.COLOR_BGR2BGRA)
    cv2.imwrite(str(output/'card-12.png'), background_rgba)
    assets.append({'id': 'asset-background', 'filename': 'card-12.png', 'width': width, 'height': height})
    scene = {'format': 'shortscraft-reference-motion', 'version': 2, 'width': width, 'height': height,
             'fps': fps, 'durationFrames': duration_frames,
             'background': '#%02x%02x%02x' % tuple(background[::-1]),
             'layers': [{'id': 'background-plane', 'label': 'Inferred simple background', 'assetId': 'asset-background',
                         'width': width, 'height': height, 'zIndex': 0, 'visible': True, 'offset': {'x': 0, 'y': 0},
                         'scale': 1, 'rotation': 0, 'opacity': 1,
                         'lighting': None,
                         'keyframes': [{'frame': frame, 'corners': [[0, 0], [width, 0], [width, height], [0, height]], 'opacity': 1}
                                       for frame in (0, duration_frames-1)]}]}
    card_reports = []
    for index, track in enumerate(tracks):
        identifier = 'plane-'+str(index+1)
        confidence = max(0., min(1., track['observedRatio']*(1-track['medianError']/4)))
        scene['layers'].append({'id': identifier, 'label': 'Grouped image card '+str(index+1),
                                'assetId': assets[index]['id'], 'width': track['assetWidth'], 'height': track['assetHeight'],
                                'zIndex': index+1, 'visible': True, 'offset': {'x': 0, 'y': 0}, 'scale': 1,
                                'rotation': 0, 'opacity': 1,
                                'lighting': {'type': 'bilinear-gain', 'keyframes': track['lightingKeys']},
                                'keyframes': track['keyframes']})
        card_reports.append({'id': identifier, 'confidence': round(confidence, 4),
                             'observedCoverage': round(track['coverage'], 4), 'trackedFrameRatio': round(track['observedRatio'], 4),
                             'medianReprojectionErrorPixels': round(track['medianError'], 4),
                             'anchorFeatures': track['anchorFeatures'],
                             'partialVisibility': track.get('partialVisibility', False),
                             'lightingObservedRatio': round(track['lightingObservedRatio'], 4),
                             'geometryInferredFromSharedAspect': track['proposal'].get('aspectInferred', False),
                             'screenshotInternalText': 'GROUPED_NOT_NATIVE'})
    all_comparisons = []
    sampled = set([0, len(frames)//4, len(frames)//2, len(frames)*3//4, len(frames)-1])
    comparison_width = min(width, 360)
    comparison_height = round(height*comparison_width/width)
    for index in range(len(frames)):
        original = cv2.imread(str(frames[index]), cv2.IMREAD_COLOR)
        composite = render_frame(original, tracks, index, background_image)
        small_source = cv2.resize(original, (comparison_width, comparison_height), interpolation=cv2.INTER_AREA)
        small_composite = cv2.resize(composite, (comparison_width, comparison_height), interpolation=cv2.INTER_AREA)
        absolute = np.abs(small_composite.astype(float)-small_source.astype(float))
        mse = float(np.mean((small_composite.astype(float)-small_source.astype(float))**2))
        if index in sampled:
            large_absolute = np.abs(composite.astype(float)-original.astype(float))
            comparison = np.concatenate((original, composite, np.clip(large_absolute*3, 0, 255).astype(np.uint8)), axis=1)
            cv2.imwrite(str(output/('comparison-'+str(index).zfill(6)+'.png')), comparison)
        all_comparisons.append({'frame': index, 'meanAbsoluteError': round(float(absolute.mean()), 3),
                                'psnrDb': round(10*math.log10(255**2/max(1e-9, mse)), 3),
                                'changedPixelFractionOver30': round(float(np.mean(absolute.max(axis=2) > 30)), 4)})
    worst = sorted(all_comparisons, key=lambda item:item['meanAbsoluteError'], reverse=True)[:5]
    for item in worst:
        index = item['frame']
        if index not in sampled:
            original = cv2.imread(str(frames[index]), cv2.IMREAD_COLOR)
            composite = render_frame(original, tracks, index, background_image)
            delta = np.abs(composite.astype(float)-original.astype(float))
            comparison = np.concatenate((original, composite, np.clip(delta*3, 0, 255).astype(np.uint8)), axis=1)
            cv2.imwrite(str(output/('comparison-'+str(index).zfill(6)+'.png')), comparison)
    sampled.update(item['frame'] for item in worst)
    comparisons = [item for item in all_comparisons if item['frame'] in sampled]
    failed = [item for item in all_comparisons if item['meanAbsoluteError'] >= 12 or item['changedPixelFractionOver30'] >= .12]
    visual_pass = not failed
    warnings = ['Each card is one replaceable grouped image. Screenshot text, icons and embedded objects are not independent native layers.',
                'Only pixels actually visible in the source frames were recovered. Unobserved card areas are transparent.',
                'Planar similarity motion only; perspective/deformation and arbitrary scenes are not supported.',
                'Background is inferred from observed uncovered row colors. This is not contextual inpainting or a hidden full-frame video duplicate.',
                'Rounded card corners are approximate geometric clipping, not independently measured alpha masks.',
                'Lighting uses four measured corner gains per plane. This is a low-frequency approximation, not full shadow or reflection reconstruction.',
                'Layer order is a spatial stack hypothesis and needs visual review; it is not semantic occlusion certification.']
    if not visual_pass:
        warnings.append('Source-versus-reconstruction pixel comparison failed. Do not claim exact recreation or publish automatically.')
    if request.get('sourceHasAudio'):
        warnings.append('Audio was detected but not reconstructed or copied into this editable scene.')
    analysis = {'method': 'local-planar-cards-v2', 'scope': 'editable grouped image planes and measured lighting; not screenshot internal text',
                'frameCount': len(frames), 'fps': fps, 'width': width, 'height': height,
                'anchorFrame': anchor_index, 'backgroundConfidence': round(bg_confidence, 4), 'cards': card_reports,
                'warnings': warnings, 'quality': {'state': 'REVIEW_REQUIRED', 'visualComparison': 'PASS' if visual_pass else 'FAIL',
                                                  'exactRecreation': False, 'nativeText': 'NOT_RUN',
                                                  'audioReconstruction': 'NOT_RUN', 'zOrder': 'REVIEW_REQUIRED',
                                                  'comparedFrameCount': len(frames), 'comparisonWidth': comparison_width,
                                                  'comparisonHeight': comparison_height, 'worstFrame': worst[0]['frame'],
                                                  'meanAbsoluteError': round(float(np.mean([item['meanAbsoluteError'] for item in all_comparisons])), 3),
                                                  'maxMeanAbsoluteError': max(item['meanAbsoluteError'] for item in all_comparisons),
                                                  'maxChangedPixelFractionOver30': max(item['changedPixelFractionOver30'] for item in all_comparisons),
                                                  'failedFrameCount': len(failed),
                                                  'comparisons': comparisons},
                'metadata': {'networkRequests': 0, 'modelInvocations': 0, 'modelDownloads': 0,
                             'elapsedSeconds': round(time.monotonic()-started, 3),
                             'tracking': 'OpenCV SIFT + RANSAC similarity; observed anchors and bounded neighbor bridging'}}
    return account_tracked_attempt({'success': True, 'scene': scene, 'assets': assets, 'analysis': analysis}, tracked_candidate)


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.read(64*1024))
        result = process(request)
        print(json.dumps(result, allow_nan=False, separators=(',', ':')))
    except Exception as error:
        print(json.dumps({'success': False, 'code': 'REFERENCE_ANALYSIS_FAILED',
                          'error': type(error).__name__+': '+str(error)[:220]}))
        sys.exit(1)
