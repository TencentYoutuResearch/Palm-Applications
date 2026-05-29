package database

import (
	"context"

	"github.com/jmoiron/sqlx"
	mysqldao "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/dao/mysql.dao"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/model"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/score"
)

// ScoreRepository 基于 MySQL 的分数数据访问实现。
type ScoreRepository struct {
	dao *mysqldao.ScoreDao
}

// NewScoreRepository 创建 MySQL 分数仓储实例。
func NewScoreRepository(db *sqlx.DB) score.ScoreRepository {
	return &ScoreRepository{
		dao: mysqldao.NewScoreDao(db),
	}
}

// InsertScore 插入一条游戏分数记录。
func (r *ScoreRepository) InsertScore(ctx context.Context, userID, userName string, scoreVal int, maxSpeed, surviveTime float64, cheated bool, cheatUserID string) error {
	return r.dao.InsertScore(ctx, userID, userName, scoreVal, maxSpeed, surviveTime, cheated, cheatUserID)
}

// GetLeaderboard 获取排行榜。
func (r *ScoreRepository) GetLeaderboard(ctx context.Context, period string, offset int, pageSize int) ([]model.LeaderboardEntry, error) {
	return r.dao.GetLeaderboard(ctx, period, offset, pageSize)
}

// GetLeaderboardTotal 获取去重后的排行榜总条数。
func (r *ScoreRepository) GetLeaderboardTotal(ctx context.Context, period string, maxTotal int) (int, error) {
	return r.dao.GetLeaderboardTotal(ctx, period, maxTotal)
}

// GetUserRank 获取指定用户在 period 下的全局排名条目。
func (r *ScoreRepository) GetUserRank(ctx context.Context, userID, period string) (model.LeaderboardEntry, bool, error) {
	return r.dao.GetUserRank(ctx, userID, period)
}

// GetUserHistory 分页获取用户历史成绩。
func (r *ScoreRepository) GetUserHistory(ctx context.Context, userID string, offset int64, limit int32) ([]model.HistoryEntry, error) {
	return r.dao.GetUserHistory(ctx, userID, offset, limit)
}

// GetUserHistoryStats 获取用户历史全量聚合统计。
func (r *ScoreRepository) GetUserHistoryStats(ctx context.Context, userID string) (model.UserHistoryStats, error) {
	return r.dao.GetUserHistoryStats(ctx, userID)
}
