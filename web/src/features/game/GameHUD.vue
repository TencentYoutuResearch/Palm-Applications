<template>
  <div class="hud" v-if="gameStore.state === 'playing'">
    <!-- 左侧：生命值 -->
    <div class="hud-left">
      <div class="hud-lives">
        <span v-for="i in 3" :key="i" class="heart" :class="{ lost: i > gameStore.lives }">
          ❤️
        </span>
      </div>
    </div>

    <!-- 中部：速度 + 倍率 -->
    <div class="hud-center">
      <div class="speedometer">
        <span class="speed-value" :class="speedClass">{{ Math.round(gameStore.speed) }}</span>
        <span class="speed-unit">km/h</span>
      </div>
      <div class="speed-bar">
        <div class="speed-bar-fill" :style="{ width: speedPercent + '%' }" />
      </div>
      <div v-if="gameStore.comboMultiplier > 1" class="combo">
        ×{{ gameStore.comboMultiplier.toFixed(1) }}
      </div>
    </div>

    <!-- 右侧：用户信息 + 得分 -->
    <div class="hud-right">
      <!-- 防作弊徽章 -->
      <div v-if="userStore.isLoggedIn" class="anti-cheat-badge">
        <span class="ac-dot" />
        <span class="ac-text">{{ t('game.hud.antiCheat') }}</span>
      </div>
      <!-- 用户信息栏 -->
      <div v-if="userStore.isLoggedIn" class="hud-user-bar">
        <span class="hud-user-icon">👤</span>
        <span class="hud-user-name">{{ userStore.userName || '—' }}</span>
      </div>
      <!-- 替玩计数（始终显示） -->
      <div v-if="userStore.isLoggedIn" class="hud-cheat-counter" :class="{ active: userStore.cheatCount > 0 }">
        <span>⚠️</span>
        <span>{{ t('game.hud.cheatPlay') }}</span>
        <span class="cheat-num">{{ userStore.cheatCount }}</span>
        <span class="cheat-sep">/</span>
        <span class="cheat-max">3</span>
      </div>
      <!-- 得分 -->
      <div class="hud-score-box">
        <span class="hud-score-label">{{ t('game.hud.score') }}</span>
        <span class="hud-score-value">{{ gameStore.score.toLocaleString() }}</span>
      </div>
      <div class="hud-score-box small">
        <span class="hud-score-label">{{ t('game.hud.highScore') }}</span>
        <span class="hud-highscore-value">{{ gameStore.highScore.toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '@/stores/game';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const gameStore = useGameStore();
const userStore = useUserStore();

const speedPercent = computed(() => Math.min(gameStore.speed / 350 * 100, 100));
const speedClass = computed(() => {
  const s = gameStore.speed;
  if (s >= 280) return 'speed-high';
  if (s >= 180) return 'speed-mid';
  return '';
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 16px;
  pointer-events: none;
  z-index: 10;
}

/* ---- Left: Lives ---- */
.hud-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hud-lives {
  display: flex;
  gap: 2px;
  font-size: 20px;

  .heart.lost { opacity: 0.2; }
}

/* ---- Center: Speed ---- */
.hud-center {
  text-align: center;

  .speedometer {
    .speed-value {
      font-size: 32px;
      font-weight: 800;
      color: $color-text;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);

      &.speed-mid { color: $color-warning; }
      &.speed-high { color: $color-danger; }
    }
    .speed-unit {
      font-size: 12px;
      color: $color-text-secondary;
      margin-left: 3px;
    }
  }

  .speed-bar {
    width: 120px;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    margin: 4px auto 0;
    overflow: hidden;
  }

  .speed-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, $color-primary, $color-danger);
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  .combo {
    font-size: 18px;
    font-weight: 700;
    color: $color-accent;
    text-shadow: 0 0 10px rgba($color-accent, 0.5);
    margin-top: 2px;
  }
}

/* ---- Right: User + Score ---- */
.hud-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.anti-cheat-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 10px;
  background: rgba(76, 175, 80, 0.2);
  font-size: 10px;
  color: #4caf50;

  .ac-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4caf50;
  }
}

.hud-cheat-counter {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.4);
  font-size: 11px;
  color: $color-text-secondary;

  .cheat-num {
    font-weight: 700;
    font-size: 13px;
    color: $color-text;
  }

  .cheat-sep { opacity: 0.5; }
  .cheat-max { opacity: 0.5; }

  &.active {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;

    .cheat-num { color: #f44336; }
  }
}

.hud-user-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
  font-size: 11px;
  color: $color-text-secondary;

  .hud-user-icon { font-size: 12px; }
  .hud-user-name {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.hud-score-box {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);

  .hud-score-label {
    font-size: 10px;
    color: $color-text-secondary;
  }

  .hud-score-value {
    font-size: 20px;
    font-weight: 700;
    color: $color-accent;
  }

  .hud-highscore-value {
    font-size: 14px;
    font-weight: 600;
    color: $color-text-secondary;
  }

  &.small {
    padding: 3px 10px;
  }
}
</style>
