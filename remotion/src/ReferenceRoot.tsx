import React from 'react';
import {CalculateMetadataFunction, Composition, registerRoot} from 'remotion';
import {ReferenceMotion, ReferenceMotionProps} from './ReferenceMotion';
import {validateScene} from '../../reference-motion/schema';

const metadata: CalculateMetadataFunction<ReferenceMotionProps> = ({props}) => {
  const scene = validateScene(props.scene);
  return {width: scene.width, height: scene.height, fps: scene.fps, durationInFrames: scene.durationFrames, props: {...props, scene}};
};

// Dedicated entrypoint keeps existing V1/V2 and flagship registrations intact.
// Its default is a transparent placeholder, not supposed reference evidence.
export function ReferenceRoot() {
  return <Composition
    id="ReferenceMotion"
    component={ReferenceMotion}
    width={720}
    height={1280}
    fps={30}
    durationInFrames={150}
    calculateMetadata={metadata}
    defaultProps={{
      scene: {format: 'shortscraft-reference-motion', version: 1, width: 720, height: 1280, fps: 30, durationFrames: 150, background: '#b7b7b7', layers: [{id: 'placeholder', label: 'Reference card placeholder', assetId: 'placeholder', width: 1, height: 1, zIndex: 0, visible: false, offset: {x: 0, y: 0}, scale: 1, rotation: 0, opacity: 1, keyframes: [{frame: 0, corners: [[120, 180], [600, 180], [600, 1100], [120, 1100]], opacity: 1}, {frame: 149, corners: [[120, 180], [600, 180], [600, 1100], [120, 1100]], opacity: 1}]}]},
      images: {placeholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='},
      watermark: false,
    }}
  />;
}
registerRoot(ReferenceRoot);
