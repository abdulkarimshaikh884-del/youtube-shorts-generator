export type Point = [number, number];
export type Quad = [Point, Point, Point, Point];
export interface ReferenceKeyframe {frame: number; corners: Quad; opacity: number}
export interface ReferenceLighting {type: 'bilinear-gain'; keyframes: {frame: number; gains: number[]}[]}
export interface ReferenceVectorShape {paths: number[]}
export interface ReferenceVector {fill: string | null; colorKeyframes: {frame:number;color:string}[]; paths: string[]; shapes: ReferenceVectorShape[]; keyframes: {frame: number; shape: number}[]}
export interface ReferenceObjectPaint {fill: string | null; colorKeyframes: {frame: number; color: string}[]}
export interface ReferenceObjectPart {paint: number; paths: number[]}
export interface ReferenceObjectShape {parts: ReferenceObjectPart[]}
export interface ReferenceObjectVector {fill: string | null; paints: ReferenceObjectPaint[]; paths: string[]; shapes: ReferenceObjectShape[]; keyframes: {frame: number; shape: number}[]}
export interface ReferenceText {
  content: string; font: 'noto-sans' | 'latin-modern-roman'; fontWeight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  fontSize: number; lineHeight: number; letterSpacing: number; align: 'left' | 'center' | 'right';
  fill: string; strokeWidth: number; strokeColor: string;
}
export interface ReferenceLayer {
  id: string; label: string; assetId: string | null; width: number; height: number; zIndex: number;
  visible: boolean; offset: {x: number; y: number}; scale: number; rotation: number; opacity: number;
  keyframes: ReferenceKeyframe[];
  lighting?: ReferenceLighting | null;
  vector?: ReferenceVector | ReferenceObjectVector | null;
  text?: ReferenceText | null;
}
export interface ReferenceScene {
  format: 'shortscraft-reference-motion'; version: 1 | 2 | 3 | 4; width: number; height: number; fps: 30;
  durationFrames: number; background: string; layers: ReferenceLayer[];
}
export const FORMAT: 'shortscraft-reference-motion';
export const LIMITS: Readonly<{layers: number; frames: number; keys: number; dimension: number; bytes: number}>;
export function validateScene(input: unknown): ReferenceScene;
export function frameState(layer: ReferenceLayer, frame: number): {corners: Quad; opacity: number; visible: boolean};
export function lightingState(layer: ReferenceLayer, frame: number): number[];
export function vectorState(layer: ReferenceLayer, frame: number): ReferenceVectorShape | null;
export function vectorColor(layer:ReferenceLayer,frame:number):string;
export function multipartState(layer: ReferenceLayer, frame: number): ReferenceObjectShape | null;
export function multipartColor(layer: ReferenceLayer, paintIndex: number, frame: number): string;
export function assetIds(scene: ReferenceScene): string[];
export function retimeScene(input: ReferenceScene, durationFrames: number): ReferenceScene;
export function homographyMatrix(width: number, height: number, corners: Quad): number[];
