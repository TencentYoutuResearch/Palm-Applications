package score

import (
	"context"

	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/model"
)

// ScoreRepository 游戏分数数据访问接口（领域层定义）。
type ScoreRepository interface {
	// InsertScore 插入一条游戏分数记录。
	InsertScore(ctx context.Context, userID, userName string, score int, maxSpeed, surviveTime float64, cheated bool, cheatUserID string) error

	// GetLeaderboard 获取排行榜，每个用户只保留最高非作弊分数。
	// offset 用于分页偏移，pageSize 为每页条数。
	GetLeaderboard(ctx context.Context, period string, offset int, pageSize int) ([]model.LeaderboardEntry, error)

	// GetLeaderboardTotal 获取去重后的排行榜总条数，受 maxTotal 上限约束。
	GetLeaderboardTotal(ctx context.Context, period string, maxTotal int) (int, error)

	// GetUserRank 获取指定用户在 period 下的全局排名条目。
	// 返回 (entry, found, err)：found=false 表示该用户在该 period 下无成绩。
	GetUserRank(ctx context.Context, userID, period string) (model.LeaderboardEntry, bool, error)

	// GetUserHistory 分页获取指定用户的历史成绩，按时间倒序。
	// offset / limit 必须由调用方完成合法性校验。
	GetUserHistory(ctx context.Context, userID string, offset int64, limit int32) ([]model.HistoryEntry, error)

	// GetUserHistoryStats 返回用户历史全量聚合统计（非作弊最高分、总场次、作弊场次）。
	GetUserHistoryStats(ctx context.Context, userID string) (model.UserHistoryStats, error)
}
