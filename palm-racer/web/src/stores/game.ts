import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

export interface GameStats {
  score: number;
  maxSpeed: number;
  surviveTime: number;
  comboMax: number;
  cheated: boolean;
  /** 替玩者的 userId（防作弊检测到的最后一个替玩用户） */
  cheatUserId: string;
}

export const useGameStore = defineStore('game', () => {
  const state = ref<GameState>('idle');
  const score = ref(0);
  const highScore = ref(Number(localStorage.getItem('palmRacer_highScore') || '0'));
  const lives = ref(3);
  const speed = ref(0);
  const maxSpeed = ref(0);
  const gameTime = ref(0);
  const comboCount = ref(0);
  const comboMultiplier = computed(() => Math.min(1 + comboCount.value * 0.5, 5));
  const lastStats = ref<GameStats | null>(null);
  /** 当前局分数是否已提交，防止重复提交 */
  const scoreSubmitted = ref(false);
  /** 当前局唯一标识，用于服务端去重（前端兼容字段） */
  const gameSessionId = ref('');
  /** 服务端 StartGame 下发的单局 session 标识：提交分数和反作弊核身均需携带 */
  const sid = ref('');

  function reset(): void {
    state.value = 'idle';
    score.value = 0;
    lives.value = 3;
    speed.value = 0;
    maxSpeed.value = 0;
    gameTime.value = 0;
    comboCount.value = 0;
    lastStats.value = null;
    scoreSubmitted.value = false;
    gameSessionId.value = '';
    sid.value = '';
  }

  function setGameOver(stats: GameStats): void {
    state.value = 'gameover';
    lastStats.value = stats;
    // 客户端 gameSessionId 仅作幂等去重提示，权威 sid 由服务端 StartGame 下发。
    gameSessionId.value = crypto.randomUUID();
    if (stats.score > highScore.value) {
      highScore.value = stats.score;
      localStorage.setItem('palmRacer_highScore', String(stats.score));
    }
  }

  return {
    state,
    score,
    highScore,
    lives,
    speed,
    maxSpeed,
    gameTime,
    comboCount,
    comboMultiplier,
    lastStats,
    scoreSubmitted,
    gameSessionId,
    sid,
    reset,
    setGameOver,
  };
});
