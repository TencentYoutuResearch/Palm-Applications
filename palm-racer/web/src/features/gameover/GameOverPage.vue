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

    <!-- 排名提示卡片 -->
    <div v-if="(myRank || currentRoundRank > 0) && !userStore.isGuest" class="rank-hint">
      <!-- 本局排名 -->
      <div v-if="currentRoundRank > 0" class="rank-hint-content">
        <span class="rank-text">
          {{ t('gameover.currentRoundRank') }}：{{ t('gameover.rankValue', { rank: currentRoundRank }) }}
        </span>
      </div>
      <!-- 历史最佳排名 -->
      <div v-if="myRank && !isNewRecord" class="rank-hint-content best-rank">
        <span class="rank-text-secondary">
          {{ t('gameover.bestRank') }}：{{ t('gameover.rankValue', { rank: myRank.rank }) }}
          <span class="best-score-hint">({{ t('gameover.bestScore', { score: myRank.score.toLocaleString() }) }})</span>
        </span>
      </div>
      <!-- 追赶目标 -->
      <div v-if="nextTarget" class="rank-target">
        {{ t('gameover.nextGoal', { points: nextTarget.gap, rank: nextTarget.rank }) }}
      </div>
    </div>

    <div class="actions">
      <button class="btn-primary" @click="retry">{{ t('gameover.retry') }}</button>
      <div class="actions-row">
        <button class="btn-secondary" @click="router.push('/menu')">{{ t('gameover.menu') }}</button>
        <button
          v-if="!userStore.isGuest"
          :class="['btn-leaderboard', { 'leaderboard-highlight': isNewRecord }]"
          @click="router.push('/leaderboard')"
        >
          {{ isNewRecord ? t('gameover.leaderboardHighlight') : t('gameover.leaderboard') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '@/stores/game';
import { useUserStore } from '@/stores/user';
import { submitScore, getLeaderboard, type LeaderboardEntry } from '@/services/ScoreService';
import { logger } from '@/utils/logger';

const router = useRouter();
const { t } = useI18n();
const gameStore = useGameStore();
const userStore = useUserStore();

const myRank = ref<LeaderboardEntry | null>(null);
const currentRoundRank = ref<number>(0);
const nextTarget = ref<{ gap: number; rank: number } | null>(null);

const stats = computed(() => gameStore.lastStats ?? {
  score: 0, maxSpeed: 0, surviveTime: 0, comboMax: 0, cheated: false, cheatUserId: '',
});

const isNewRecord = computed(() =>
  stats.value.score > 0 && stats.value.score >= gameStore.highScore
);

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
  // 防止同一局游戏分数被重复提交（如组件被重新挂载）
  if (gameStore.scoreSubmitted) {
    logger.debug('GameOver', 'Score already submitted, skip duplicate');
    // 即使已提交，仍然获取排名
    await fetchRank();
    return;
  }
  gameStore.scoreSubmitted = true;
  try {
    await submitScore(
      userStore.userId,
      userStore.userName,
      stats.value,
      stats.value.cheatUserId,
      gameStore.gameSessionId,
      () => gameStore.sid,
    );
    logger.debug('GameOver', 'Score submitted:', stats.value.score);
  } catch (e) {
    // Never block UI on submission failure (e.g. MySQL not configured).
    logger.warn('GameOver', 'Submit score failed:', (e as Error).message);
  }
  // 提交后获取排名
  await fetchRank();
});

/** 获取用户在排行榜中的排名（历史最佳 + 本局排名） */
async function fetchRank(): Promise<void> {
  try {
    const result = await getLeaderboard('all', userStore.userId, 0, 1);
    if (result.myRank && result.myRank.rank > 0) {
      myRank.value = result.myRank;

      // 计算本局排名
      if (isNewRecord.value) {
        // 本局是新纪录，本局排名 = 历史最佳排名（因为提交后最高分就是本局分数）
        currentRoundRank.value = result.myRank.rank;
      } else {
        // 本局不是新纪录，需要估算本局分数在排行榜中的位置
        await estimateCurrentRoundRank(result.total);
      }

      // 计算与上一名的差距（基于历史最佳排名）
      if (result.myRank.rank > 1) {
        const aboveResult = await getLeaderboard('all', '', result.myRank.rank - 2, 1);
        if (aboveResult.list.length > 0) {
          const aboveScore = aboveResult.list[0].score;
          const gap = aboveScore - result.myRank.score + 1;
          if (gap > 0) {
            nextTarget.value = { gap, rank: result.myRank.rank - 1 };
          }
        }
      }
    }
    logger.debug('GameOver', 'Rank fetched: best=', myRank.value?.rank, 'round=', currentRoundRank.value);
  } catch (e) {
    logger.debug('GameOver', 'Fetch rank failed:', (e as Error).message);
  }
}

/** 估算本局分数在排行榜中的排名位置 */
async function estimateCurrentRoundRank(total: number): Promise<void> {
  const roundScore = stats.value.score;
  if (roundScore <= 0) return;

  try {
    // 获取排行榜前50名来估算位置
    const topResult = await getLeaderboard('all', '', 0, Math.min(total, 50));
    const list = topResult.list;

    // 在排行榜中找到本局分数应该插入的位置
    let rank = list.length + 1; // 默认排在最后
    for (let i = 0; i < list.length; i++) {
      if (roundScore >= list[i].score) {
        rank = i + 1;
        break;
      }
    }

    // 如果本局分数比所有已获取的都低，且还有更多数据，则排名为 total 附近
    if (rank > list.length && total > list.length) {
      rank = total; // 近似值
    }

    currentRoundRank.value = rank;
  } catch (e) {
    logger.debug('GameOver', 'Estimate round rank failed:', (e as Error).message);
  }
}
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

.rank-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.6vh, 8px);
  padding: clamp(8px, 1.2vh, 14px) clamp(12px, 2vw, 20px);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: min(320px, 85vw);

  .rank-hint-content {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: clamp(14px, 2.2vh, 18px);
    font-weight: 700;

    .rank-icon {
      font-size: clamp(18px, 3vh, 24px);
    }

    .rank-text {
      color: $color-accent;
    }

    .rank-text-secondary {
      color: $color-text-secondary;
      font-size: clamp(12px, 1.8vh, 15px);
      font-weight: 600;
    }

    .best-score-hint {
      font-size: clamp(10px, 1.4vh, 12px);
      font-weight: 400;
      opacity: 0.7;
    }

    &.best-rank {
      font-size: clamp(12px, 1.8vh, 15px);
    }
  }

  .rank-target {
    font-size: clamp(11px, 1.5vh, 13px);
    color: $color-text-secondary;
    text-align: center;
  }
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

  .btn-secondary,
  .btn-leaderboard {
    flex: 1;
    text-align: center;
    padding: clamp(8px, 1.2vh, 12px) 16px;
    font-size: clamp(12px, 2vh, 16px);
  }

  .btn-leaderboard {
    background: rgba($color-accent, 0.12);
    border: 1.5px solid rgba($color-accent, 0.6);
    color: $color-accent;
    font-weight: 700;
    border-radius: 10px;
    transition: all 0.2s ease;

    &:hover,
    &:active {
      background: rgba($color-accent, 0.2);
      border-color: $color-accent;
    }
  }

  .leaderboard-highlight {
    animation: pulse-highlight 1.5s ease-in-out infinite;
    border-color: $color-accent;
    box-shadow: 0 0 8px rgba($color-accent, 0.3);
  }
}

@keyframes pulse-highlight {
  0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba($color-accent, 0.3); }
  50% { transform: scale(1.03); box-shadow: 0 0 16px 4px rgba($color-accent, 0.4); }
}
</style>
