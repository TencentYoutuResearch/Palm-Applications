import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import App from './App.vue';
import router from './router';
import zh from './assets/locales/zh.json';
import en from './assets/locales/en.json';
import ja from './assets/locales/ja.json';
import './assets/styles/global.scss';

const savedLocale = localStorage.getItem('palmRacer_locale') || 'zh';

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: { zh, en, ja },
});

/**
 * 在非 Vue 组件中获取翻译函数。
 * Platform 层等非组件代码可通过此函数进行国际化翻译。
 */
export function getI18nT(): (key: string, named?: Record<string, unknown>) => string {
  const { t } = i18n.global;
  return t as (key: string, named?: Record<string, unknown>) => string;
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount('#app');
