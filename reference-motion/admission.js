'use strict';

const LIMITS = Object.freeze({ inputBytes: 20 * 1024 * 1024, sourceSeconds: 10,
  freeSeconds: 5, paidSeconds: 10, fps: 30, frames: 300, maxSide: 1280,
  inputSide: 4096, inputPixels: 8_500_000, timeoutMs: 180_000 });

class ReferenceMotionError extends Error {
  constructor(code, message, status = 422, details) {
    super(message); this.name = 'ReferenceMotionError'; this.code = code; this.status = status;
    if (details) this.details = details;
  }
}

function durationLimit(plan) { return ['pro', 'promax'].includes(plan) ? LIMITS.paidSeconds : LIMITS.freeSeconds; }

function validateInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['video', 'trimToSeconds', 'analysisMode', 'cloudConsent', 'ownerPcConsent'].includes(key))) {
    throw new ReferenceMotionError('REFERENCE_INPUT_INVALID', 'Upload a bounded MP4 or WebM file, not a path or URL.');
  }
  if (value.ownerPcConsent !== undefined && value.ownerPcConsent !== true) {
    throw new ReferenceMotionError('REFERENCE_PC_CONSENT_REQUIRED', 'Confirm private beta-PC processing before uploading.', 422);
  }
  if (value.trimToSeconds !== undefined && value.trimToSeconds !== 5) {
    throw new ReferenceMotionError('REFERENCE_INPUT_INVALID', 'Only an explicit trim to the first 5 seconds is supported.');
  }
  const analysisMode = value.analysisMode === undefined ? 'local' : value.analysisMode;
  if (!['local', 'gemini'].includes(analysisMode)) throw new ReferenceMotionError('REFERENCE_INPUT_INVALID', 'Unsupported reference analysis mode.');
  if (analysisMode === 'gemini' && value.cloudConsent !== true) throw new ReferenceMotionError('REFERENCE_CLOUD_CONSENT_REQUIRED', 'Confirm that the trimmed silent video may be sent to Google for Gemini analysis before continuing.', 422);
  if (analysisMode !== 'gemini' && value.cloudConsent !== undefined) throw new ReferenceMotionError('REFERENCE_INPUT_INVALID', 'Cloud consent is only valid for an explicit Gemini request.');
  if (typeof value.video !== 'string' || value.video.length > Math.ceil(LIMITS.inputBytes / 3) * 4 + 64) {
    throw new ReferenceMotionError('REFERENCE_INPUT_TOO_LARGE', 'Reference videos must be 20 MiB or smaller.', 413);
  }
  const match = value.video.match(/^data:video\/(mp4|webm);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0) {
    throw new ReferenceMotionError('REFERENCE_INPUT_INVALID', 'Upload an MP4 or WebM file with valid base64 encoding.');
  }
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > LIMITS.inputBytes) {
    throw new ReferenceMotionError('REFERENCE_INPUT_TOO_LARGE', 'Reference videos must be 20 MiB or smaller.', 413);
  }
  if (bytes.toString('base64') !== match[2]) throw new ReferenceMotionError('REFERENCE_INPUT_INVALID', 'The file encoding is invalid.');
  const extension = match[1];
  const signatureValid = extension === 'mp4'
    ? bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp'
    : bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!signatureValid) throw new ReferenceMotionError('REFERENCE_CONTAINER_INVALID', 'The actual file is not the declared MP4/WebM container.');
  return { bytes, extension, trimToSeconds: value.trimToSeconds, analysisMode };
}

function admitProbe(probe, plan, trimToSeconds) {
  if (!probe || !Array.isArray(probe.streams)) throw new ReferenceMotionError('REFERENCE_MEDIA_INVALID', 'The uploaded video could not be decoded.');
  const video = probe.streams.filter(stream => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1);
  if (video.length !== 1) throw new ReferenceMotionError('REFERENCE_MEDIA_INVALID', 'Use a reference with exactly one video stream.');
  const stream = video[0], width = Number(stream.width), height = Number(stream.height);
  const streamIndex = stream.index === undefined ? 0 : Number(stream.index);
  if (!Number.isInteger(streamIndex) || streamIndex < 0 || streamIndex > 31) {
    throw new ReferenceMotionError('REFERENCE_MEDIA_INVALID', 'The video stream index could not be verified.');
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64 ||
      Math.max(width, height) > LIMITS.inputSide || width * height > LIMITS.inputPixels) {
    throw new ReferenceMotionError('REFERENCE_DIMENSIONS_UNSUPPORTED', 'Use a video between 64 and 4096 pixels per side and no larger than 8.5 megapixels.');
  }
  // Container duration can include longer audio. Prefer the actual video stream;
  // never grant Free time based on browser-supplied duration or an audio stream.
  const timebase = typeof stream.time_base === 'string' && stream.time_base.match(/^(\d+)\/(\d+)$/);
  const tickDuration = timebase && Number(timebase[2]) > 0 ? Number(stream.duration_ts) * Number(timebase[1]) / Number(timebase[2]) : NaN;
  const candidates = [Number(stream.duration), tickDuration].filter(number => Number.isFinite(number) && number > 0);
  const originalDurationSeconds = candidates.length ? Math.max(...candidates) : Number(probe.format?.duration);
  if (!Number.isFinite(originalDurationSeconds) || originalDurationSeconds < 0.1) {
    throw new ReferenceMotionError('REFERENCE_DURATION_UNKNOWN', 'The actual video duration could not be verified.');
  }
  const allowedSeconds = durationLimit(plan), epsilon = 0.000001;
  if (originalDurationSeconds > LIMITS.sourceSeconds + epsilon) {
    throw new ReferenceMotionError('REFERENCE_SOURCE_TOO_LONG', 'Reference uploads are limited to 10 seconds on every plan.', 422,
      { originalDurationSeconds, allowedSeconds, maximumSourceSeconds: LIMITS.sourceSeconds });
  }
  if (originalDurationSeconds > allowedSeconds + epsilon && trimToSeconds !== 5) {
    throw new ReferenceMotionError('REFERENCE_TOO_LONG', 'Free references are limited to 5 seconds. Choose an explicit first-5-seconds trim or use Pro for up to 10 seconds.', 422,
      { originalDurationSeconds, allowedSeconds, canTrimToSeconds: 5, requiredPlan: 'pro' });
  }
  const selectedDurationSeconds = trimToSeconds === 5 ? Math.min(5, originalDurationSeconds) : originalDurationSeconds;
  const durationFrames = Math.min(LIMITS.frames, Math.max(1, Math.floor(selectedDurationSeconds * LIMITS.fps + epsilon)));
  return { originalDurationSeconds, durationSeconds: durationFrames / LIMITS.fps, durationFrames,
    fps: LIMITS.fps, sourceWidth: width, sourceHeight: height, sourceVideoStreamIndex: streamIndex, allowedSeconds,
    explicitlyTrimmed: trimToSeconds === 5 && originalDurationSeconds > 5,
    sourceHasAudio: probe.streams.some(item => item.codec_type === 'audio') };
}

module.exports = { LIMITS, ReferenceMotionError, durationLimit, validateInput, admitProbe };
