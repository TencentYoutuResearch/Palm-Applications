package model

import (
	"database/sql"
)

// GameScore 游戏分数数据模型，对应 MySQL t_game_scores 表。
type GameScore struct {
	ID          sql.NullInt64   `db:"id"`
	UserID      string          `db:"user_id"`
	UserName    string          `db:"user_name"`
	Score       int             `db:"score"`
	MaxSpeed    float64         `db:"max_speed"`
	SurviveTime float64         `db:"survive_time"`
	Cheated     int             `db:"cheated"` // 0: 未作弊, 1: 作弊
	CheatUserID string          `db:"cheat_user_id"` // 替玩用户ID
	CreatedAt   sql.NullTime    `db:"created_at"`
}

// LeaderboardEntry 排行榜条目。
type LeaderboardEntry struct {
	Rank        int     `json:"Rank"`
	UserID      string  `json:"UserId"`
	UserName    string  `json:"UserName"`
	Score       int     `json:"Score"`
	MaxSpeed    float64 `json:"MaxSpeed"`
	SurviveTime float64 `json:"SurviveTime"`
	Cheated     bool    `json:"Cheated"`
	CheatUserID string  `json:"CheatUserId"` // 替玩用户ID
	Timestamp   int64   `json:"Timestamp"`
}

// HistoryEntry 历史成绩条目。
type HistoryEntry struct {
	Index       int     `json:"Index"`
	UserID      string  `json:"UserId"`
	UserName    string  `json:"UserName"`
	Score       int     `json:"Score"`
	MaxSpeed    float64 `json:"MaxSpeed"`
	SurviveTime float64 `json:"SurviveTime"`
	Cheated     bool    `json:"Cheated"`
	CheatUserID string  `json:"CheatUserId"` // 替玩用户ID
	Timestamp   int64   `json:"Timestamp"`
}

// UserHistoryStats 用户历史全量聚合统计。
// 直接由数据库聚合得出，不受分页影响。
type UserHistoryStats struct {
	BestScore  int `json:"BestScore"`  // 非作弊最高分（无非作弊记录时为 0）
	TotalGames int `json:"TotalGames"` // 总场次
	CheatCount int `json:"CheatCount"` // 作弊场次
}
