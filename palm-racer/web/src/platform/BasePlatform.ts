/**
 * @file BasePlatform.ts
 * @description 平台服务基类，提取 WebPlatform 和 NativePlatform 的公共逻辑。
 *
 * 子类通过覆盖钩子方法来实现差异化行为（如 timeout 包装、stabilize delay 等）。
 */
import type {
  PlatformService,
  PalmLoginOptions,
  PalmLoginState,
  PalmRegisterOptions,
  PalmRegisterResult,
  AntiCheatResult,
  PreSelectedFrame,
} from './PlatformService';
import type { UserInfo } from '@/stores/user';
import * as PalmApiService from '@/services/PalmApiService';
import { captureFrameFromVideo } from '@/utils/videoCapture';
import { logger } from '@/utils/logger';
import { getI18nT } from '@/main';
import {
  MAX_RETRIES,
  RETRY_INTERVAL,
  ANTI_CHEAT_FAIL_THRESHOLD,
  USER_CANCELLED_PALM,
} from '@/config/platformConfig';

/** 会话对象，用于跟踪和取消正在进行的操作。 */
export interface PalmSession {
  cancelled: boolean;
}

/**
 * 平台服务基类。
 *
 * 提供 session 管理、摄像头流程、识别/注册循环、反作弊等公共逻辑。
 * 子类需要实现 `platformName` 和可选的钩子方法。
 */
export abstract class BasePlatform implements PlatformService {
  /** 当前活跃的 session（登录/注册互斥）。 */
  protected activeSession_: PalmSession | null = null;

  // Anti-cheat state
  protected consecutiveFails_ = 0;
  protected readonly failThreshold_ = ANTI_CHEAT_FAIL_THRESHOLD;

  /** 子类标识名，用于日志输出。 */
  protected abstract get platformName(): string;

  /** 子类提供的 stabilize delay（ms）。 */
  protected abstract get stabilizeDelay(): number;

  // ─── Session 管理 ──────────────────────────────────────────────

  cancelLogin(): void {
    if (this.activeSession_) {
      this.activeSession_.cancelled = true;
      this.activeSession_ = null;
    }
  }

  /** 创建新 session，取消旧 session。 */
  protected createSession(): PalmSession {
    if (this.activeSession_) {
      this.activeSession_.cancelled = true;
    }
    const session: PalmSession = { cancelled: false };
    this.activeSession_ = session;
    return session;
  }

  /** 如果 session 已取消则抛出异常，可选释放 MediaStream。 */
  protected bailIfCancelled(session: PalmSession, stream?: MediaStream): void {
    if (!session.cancelled) return;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    throw new Error(USER_CANCELLED_PALM);
  }

  /** 清理 session（仅当仍是当前 session 时）。 */
  protected clearSession(session: PalmSession): void {
    if (this.activeSession_ === session) {
      this.activeSession_ = null;
    }
  }

  // ─── 可覆盖的钩子方法 ──────────────────────────────────────────

  /**
   * 包装 Promise 以添加超时（子类可覆盖）。
   * 默认实现不添加超时（WebPlatform 行为）。
   */
  protected wrapWithTimeout<T>(promise: Promise<T>, _timeoutMs: number, _timeoutMsg: string): Promise<T> {
    return promise;
  }

  // ─── 摄像头流程 ────────────────────────────────────────────────

  /** 打开摄像头并获取 MediaStream。 */
  protected async openCamera(session: PalmSession, onState: (state: PalmLoginState, msg: string) => void): Promise<MediaStream> {
    onState('camera', getI18nT()('platform.openingCamera'));
    let stream: MediaStream;
    try {
      stream = await this.wrapWithTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        }),
        8000,
        getI18nT()('platform.cameraTimeout')
      );
    } catch (e) {
      const msg = (e as Error).message || '';
      if ((e as Error).name === 'NotAllowedError' || msg.includes('Permission')) {
        throw new Error(getI18nT()('platform.cameraPermissionDenied'));
      }
      if ((e as Error).name === 'NotFoundError') {
        throw new Error(getI18nT()('platform.cameraNotFound'));
      }
      throw new Error(getI18nT()('platform.cameraFailed', { msg }));
    }
    this.bailIfCancelled(session, stream);
    return stream;
  }

  /** 绑定 video 元素并等待首帧。 */
  protected async bindVideo(
    session: PalmSession,
    stream: MediaStream,
    videoElement?: HTMLVideoElement
  ): Promise<HTMLVideoElement> {
    const video = videoElement ?? document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.muted = true;
    try {
      await video.play();
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.onloadeddata = () => resolve();
      });
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(getI18nT()('platform.videoPlayFailed', { msg: (e as Error).message }));
    }
    this.bailIfCancelled(session, stream);
    return video;
  }

  /** 等待摄像头稳定。 */
  protected async waitStabilize(session: PalmSession, stream: MediaStream): Promise<void> {
    await new Promise((r) => setTimeout(r, this.stabilizeDelay));
    this.bailIfCancelled(session, stream);
  }

  // ─── 通用重试循环框架 ──────────────────────────────────────────

  /**
   * 通用重试循环：截帧 → 调用 API → 判定结果，直到成功/终态错误/达到最大重试次数。
   *
   * @param session   当前会话
   * @param video     视频元素
   * @param onAttempt 每次尝试前的回调（用于更新 UI 状态）
   * @param apiCall   每次尝试的 API 调用逻辑，返回 { done, result?, fatal? }
   * @param failMsg   达到最大重试次数时的错误消息
   */
  private retryLoop_<T>(
    session: PalmSession,
    video: HTMLVideoElement,
    onAttempt: (attempt: number) => void,
    apiCall: (base64: string, digest: string, attempt: number) => Promise<{ done: boolean; result?: T; fatal?: string }>,
    failMsg: string,
    onState: (state: PalmLoginState, msg: string) => void
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let attempt = 0;
      let settled = false;

      const tick = async () => {
        if (settled) return;
        if (session.cancelled) {
          settled = true;
          reject(new Error(USER_CANCELLED_PALM));
          return;
        }

        attempt++;
        onAttempt(attempt);

        try {
          const { base64, digest } = captureFrameFromVideo(video);
          logger.debug(this.platformName, `Attempt ${attempt}/${MAX_RETRIES}`);

          const outcome = await apiCall(base64, digest, attempt);

          if (settled) return;
          if (session.cancelled) {
            settled = true;
            reject(new Error(USER_CANCELLED_PALM));
            return;
          }

          if (outcome.done) {
            settled = true;
            resolve(outcome.result as T);
            return;
          }
          if (outcome.fatal) {
            settled = true;
            onState('error', outcome.fatal);
            reject(new Error(outcome.fatal));
            return;
          }
        } catch (e) {
          if (settled) return;
          logger.debug(this.platformName, `Attempt ${attempt} failed:`, (e as Error).message);
        }

        if (settled) return;
        if (session.cancelled) {
          settled = true;
          reject(new Error(USER_CANCELLED_PALM));
          return;
        }

        if (attempt >= MAX_RETRIES) {
          settled = true;
          onState('error', failMsg);
          reject(new Error(failMsg));
          return;
        }

        setTimeout(tick, RETRY_INTERVAL);
      };

      tick();
    });
  }

  // ─── 识别循环 ──────────────────────────────────────────────────

  /**
   * 循环截帧并尝试 1:N 识别，直到成功或达到最大重试次数。
   */
  protected scanLoop_(
    session: PalmSession,
    video: HTMLVideoElement,
    onState: (state: PalmLoginState, msg: string) => void
  ): Promise<UserInfo> {
    return this.retryLoop_<UserInfo>(
      session,
      video,
      (attempt) => onState('searching', getI18nT()('platform.recognizing', { attempt, max: MAX_RETRIES })),
      async (base64, digest) => {
        const resp = await this.wrapWithTimeout(
          PalmApiService.searchRgbPalm(base64, digest),
          30000,
          getI18nT()('platform.recognizeTimeout')
        );
        if (resp.code === 0 && resp.userId) {
          logger.debug(this.platformName, 'Palm login success:', resp.userId, resp.userName);
          onState('matched', getI18nT()('platform.recognizeSuccess', { name: resp.userName }));
          return { done: true, result: { userId: resp.userId, userName: resp.userName, tenantName: resp.tenantName } };
        }
        logger.debug(this.platformName, `code=${resp.code}, ${resp.message}`);
        return { done: false };
      },
      getI18nT()('platform.recognizeFailed'),
      onState
    );
  }

  // ─── 注册循环 ──────────────────────────────────────────────────

  /**
   * 循环截帧并调用注册接口，直到成功或达到最大重试次数。
   */
  protected registerLoop_(
    session: PalmSession,
    video: HTMLVideoElement,
    userId: string,
    isForce: boolean,
    onState: (state: PalmLoginState, msg: string) => void
  ): Promise<PalmRegisterResult> {
    return this.retryLoop_<PalmRegisterResult>(
      session,
      video,
      (attempt) => onState('searching', getI18nT()('platform.collectingPalm', { attempt, max: MAX_RETRIES })),
      async (base64, digest) => {
        const resp = await this.wrapWithTimeout(
          PalmApiService.registerRgbPalm(userId, base64, digest, isForce),
          30000,
          getI18nT()('platform.registerTimeout')
        );
        if (resp.code === 0) {
          logger.debug(this.platformName, `Palm register success: userId=${userId}, palmId=${resp.palmId}`);
          onState('matched', getI18nT()('platform.registerSuccess', { name: userId }));
          return { done: true, result: { userId, palmId: resp.palmId } };
        }
        // 该用户已注册过掌纹(5001)：终态错误
        if (resp.code === 5001) {
          const errMsg = getI18nT()('platform.userAlreadyBound');
          logger.warn(this.platformName, `Register fatal: code=5001, userId=${userId} already registered`);
          return { done: false, fatal: errMsg };
        }
        // 该掌纹已被其他用户绑定(5002)：终态错误
        if (resp.code === 5002) {
          const errMsg = getI18nT()('platform.palmBoundToOtherUser');
          logger.warn(this.platformName, `Register fatal: code=5002, palm bound to another user`);
          return { done: false, fatal: errMsg };
        }
        logger.debug(this.platformName, `code=${resp.code}, ${resp.message}`);
        return { done: false };
      },
      getI18nT()('platform.registerFailed'),
      onState
    );
  }

  // ─── Camera 登录/注册公共流程 ──────────────────────────────────

  /**
   * Camera 流程模板：camera → video → action → cleanup。
   * 子类的 palmLogin 和 palmRegister 都复用此方法。
   */
  protected async cameraFlow_<T>(
    session: PalmSession,
    videoElement: HTMLVideoElement | undefined,
    onState: (state: PalmLoginState, msg: string) => void,
    action: (session: PalmSession, video: HTMLVideoElement, stream: MediaStream) => Promise<T>
  ): Promise<T> {
    // Step 1: 摄像头
    const stream = await this.openCamera(session, onState);

    // Step 3: 绑 video
    const video = await this.bindVideo(session, stream, videoElement);
    onState('camera_ok', getI18nT()('platform.cameraReady'));

    // 等待摄像头稳定
    await this.waitStabilize(session, stream);

    // Step 4: 执行具体操作
    try {
      return await action(session, video, stream);
    } finally {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      this.clearSession(session);
    }
  }

  // ─── 注册流程（公共部分） ──────────────────────────────────────

  /**
   * 注册刷掌：camera → registerLoop_。
   * 子类可直接使用或覆盖。
   */
  async palmRegister(options: PalmRegisterOptions): Promise<PalmRegisterResult> {
    const { userId, videoElement, onStateChange, isForce = false } = options;
    const onState = onStateChange ?? (() => {});
    const session = this.createSession();

    return this.cameraFlow_(session, videoElement, onState, (s, video) =>
      this.registerLoop_(s, video, userId, isForce, onState)
    );
  }

  // ─── Anti-cheat ────────────────────────────────────────────────

  resetAntiCheat(): void {
    this.consecutiveFails_ = 0;
  }

  /**
   * Extract frame data from a PreSelectedFrame if available.
   * Returns null if no bestFrame provided (subclass handles fallback).
   */
  protected extractBestFrame(bestFrame?: PreSelectedFrame): { base64: string; digest: string } | null {
    if (!bestFrame) return null;
    logger.debug('AntiCheat', `Using pre-selected best frame (${bestFrame.base64.length} chars)`);
    return { base64: bestFrame.base64, digest: bestFrame.digest };
  }

  /**
   * Anti-cheat 基础验证逻辑（处理 API 响应的 3-tier 判定）。
   * 子类需要自行获取帧数据后调用此方法。
   */
  protected async verifyWithFrame(
    expectedUserId: string,
    base64: string,
    digest: string
  ): Promise<AntiCheatResult> {
    try {
      const resp = await PalmApiService.searchRgbPalm(base64, digest);
      logger.debug('AntiCheat', `resp: code=${resp.code}, userId=${resp.userId}, expected=${expectedUserId}`);

      if (resp.code === 0 && resp.userId) {
        if (resp.userId === expectedUserId) {
          this.consecutiveFails_ = 0;
          logger.debug('AntiCheat', 'PASS');
          return { passed: true };
        } else {
          this.consecutiveFails_ = 0;
          logger.warn('AntiCheat', `CHEAT: userId ${resp.userId} != ${expectedUserId}`);
          return { passed: false, cheatType: 'different_user', detectedUserId: resp.userId };
        }
      }

      if (resp.code === 1001013) {
        logger.debug('AntiCheat', '1001013 user not found, skip (image quality issue)');
        return { passed: true };
      }

      logger.debug('AntiCheat', `code=${resp.code}, skip (${resp.message})`);
      return { passed: true };
    } catch (e) {
      logger.debug('AntiCheat', `Error, skip: ${(e as Error).message}`);
      return { passed: true };
    }
  }

  // ─── 抽象方法 ──────────────────────────────────────────────────

  abstract palmLogin(options?: PalmLoginOptions): Promise<UserInfo>;
  abstract antiCheatVerify(expectedUserId: string, bestFrame?: PreSelectedFrame): Promise<AntiCheatResult>;
}
