/**
 * Platform service interface.
 *
 * Abstracts native vs web platform differences for palm authentication.
 */
import type { UserInfo } from '@/stores/user';

export type PalmLoginState =
  | 'camera'
  | 'camera_ok'
  | 'searching'
  | 'matched'
  | 'error';

/** 刷掌注册流程的 options，复用 PalmLoginOptions 的状态回调语义。 */
export interface PalmRegisterOptions {
  /** 要注册的用户 ID（长度 1-64，仅字母/数字/下划线/短横线）。 */
  userId: string;
  /** An existing <video> element to bind the camera stream to (for live preview). */
  videoElement?: HTMLVideoElement;
  /** Callback fired when register state changes（复用 PalmLoginState，matched 表示注册成功）。 */
  onStateChange?: (state: PalmLoginState, message: string) => void;
  /** 是否强制换绑（默认 false）。 */
  isForce?: boolean;
}

/** 注册结果信息。 */
export interface PalmRegisterResult {
  /** 用户 ID（即入参的 userId，透传便于 UI 展示）。 */
  userId: string;
  /** 掌纹 ID（游戏侧一般不展示，仅用于排障）。 */
  palmId: string;
}

export interface PalmLoginOptions {
  /** An existing <video> element to bind the camera stream to (for live preview). */
  videoElement?: HTMLVideoElement;
  /** Callback fired when login state changes. */
  onStateChange?: (state: PalmLoginState, message: string) => void;
}

/** 预选的最优帧，由 BestFrameCollector 提供 */
export interface PreSelectedFrame {
  /** base64 编码的 JPEG 图像数据 */
  base64: string;
  /** 图像摘要 */
  digest: string;
}

/** Result of an anti-cheat verification check. */
export interface AntiCheatResult {
  /** Whether the check passed (same user or skipped). */
  passed: boolean;
  /** Type of cheat detected (only set when passed=false). */
  cheatType?: 'different_user' | 'unknown_palm';
  /** The userId detected by palm recognition (when a different user is recognized). */
  detectedUserId?: string;
}

export interface PlatformService {
  /**
   * Login using palm biometric recognition.
   */
  palmLogin(options?: PalmLoginOptions): Promise<UserInfo>;

  /**
   * 注册 RGB 手掌到刷掌平台。
   *
   * 在 Web 端通过摄像头采帧 + 调用后端 `/api/palm/register_rgb_palm` 完成。
   * Native 端建议由宿主 App 直接调 PalmMobileManager SDK 实现（可按需补充）。
   */
  palmRegister?(options: PalmRegisterOptions): Promise<PalmRegisterResult>;

  /**
   * Verify current user identity for anti-cheat purposes.
   * Returns structured result with cheat type and detected userId.
   *
   * @param expectedUserId - 期望的用户 ID
   * @param bestFrame - 可选的预选最优帧，由 BestFrameCollector 提供
   */
  antiCheatVerify(expectedUserId: string, bestFrame?: PreSelectedFrame): Promise<AntiCheatResult>;
}
