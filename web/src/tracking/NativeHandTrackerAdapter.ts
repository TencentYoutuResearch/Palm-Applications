/**
 * NativeHandTrackerAdapter — receives hand landmarks from Android native
 * MediaPipe SDK via JSBridge events, replacing the WASM-based MediaPipeAdapter.
 *
 * Protocol:
 *   JS calls JSBridge.call('startHandTracking') → native starts CameraX + MediaPipe
 *   Native broadcasts 'nativeHandLandmarks' events with:
 *     { landmarks: "[{x,y,z},...]" | null, frame: "<base64 JPEG>" | null }
 *   JS calls JSBridge.call('stopHandTracking') → native stops
 */

import { HandLandmarks } from './types';
import { logger } from '@/utils/logger';
import { getI18nT } from '@/main';

export type OnResultsCallback = (landmarks: HandLandmarks | null) => void;
export type ProgressCallback = (percent: number, message: string) => void;
export type OnFrameCallback = (frameBase64: string) => void;
export type OnFullFrameCallback = (fullBase64: string) => void;

export class NativeHandTrackerAdapter {
  private onResults_: OnResultsCallback | null = null;
  private onFrame_: OnFrameCallback | null = null;
  private onFullFrame_: OnFullFrameCallback | null = null;
  private eventHandler_: ((e: Event) => void) | null = null;
  private isTracking_ = false;

  setOnResults(cb: OnResultsCallback): void {
    this.onResults_ = cb;
  }

  /**
   * Register a callback to receive low-res camera preview frames.
   */
  setOnFrame(cb: OnFrameCallback): void {
    this.onFrame_ = cb;
  }

  /**
   * Register a callback to receive full-res frames for anti-cheat.
   */
  setOnFullFrame(cb: OnFullFrameCallback): void {
    this.onFullFrame_ = cb;
  }

  /**
   * Start native hand tracking via JSBridge.
   * No camera/video element needed — native handles everything.
   */
  async init(
    _videoElement: HTMLVideoElement, // unused, kept for interface compatibility
    onProgress?: ProgressCallback
  ): Promise<void> {
    if (onProgress) onProgress(10, getI18nT()('game.loading.nativeStarting'));

    // Listen for native landmark broadcasts
    this.eventHandler_ = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      // Parse landmarks
      const landmarksStr = detail.landmarks;
      if (!landmarksStr || landmarksStr === 'null') {
        this.onResults_?.(null);
      } else {
        try {
          const landmarks: HandLandmarks = JSON.parse(landmarksStr);
          this.onResults_?.(landmarks);
        } catch {
          this.onResults_?.(null);
        }
      }

      // Forward preview frame if available
      const frame = detail.frame;
      if (frame && this.onFrame_) {
        this.onFrame_(frame);
      }

      // Forward full-res frame for anti-cheat
      const fullFrame = detail.fullFrame;
      if (fullFrame && this.onFullFrame_) {
        this.onFullFrame_(fullFrame);
      }
    };

    window.addEventListener('nativeHandLandmarks', this.eventHandler_);

    // Call native to start hand tracking (fire-and-forget)
    const bridge = (window as any).JSBridge;
    if (bridge && typeof bridge.call === 'function') {
      if (onProgress) onProgress(30, getI18nT()('game.loading.nativeInitCamera'));
      logger.debug('NativeAdapter', 'Calling startHandTracking via JSBridge');
      bridge.call('startHandTracking', '{}', 'cb_handtrack_start');
      // Give native a moment to start camera
      await new Promise<void>((r) => setTimeout(r, 2000));
      this.isTracking_ = true;
      if (onProgress) onProgress(100, getI18nT()('game.loading.nativeReady'));
      logger.debug('NativeAdapter', 'Initialized, listening for nativeHandLandmarks events');
    } else {
      throw new Error('JSBridge not available — native hand tracking requires Android app');
    }
  }

  getVideoElement(): HTMLVideoElement | null {
    return null; // No video element in native mode
  }

  dispose(): void {
    if (this.eventHandler_) {
      window.removeEventListener('nativeHandLandmarks', this.eventHandler_);
      this.eventHandler_ = null;
    }

    // Tell native to stop
    const bridge = (window as any).JSBridge;
    if (bridge && bridge.call) {
      bridge.call('stopHandTracking', '{}', 'cb_handtrack_stop');
    }

    this.onFrame_ = null;
    this.onFullFrame_ = null;
    this.isTracking_ = false;
  }
}
