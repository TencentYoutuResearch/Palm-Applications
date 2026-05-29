package application

import (
	"context"
	"fmt"

	appconfig "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/score"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/model"
)

// ScoreHandler 游戏分数应用层处理器。
type ScoreHandler struct {
	repo score.ScoreRepository
}

// NewScoreHandler 创建游戏分数应用层处理器。
func NewScoreHandler(repo score.ScoreRepository) ScoreHandler {
	return ScoreHandler{repo: repo}
}

// SubmitScoreRequest 提交分数请求。
type SubmitScoreRequest struct {
	UserID      string  `json:"UserId"`
	UserName    string  `json:"UserName"`
	Score       int     `json:"Score"`
	MaxSpeed    float64 `json:"MaxSpeed"`
	SurviveTime float64 `json:"SurviveTime"`
	Cheated     bool    `json:"Cheated"`
	CheatUserID string  `json:"CheatUserId"` // 替玩用户ID
}

// Validate 校验提交分数请求。
func (r *SubmitScoreRequest) Validate() error {
	if r.UserID == "" {
		return score.ErrUserIDEmpty
	}
	if r.Score < 0 || r.Score > appconfig.MaxScoreValue {
		return fmt.Errorf("score range [0, %d]: %w", appconfig.MaxScoreValue, score.ErrScoreOutOfRange)
	}
	if r.MaxSpeed < 0 || r.MaxSpeed > appconfig.MaxSpeedValue {
		return fmt.Errorf("max_speed range [0, %v]: %w", appconfig.MaxSpeedValue, score.ErrMaxSpeedOutOfRange)
	}
	if r.SurviveTime < 0 || r.SurviveTime > 3600 {
		return fmt.Errorf("survive_time range [0, 3600]: %w", score.ErrSurviveTimeOutOfRange)
	}
	return nil
}

// SubmitScore 提交游戏分数。
func (h *ScoreHandler) SubmitScore(ctx context.Context, req *SubmitScoreRequest) error {
	if h.repo == nil {
		return score.ErrMySQLNotEnabled
	}
	if err := req.Validate(); err != nil {
		return err
	}
	return h.repo.InsertScore(
		ctx, req.UserID, req.UserName, req.Score,
		req.MaxSpeed, req.SurviveTime, req.Cheated, req.CheatUserID,
	)
}

// GetLeaderboardRequest 排行榜请求。
type GetLeaderboardRequest struct {
	Period string `json:"Period"`
	// UserID 当前登录用户 ID。非空时，服务端会额外返回该用户的全局排名条目 MyRank。
	UserID string `json:"UserId"`
	// Offset 分页偏移量，默认 0。
	Offset int `json:"Offset"`
	// Limit 每页条数，默认 DefaultLeaderboardPageSize，最大 MaxLeaderboardPageSize。
	Limit int `json:"Limit"`
}

// GetLeaderboardResult 排行榜查询结果。
type GetLeaderboardResult struct {
	// List 当前页的榜单条目。
	List []model.LeaderboardEntry
	// Total 去重后的排行榜总条数（受 period 上限约束），用于前端计算总页数。
	Total int
	// MyRank 当前用户的全局排名条目：
	//   - 请求未带 UserID 时为 nil；
	//   - 该用户在该 period 下无成绩时也为 nil；
	//   - 否则即使在 Top N 内也会返回（前端可自行决定是否展示吸附条）。
	MyRank *model.LeaderboardEntry
}

// leaderboardLimitByPeriod 根据 period 返回固定 Top N 上限。
// 这里不让客户端决定，避免恶意客户端传 1e9 拖垮 DB。
func leaderboardLimitByPeriod(period string) int {
	switch period {
	case "today":
		return appconfig.LeaderboardLimitToday
	case "week":
		return appconfig.LeaderboardLimitWeek
	default: // "all"
		return appconfig.LeaderboardLimitAll
	}
}

// GetLeaderboard 获取排行榜。
//
// 行为：
//   - period 空值回退为 "all"；非白名单值返回 ErrPeriodInvalid。
//   - 支持分页查询：通过 Offset 和 PageSize 控制。
//     PageSize 默认 DefaultLeaderboardPageSize，最大 MaxLeaderboardPageSize。
//     每个 period 有最大总条数上限（all=500 / today=20 / week=50），
//     offset + pageSize 不会超过该上限。
//   - 请求带 UserID 时同时返回 MyRank，用于前端在底部展示"我的排名"吸附条。
//     MyRank 的 Rank 字段为该用户在去重后的全局名次，语义与榜单内 Rank 一致。
//   - 返回 HasMore 标记前端是否还有更多数据可加载。
func (h *ScoreHandler) GetLeaderboard(ctx context.Context, req *GetLeaderboardRequest) (*GetLeaderboardResult, error) {
	if h.repo == nil {
		return nil, score.ErrMySQLNotEnabled
	}
	period := req.Period
	if period == "" {
		period = "all"
	}
	// period 白名单校验（空值已经 fallback 到 all）
	switch period {
	case "today", "week", "all":
	default:
		return nil, fmt.Errorf("period=%q: %w", period, score.ErrPeriodInvalid)
	}

	// 计算该 period 的最大总条数上限
	maxTotal := leaderboardLimitByPeriod(period)

	// 校验并修正 offset
	offset := req.Offset
	if offset < 0 {
		offset = 0
	}
	if offset >= maxTotal {
		// offset 超过上限，直接返回空列表
		result := &GetLeaderboardResult{Total: 0}
		if req.UserID != "" {
			entry, found, err := h.repo.GetUserRank(ctx, req.UserID, period)
			if err != nil {
				return nil, err
			}
			if found {
				copied := entry
				result.MyRank = &copied
			}
		}
		return result, nil
	}

	// 校验并修正 limit
	limit := req.Limit
	if limit <= 0 {
		limit = appconfig.DefaultLeaderboardPageSize
	}
	if limit > appconfig.MaxLeaderboardPageSize {
		limit = appconfig.MaxLeaderboardPageSize
	}
	// 确保不超过该 period 的最大总条数
	if offset+limit > maxTotal {
		limit = maxTotal - offset
	}

	list, err := h.repo.GetLeaderboard(ctx, period, offset, limit)
	if err != nil {
		return nil, err
	}

	// 查询去重后的总条数，受 maxTotal 上限约束
	total, err := h.repo.GetLeaderboardTotal(ctx, period, maxTotal)
	if err != nil {
		return nil, err
	}

	result := &GetLeaderboardResult{List: list, Total: total}

	// 仅在带 UserID 时计算 MyRank，避免多余 SQL。
	if req.UserID != "" {
		entry, found, err := h.repo.GetUserRank(ctx, req.UserID, period)
		if err != nil {
			return nil, err
		}
		if found {
			// 拷贝一份，避免调用方误以为它是 list 中某项的引用。
			copied := entry
			result.MyRank = &copied
		}
	}

	return result, nil
}

// GetUserHistoryRequest 用户历史成绩请求。
type GetUserHistoryRequest struct {
	UserID string `json:"UserId"`
	Offset int64  `json:"Offset"`
	Limit  int32  `json:"Limit"`
}

// GetUserHistoryResult 用户历史成绩结果（列表 + 全量聚合统计）。
type GetUserHistoryResult struct {
	List  []model.HistoryEntry
	Stats model.UserHistoryStats
}

// GetUserHistory 分页获取用户历史成绩，同时返回全量聚合统计。
//
// 分页规则：
//   - offset 小于 0 会被视为 0。
//   - limit 小于等于 0 时使用默认值 DefaultUserHistoryLimit。
//   - limit 超过 MaxUserHistoryLimit 时会被夹到上限，避免拉数据过多拖垮 DB。
//
// 统计口径：
//   - Stats 由 SQL 直接聚合，包含用户历史的真实 best_score / total_games / cheat_count，
//     不受分页窗口影响，前端不应再从分页列表里二次聚合最高分/总场次。
func (h *ScoreHandler) GetUserHistory(ctx context.Context, req *GetUserHistoryRequest) (*GetUserHistoryResult, error) {
	if h.repo == nil {
		return nil, score.ErrMySQLNotEnabled
	}
	if req.UserID == "" {
		return nil, score.ErrUserIDEmpty
	}

	offset := req.Offset
	if offset < 0 {
		offset = 0
	}
	limit := req.Limit
	if limit <= 0 {
		limit = appconfig.DefaultUserHistoryLimit
	}
	if limit > appconfig.MaxUserHistoryLimit {
		limit = appconfig.MaxUserHistoryLimit
	}

	list, err := h.repo.GetUserHistory(ctx, req.UserID, offset, limit)
	if err != nil {
		return nil, err
	}
	stats, err := h.repo.GetUserHistoryStats(ctx, req.UserID)
	if err != nil {
		return nil, err
	}

	// 重新计算 Index：列表按时间倒序，最新的记录应该是局数最大的。
	// 第一页第一条 = TotalGames - offset，依次递减。
	startIndex := stats.TotalGames - int(offset)
	for i := range list {
		list[i].Index = startIndex - i
	}

	return &GetUserHistoryResult{List: list, Stats: stats}, nil
}
