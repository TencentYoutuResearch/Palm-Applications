/**
 * @file ConfigService.ts
 * @description Fetches application feature flags from backend /app_config endpoint.
 */

import api from './api';
import { logger } from '@/utils/logger';

export interface AppConfigFeatures {
  guestMode: boolean;
}

export interface AppConfig {
  features: AppConfigFeatures;
}

/** Default config used when backend is unreachable or returns invalid data. */
const DEFAULT_CONFIG: AppConfig = {
  features: {
    guestMode: true,
  },
};

/**
 * Fetch application config from backend.
 * Falls back to defaults on any error (fail-open for guest mode).
 */
export async function fetchAppConfig(): Promise<AppConfig> {
  try {
    // api interceptor already unwraps response.data, so resp is the JSON body
    const resp: any = await api.post('/app/config', {});
    const data = resp?.Data ?? resp?.data;
    if (!data?.Features && !data?.features) {
      logger.warn('ConfigService', 'Invalid config response, using defaults');
      return DEFAULT_CONFIG;
    }
    const features = data.Features ?? data.features;
    return {
      features: {
        guestMode: features.GuestMode ?? features.guest_mode ?? true,
      },
    };
  } catch (e) {
    logger.warn('ConfigService', 'Failed to fetch config, using defaults:', (e as Error).message);
    return DEFAULT_CONFIG;
  }
}
