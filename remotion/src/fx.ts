import React from "react";
import { Easing, interpolate } from "remotion";

// Approved motion-craft curves (ported from my-video/src/components/fx.ts).
export const HEAVY = Easing.bezier(0.25, 1, 0.5, 1);
export const SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);      // fast launch -> long graceful settle
export const SNAP_OUT = Easing.bezier(0.25, 1, 0.5, 1);  // PaperInk house curve

export const enter = (frame: number, start: number, dur: number, easing = EXPO): number =>
  interpolate(frame, [start, start + dur], [0, 1], { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// windup dip -> overshoot -> settle to 1 (returns a scale track 0->1)
export const anticipate = (frame: number, start: number, dur = 22, overshoot = 1.06): number => {
  const grow = interpolate(frame, [start, start + dur * 0.55, start + dur], [0, overshoot, 1], {
    easing: EXPO, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return frame < start ? 0 : grow;
};

export const breathe = (frame: number, fps: number, amp = 0.02, periodSec = 3, phase = 0): number =>
  1 + Math.sin((frame / (periodSec * fps)) * Math.PI * 2 + phase) * amp;

export const floatY = (frame: number, fps: number, ampPx = 8, periodSec = 4, phase = 0): number =>
  Math.sin((frame / (periodSec * fps)) * Math.PI * 2 + phase) * ampPx;

// continuous cinematic push-in + tiny drift so no scene is ever perfectly static
export const camera = (frame: number, durationFrames: number, fps: number, zoomTo = 1.05): string => {
  const push = interpolate(frame, [0, durationFrames], [1.0, zoomTo], { easing: Easing.inOut(Easing.quad), extrapolateRight: "clamp" });
  const dx = Math.sin((frame / (6 * fps)) * Math.PI * 2) * 6;
  const dy = Math.cos((frame / (7 * fps)) * Math.PI * 2) * 5;
  return `scale(${push}) translate(${dx}px, ${dy}px)`;
};

export const spotlight = (accent: string, cx = "50%", cy = "42%"): React.CSSProperties => ({
  background: `radial-gradient(circle at ${cx} ${cy}, ${accent}22 0%, ${accent}0d 26%, transparent 60%)`,
  pointerEvents: "none",
});
