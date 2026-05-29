/**
 * Score and leaderboard API service.
 *
 * All request/response fields use PascalCase to match the backend
 * protobuf JSON naming (json_name = "PascalCase"). Responses are
 * unwrapped from {Code, Data: {List, Total}}.
 */
import api from './api';
import { getI18nT } from '@/main';
import type { GameStats } from '@/stores/game';

/** A single leaderboard row returned by the backend. */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  score: number;
  maxSpeed: number;
  surviveTime: number;
  cheated: boolean;
  cheatUserId: string;
  timestamp: number;
}

/** A single history row returned by the backend. */
export interface UserHistoryEntry {
  index: number;
  userId: string;
  userName: string;
  score: number;
  maxSpeed: number;
  surviveTime: number;
  cheated: boolean;
  cheatUserId: string;
  timestamp: number;
}

/** Raw wire format returned by backend (PascalCase). */
interface RawLeaderboardEntry {
  Rank?: number;
  UserId?: string;
  UserName?: string;
  Score?: number;
  MaxSpeed?: number;
  SurviveTime?: number;
  Cheated?: boolean;
  CheatUserId?: string;
  /** int64 is serialized as string by protojson; accept both for safety. */
  Timestamp?: number | string;
}

interface RawListResponse {
  Code?: number;
  Message?: string;
  Data?: {
    List?: RawLeaderboardEntry[];
    Total?: number;
    Stats?: RawUserHistoryStats;
    /** Optional rank entry for the current user (returned when request contains user_id). */
    MyRank?: RawLeaderboardEntry;
  };
}

/** Raw user history stats (PascalCase wire format). */
interface RawUserHistoryStats {
  BestScore?: number;
  TotalGames?: number;
  CheatCount?: number;
}

/** Aggregated user history stats, always full-scan, never affected by paging. */
export interface UserHistoryStats {
  bestScore: number;
  totalGames: number;
  cheatCount: number;
}

/** Paged user history response for front-end consumption. */
export interface UserHistoryPage {
  list: UserHistoryEntry[];
  total: number;
  stats: UserHistoryStats;
}

/** Parse a possibly-string int64 timestamp to number. Returns 0 on failure. */
function toNumber(v: number | string | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Convert raw PascalCase entry to camelCase LeaderboardEntry. */
function toLeaderboardEntry(r: RawLeaderboardEntry, fallbackRank: number): LeaderboardEntry {
  return {
    rank: r.Rank ?? fallbackRank,
    userId: r.UserId ?? '',
    userName: r.UserName ?? '',
    score: r.Score ?? 0,
    maxSpeed: r.MaxSpeed ?? 0,
    surviveTime: r.SurviveTime ?? 0,
    cheated: r.Cheated ?? false,
    cheatUserId: r.CheatUserId ?? '',
    timestamp: toNumber(r.Timestamp),
  };
}

/** Convert raw PascalCase entry to camelCase UserHistoryEntry. */
function toHistoryEntry(r: RawLeaderboardEntry & { Index?: number }, fallbackIndex: number): UserHistoryEntry {
  return {
    index: r.Index ?? fallbackIndex,
    userId: r.UserId ?? '',
    userName: r.UserName ?? '',
    score: r.Score ?? 0,
    maxSpeed: r.MaxSpeed ?? 0,
    surviveTime: r.SurviveTime ?? 0,
    cheated: r.Cheated ?? false,
    cheatUserId: r.CheatUserId ?? '',
    timestamp: toNumber(r.Timestamp),
  };
}

/**
 * Submit game score to the server.
 * Silently ignores submission errors (e.g. MySQL not configured) so the
 * game-over flow is not blocked.
 */
export async function submitScore(
  userId: string,
  userName: string,
  stats: GameStats,
  cheatUserId = ''
): Promise<void> {
  await api.post('/scores', {
    UserId: userId,
    UserName: userName,
    Score: stats.score,
    MaxSpeed: Math.round(stats.maxSpeed),
    SurviveTime: Math.round(stats.surviveTime),
    Cheated: stats.cheated,
    CheatUserId: cheatUserId,
  });
}

/** Paged leaderboard response. Includes optional MyRank entry for current user. */
export interface LeaderboardPage {
  list: LeaderboardEntry[];
  /** Total number of distinct users in the leaderboard (capped by period limit). */
  total: number;
  /** Current user's global rank entry, or null if request had no user_id or user has no record in that period. */
  myRank: LeaderboardEntry | null;
}

/**
 * Get leaderboard entries with pagination.
 * Server enforces max total per period (all=500 / today=20 / week=50).
 * When `userId` is provided, response also includes `myRank` for "my rank" sticky row on UI.
 *
 * @param period 'all' | 'today' | 'week'
 * @param userId Current logged-in user id. Leave empty to skip my_rank lookup.
 * @param offset Pagination offset, default 0.
 * @param limit Page size, default 50 (server max 100).
 */
export async function getLeaderboard(
  period: 'all' | 'today' | 'week' = 'all',
  userId = '',
  offset = 0,
  limit = 50
): Promise<LeaderboardPage> {
  const resp: RawListResponse = await api.post('/leaderboard', {
    Period: period,
    UserId: userId,
    Offset: offset,
    Limit: limit,
  });
  if (resp?.Code !== 0) {
    throw new Error(resp?.Message || getI18nT()('service.leaderboardFailed'));
  }
  const rawList = resp.Data?.List ?? [];
  const list = rawList.map((r, i) => toLeaderboardEntry(r, offset + i + 1));
  const rawMy = resp.Data?.MyRank;
  const myRank = rawMy && rawMy.UserId ? toLeaderboardEntry(rawMy, rawMy.Rank ?? 0) : null;
  return { list, total: resp.Data?.Total ?? 0, myRank };
}

/**
 * Get score history for a specific user, with paging + full-scan stats.
 *
 * @param userId Target user id.
 * @param offset Row offset (default 0).
 * @param limit  Page size (default 20, server max 100). 0 falls back to server default.
 */
export async function getUserHistory(
  userId: string,
  offset = 0,
  limit = 0
): Promise<UserHistoryPage> {
  const resp: RawListResponse = await api.post('/user_history', {
    UserId: userId,
    Offset: offset,
    Limit: limit,
  });
  if (resp?.Code !== 0) {
    throw new Error(resp?.Message || getI18nT()('service.historyFailed'));
  }
  const rawList = resp.Data?.List ?? [];
  const list = rawList.map((r, i) =>
    toHistoryEntry(r as RawLeaderboardEntry & { Index?: number }, offset + i + 1)
  );
  const rawStats = resp.Data?.Stats ?? {};
  const stats: UserHistoryStats = {
    bestScore: rawStats.BestScore ?? 0,
    totalGames: rawStats.TotalGames ?? 0,
    cheatCount: rawStats.CheatCount ?? 0,
  };
  return {
    list,
    total: resp.Data?.Total ?? stats.totalGames,
    stats,
  };
}
