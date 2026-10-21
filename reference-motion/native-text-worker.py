"""Conservative offline native text for measured, flat-background references.

This is NOT general video OCR, semantic inpainting or text-motion synthesis.
Pinned learned OCR is actually called on at most six source frames. Only an
agreeing high-confidence phrase with an isolated, uniform-color footprint is
eligible. All-frame pixel matching determines its observed visibility/motion.
Accepted source glyph pixels are returned as exclusion masks; callers MUST
remove those pixels from other artwork before adding the native text layer.
Unrecognized formulae, perspective, changing words and morphs remain grouped.
"""
import base64
import hashlib
import importlib.util
import io
import math
from pathlib import Path
import re
import time

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / 'flagship' / 'assets' / 'NotoSansDevanagari.ttf'
FONT_CATALOG = {
    'noto-sans': (FONT, '14ec4af41f27482216d1c2229f417ff9b1425e1babb014e57d1d40d03229853e'),
    'latin-modern-roman': (ROOT / 'reference-motion' / 'fonts' / 'LMRoman10-Regular.otf',
                           '1aa18cfefa58132c52ce5de70db1fd1154201c19cd2b2cdaffba4906a33e6852'),
}


def _image(frame, color_order):
    if isinstance(frame, (str, Path)):
        value = cv2.imread(str(frame))
        if value is None:
            raise ValueError('Cannot read server-owned text-analysis frame')
        return cv2.cvtColor(value, cv2.COLOR_BGR2RGB)
    value = np.asarray(frame)
    if value.dtype != np.uint8 or value.ndim != 3 or value.shape[2] != 3:
        raise ValueError('Text-analysis frames must be uint8 RGB or BGR')
    return value[:, :, ::-1].copy() if color_order == 'BGR' else value


def _png(image):
    from PIL import Image
    buffer = io.BytesIO()
    Image.fromarray(image).save(buffer, format='PNG')
    return buffer.getvalue()


def _load_ocr():
    location = ROOT / 'workers' / 'neural-text-adapter.py'
    spec = importlib.util.spec_from_file_location('reference_native_actual_ocr', location)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.NeuralTextAdapter()


def _word_eligible(item, width, height):
    text = item.get('text')
    if not isinstance(text, str) or not 3 <= len(text.strip()) <= 160 or (item.get('recognitionConfidence') or 0) < .95:
        return False
    # The installed multilingual recognizer may transcribe equations as Latin
    # letters. The narrow native adapter does not infer mathematical notation.
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 ,.!?%+#&:;'\"()/\-]*", text.strip()):
        return False
    if sum(character.isalpha() for character in text) < 3 or abs(item.get('rotation', 999)) > 2:
        return False
    box = item.get('bounds', {})
    x, y, bw, bh = (box.get(key, 0) for key in ('x', 'y', 'width', 'height'))
    return 0 <= x < width and 0 <= y < height and 24 <= bw <= width*.9 and 10 <= bh <= height*.25 and bw*bh <= width*height*.30


def _font_footprint(content, font_name='noto-sans'):
    from PIL import Image, ImageDraw, ImageFont
    font_path, expected_sha = FONT_CATALOG[font_name]
    if not font_path.is_file() or hashlib.sha256(font_path.read_bytes()).hexdigest() != expected_sha:
        raise ValueError('Verified packaged native text font is unavailable')
    font_size = 24
    font = ImageFont.truetype(str(font_path), font_size)
    width = max(1, int(math.ceil(font.getlength(content)))+2)
    height = int(math.ceil(font_size*1.3))+2
    raster = Image.new('L', (width, height))
    ImageDraw.Draw(raster).text((0, font_size), content, font=font, fill=255, anchor='ls')
    alpha = np.asarray(raster)
    yy, xx = np.where(alpha > 12)
    if not len(xx):
        raise ValueError('Native text has no supported glyph footprint')
    return alpha, (int(xx.min()), int(yy.min()), int(xx.max()+1), int(yy.max()+1)), width, height, font_size


def _candidate(item, image, background):
    height, width = image.shape[:2]
    box = item['bounds']
    x, y = max(0, box['x']-2), max(0, box['y']-2)
    right, bottom = min(width, box['x']+box['width']+2), min(height, box['y']+box['height']+2)
    patch = image[y:bottom, x:right]
    delta = patch.astype(np.float32)-background
    magnitude = np.max(np.abs(delta), axis=2)
    foreground = magnitude > 12
    ys, xs = np.where(foreground)
    if len(xs) < 16 or np.mean(foreground) > .65:
        return None, 'not-isolated-text-footprint'
    # Four-sided real background evidence is required; no rectangular repair is
    # accepted across artwork, a card edge, a photo, a glow or a gradient.
    ring = np.concatenate((foreground[:2].ravel(), foreground[-2:].ravel(), foreground[:, :2].ravel(), foreground[:, -2:].ravel()))
    if float(np.mean(ring)) > .02:
        return None, 'text-region-touches-other-artwork'
    # Alpha edges are not a second ink color. Estimate the endpoint from the
    # strongest actually observed cores, not the median of antialiased strokes.
    strong = magnitude >= np.quantile(magnitude[foreground], .98)
    fill = np.median(patch[strong], axis=0).astype(np.float32)
    direction = fill-background
    denominator = float(np.sum(direction**2))
    if denominator < 80**2:
        return None, 'text-contrast-too-low'
    strength = np.clip(np.sum(delta*direction, axis=2)/denominator, 0, 1)
    residual = np.linalg.norm(delta-strength[:, :, None]*direction, axis=2)
    if float(np.percentile(residual[foreground], 95)) > 18:
        return None, 'text-surface-is-not-single-flat-color'
    left, top, right_ink, bottom_ink = int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)
    observed = (foreground[top:bottom_ink, left:right_ink]).astype(np.uint8)
    halo = np.ones((3, 3), np.uint8)
    choices = []
    for font_name in FONT_CATALOG:
        try:
            alpha, font_bounds, plane_width, plane_height, font_size = _font_footprint(item['text'].strip(), font_name)
        except (OSError, ValueError):
            continue
        fx, fy, fr, fb = font_bounds
        target = cv2.resize(alpha[fy:fb, fx:fr], (right_ink-left, bottom_ink-top), interpolation=cv2.INTER_AREA) > 32
        recall = float(np.count_nonzero(observed & cv2.dilate(target.astype(np.uint8), halo))/np.count_nonzero(observed))
        precision = float(np.count_nonzero(target & cv2.dilate(observed, halo))/max(1, np.count_nonzero(target)))
        choices.append({'font': font_name, 'recall': recall, 'precision': precision, 'fontAlpha': alpha,
                        'fontBounds': font_bounds, 'planeWidth': plane_width, 'planeHeight': plane_height, 'fontSize': font_size})
    if not choices:
        return None, 'verified-native-fonts-unavailable'
    fitted = max(choices, key=lambda choice: (min(choice['recall'], choice['precision']), choice['recall']+choice['precision']))
    recall, precision = fitted['recall'], fitted['precision']
    # Font identity is estimated, not asserted. A poor available-font fit stays
    # original vector artwork instead of replacing it with unrelated lettering.
    if recall < .90 or precision < .90:
        return None, 'available-native-font-does-not-fit'
    return {'content': item['text'].strip(), 'x': x, 'y': y, 'template': foreground.astype(np.uint8),
            'ink': (left, top, right_ink, bottom_ink), 'fill': fill,
            **{key: fitted[key] for key in ('font', 'fontAlpha', 'fontBounds', 'planeWidth', 'planeHeight', 'fontSize')},
            'fontFit': {'recallWithinOnePixel': round(recall, 4), 'precisionWithinOnePixel': round(precision, 4),
                        'fontIdentity': 'MEASURED_BEST_PACKAGED_FONT_NOT_EXACT_IDENTITY',
                        'candidates': [{'font': choice['font'], 'recallWithinOnePixel': round(choice['recall'], 4),
                                        'precisionWithinOnePixel': round(choice['precision'], 4)} for choice in choices]}}, None


def detect_native_text(frames, background, fps=30, max_keyframes=6, output_directory=None, color_order='RGB', max_layers=3):
    """Return {layers,masks,rendered,metadata} at the caller's analysis dimensions.

    frames: 2..300 uint8 RGB/BGR arrays OR existing operator-owned PNG Paths.
    background: actual measured RGB/BGR color in the SAME input color order.
    masks: full-resolution uint8 glyph footprints that MUST be excluded from
      every remaining vector/image layer. Values represent actual source ink,
      dilated one pixel for anti-alias halo, never a claimed learned segmentation.
    rendered: native-font RGB frame approximations for independent quality checks.
      The original source is NOT copied into these foreground layers.
    """
    started = time.monotonic()
    if not isinstance(frames, (list, tuple)) or not 2 <= len(frames) <= 300 or fps != 30 or color_order not in ('RGB', 'BGR'):
        raise ValueError('Native text requires 2..300 actual 30fps frames')
    if isinstance(max_keyframes, bool) or not isinstance(max_keyframes, int) or not 2 <= max_keyframes <= 6:
        raise ValueError('Native OCR keyframe budget must be 2..6')
    if isinstance(max_layers, bool) or not isinstance(max_layers, int) or not 1 <= max_layers <= 3:
        raise ValueError('Native text layer budget must be 1..3')
    images = [_image(frame, color_order) for frame in frames]
    height, width = images[0].shape[:2]
    if min(width, height) < 64 or max(width, height) > 1280 or width*height > 900000 or width*height*len(images) > 100000000 or any(image.shape != images[0].shape for image in images):
        raise ValueError('Native OCR analysis dimensions exceed their budget')
    background = np.asarray(background, np.float32)
    if background.shape != (3,) or not np.isfinite(background).all() or np.min(background) < 0 or np.max(background) > 255:
        raise ValueError('Native OCR needs the measured flat background RGB')
    if color_order == 'BGR':
        background = background[::-1].copy()
    masks = [np.zeros((height, width), np.uint8) for _ in frames]
    rendered = [np.full((height, width, 3), background, np.uint8) for _ in frames]
    evidence = {'method': 'actual-PP-OCRv4-agreement-isolated-flat-text-v1', 'networkRequests': 0, 'modelDownloads': 0,
                'actualOcrCalls': 0, 'textRemoval': 'ONLY_VERIFIED_FLAT_BACKGROUND_GLYPH_EXCLUSION', 'nativeFont': 'MEASURED_BEST_PACKAGED_FONT',
                'fontSHA256': {name: expected for name, (_, expected) in FONT_CATALOG.items()},
                'samples': [], 'accepted': [], 'rejected': [], 'semanticInpainting': 'NOT_RUN', 'exactTextReconstruction': False,
                'fontFit': 'ESTIMATED_REQUIRES_INDEPENDENT_RENDER_VALIDATION', 'wordMorphs': 'UNSUPPORTED_REMAINS_GROUPED',
                'languageScope': 'HIGH_CONFIDENCE_LATIN_WORDS_AND_NUMBERS_ONLY'}
    try:
        adapter = _load_ocr()
    except (ImportError, RuntimeError, OSError) as error:
        evidence.update({'state': 'OCR_UNAVAILABLE', 'errorType': type(error).__name__, 'processingMs': round((time.monotonic()-started)*1000)})
        return {'layers': [], 'masks': masks, 'rendered': rendered, 'metadata': evidence}
    sampled = sorted(set(np.linspace(0, len(frames)-1, min(max_keyframes, len(frames))).astype(int).tolist()))
    groups = {}
    destination = Path(output_directory) if output_directory is not None else None
    if destination is not None and (not destination.is_absolute() or not destination.is_dir()):
        raise ValueError('Use an existing server-owned text audit directory')
    for frame in sampled:
        detected = adapter.detect(_png(images[frame]), 'connected-glyph-halo')
        evidence['actualOcrCalls'] += 1
        evidence['model'] = detected['metadata']['model']
        evidence['modelSHA256'] = detected['metadata']['modelSHA256']
        entry = {'frame': frame, 'processingMs': detected['metadata']['processingMs'], 'instances': []}
        for item in detected['instances']:
            entry['instances'].append({key: item[key] for key in ('text', 'polygon', 'bounds', 'recognitionConfidence', 'maskPrecision')})
            if not _word_eligible(item, width, height):
                continue
            candidate, reason = _candidate(item, images[frame], background)
            if candidate is None:
                evidence['rejected'].append({'frame': frame, 'text': item['text'], 'reason': reason})
                continue
            key = candidate['content']
            groups.setdefault(key, []).append((frame, item, candidate))
        evidence['samples'].append(entry)
    layers = []
    for content, observations in sorted(groups.items(), key=lambda pair: (-len(pair[1]), pair[0])):
        if len(layers) >= max_layers:
            break
        if len(set(item[0] for item in observations)) < 2:
            evidence['rejected'].append({'text': content, 'reason': 'no-independent-temporal-OCR-agreement'})
            continue
        if len(set(item[0] for item in observations)) != len(observations):
            evidence['rejected'].append({'text': content, 'reason': 'ambiguous-duplicate-phrase-in-one-frame'})
            continue
        _, exemplar, candidate = observations[-1]
        template = candidate['template']
        th, tw = template.shape
        template_area = int(np.count_nonzero(template))
        records, observed_frames = [], []
        ink_left, ink_top, ink_right, ink_bottom = candidate['ink']
        font_left, font_top, font_right, font_bottom = candidate['fontBounds']
        sx, sy = (ink_right-ink_left)/(font_right-font_left), (ink_bottom-ink_top)/(font_bottom-font_top)
        default_left = candidate['x']+ink_left-font_left*sx
        default_top = candidate['y']+ink_top-font_top*sy
        default_quad = [[default_left, default_top], [default_left+candidate['planeWidth']*sx, default_top],
                        [default_left+candidate['planeWidth']*sx, default_top+candidate['planeHeight']*sy],
                        [default_left, default_top+candidate['planeHeight']*sy]]
        matched = []
        for frame, image in enumerate(images):
            foreground = np.max(np.abs(image.astype(float)-background), axis=2) > 12
            response = cv2.matchTemplate(foreground.astype(np.float32), template.astype(np.float32), cv2.TM_CCOEFF_NORMED)
            _, score, _, position = cv2.minMaxLoc(response)
            left, top = position
            current = foreground[top:top+th, left:left+tw]
            intersection = int(np.count_nonzero(current & (template > 0)))
            union = int(np.count_nonzero(current | (template > 0)))
            valid = score >= .88 and intersection/max(1, union) >= .86
            if valid:
                # All source ink in this isolated text region must follow the
                # same measured template; original/partial duplicate text is
                # never retained behind the emitted native layer.
                valid = np.count_nonzero(current)/max(1, template_area) <= 1.10
            if valid:
                patch = image[top:top+th, left:left+tw].astype(np.float32)
                direction = candidate['fill']-background
                strength = np.sum((patch-background)*direction, axis=2)/max(1., float(np.sum(direction**2)))
                opacity = float(np.clip(np.quantile(strength[current], .98), 0, 1))
                residual = np.linalg.norm(patch-background-np.clip(strength, 0, 1)[:, :, None]*direction, axis=2)
                if opacity < .06 or float(np.percentile(residual[current], 95)) > 18:
                    valid = False
            if valid:
                matched.append((frame, left, top, opacity))
                observed_frames.append(frame)
            records.append({'frame': frame, 'corners': default_quad, 'opacity': 0.})
        if len(observed_frames) < 6:
            evidence['rejected'].append({'text': content, 'reason': 'insufficient-all-frame-pixel-matches'})
            continue
        for frame, left, top, observed_opacity in matched:
            image = images[frame]
            local = (np.max(np.abs(image[top:top+th, left:left+tw].astype(float)-background), axis=2) > 4).astype(np.uint8)*255
            local = cv2.dilate(local, np.ones((3, 3), np.uint8))
            if np.any(masks[frame][top:top+th, left:left+tw] & local):
                continue
            masks[frame][top:top+th, left:left+tw] |= local
            actual_left = left+ink_left-font_left*sx
            actual_top = top+ink_top-font_top*sy
            quad = [[actual_left, actual_top], [actual_left+candidate['planeWidth']*sx, actual_top],
                    [actual_left+candidate['planeWidth']*sx, actual_top+candidate['planeHeight']*sy],
                    [actual_left, actual_top+candidate['planeHeight']*sy]]
            records[frame] = {'frame': frame, 'corners': quad, 'opacity': round(observed_opacity, 5)}
            transform = np.float32([[sx, 0, actual_left], [0, sy, actual_top]])
            alpha = cv2.warpAffine(candidate['fontAlpha'], transform, (width, height), flags=cv2.INTER_LINEAR).astype(np.float32)/255*observed_opacity
            rendered[frame] = np.round(candidate['fill']*alpha[:, :, None]+rendered[frame]*(1-alpha[:, :, None])).astype(np.uint8)
        fill = '#%02x%02x%02x' % tuple(np.clip(np.rint(candidate['fill']), 0, 255).astype(int))
        layer = {'id': 'native_text_'+str(len(layers)+1), 'label': 'Editable text: '+content[:70], 'assetId': None,
                 'width': candidate['planeWidth'], 'height': candidate['planeHeight'], 'zIndex': 800+len(layers), 'visible': True,
                 'offset': {'x': 0, 'y': 0}, 'scale': 1, 'rotation': 0, 'opacity': 1, 'lighting': None, 'vector': None,
                 'keyframes': records,
                 'text': {'content': content, 'font': candidate['font'], 'fontWeight': 400, 'fontSize': candidate['fontSize'],
                          'lineHeight': 1.3, 'letterSpacing': 0, 'align': 'left', 'fill': fill, 'strokeWidth': 0, 'strokeColor': fill}}
        layers.append(layer)
        evidence['accepted'].append({'id': layer['id'], 'text': content, 'ocrConsensusFrames': [int(item[0]) for item in observations],
                                     'confidence': round(min(item[1]['recognitionConfidence'] for item in observations), 5),
                                     'observedFrameCount': len(observed_frames), 'observedFrames': observed_frames,
                                     'font': candidate['font'], 'fontFit': candidate['fontFit'], 'motion': 'MEASURED_TRANSLATION_AND_VISIBILITY_ONLY',
                                     'glyphExclusion': 'MEASURED_SOURCE_CONTRAST_WITH_ONE_PIXEL_HALO'})
    evidence['state'] = 'REVIEW_REQUIRED' if layers else 'NO_CERTIFIED_NATIVE_TEXT'
    evidence['processingMs'] = round((time.monotonic()-started)*1000)
    if destination is not None:
        import json
        from PIL import Image
        (destination/'native-text-evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        (destination/'native-text-layers.json').write_text(json.dumps(layers, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
        for index in sorted(set([0, len(images)//2, len(images)-1])):
            Image.fromarray(masks[index]).save(destination/('native-text-exclusion-'+str(index).zfill(6)+'.png'))
            Image.fromarray(rendered[index]).save(destination/('native-text-preview-'+str(index).zfill(6)+'.png'))
            removed = images[index].copy()
            removed[masks[index] > 0] = background.astype(np.uint8)
            Image.fromarray(removed).save(destination/('native-text-hidden-'+str(index).zfill(6)+'.png'))
    if color_order == 'BGR':
        rendered = [image[:, :, ::-1].copy() for image in rendered]
    return {'layers': layers, 'masks': masks, 'rendered': rendered, 'metadata': evidence}
