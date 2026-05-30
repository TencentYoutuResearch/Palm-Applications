<template>
  <div v-if="visible" class="camera-preview">
    <canvas ref="previewCanvas" class="preview-canvas" />
    <div class="preview-label">
      <span v-if="handDetected" class="dot green" />
      <span v-else class="dot red" />
      {{ handDetected ? t('game.camera.handTracking') : t('game.camera.noHand') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { HandTracker } from '@/tracking/HandTracker';
import { getI18nT } from '@/main';

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  handDetected: boolean;
  isNativeMode: boolean;
  getTracker: () => HandTracker | null;
  getVideo: () => HTMLVideoElement | undefined;
}>();

const previewCanvas = ref<HTMLCanvasElement>();

// Hand landmark connections for drawing skeleton
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],       // thumb
  [0,5],[5,6],[6,7],[7,8],       // index
  [0,9],[9,10],[10,11],[11,12],  // middle
  [0,13],[13,14],[14,15],[15,16],// ring
  [0,17],[17,18],[18,19],[19,20],// pinky
  [5,9],[9,13],[13,17],          // palm
];

// Native preview frame: decoded Image from base64 sent by native CameraX
let nativeFrameImg: HTMLImageElement | null = null;
let nativeFrameReady = false;

/**
 * Called by parent when a native preview frame arrives.
 * Decode base64 JPEG into an Image for canvas drawing.
 */
function onNativeFrame(base64: string): void {
  if (!nativeFrameImg) {
    nativeFrameImg = new Image();
    nativeFrameImg.onload = () => { nativeFrameReady = true; };
  }
  nativeFrameReady = false;
  nativeFrameImg.src = 'data:image/jpeg;base64,' + base64;
}

/** Draw camera preview with hand skeleton overlay. Called from game loop. */
function drawPreview(): void {
  const canvas = previewCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = 160;
  const H = 120;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;

  if (props.isNativeMode) {
    if (nativeFrameImg && nativeFrameReady) {
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(nativeFrameImg, 0, 0, W, H);
      ctx.restore();
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(getI18nT()('game.camera.waitingCamera'), W / 2, H / 2);
      return;
    }
  } else {
    const video = props.getVideo();
    if (!video || video.readyState < 2) return;
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();
  }

  drawSkeletonOverlay(ctx, W, H);
}

function drawSkeletonOverlay(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const tracker = props.getTracker();
  if (!tracker?.isReady) return;
  const gesture = tracker.getCurrentGesture();
  if (!gesture.isHandDetected) return;

  const landmarks = tracker.getLastLandmarks();
  if (!landmarks || landmarks.length < 21) return;

  const color = gesture.isBraking ? '#ff4444' : '#00ff88';
  const mirrorSkeleton = props.isNativeMode;

  // Draw connections
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (const [a, b] of HAND_CONNECTIONS) {
    const ax = (mirrorSkeleton ? (1 - landmarks[a].x) : landmarks[a].x) * W;
    const ay = landmarks[a].y * H;
    const bx = (mirrorSkeleton ? (1 - landmarks[b].x) : landmarks[b].x) * W;
    const by = landmarks[b].y * H;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  // Draw landmark points
  ctx.fillStyle = color;
  for (let i = 0; i < 21; i++) {
    const x = (mirrorSkeleton ? (1 - landmarks[i].x) : landmarks[i].x) * W;
    const y = landmarks[i].y * H;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Expose methods for parent to call
defineExpose({ drawPreview, onNativeFrame });
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.camera-preview {
  position: absolute;
  bottom: 56px;
  left: 12px;
  width: clamp(100px, 15vw, 160px);
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.2);
  z-index: 15;
  background: #000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);

  .preview-canvas {
    width: 100%;
    aspect-ratio: 4 / 3;
    display: block;
  }

  .preview-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 11px;
    color: $color-text-secondary;
    background: rgba(0, 0, 0, 0.8);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;

    &.green { background: #4caf50; box-shadow: 0 0 6px #4caf50; }
    &.red { background: #f44336; box-shadow: 0 0 6px #f44336; }
  }
}
</style>
