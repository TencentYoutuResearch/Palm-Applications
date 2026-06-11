/**
 * @file useCameraPreview.ts
 * @description Shared composable for camera preview canvas drawing.
 *
 * Extracts the common startDrawFrame/stopDrawFrame logic used by
 * both LoginPage and RegisterPage palm-scan modals.
 */
import { ref, type Ref } from 'vue';
import type { PalmLoginState } from '@/platform/PlatformService';

export interface CameraPreviewRefs {
  videoRef: Ref<HTMLVideoElement | null>;
  canvasRef: Ref<HTMLCanvasElement | null>;
  previewState: Ref<'' | 'scanning' | 'success' | 'error'>;
  messageClass: Ref<string>;
  scanMessage: Ref<string>;
  showRetry: Ref<boolean>;
}

export interface CameraPreviewActions {
  startDrawFrame: () => void;
  stopDrawFrame: () => void;
  handleStateChange: (state: PalmLoginState, msg: string) => void;
  cancelPlatform: () => void;
}

/**
 * Composable that manages camera preview drawing (video → canvas via rAF)
 * and palm-scan state transitions.
 */
export function useCameraPreview(): CameraPreviewRefs & CameraPreviewActions {
  const videoRef = ref<HTMLVideoElement | null>(null);
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const previewState = ref<'' | 'scanning' | 'success' | 'error'>('');
  const messageClass = ref('');
  const scanMessage = ref('');
  const showRetry = ref(false);
  let drawFrameId = 0;

  function startDrawFrame(): void {
    stopDrawFrame();
    const draw = () => {
      const video = videoRef.value;
      const canvas = canvasRef.value;
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (canvas.width !== 640) canvas.width = 640;
          if (canvas.height !== 480) canvas.height = 480;
          ctx.drawImage(video, 0, 0, 640, 480);
        }
      }
      drawFrameId = requestAnimationFrame(draw);
    };
    drawFrameId = requestAnimationFrame(draw);
  }

  function stopDrawFrame(): void {
    if (drawFrameId) {
      cancelAnimationFrame(drawFrameId);
      drawFrameId = 0;
    }
  }

  function handleStateChange(state: PalmLoginState, msg: string): void {
    scanMessage.value = msg;

    switch (state) {
      case 'camera_ok':
        previewState.value = 'scanning';
        messageClass.value = 'scanning';
        startDrawFrame();
        break;
      case 'searching':
        previewState.value = 'scanning';
        messageClass.value = 'scanning';
        break;
      case 'matched':
        previewState.value = 'success';
        messageClass.value = 'success';
        stopDrawFrame();
        break;
      case 'error':
        previewState.value = 'error';
        messageClass.value = 'error';
        showRetry.value = true;
        stopDrawFrame();
        break;
      default:
        messageClass.value = '';
        break;
    }
  }

  function cancelPlatform(): void {
    stopDrawFrame();
    // Dynamic import avoided; caller should handle platform cancel directly
  }

  return {
    videoRef,
    canvasRef,
    previewState,
    messageClass,
    scanMessage,
    showRetry,
    startDrawFrame,
    stopDrawFrame,
    handleStateChange,
    cancelPlatform,
  };
}
