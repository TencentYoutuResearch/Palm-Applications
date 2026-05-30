<template>
  <div class="page gameover-page">
    <h1 class="title">{{ t('gameover.title') }}</h1>

    <div v-if="isNewRecord" class="new-record">
      {{ t('gameover.newRecord') }}
    </div>

    <div v-if="userStore.isGuest" class="guest-notice">
      {{ t('gameover.guestNotice') }}
    </div>

    <div class="stats-grid">
      <div class="stat card">
        <span class="stat-label">{{ t('gameover.score') }}</span>
        <span class="stat-value accent">{{ stats.score.toLocaleString() }}</span>
      </div>
      <div class="stat card">
        <span class="stat-label">{{ t('gameover.maxSpeed') }}</span>
        <span class="stat-value">{{ Math.round(stats.maxSpeed) }} km/h</span>
      </div>
      <div class="stat card">
        <span class="stat-label">{{ t('gameover.time') }}</span>
        <span class="stat-value">{{ formatTime(stats.surviveTime) }}</span>
      </div>
    </div>

    <div class="star-rating">
      <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= starCount }">
        ⭐
      </span>
    </div>

    <div class="actions">
      <button class="btn-primary" @click="retry">{{ t('gameover.retry') }}</button>
      <div class="actions-row">
        <button class="btn-secondary" @click="router.push('/menu')">{{ t('gameover.menu') }}</button>
        <button v-if="!userStore.isGuest" class="btn-secondary" @click="router.push('/leaderboard')">{{ t('gameover.leaderboard') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '@/stores/game';
import { useUserStore } from '@/stores/user';
import { submitScore } from '@/services/ScoreService';
import { logger } from '@/utils/logger';

const router = useRouter();
const { t } = useI18n();
const gameStore = useGameStore();
const userStore = useUserStore();

const stats = computed(() => gameStore.lastStats ?? {
  score: 0, maxSpeed: 0, surviveTime: 0, comboMax: 0, cheated: false, cheatUserId: '',
});

const isNewRecord = computed(() =>
  stats.value.score > 0 && stats.value.score >= gameStore.highScore
);

const starCount = computed(() => {
  const s = stats.value.score;
  if (s >= 10000) return 5;
  if (s >= 5000) return 4;
  if (s >= 2000) return 3;
  if (s >= 500) return 2;
  return 1;
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function retry(): void {
  gameStore.reset();
  router.push('/game');
}

/** Auto-submit score on entering the page (logged-in non-guest only, score > 0). */
onMounted(async () => {
  if (!userStore.userId || userStore.isGuest || stats.value.score <= 0) {
    return;
  }
  try {
    await submitScore(userStore.userId, userStore.userName, stats.value, stats.value.cheatUserId);
    logger.debug('GameOver', 'Score submitted:', stats.value.score);
  } catch (e) {
    // Never block UI on submission failure (e.g. MySQL not configured).
    logger.warn('GameOver', 'Submit score failed:', (e as Error).message);
  }
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.gameover-page {
  gap: clamp(8px, 2vh, 16px);
  padding: clamp(8px, 2vh, 24px) 16px;
  background: radial-gradient(ellipse at 50% 40%, rgba($color-primary, 0.1), transparent 60%),
              $color-bg;
}

.title {
  font-size: clamp(24px, 5vh, 36px);
  font-weight: 800;
}

.new-record {
  font-size: clamp(16px, 3vh, 22px);
  font-weight: 700;
  color: $color-accent;
  animation: glow 1.5s ease-in-out infinite alternate;
}

.guest-notice {
  font-size: clamp(11px, 1.6vh, 13px);
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes glow {
  from { text-shadow: 0 0 10px rgba($color-accent, 0.5); }
  to { text-shadow: 0 0 30px rgba($color-accent, 0.8); }
}

.stats-grid {
  display: flex;
  gap: clamp(6px, 1.5vw, 12px);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.8vh, 8px);
  min-width: clamp(70px, 20vw, 100px);

  .stat-label {
    font-size: clamp(10px, 1.5vh, 12px);
    color: $color-text-secondary;
    text-transform: uppercase;
  }

  .stat-value {
    font-size: clamp(18px, 3vh, 24px);
    font-weight: 700;

    &.accent { color: $color-accent; }
  }
}

.star-rating {
  display: flex;
  gap: clamp(4px, 1vw, 8px);
  font-size: clamp(22px, 4vh, 32px);

  .star { opacity: 0.2; }
  .star.filled { opacity: 1; }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1.2vh, 12px);
  min-width: min(280px, 80vw);
  width: min(320px, 85vw);

  .btn-primary {
    width: 100%;
    padding: clamp(10px, 1.5vh, 14px);
    font-size: clamp(14px, 2.5vh, 18px);
  }
}

.actions-row {
  display: flex;
  gap: clamp(6px, 1vw, 12px);

  .btn-secondary {
    flex: 1;
    text-align: center;
    padding: clamp(8px, 1.2vh, 12px) 16px;
    font-size: clamp(12px, 2vh, 16px);
  }
}
</style>
