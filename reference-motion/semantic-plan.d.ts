import type {ReferenceScene, ReferenceText} from './schema';
export type UnsupportedFeature = 'PHOTOGRAPHIC_ASSETS' | 'THREE_DIMENSIONAL' | 'COMPLEX_GRADIENTS' | 'PARTICLES' | 'BLUR_GLOW' | 'MASKING_OCCLUSION' | 'CAMERA_PERSPECTIVE' | 'SCENE_CUTS' | 'AUDIO' | 'UNREADABLE_TEXT' | 'UNSUPPORTED_GLYPHS' | 'OTHER';
export interface SemanticKeyframe {frame: number; x: number; y: number; width: number; height: number; rotation: number; opacity: number; fill: string; strokeWidth?: number | null}
export interface SemanticShape {kind: 'rectangle' | 'ellipse' | 'line' | 'polygon'; points: [number, number][]; strokeWidth: number; strokeColor: string}
export interface SemanticElement {id: string; label: string; type: 'shape' | 'text'; zIndex: number; width: number; height: number; shape: SemanticShape | null; text: ReferenceText | null; keyframes: SemanticKeyframe[]}
export interface SemanticPlan {format: 'shortscraft-reference-plan'; version: 1; width: number; height: number; fps: 30; durationFrames: number; background: string; analysis: {summary: string; motionSummary: string; confidence: number; cuts: number[]; unsupportedFeatures: UnsupportedFeature[]}; elements: SemanticElement[]}
export interface ExpectedSource {width?: number; height?: number; durationFrames?: number; maxFrames?: number}
export const FORMAT: 'shortscraft-reference-plan';
export const LIMITS: Readonly<{elements: number; keyframes: number; frames: number; dimension: number; bytes: number; sceneBytes: number}>;
export const UNSUPPORTED_FEATURES: readonly UnsupportedFeature[];
export const RESPONSE_SCHEMA: Record<string, unknown>;
export function validatePlan(input: unknown, expected?: ExpectedSource): SemanticPlan;
export function compilePlan(input: unknown, expected?: ExpectedSource): ReferenceScene;
export function sampleElement(element: SemanticElement, frame: number): SemanticKeyframe;
