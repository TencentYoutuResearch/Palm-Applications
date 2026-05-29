package mysqldao

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/dao"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/model"
	"github.com/jmoiron/sqlx"
	context_ "github.com/kaydxh/golang/go/context"
)

const scoreTableName = "t_game_scores"

// ScoreDao 游戏分数数据访问对象。
type ScoreDao struct {
	db *sqlx.DB
}

// NewScoreDao 创建游戏分数 DAO 实例。
func NewScoreDao(db *sqlx.DB) *ScoreDao {
	return &ScoreDao{db: db}
}

// buildDateFilter 根据 period 生成时间段过滤子句，附加在 WHERE 1=1 之后。
// 返回的片段以 "AND ..." 开头，period 非 today/week 时返回空串（表示全量）。
func buildDateFilter(period string) string {
	switch period {
	case "today":
		return "AND DATE(created_at) = CURDATE()"
	case "week":
		return "AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
	default:
		return ""
	}
}

// InsertScore 插入一条游戏分数记录。
func (d *ScoreDao) InsertScore(ctx context.Context, userID, userName string, score int, maxSpeed, surviveTime float64, cheated bool, cheatUserID string) error {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	query := fmt.Sprintf(`INSERT INTO %s (user_id, user_name, score, max_speed, survive_time, cheated, cheat_user_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`, scoreTableName)

	cheatedInt := 0
	if cheated {
		cheatedInt = 1
	}

	_, err := d.db.ExecContext(ctx, query, userID, userName, score, maxSpeed, surviveTime, cheatedInt, cheatUserID)
	if err != nil {
		return fmt.Errorf("score_dao: insert: %w", err)
	}
	return nil
}

// GetLeaderboard 获取排行榜，每个用户只保留最高非作弊分数。
// 优先取非作弊成绩，如果没有则取最高作弊成绩。
// offset 用于分页偏移，pageSize 为每页条数。
func (d *ScoreDao) GetLeaderboard(ctx context.Context, period string, offset int, pageSize int) ([]model.LeaderboardEntry, error) {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	dateFilter := buildDateFilter(period)

	query := fmt.Sprintf(`
		SELECT user_id, user_name, score, max_speed, survive_time, cheated, cheat_user_id, created_at
		FROM (
			SELECT *,
				ROW_NUMBER() OVER (
					PARTITION BY user_id
					ORDER BY cheated ASC, score DESC
				) AS rn
			FROM %s
			WHERE 1=1 %s
		) ranked
		WHERE rn = 1
		ORDER BY cheated ASC, score DESC
		LIMIT ? OFFSET ?
	`, scoreTableName, dateFilter)

	rows, err := d.db.QueryContext(ctx, query, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("score_dao: get leaderboard: %w", err)
	}
	defer rows.Close()

	var entries []model.LeaderboardEntry
	rank := offset + 1
	for rows.Next() {
		var entry model.LeaderboardEntry
		var cheated int
		var createdAt sql.NullTime
		if err := rows.Scan(
			&entry.UserID, &entry.UserName, &entry.Score,
			&entry.MaxSpeed, &entry.SurviveTime, &cheated, &entry.CheatUserID, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("score_dao: scan leaderboard row: %w", err)
		}
		entry.Rank = rank
		entry.Cheated = cheated == 1
		if createdAt.Valid {
			entry.Timestamp = createdAt.Time.UnixMilli()
		}
		entries = append(entries, entry)
		rank++
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("score_dao: iterate leaderboard rows: %w", err)
	}

	return entries, nil
}

// GetLeaderboardTotal 获取去重后的排行榜总条数，受 maxTotal 上限约束。
// 使用 COUNT 子查询避免全量扫描，性能优于 SELECT 全部再 len()。
func (d *ScoreDao) GetLeaderboardTotal(ctx context.Context, period string, maxTotal int) (int, error) {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	dateFilter := buildDateFilter(period)

	// 先用窗口函数去重，再 COUNT，LIMIT 约束最大值
	query := fmt.Sprintf(`
		SELECT COUNT(*) FROM (
			SELECT user_id
			FROM (
				SELECT user_id,
					ROW_NUMBER() OVER (
						PARTITION BY user_id
						ORDER BY cheated ASC, score DESC
					) AS rn
				FROM %s
				WHERE 1=1 %s
			) ranked
			WHERE rn = 1
			LIMIT ?
		) total_count
	`, scoreTableName, dateFilter)

	var total int
	row := d.db.QueryRowContext(ctx, query, maxTotal)
	if err := row.Scan(&total); err != nil {
		return 0, fmt.Errorf("score_dao: get leaderboard total: %w", err)
	}
	return total, nil
}

// GetUserRank 获取指定用户在 period 下的全局排名条目（基于每人最高分的去重榜）。
// 返回 (entry, found, err)：found=false 表示该用户在该 period 下无成绩。
// 排序语义必须与 GetLeaderboard 一致（ORDER BY cheated ASC, score DESC），
// 否则会出现 my_rank 与榜单位置不一致的 bug。
func (d *ScoreDao) GetUserRank(ctx context.Context, userID, period string) (model.LeaderboardEntry, bool, error) {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	dateFilter := buildDateFilter(period)

	// 两层窗口函数：
	//   1) 内层 rn 按 user_id 分组只留每人最高分；
	//   2) 外层 rank_no 对去重后的记录按 cheated ASC, score DESC 计算全局排名；
	//   3) 最终按 user_id 过滤到目标用户。
	query := fmt.Sprintf(`
		SELECT user_id, user_name, score, max_speed, survive_time, cheated, cheat_user_id, created_at, rank_no
		FROM (
			SELECT user_id, user_name, score, max_speed, survive_time, cheated, cheat_user_id, created_at,
				ROW_NUMBER() OVER (ORDER BY cheated ASC, score DESC) AS rank_no
			FROM (
				SELECT *,
					ROW_NUMBER() OVER (
						PARTITION BY user_id
						ORDER BY cheated ASC, score DESC
					) AS rn
				FROM %s
				WHERE 1=1 %s
			) ranked
			WHERE rn = 1
		) leaderboard
		WHERE user_id = ?
		LIMIT 1
	`, scoreTableName, dateFilter)

	var entry model.LeaderboardEntry
	var cheated int
	var createdAt sql.NullTime
	var rankNo int

	row := d.db.QueryRowContext(ctx, query, userID)
	if err := row.Scan(
		&entry.UserID, &entry.UserName, &entry.Score,
		&entry.MaxSpeed, &entry.SurviveTime, &cheated, &entry.CheatUserID, &createdAt, &rankNo,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.LeaderboardEntry{}, false, nil
		}
		return model.LeaderboardEntry{}, false, fmt.Errorf("score_dao: get user rank: %w", err)
	}
	entry.Rank = rankNo
	entry.Cheated = cheated == 1
	if createdAt.Valid {
		entry.Timestamp = createdAt.Time.UnixMilli()
	}
	return entry, true, nil
}

// GetUserHistory 分页获取指定用户的历史成绩，按时间降序。
// Index 字段在此处按倒序位置临时赋值，application 层会根据 TotalGames 重新计算为真实局数。
func (d *ScoreDao) GetUserHistory(ctx context.Context, userID string, offset int64, limit int32) ([]model.HistoryEntry, error) {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	query := fmt.Sprintf(`SELECT user_id, user_name, score, max_speed, survive_time, cheated, cheat_user_id, created_at
		FROM %s WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, scoreTableName)

	rows, err := d.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("score_dao: get user history: %w", err)
	}
	defer rows.Close()

	var entries []model.HistoryEntry
	// Index 从 offset+1 开始，代表"按时间倒序的绝对序号"。
	index := offset + 1
	for rows.Next() {
		var entry model.HistoryEntry
		var cheated int
		var createdAt sql.NullTime
		if err := rows.Scan(
			&entry.UserID, &entry.UserName, &entry.Score,
			&entry.MaxSpeed, &entry.SurviveTime, &cheated, &entry.CheatUserID, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("score_dao: scan history row: %w", err)
		}
		entry.Index = int(index)
		entry.Cheated = cheated == 1
		if createdAt.Valid {
			entry.Timestamp = createdAt.Time.UnixMilli()
		}
		entries = append(entries, entry)
		index++
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("score_dao: iterate history rows: %w", err)
	}

	return entries, nil
}

// GetUserHistoryStats 获取用户历史全量聚合统计。
// 单条 SQL 同时算出非作弊最高分、总场次、作弊场次，不受分页影响。
func (d *ScoreDao) GetUserHistoryStats(ctx context.Context, userID string) (model.UserHistoryStats, error) {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	query := fmt.Sprintf(`SELECT
			COALESCE(MAX(CASE WHEN cheated = 0 THEN score END), 0) AS best_score,
			COUNT(*) AS total_games,
			COALESCE(SUM(CASE WHEN cheated = 1 THEN 1 ELSE 0 END), 0) AS cheat_count
		FROM %s WHERE user_id = ?`, scoreTableName)

	var stats model.UserHistoryStats
	row := d.db.QueryRowContext(ctx, query, userID)
	if err := row.Scan(&stats.BestScore, &stats.TotalGames, &stats.CheatCount); err != nil {
		return model.UserHistoryStats{}, fmt.Errorf("score_dao: get user history stats: %w", err)
	}
	return stats, nil
}
