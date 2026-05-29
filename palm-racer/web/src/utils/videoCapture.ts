/**
 * @file videoCapture.ts
 * @description Shared video frame capture utility.
 *
 * Extracted from NativePlatform.ts and WebPlatform.ts to eliminate
 * code duplication. Both platforms use the same mirror-capture logic.
 */

/**
 * Capture a single frame from a video element as base64 JPEG.
 *
 * The image is horizontally mirrored (front camera selfie mode).
 * A simple non-cryptographic hash is computed for dedup/digest purposes.
 *
 * @param video - HTMLVideoElement with an active camera stream.
 * @returns base64-encoded JPEG data and a hex digest string.
 */
export function captureFrameFromVideo(video: HTMLVideoElement): {
  base64: string;
  digest: string;
  width: number;
  height: number;
} {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d')!;

  // Mirror for front camera
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const base64 = dataUrl.split(',')[1];

  // Simple hash for digest (not cryptographic, just for dedup)
  let hash = 0;
  for (let i = 0; i < base64.length; i++) {
    hash = ((hash << 5) - hash + base64.charCodeAt(i)) | 0;
  }
  const digest = Math.abs(hash).toString(16).padStart(8, '0');

  return { base64, digest, width: canvas.width, height: canvas.height };
}
