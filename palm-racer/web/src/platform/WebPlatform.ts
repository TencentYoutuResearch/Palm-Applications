/**
 * @file WebPlatform.ts
 * @description Web browser platform implementation.
 *
 * Uses the device camera to capture palm images, then sends them
 * to the Go backend proxy for TC3-signed Palm API calls.
 */
import type {
  PalmLoginOptions,
  PalmLoginState,
  AntiCheatResult,
  PreSelectedFrame,
} from './PlatformService';
import type { UserInfo } from '@/stores/user';
import * as PalmApiService from '@/services/PalmApiService';
import { captureFrameFromVideo } from '@/utils/videoCapture';
import { logger } from '@/utils/logger';
import { getI18nT } from '@/main';
import { BasePlatform } from './BasePlatform';
import {
  STABILIZE_DELAY,
  USER_CANCELLED_PALM,
} from '@/config/platformConfig';

export class WebPlatform extends BasePlatform {
  protected get platformName(): string {
    return 'WebPlatform';
  }

  protected get stabilizeDelay(): number {
    return STABILIZE_DELAY.web;
  }

  /**
   * Login using palm biometric recognition via the Go backend proxy.
   *
   * Flow (sequential, fail-fast): token → camera → preview → scan loop.
   */
  async palmLogin(options?: PalmLoginOptions): Promise<UserInfo> {
    const { videoElement, onStateChange } = options ?? {};
    const onState = onStateChange ?? (() => {});
    const session = this.createSession();

    return this.cameraFlow_(session, videoElement, onState, (s, video) =>
      this.scanLoop_(s, video, onState)
    );
  }

  /**
   * Anti-cheat verification with 3-tier logic:
   *
   * 1. code=0 + userId matches    → PASS
   * 2. code=0 + userId mismatches → CHEAT (different person)
   * 3. code=1001013 (not found)   → skip (image quality issue)
   * 4. Other codes / network error → skip
   */
  async antiCheatVerify(expectedUserId: string, bestFrame?: PreSelectedFrame): Promise<AntiCheatResult> {
    const extracted = this.extractBestFrame(bestFrame);
    if (extracted) {
      return this.verifyWithFrame(expectedUserId, extracted.base64, extracted.digest);
    }

    // Fallback: realtime capture from existing video element
    const existingVideo = document.querySelector('video') as HTMLVideoElement | null;
    if (!existingVideo || !existingVideo.srcObject) {
      logger.debug('AntiCheat', 'No active camera, skip');
      return { passed: true };
    }
    const captured = captureFrameFromVideo(existingVideo);
    logger.debug('AntiCheat', `Using realtime frame (${captured.base64.length} chars)`);
    return this.verifyWithFrame(expectedUserId, captured.base64, captured.digest);
  }
}
