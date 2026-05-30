/**
 * Palm Racer 专用 JSBridge SDK 封装。
 *
 * 封装与原生 PalmMobileManager SDK 的交互。
 */
import bridge from './JSBridge';
import type { UserInfo } from '@/stores/user';

export interface PalmRecognitionResult {
  userId: string;
  userName: string;
  tenantName?: string;
  score?: number;
  palmDirection?: string;
}

export interface PalmVerificationResult {
  verified: boolean;
}

export interface DeviceInfo {
  platform: 'android' | 'ios';
  model: string;
}

/**
 * Invoke native PalmMobileManager SDK for 1:N palm recognition (login).
 */
export async function palmRecognition(): Promise<UserInfo> {
  const result = await bridge.invoke<PalmRecognitionResult>('palmRecognition', {
    mode: 'recognition',
  });
  return {
    userId: result.userId,
    userName: result.userName,
    tenantName: result.tenantName,
  };
}

/**
 * Invoke native PalmMobileManager SDK for palm verification (anti-cheat).
 */
export async function palmVerification(): Promise<boolean> {
  const result = await bridge.invoke<PalmVerificationResult>('palmVerification', {});
  return result.verified;
}

/**
 * Get device info from native shell.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  return bridge.call<DeviceInfo>('getDeviceInfo', {});
}
