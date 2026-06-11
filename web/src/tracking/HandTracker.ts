/**
 * HandTracker - 高层门面，组合 MediaPipeAdapter + GestureRecognizer
 *
 * 自动检测环境：
 *  - 原生 App (JSBridge 可用) → NativeHandTrackerAdapter (CameraX + 原生 MediaPipe)
 *  - Web 浏览器              → MediaPipeAdapter (WASM)
 */

import { GestureState, HandLandmarks } from './types';
import { MediaPipeAdapter, ProgressCallback } from './MediaPipeAdapter';
import { NativeHandTrackerAdapter, type OnFrameCallback, type OnFullFrameCallback } from './NativeHandTrackerAdapter';
import { GestureRecognizer } from './GestureRecognizer';
import { isNative } from '@/utils/environment';
import { logger } from '@/utils/logger';
import { getI18nT } from '@/main';

interface Adapter {
  setOnResults(cb: (landmarks: HandLandmarks | null) => void): void;
  init(videoElement: HTMLVideoElement, onProgress?: ProgressCallback): Promise<void>;
  getVideoElement(): HTMLVideoElement | null;
  pause?(): void;
  resume?(): void;
  dispose(): void;
}

export class HandTracker {
  private adapter_: Adapter;
  private recognizer_: GestureRecognizer;
  private currentGesture_: GestureState;
  private isReady_: boolean = false;
  private lastLandmarks_: HandLandmarks | null = null;

  constructor() {
    // Auto-select adapter based on environment
    if (isNative()) {
      logger.debug('HandTracker', 'Using native adapter (CameraX + MediaPipe SDK)');
      this.adapter_ = new NativeHandTrackerAdapter();
    } else {
      logger.debug('HandTracker', 'Using WASM adapter (MediaPipe in browser)');
      this.adapter_ = new MediaPipeAdapter();
    }

    this.recognizer_ = new GestureRecognizer();
    // Native: no mirror (front camera landmarks are already in correct direction)
    // + higher sensitivity (small hand movement range on mobile)
    if (isNative()) {
      this.recognizer_.setMirrorX(false);
      this.recognizer_.setSteerSensitivity(3.0);
    }

    this.currentGesture_ = {
      steerX: 0,
      throttle: 0,
      isBraking: false,
      palmQuality: 0,
      isHandDetected: false,
    };

    this.adapter_.setOnResults((landmarks: HandLandmarks | null) => {
      this.lastLandmarks_ = landmarks;
      this.currentGesture_ = this.recognizer_.update(landmarks);
    });
  }

  /** Whether the tracker has been initialised successfully. */
  get isReady(): boolean {
    return this.isReady_;
  }

  /** Whether the palm is good for recognition / anti-cheat snapshot. */
  get isPalmGoodForRecognition(): boolean {
    return this.recognizer_.isPalmGoodForRecognition;
  }

  /**
   * Initialise the camera and MediaPipe model.
   *
   * @param videoElement - hidden <video> element for the camera feed
   * @param onProgress   - optional progress callback (0-100)
   */
  async init(
    videoElement: HTMLVideoElement,
    onProgress?: ProgressCallback
  ): Promise<void> {
    await this.adapter_.init(videoElement, onProgress);
    this.isReady_ = true;
    if (onProgress) {
      onProgress(100, getI18nT()('game.loading.initComplete'));
    }
  }

  /** Return the latest gesture state (updated every frame by MediaPipe). */
  getCurrentGesture(): GestureState {
    return this.currentGesture_;
  }

  /** Get raw landmarks for drawing skeleton overlay (null if no hand). */
  getLastLandmarks(): HandLandmarks | null {
    return this.lastLandmarks_;
  }

  /**
   * Capture the current camera frame as a base64-encoded JPEG image.
   * Useful for palm-print authentication / anti-cheat snapshots.
   *
   * @returns base64 data-URL string, or `null` if no video is available.
   */
  captureFrame(): string | null {
    const video = this.adapter_.getVideoElement();
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /**
   * Register a callback to receive camera preview frames (native mode only).
   */
  setOnFrame(cb: OnFrameCallback): void {
    if (this.adapter_ instanceof NativeHandTrackerAdapter) {
      this.adapter_.setOnFrame(cb);
    }
  }

  /**
   * Register a callback to receive full-res frames for anti-cheat (native mode only).
   */
  setOnFullFrame(cb: OnFullFrameCallback): void {
    if (this.adapter_ instanceof NativeHandTrackerAdapter) {
      this.adapter_.setOnFullFrame(cb);
    }
  }

  /** Pause tracking (stop sending frames to MediaPipe). */
  pause(): void {
    this.adapter_.pause?.();
  }

  /** Resume tracking after pause. */
  resume(): void {
    this.adapter_.resume?.();
  }

  /** Release camera, model, and all internal resources. */
  dispose(): void {
    this.adapter_.dispose();
    this.isReady_ = false;
    this.currentGesture_ = {
      steerX: 0,
      throttle: 0,
      isBraking: false,
      palmQuality: 0,
      isHandDetected: false,
    };
  }
}
