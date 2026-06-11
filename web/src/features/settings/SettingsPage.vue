<template>
  <div class="page settings-page">
    <div class="page-header">
      <button class="back-btn" @click="router.back()">←</button>
      <h1>{{ t('settings.title') }}</h1>
    </div>

    <div class="settings-list">
      <div class="setting-item">
        <span class="setting-label">{{ t('settings.camera') }}</span>
        <label class="toggle">
          <input type="checkbox" v-model="settingsStore.cameraEnabled" />
          <span class="slider" />
        </label>
      </div>

      <div class="setting-item">
        <span class="setting-label">{{ t('settings.language') }}</span>
        <div class="lang-select-wrapper">
          <select
            class="lang-select"
            :value="settingsStore.locale"
            @change="switchLocale(($event.target as HTMLSelectElement).value as Locale)"
          >
            <option value="zh">简体中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
          <span class="lang-select-arrow">▾</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/stores/settings';
import type { Locale } from '@/stores/settings';

const router = useRouter();
const { t, locale } = useI18n();
const settingsStore = useSettingsStore();

function switchLocale(lang: Locale): void {
  settingsStore.locale = lang;
  locale.value = lang;
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.settings-page {
  justify-content: flex-start;
  padding: 16px 24px;
  gap: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;

  h1 { font-size: 24px; }
}

.back-btn {
  background: $color-bg-card;
  color: $color-text;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-list {
  width: 100%;
  max-width: 400px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.setting-label {
  font-size: 16px;
}

.toggle {
  position: relative;
  width: 50px;
  height: 28px;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    transition: background $transition-fast;

    &::before {
      content: '';
      position: absolute;
      width: 22px;
      height: 22px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: transform $transition-fast;
    }
  }

  input:checked + .slider {
    background: $color-primary;

    &::before {
      transform: translateX(22px);
    }
  }
}

.lang-select-wrapper {
  position: relative;
  display: inline-block;
}

.lang-select {
  appearance: none;
  -webkit-appearance: none;
  padding: 8px 36px 8px 14px;
  font-size: 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: $color-text;
  cursor: pointer;
  outline: none;
  transition: all $transition-fast;
  min-width: 120px;

  &:hover {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
  }

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px rgba($color-primary, 0.2);
  }

  option {
    background: #1e1e3c;
    color: #fff;
  }
}

.lang-select-arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}
</style>
