<template>
  <div class="page leaderboard-page">
    <div class="page-header">
      <button class="back-btn" @click="router.back()">←</button>
      <h1>{{ t('leaderboard.title') }}</h1>
    </div>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: activeTab === tab.id }"
        @click="switchTab(tab.id)"
      >
        {{ t(`leaderboard.tabs.${tab.id}`) }}
        <span class="tab-badge">Top <span class="tab-badge-num">{{ tab.topN }}</span></span>
      </button>
    </div>

    <div class="leaderboard-list">
      <div v-if="loading" class="status loading">
        <span class="spinner" />
        {{ t('leaderboard.loading') }}
      </div>

      <div v-else-if="errorMsg" class="status error">
        <div class="status-icon">😵</div>
        <p>{{ errorMsg }}</p>
        <button class="btn-retry" @click="loadLeaderboard(true)">{{ t('leaderboard.retry') }}</button>
      </div>

      <div v-else-if="entries.length === 0" class="status empty">
        <div class="status-icon">🏜️</div>
        <p>{{ t('leaderboard.empty') }}</p>
        <p class="hint">{{ t('leaderboard.emptyHint') }}</p>
      </div>

      <template v-else>
        <div class="list-header">
          <span class="col-rank">{{ t('leaderboard.rank') }}</span>
          <span class="col-player">{{ t('leaderboard.player') }}</span>
          <span class="col-score">{{ t('leaderboard.score') }}</span>
          <span class="col-speed">{{ t('leaderboard.speed') }}</span>
        </div>

        <div
          v-for="(entry, index) in entries"
          :key="entry.userId + '-' + index"
          class="list-row"
          :class="{
            'top-1': entry.rank === 1,
            'top-2': entry.rank === 2,
            'top-3': entry.rank === 3,
            'cheated': entry.cheated,
            'me': isMe(entry.userId),
          }"
        >
          <span class="col-rank">
            <span v-if="entry.rank <= 3" class="medal">
              {{ ['🥇', '🥈', '🥉'][entry.rank - 1] }}
            </span>
            <span v-else class="rank-num">{{ entry.rank }}</span>
          </span>
          <span class="col-player">
            <span class="player-name">
            {{ entry.userName || t('leaderboard.unknownPlayer') }}
              <span v-if="isMe(entry.userId)" class="me-tag">（{{ t('leaderboard.me') }}）</span>
            </span>
            <span v-if="entry.cheated" class="cheat-badge">
              {{ t('leaderboard.cheatSuspect') }}{{ cheatSuffix(entry.cheatUserId) }}
            </span>
          </span>
          <span class="col-score" :class="{ 'score-cheated': entry.cheated }">
            {{ entry.score.toLocaleString() }}
          </span>
          <span class="col-speed">{{ Math.round(entry.maxSpeed) }} km/h</span>
          <button
            v-if="entry.userId"
            class="history-btn"
            :title="t('leaderboard.viewHistory')"
            @click="openHistory(entry)"
          >
            📋
          </button>
        </div>

        <!-- 分页器 -->
        <div v-if="totalPages > 1" class="pager">
        <span class="pager-total">{{ t('leaderboard.totalRecords', { total }) }}</span>
          <div class="pager-controls">
            <button class="pager-btn" :disabled="currentPage <= 1 || loading" @click="goPage(currentPage - 1)">&lt;</button>
            <template v-for="p in pageNumbers" :key="p">
              <span v-if="p === '....'" class="pager-ellipsis">…</span>
              <button
                v-else
                class="pager-btn"
                :class="{ active: p === currentPage }"
                :disabled="loading"
                @click="goPage(p as number)"
              >{{ p }}</button>
            </template>
            <button class="pager-btn" :disabled="currentPage >= totalPages || loading" @click="goPage(currentPage + 1)">&gt;</button>
          </div>
        </div>
        <div v-else-if="entries.length > 0" class="pager">
        <span class="pager-total">{{ t('leaderboard.totalRecords', { total }) }}</span>
        </div>
      </template>
    </div>

    <!-- 底部吸附"我的排名"：仅当用户已登录、有成绩、且不在榜内时展示 -->
    <div v-if="showMySticky" class="my-rank-sticky">
      <span class="col-rank">
        <span v-if="myRank!.rank > 0 && myRank!.rank <= 3" class="medal">
          {{ ['🥇', '🥈', '🥉'][myRank!.rank - 1] }}
        </span>
        <span v-else-if="myRank!.rank > 0" class="rank-num">{{ myRank!.rank }}</span>
        <span v-else class="rank-num">-</span>
      </span>
      <span class="col-player">
        <span class="player-name">
          {{ myRank!.userName || userStore.userName || t('leaderboard.me') }}
          <span class="me-tag">（{{ t('leaderboard.me') }}）</span>
        </span>
      </span>
      <span class="col-score">{{ myRank!.score.toLocaleString() }}</span>
      <span class="col-speed">{{ Math.round(myRank!.maxSpeed) }} km/h</span>
    </div>

    <!-- 已登录但该 period 无成绩时的引导提示 -->
    <div v-else-if="showNoScoreHint" class="my-rank-hint">
      <span>{{ noScoreHint }}</span>
    </div>

    <UserHistoryModal
      :visible="historyVisible"
      :user-id="historyUserId"
      :user-name="historyUserName"
      @close="historyVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getLeaderboard, type LeaderboardEntry } from '@/services/ScoreService';
import { useUserStore } from '@/stores/user';
import { logger } from '@/utils/logger';
import UserHistoryModal from './UserHistoryModal.vue';

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();

type TabId = 'all' | 'today' | 'week';
/** Top-N limits, mirror the server-side hardcoded values (constants.go). */
const TOP_N: Record<TabId, number> = { all: 500, today: 20, week: 50 };
/** 每页加载条数 */
const PAGE_SIZE = 50;

const activeTab = ref<TabId>('all');
const tabs: { id: TabId; topN: number }[] = [
  { id: 'all', topN: TOP_N.all },
  { id: 'today', topN: TOP_N.today },
  { id: 'week', topN: TOP_N.week },
];

const entries = ref<LeaderboardEntry[]>([]);
const myRank = ref<LeaderboardEntry | null>(null);
const total = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const errorMsg = ref('');

/** 总页数 */
const totalPages = computed(() =>
  total.value <= 0 ? 1 : Math.ceil(total.value / PAGE_SIZE)
);

/** 生成页码列表（带省略号）：1 2 3 ... 10 */
const pageNumbers = computed((): (number | string)[] => {
  const tp = totalPages.value;
  const cp = currentPage.value;
  if (tp <= 7) {
    return Array.from({ length: tp }, (_, i) => i + 1);
  }
  const pages: (number | string)[] = [1];
  if (cp > 3) pages.push('....');
  const start = Math.max(2, cp - 1);
  const end = Math.min(tp - 1, cp + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (cp < tp - 2) pages.push('....');
  pages.push(tp);
  return pages;
});

// Per-tab cache to avoid redundant fetches when toggling tabs.
const CACHE_TTL_MS = 30_000;
interface TabCacheEntry {
  entries: LeaderboardEntry[];
  myRank: LeaderboardEntry | null;
  total: number;
  page: number;
  fetchedAt: number;
}
const tabCache = new Map<TabId, TabCacheEntry>();

// History modal state
const historyVisible = ref(false);
const historyUserId = ref('');
const historyUserName = ref('');

/** Whether the given userId is the current logged-in user. */
function isMe(userId: string): boolean {
  return !!userId && !!userStore.userId && userId === userStore.userId;
}

/** Show sticky "my rank" row only when user is logged in, has a score, and is outside Top N. */
const showMySticky = computed((): boolean => {
  if (!userStore.userId) return false;
  if (!myRank.value || myRank.value.rank <= 0) return false;
  // If already in the visible list, highlight in-place instead of sticky bar.
  const inList = entries.value.some((e) => e.userId === userStore.userId);
  return !inList;
});

/** Show hint when user is logged in but has no score in this period. */
const showNoScoreHint = computed((): boolean => {
  if (!userStore.userId) return false;
  return !myRank.value || myRank.value.rank === 0;
});

const noScoreHint = computed((): string => {
  const map: Record<TabId, string> = {
    all: t('leaderboard.noScoreAll'),
    today: t('leaderboard.noScoreToday'),
    week: t('leaderboard.noScoreWeek'),
  };
  return map[activeTab.value];
});

/** Truncate cheat user id for display. */
function cheatSuffix(cheatUserId: string): string {
  if (!cheatUserId) return '';
  return `（${t('leaderboard.cheatPlayer', { userId: cheatUserId })}）`;
}

async function loadLeaderboard(force = false): Promise<void> {
  const tab = activeTab.value;
  const page = currentPage.value;
  const cacheKey = `${tab}_${page}`;
  const cached = tabCache.get(cacheKey as TabId);
  const now = Date.now();
  if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS && cached.page === page) {
    entries.value = cached.entries;
    myRank.value = cached.myRank;
    total.value = cached.total;
    errorMsg.value = '';
    loading.value = false;
    return;
  }

  loading.value = true;
  errorMsg.value = '';
  const offset = (page - 1) * PAGE_SIZE;
  try {
    const result = await getLeaderboard(tab, userStore.userId, offset, PAGE_SIZE);
    entries.value = result.list;
    myRank.value = result.myRank;
    total.value = result.total;
    tabCache.set(cacheKey as TabId, {
      entries: result.list,
      myRank: result.myRank,
      total: result.total,
      page,
      fetchedAt: Date.now(),
    });
  } catch (e) {
    logger.warn('LeaderboardPage', 'load failed:', (e as Error).message);
    errorMsg.value = t('leaderboard.loadFailed');
    entries.value = [];
    myRank.value = null;
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

/** 跳转到指定页 */
function goPage(page: number): void {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;
  currentPage.value = page;
  loadLeaderboard();
}

function switchTab(id: TabId): void {
  if (activeTab.value === id) return;
  activeTab.value = id;
  currentPage.value = 1;
  loadLeaderboard();
}

function openHistory(entry: LeaderboardEntry): void {
  historyUserId.value = entry.userId;
  historyUserName.value = entry.userName;
  historyVisible.value = true;
}

onMounted(() => loadLeaderboard());
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.leaderboard-page {
  justify-content: flex-start;
  padding: 16px 24px;
  gap: 16px;
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

.tabs {
  display: flex;
  gap: 8px;
  width: 100%;
}

.tab {
  flex: 1;
  padding: 10px;
  background: $color-bg-card;
  color: $color-text-secondary;
  border-radius: $border-radius-sm;
  font-size: 14px;
  text-align: center;
  transition: all $transition-fast;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  &.active {
    background: $color-primary;
    color: $color-text;
  }
}

.tab-badge {
  font-size: 12px;
  font-weight: 600;
  color: $color-accent;
  opacity: 1;
  line-height: 1;

  .tab-badge-num {
    font-size: 18px;
    font-weight: 800;
    margin-left: 2px;
    letter-spacing: 0.5px;
  }
}

.leaderboard-list {
  width: 100%;
  flex: 1;
  overflow-y: auto;
}

.list-header, .list-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 8px;
}

.list-header {
  font-size: 12px;
  color: $color-text-secondary;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.list-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &.top-1 { background: linear-gradient(90deg, rgba(255, 215, 0, 0.12), transparent); }
  &.top-2 { background: linear-gradient(90deg, rgba(192, 192, 192, 0.12), transparent); }
  &.top-3 { background: linear-gradient(90deg, rgba(205, 127, 50, 0.12), transparent); }

  &.cheated {
    background: linear-gradient(90deg, rgba(255, 68, 68, 0.08), transparent);
  }

  // 当前用户在榜内时的高亮（蓝色，优先级高于 top-N 金属色）
  &.me {
    background: linear-gradient(90deg, rgba(64, 158, 255, 0.18), rgba(64, 158, 255, 0.04));
    box-shadow: inset 3px 0 0 $color-primary;
  }
}

.me-tag {
  font-size: 11px;
  color: $color-primary;
  margin-left: 4px;
  font-weight: 600;
}

.col-rank {
  width: 48px;
  text-align: center;
  font-weight: 600;

  .medal { font-size: 20px; }
  .rank-num { color: $color-text-secondary; }
}

.col-player {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  .player-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cheat-badge {
    font-size: 11px;
    color: #ff6666;
    background: rgba(255, 68, 68, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
    width: fit-content;
  }
}

.col-score {
  width: 72px;
  text-align: right;
  color: $color-accent;
  font-weight: 600;

  &.score-cheated {
    text-decoration: line-through;
    opacity: 0.6;
  }
}

.col-speed {
  width: 78px;
  text-align: right;
  color: $color-text-secondary;
  font-size: 13px;
}

.history-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: $color-text-secondary;
  width: 32px;
  height: 32px;
  border-radius: $border-radius-sm;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all $transition-fast;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: $color-text;
    transform: scale(1.05);
  }
}

.status {
  padding: 48px 16px;
  text-align: center;
  color: $color-text-secondary;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  .status-icon { font-size: 48px; }
  .hint { font-size: 12px; opacity: 0.7; }
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: $color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-retry {
  padding: 6px 18px;
  background: $color-primary;
  color: $color-text;
  border-radius: $border-radius-sm;
  font-size: 13px;
  cursor: pointer;
}

// 底部吸附"我的排名"行，样式参照 .list-row 但视觉上更突出
.my-rank-sticky {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, rgba(64, 158, 255, 0.25), rgba(64, 158, 255, 0.08));
  border-top: 1px solid rgba(64, 158, 255, 0.4);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  z-index: 2;
}

.my-rank-hint {
  padding: 10px 16px;
  text-align: center;
  font-size: 12px;
  color: $color-text-secondary;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

// 分页器
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.pager-total {
  font-size: 12px;
  color: $color-text-secondary;
  white-space: nowrap;
}

.pager-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pager-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  background: $color-bg-card;
  color: $color-text-secondary;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: $border-radius-sm;
  font-size: 13px;
  cursor: pointer;
  transition: all $transition-fast;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled):not(.active) {
    background: rgba(255, 255, 255, 0.08);
    color: $color-text;
    border-color: $color-primary;
  }

  &.active {
    background: $color-primary;
    color: $color-text;
    border-color: $color-primary;
    font-weight: 600;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.pager-ellipsis {
  width: 32px;
  text-align: center;
  color: $color-text-secondary;
  font-size: 14px;
  user-select: none;
}
</style>
