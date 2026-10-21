"""Independent all-frame comparison of actual encoded Remotion exports."""
import json
from pathlib import Path
import sys

import cv2
import numpy as np

request = json.loads(sys.stdin.read(65536))
source = Path(request['sourceFrames'])
decoded = Path(request['decodedFrames'])
output = Path(request['output'])
width, height = request['width'], request['height']
background = np.array([int(request['background'][index:index+2], 16) for index in (5, 3, 1)])
files = sorted(decoded.glob('frame-*.png'))
if len(files) != request['frameCount']:
    raise ValueError('Actual exported frame count differs from native timeline')
rows = []
kernel = np.ones((3, 3), np.uint8)
for frame, filename in enumerate(files):
    original = cv2.imread(str(source/('frame-'+str(frame+1).zfill(6)+'.png')))
    original = cv2.resize(original, (width, height), interpolation=cv2.INTER_AREA)
    movie = cv2.imread(str(filename))
    if movie is None or movie.shape != original.shape:
        raise ValueError('Actual video comparison dimensions differ')
    difference = np.abs(original.astype(float)-movie.astype(float))
    original_mask = (np.max(np.abs(original.astype(float)-background), axis=2) > 12).astype(np.uint8)
    rendered_mask = (np.max(np.abs(movie.astype(float)-background), axis=2) > 12).astype(np.uint8)
    recall = np.count_nonzero(original_mask & cv2.dilate(rendered_mask, kernel))/max(1, np.count_nonzero(original_mask)) if np.any(original_mask) else 1.
    precision = np.count_nonzero(rendered_mask & cv2.dilate(original_mask, kernel))/max(1, np.count_nonzero(rendered_mask)) if np.any(rendered_mask) else (1. if not np.any(original_mask) else 0.)
    rows.append({'frame': frame, 'meanAbsoluteError': float(difference.mean()), 'changedPixelFractionOver30': float(np.mean(difference.max(axis=2) > 30)), 'foregroundRecall': float(recall), 'foregroundPrecision': float(precision)})
    if frame in (0, len(files)//2, len(files)-1):
        cv2.imwrite(str(output/('encoded-comparison-'+str(frame).zfill(6)+'.png')), np.concatenate((original, movie, np.clip(difference*3, 0, 255).astype(np.uint8)), axis=1))
failed = [row for row in rows if row['meanAbsoluteError'] >= 12 or row['changedPixelFractionOver30'] >= .12 or row['foregroundRecall'] < .90 or row['foregroundPrecision'] < .90]
report = {'status': 'PASS' if not failed else 'FAIL', 'comparedFrameCount': len(rows), 'failedFrameCount': len(failed),
          'maxMeanAbsoluteError': max(row['meanAbsoluteError'] for row in rows), 'maxChangedPixelFractionOver30': max(row['changedPixelFractionOver30'] for row in rows),
          'minForegroundRecall': min(row['foregroundRecall'] for row in rows), 'minForegroundPrecision': min(row['foregroundPrecision'] for row in rows),
          'thresholds': {'maxMAE': 12, 'maxChangedFractionOver30': .12, 'minForegroundRecall': .90, 'minForegroundPrecision': .90}}
(output/'encoded-all-frame-metrics.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
(output/'encoded-quality.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
