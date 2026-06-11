<template>
  <Teleport to="body">
    <div v-if="visible" class="history-overlay" @click.self="close">
      <div class="history-modal">
        <div class="history-header">
          <h2 class="history-title">{{ t('leaderboard.history.title', { name: title }) }}</h2>
          <button class="history-close" @click="close">✕</button>
        </div>

        <div v-if="loading" class="status">
          <span class="spinner" />
          {{ t('leaderboard.loading') }}
        </div>

        <div v-else-if="errorMsg" class="status">
          <div class="status-icon">😵</div>
          <p>{{ errorMsg }}</p>
        </div>

        <template v-else>
          <div class="history-summary">
            <div class="stat-card">
              <div class="stat-value gold">{{ stats.bestScore.toLocaleString() }}</div>
              <div class="stat-label">{{ t('leaderboard.history.bestScore') }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ stats.totalGames }}</div>
              <div class="stat-label">{{ t('leaderboard.history.totalGames') }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" :class="{ red: stats.cheatCount > 0 }">{{ stats.cheatCount }}</div>
              <div class="stat-label">{{ t('leaderboard.history.cheatCount') }}</div>
            </div>
          </div>

          <div v-if="records.length === 0" class="status">
            <div class="status-icon">📭</div>
            <p>{{ t('leaderboard.history.noRecords') }}</p>
          </div>

          <div v-else class="history-list">
            <div
              v-for="record in records"
              :key="record.index + '-' + record.timestamp"
              class="history-record"
              :class="{ cheated: record.cheated }"
            >
              <div class="record-left">
                <span class="record-num">{{ t('leaderboard.history.gameIndex', { index: record.index }) }}</span>
                <span class="record-score" :class="{ 'score-cheated': record.cheated }">
                  {{ record.score.toLocaleString() }} {{ t('leaderboard.history.points') }}
                </span>
                <div class="record-meta">
                  <span v-if="record.maxSpeed">🏎️ {{ Math.round(record.maxSpeed) }}km/h</span>
                  <span v-if="record.surviveTime">⏱️ {{ Math.round(record.surviveTime) }}s</span>
                </div>
              </div>
              <div class="record-right">
                <span class="record-date">{{ formatTime(record.timestamp) }}</span>
                <span v-if="record.cheated" class="cheat-tag">
                  {{ t('leaderboard.cheatSuspect') }}{{ cheatSuffix(record.cheatUserId) }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="totalPages > 1" class="history-pager">
            <span class="pager-total">{{ t('leaderboard.totalRecords', { total }) }}</span>
            <div class="pager-controls">
              <button class="pager-btn" :disabled="page <= 1 || loading" @click="goPage(page - 1)">&lt;</button>
              <template v-for="p in pageNumbers" :key="p">
                <span v-if="p === '....'" class="pager-ellipsis">…</span>
                <button
                  v-else
                  class="pager-btn"
                  :class="{ active: p === page }"
                  :disabled="loading"
                  @click="goPage(p as number)"
                >{{ p }}</button>
              </template>
              <button class="pager-btn" :disabled="page >= totalPages || loading" @click="goPage(page + 1)">&gt;</button>
            </div>
          </div>
          <div v-else-if="records.length > 0" class="history-pager">
            <span class="pager-total">{{ t('leaderboard.totalRecords', { total }) }}</span>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  getUserHistory,
  type UserHistoryEntry,
  type UserHistoryStats,
} from '@/services/ScoreService';
import { logger } from '@/utils/logger';

const { t } = useI18n();

interface Props {
  /** Whether the modal is visible. */
  visible: boolean;
  /** Target user id to query history for. */
  userId: string;
  /** Display name used in the header. */
  userName?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'close'): void }>();

/** Page size for each network request. Server hard-caps at 100. */
const PAGE_SIZE = 20;

/**
 * Module-level cache: `${userId}|${page}` → page payload + fetchedAt timestamp.
 * Re-opening the same page within TTL skips network request.
 */
const CACHE_TTL_MS = 30_000;
interface CacheEntry {
  records: UserHistoryEntry[];
  stats: UserHistoryStats;
  total: number;
  fetchedAt: number;
}
const historyCache = new Map<string, CacheEntry>();

const EMPTY_STATS: UserHistoryStats = { bestScore: 0, totalGames: 0, cheatCount: 0 };

const records = ref<UserHistoryEntry[]>([]);
const stats = ref<UserHistoryStats>({ ...EMPTY_STATS });
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const errorMsg = ref('');

const title = computed(() => props.userName || props.userId || t('leaderboard.history.player'));
const totalPages = computed(() =>
  total.value <= 0 ? 1 : Math.max(1, Math.ceil(total.value / PAGE_SIZE))
);

/** 生成页码列表（带省略号）：1 2 3 ... N */
const pageNumbers = computed((): (number | string)[] => {
  const tp = totalPages.value;
  const cp = page.value;
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

function cacheKey(userId: string, p: number): string {
  return `${userId}|${p}`;
}

function close(): void {
  emit('close');
}

function cheatSuffix(cheatUserId: string): string {
  if (!cheatUserId) return '';
  return `（${t('leaderboard.cheatPlayer', { userId: cheatUserId })}）`;
}

function formatTime(ts: number | string): string {
  const raw = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(raw) || raw <= 0) return t('leaderboard.history.unknownTime');

  // Accept both seconds and milliseconds (backend uses milliseconds).
  const ms = raw < 1e12 ? raw * 1000 : raw;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return t('leaderboard.history.unknownTime');

  const now = new Date();
  const pad = (n: number): string => n.toString().padStart(2, '0');

  if (d.toDateString() === now.toDateString()) {
    return `${t('leaderboard.history.today')} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `${t('leaderboard.history.yesterday')} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

async function load(targetPage: number): Promise<void> {
  if (!props.userId) return;

  const key = cacheKey(props.userId, targetPage);
  const cached = historyCache.get(key);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    records.value = cached.records;
    stats.value = cached.stats;
    total.value = cached.total;
    page.value = targetPage;
    errorMsg.value = '';
    loading.value = false;
    return;
  }

  loading.value = true;
  errorMsg.value = '';
  records.value = [];
  try {
    const offset = (targetPage - 1) * PAGE_SIZE;
    const data = await getUserHistory(props.userId, offset, PAGE_SIZE);
    records.value = data.list;
    stats.value = data.stats;
    total.value = data.total;
    page.value = targetPage;
    historyCache.set(key, {
      records: data.list,
      stats: data.stats,
      total: data.total,
      fetchedAt: Date.now(),
    });
  } catch (e) {
    logger.warn('UserHistoryModal', 'load failed:', (e as Error).message);
    errorMsg.value = t('leaderboard.loadFailed');
  } finally {
    loading.value = false;
  }
}

function goPrev(): void {
  if (page.value > 1 && !loading.value) {
    void load(page.value - 1);
  }
}

function goNext(): void {
  if (page.value < totalPages.value && !loading.value) {
    void load(page.value + 1);
  }
}

/** 跳转到指定页 */
function goPage(p: number): void {
  if (p < 1 || p > totalPages.value || p === page.value || loading.value) return;
  void load(p);
}

// Reset pagination to page 1 whenever the modal opens with a (potentially new) userId.
watch(
  () => [props.visible, props.userId] as const,
  ([vis], prev) => {
    if (!vis) return;
    const prevUserId = prev ? prev[1] : undefined;
    // Always reset to page 1 on open or when userId changes.
    if (!prev || prevUserId !== props.userId || page.value !== 1) {
      stats.value = { ...EMPTY_STATS };
      total.value = 0;
    }
    void load(1);
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.history-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  padding: 16px;
}

.history-modal {
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(145deg, rgba(30, 30, 60, 0.98), rgba(15, 15, 40, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: $border-radius-lg;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  color: $color-text;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.history-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
  transition: color $transition-fast;

  &:hover { color: #fff; }
}

.history-summary {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-card {
  flex: 1;
  padding: 12px 8px;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  border-radius: $border-radius-sm;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: $color-text;

  &.gold { color: #ffcc33; }
  &.red { color: #ff6666; }
}

.stat-label {
  font-size: 11px;
  color: $color-text-secondary;
  margin-top: 4px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px 16px;
}

.history-record {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  border-radius: $border-radius-sm;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);

  &.cheated {
    background: rgba(255, 68, 68, 0.08);
    border-color: rgba(255, 68, 68, 0.2);
  }
}

.record-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.record-num {
  font-size: 11px;
  color: $color-text-secondary;
}

.record-score {
  font-size: 18px;
  font-weight: 700;
  color: $color-accent;

  &.score-cheated {
    text-decoration: line-through;
    opacity: 0.6;
  }
}

.record-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: $color-text-secondary;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;
}

.record-date {
  font-size: 11px;
  color: $color-text-secondary;
}

.cheat-tag {
  font-size: 10px;
  color: #ff6666;
  background: rgba(255, 68, 68, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.history-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
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
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.08);
  color: $color-text-secondary;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: $border-radius-sm;
  font-size: 12px;
  cursor: pointer;
  transition: all $transition-fast;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled):not(.active) {
    background: rgba(255, 255, 255, 0.16);
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
  width: 30px;
  text-align: center;
  color: $color-text-secondary;
  font-size: 13px;
  user-select: none;
}
</style>
