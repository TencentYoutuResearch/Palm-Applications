/**
 * Platform auto-detection and service export.
 *
 * Automatically selects WebPlatform or NativePlatform based on environment.
 * In native mode, also fetches backend API config from the native shell.
 */
import { isNative } from '@/utils/environment';
import type { PlatformService } from './PlatformService';
import { WebPlatform } from './WebPlatform';
import { NativePlatform } from './NativePlatform';
import { setApiBaseURL } from '@/services/api';
import bridge from '@/bridge/JSBridge';
import { logger } from '@/utils/logger';

let instance: PlatformService | null = null;

/**
 * 在原生环境下，尝试从 JSBridge 获取后端 API 配置。
 * 如果获取成功，自动更新 axios baseURL。
 */
async function fetchNativeApiConfig(): Promise<void> {
  // 如果已经手动配置过，跳过
  if (localStorage.getItem('palmRacer_apiBaseURL')) return;

  try {
    const config = await bridge.call<{ apiBaseURL?: string }>('getApiConfig', {}, { timeout: 3000 });
    if (config?.apiBaseURL) {
      setApiBaseURL(config.apiBaseURL);
      logger.debug('Platform', `API baseURL from native: ${config.apiBaseURL}`);
    }
  } catch (e) {
    logger.debug('Platform', 'Failed to get API config from native, using default:', (e as Error).message);
  }
}

export function getPlatformService(): PlatformService {
  if (!instance) {
    if (isNative()) {
      instance = new NativePlatform();
      // 异步获取原生侧的后端配置（不阻塞平台初始化）
      fetchNativeApiConfig();
    } else {
      instance = new WebPlatform();
    }
  }
  return instance;
}

export type { PlatformService } from './PlatformService';
