/**
 * Native platform implementation.
 *
 * For palm login, supports two modes:
 *   1. Native SDK mode: calls native PalmMobileManager SDK via JSBridge
 *      (preferred when the native shell has integrated the Palm SDK).
 *   2. Camera fallback mode: reuses BasePlatform's camera → Go backend API
 *      flow when native SDK is unavailable.
 *
 * For hand tracking during gameplay: uses native CameraX + MediaPipe SDK
 * via JSBridge (NativeHandTrackerAdapter).
 */
import type {
  PalmLoginOptions,
  PalmLoginState,
  AntiCheatResult,
  PreSelectedFrame,
} from './PlatformService';
import type { UserInfo } from '@/stores/user';
import { withTimeout } from '@/utils/promises';
import { logger } from '@/utils/logger';
import { getI18nT } from '@/main';
import bridge from '@/bridge/JSBridge';
import { BasePlatform } from './BasePlatform';
import {
  STABILIZE_DELAY,
  USER_CANCELLED_PALM,
} from '@/config/platformConfig';

export class NativePlatform extends BasePlatform {
  protected get platformName(): string {
    return 'NativePlatform';
  }

  protected get stabilizeDelay(): number {
    return STABILIZE_DELAY.native;
  }

  /**
   * 覆盖基类的 wrapWithTimeout，为所有异步操作添加超时保护。
   * Native 环境下网络和硬件操作更容易超时，需要显式超时控制。
   */
  protected wrapWithTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
    return withTimeout(promise, timeoutMs, timeoutMsg);
  }

  /**
   * Palm login with two-tier strategy:
   *   1. Try native SDK via JSBridge (palmRecognition) — zero camera/network
   *      overhead on the web side.
   *   2. Fall back to getUserMedia + Go backend API if native SDK is
   *      unavailable or returns an error.
   */
  async palmLogin(options: PalmLoginOptions = {}): Promise<UserInfo> {
    const { videoElement, onStateChange } = options;
    const onState = onStateChange ?? (() => {});

    const session = this.createSession();

    // ── Strategy 1: Native SDK via JSBridge ──────────────────────────
    try {
      const user = await this.tryNativeSdkLogin_(session, onState);
      if (user) return user;
    } catch (e) {
      if ((e as Error).message === USER_CANCELLED_PALM) throw e;
      logger.debug('NativePlatform', 'Native SDK login unavailable, falling back to camera mode:', (e as Error).message);
    }

    this.bailIfCancelled(session);

    // ── Strategy 2: Camera + Go backend API (inherited from BasePlatform) ────
    return this.cameraFlow_(session, videoElement, onState, (s, video) =>
      this.scanLoop_(s, video, onState)
    );
  }

  /**
   * 尝试通过 JSBridge 调用原生 Palm SDK 进行刷掌登录。
   * 如果原生侧未实现或返回 stub 数据，返回 null 以触发回退。
   */
  private async tryNativeSdkLogin_(
    session: { cancelled: boolean },
    onState: (state: PalmLoginState, msg: string) => void
  ): Promise<UserInfo | null> {
    const win = window as unknown as Record<string, unknown>;
    const hasBridge = typeof win.JSBridge === 'object' ||
      !!(win.webkit as Record<string, unknown> | undefined)?.messageHandlers;
    if (!hasBridge) return null;

    onState('camera', getI18nT()('platform.connectingNative'));

    try {
      const result = await bridge.invoke<{
        userId: string;
        userName: string;
        tenantName?: string;
      }>('palmRecognition', { mode: 'recognition' }, { timeout: 60000 });

      if (session.cancelled) throw new Error(USER_CANCELLED_PALM);

      if (!result || !result.userId || result.userId === 'stub_user') {
        logger.debug('NativePlatform', 'Native SDK returned stub data, falling back');
        return null;
      }

      onState('matched', getI18nT()('platform.recognizeSuccess', { name: result.userName }));
      return {
        userId: result.userId,
        userName: result.userName,
        tenantName: result.tenantName,
      };
    } catch (e) {
      if ((e as Error).message?.includes('timed out') ||
          (e as Error).message?.includes('No handler') ||
          (e as Error).message?.includes('not found')) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Store the latest native camera frame (base64 JPEG) for anti-cheat use.
   * Called by GamePage when NativeHandTrackerAdapter delivers a frame.
   */
  setLatestFrame(base64: string): void {
    this.latestFrame_ = base64;
  }

  private latestFrame_ = '';

  /**
   * Anti-cheat verification using the latest native camera frame.
   *
   * 3-tier logic (matches WebPlatform via BasePlatform.verifyWithFrame):
   * 1. code=0 + userId matches    → PASS
   * 2. code=0 + userId mismatches → CHEAT
   * 3. code=1001013 (not found)   → skip
   * 4. Other codes / network error → skip
   */
  async antiCheatVerify(expectedUserId: string, bestFrame?: PreSelectedFrame): Promise<AntiCheatResult> {
    const extracted = this.extractBestFrame(bestFrame);
    if (extracted) {
      return this.verifyWithFrame(expectedUserId, extracted.base64, extracted.digest);
    }

    if (!this.latestFrame_) {
      logger.debug('AntiCheat', 'No full-res frame, skip');
      return { passed: true };
    }

    // Use stored native camera frame
    try {
      const mirrored = await this.mirrorFrame_(this.latestFrame_);
      let hash = 0;
      for (let i = 0; i < Math.min(mirrored.length, 200); i++) {
        hash = ((hash << 5) - hash + mirrored.charCodeAt(i)) | 0;
      }
      const base64 = mirrored;
      const digest = Math.abs(hash).toString(16).padStart(8, '0');
      logger.debug('AntiCheat', `Using latest native frame (${base64.length} chars)`);
      return this.verifyWithFrame(expectedUserId, base64, digest);
    } catch (e) {
      logger.debug('AntiCheat', `Error preparing frame: ${(e as Error).message}`);
      return { passed: true };
    }
  }

  /**
   * Mirror a base64 JPEG image horizontally using an offscreen canvas.
   * Required because front camera frames are not mirrored, but palm
   * registration was done with a mirrored image.
   */
  private mirrorFrame_(base64: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => resolve(base64);
      img.src = 'data:image/jpeg;base64,' + base64;
    });
  }
}
