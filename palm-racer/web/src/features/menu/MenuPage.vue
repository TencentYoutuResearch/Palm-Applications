<template>
  <div class="page menu-page">
    <div class="menu-header">
      <h1 class="title">🏎️ PalmRacer <span class="badge-3d">3D</span></h1>
      <p class="subtitle">{{ t('menu.subtitle') }}</p>
      <p class="welcome">{{ userStore.isGuest ? t('menu.guestMode') : t('menu.welcome', { name: userStore.userName }) }}</p>
    </div>

    <div class="controls-guide">
      <h3>{{ t('menu.controlsGuide') }}</h3>
      <div class="guide-items">
        <div class="guide-item">
          <span class="guide-icon">🖐️</span>
          <span>{{ t('menu.controlOpen') }}</span>
        </div>
        <div class="guide-item">
          <span class="guide-icon">🖐️↔️</span>
          <span>{{ t('menu.controlMove') }}</span>
        </div>
        <div class="guide-item">
          <span class="guide-icon">✊</span>
          <span>{{ t('menu.controlFist') }}</span>
        </div>
      </div>
    </div>

    <div class="camera-views">
      <button
        v-for="view in cameraViews"
        :key="view.id"
        class="view-btn"
        :class="{ active: settingsStore.cameraView === view.id }"
        @click="settingsStore.cameraView = view.id"
      >
        <span class="view-icon">{{ view.icon }}</span>
        <span class="view-label">{{ t(view.labelKey) }}</span>
      </button>
    </div>

    <div class="menu-actions">
      <button class="btn-primary start-btn" @click="startGame">
        🏁 {{ t('menu.start') }}
      </button>
      <div class="menu-row">
        <button v-if="!userStore.isGuest" class="btn-secondary" @click="router.push('/leaderboard')">
          🏆 {{ t('menu.leaderboard') }}
        </button>
        <button class="btn-secondary" @click="router.push('/settings')">
          ⚙️ {{ t('menu.settings') }}
        </button>
      </div>
      <p v-if="userStore.isGuest" class="guest-hint">{{ t('menu.guestHint') }}</p>
      <button class="logout-btn" @click="handleLogout">
        🚪 {{ t('menu.logout') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import { useSettingsStore } from '@/stores/settings';
import { useGameStore } from '@/stores/game';
import type { CameraView } from '@/stores/settings';

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const settingsStore = useSettingsStore();
const gameStore = useGameStore();

const cameraViews: { id: CameraView; icon: string; labelKey: string }[] = [
  { id: 'chase', icon: '🎥', labelKey: 'menu.cameraView.chase' },
  { id: 'cockpit', icon: '🏎️', labelKey: 'menu.cameraView.cockpit' },
  { id: 'top', icon: '🛰️', labelKey: 'menu.cameraView.top' },
];

function startGame(): void {
  gameStore.reset();
  router.push('/game');
}

function handleLogout(): void {
  userStore.logout();
  router.push('/login');
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.menu-page {
  gap: clamp(10px, 2vh, 20px);
  padding: clamp(8px, 2vh, 24px) 16px;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 20%, rgba($color-primary, 0.1), transparent 60%),
              $color-bg;
  overflow-y: auto;
}

.menu-header {
  text-align: center;

  .title {
    font-size: clamp(20px, 4.5vh, 32px);
    font-weight: 800;
    background: linear-gradient(135deg, $color-primary, $color-accent);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .badge-3d {
    background: linear-gradient(135deg, #00d4ff, #7b2ff7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 0.6em;
    font-weight: 900;
    vertical-align: super;
    margin-left: 2px;
  }

  .subtitle {
    margin-top: 2px;
    color: $color-text-secondary;
    font-size: clamp(10px, 1.4vh, 13px);
    letter-spacing: 1px;
  }

  .welcome {
    margin-top: 2px;
    color: $color-text-secondary;
    font-size: clamp(11px, 1.6vh, 14px);
  }
}

.controls-guide {
  padding: clamp(6px, 1vh, 14px) clamp(10px, 2vw, 16px);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  width: min(360px, 90vw);

  h3 {
    color: $color-accent;
    margin-bottom: clamp(4px, 0.6vh, 8px);
    font-size: clamp(10px, 1.3vh, 12px);
    letter-spacing: 1px;
    text-transform: uppercase;
    font-weight: 700;
  }

  .guide-items {
    display: flex;
    justify-content: space-around;
    gap: clamp(4px, 1vw, 12px);
  }

  .guide-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: clamp(10px, 1.3vh, 12px);
    color: $color-text-secondary;
    text-align: center;

    .guide-icon {
      font-size: clamp(18px, 3vh, 26px);
    }
  }
}

.camera-views {
  display: flex;
  gap: clamp(6px, 1vw, 10px);
}

.view-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: clamp(6px, 1vh, 12px) clamp(10px, 2vw, 18px);
  background: $color-bg-card;
  border-radius: $border-radius;
  border: 2px solid transparent;
  color: $color-text-secondary;
  transition: all $transition-fast;

  &.active {
    border-color: $color-primary;
    color: $color-text;
    background: rgba($color-primary, 0.15);
  }

  .view-icon { font-size: clamp(18px, 3vh, 26px); }
  .view-label { font-size: clamp(9px, 1.2vh, 11px); }
}

.menu-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 1vh, 12px);
  width: min(300px, 85vw);
}

.start-btn {
  width: 100%;
  font-size: clamp(14px, 2.5vh, 20px);
  padding: clamp(8px, 1.2vh, 14px);
}

.menu-row {
  display: flex;
  gap: clamp(6px, 1vw, 10px);
  width: 100%;

  .btn-secondary {
    flex: 1;
    text-align: center;
    padding: clamp(6px, 1vh, 10px) 12px;
    font-size: clamp(11px, 1.6vh, 14px);
  }
}

.logout-btn {
  background: none;
  color: $color-text-secondary;
  font-size: clamp(11px, 1.4vh, 13px);
  padding: clamp(2px, 0.5vh, 6px);
  opacity: 0.7;

  &:active { opacity: 1; }
}

.guest-hint {
  font-size: clamp(10px, 1.3vh, 12px);
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  margin-top: -4px;
}
</style>
