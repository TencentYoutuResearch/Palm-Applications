/**
 * @file PalmAuthService.ts
 * @description High-level palm authentication service.
 *
 * Provides login and anti-cheat verification, automatically selecting
 * the correct platform implementation (Web or Native).
 */
import { getPlatformService } from './index';
import type {
  PalmLoginOptions,
  PalmRegisterOptions,
  PalmRegisterResult,
  AntiCheatResult,
  PreSelectedFrame,
} from './PlatformService';
import type { UserInfo } from '@/stores/user';
import { getI18nT } from '@/main';

/**
 * Perform palm biometric login (1:N recognition).
 */
export async function palmLogin(options?: PalmLoginOptions): Promise<UserInfo> {
  const platform = getPlatformService();
  return platform.palmLogin(options);
}

/**
 * Register user's palm to the Palm Platform.
 * 当前平台未实现 palmRegister 时抛错（例如纯 Native 端应由宿主 App 调 SDK 完成）。
 */
export async function palmRegister(options: PalmRegisterOptions): Promise<PalmRegisterResult> {
  const platform = getPlatformService();
  if (typeof platform.palmRegister !== 'function') {
    throw new Error(getI18nT()('platform.platformNotSupported'));
  }
  return platform.palmRegister(options);
}

/**
 * Perform anti-cheat palm verification.
 * Returns structured result with cheat type and detected userId.
 *
 * @param expectedUserId - 期望的用户 ID
 * @param bestFrame - 可选的预选最优帧，由 BestFrameCollector 提供
 */
export async function antiCheatVerify(
  expectedUserId: string,
  bestFrame?: PreSelectedFrame
): Promise<AntiCheatResult> {
  const platform = getPlatformService();
  return platform.antiCheatVerify(expectedUserId, bestFrame);
}
