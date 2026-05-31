/**
 * @file appConfig.ts
 * @description Pinia store for application feature flags.
 * Fetched from backend at app startup, falls back to defaults on error.
 */

import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { fetchAppConfig, type AppConfigFeatures } from '@/services/ConfigService';

export const useAppConfigStore = defineStore('appConfig', () => {
  const features = reactive<AppConfigFeatures>({
    guestMode: true, // default: enabled until backend responds
  });

  const loaded = ref(false);

  /**
   * Fetch config from backend. Non-blocking — caller doesn't need to await.
   * Reactively updates features when response arrives.
   */
  async function init(): Promise<void> {
    const config = await fetchAppConfig();
    features.guestMode = config.features.guestMode;
    loaded.value = true;
  }

  return {
    features,
    loaded,
    init,
  };
});
