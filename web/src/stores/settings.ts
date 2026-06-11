import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type CameraView = 'chase' | 'cockpit' | 'top';
export type Locale = 'zh' | 'en' | 'ja';

export const useSettingsStore = defineStore('settings', () => {
  const cameraView = ref<CameraView>(
    (localStorage.getItem('palmRacer_cameraView') as CameraView) || 'chase'
  );
  const cameraEnabled = ref(localStorage.getItem('palmRacer_camera') !== 'false');
  const locale = ref<Locale>(
    (localStorage.getItem('palmRacer_locale') as Locale) || 'zh'
  );

  watch(cameraView, (v) => localStorage.setItem('palmRacer_cameraView', v));
  watch(cameraEnabled, (v) => localStorage.setItem('palmRacer_camera', String(v)));
  watch(locale, (v) => localStorage.setItem('palmRacer_locale', v));

  return {
    cameraView,
    cameraEnabled,
    locale,
  };
});
