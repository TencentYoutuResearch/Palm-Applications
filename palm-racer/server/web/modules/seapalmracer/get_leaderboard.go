package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/application"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/model"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// GetLeaderboard 获取排行榜。
//
// 行为：
//   - 支持分页查询：通过 offset 和 limit 控制。
//   - 请求带 user_id 时同时返回 my_rank（当前用户的全局排名条目），便于前端展示
//     "我的排名"吸附条；无成绩时 my_rank 不返回。
//   - 返回 total（去重后总条数）供前端计算总页数。
//
// 错误映射：
//   - period 非法      → 1005
//   - MySQL 未启用     → 3001
//   - 其它 DB 查询失败 → 3002
func (c *Controller) GetLeaderboard(
	ctx context.Context,
	req *v1.GetLeaderboardRequest,
) (*v1.GetLeaderboardResponse, error) {
	appReq := &application.GetLeaderboardRequest{
		Period: req.GetPeriod(),
		UserID: req.GetUserId(),
		Offset: int(req.GetOffset()),
		Limit:  int(req.GetLimit()),
	}

	result, err := c.app.Commands.ScoreHandler.GetLeaderboard(ctx, appReq)
	if err != nil {
		logs_.GetLogger(ctx).WithError(err).Errorf("GetLeaderboard failed")
		code, msg := toResponseCode(err, CodeInternalError_DatabaseFailed)
		return &v1.GetLeaderboardResponse{Code: code, Message: msg}, nil
	}

	pbEntries := make([]*v1.LeaderboardEntry, 0, len(result.List))
	for _, e := range result.List {
		pbEntries = append(pbEntries, toPBLeaderboardEntry(&e))
	}

	data := &v1.LeaderboardData{
		List:  pbEntries,
		Total: int32(result.Total),
	}
	if result.MyRank != nil {
		data.MyRank = toPBLeaderboardEntry(result.MyRank)
	}

	return &v1.GetLeaderboardResponse{
		Code: CodeOK,
		Data: data,
	}, nil
}

// toPBLeaderboardEntry 将 model.LeaderboardEntry 转换为 protobuf LeaderboardEntry。
func toPBLeaderboardEntry(e *model.LeaderboardEntry) *v1.LeaderboardEntry {
	return &v1.LeaderboardEntry{
		Rank:        int32(e.Rank),
		UserId:      e.UserID,
		UserName:    e.UserName,
		Score:       int32(e.Score),
		MaxSpeed:    e.MaxSpeed,
		SurviveTime: e.SurviveTime,
		Cheated:     e.Cheated,
		Timestamp:   e.Timestamp,
		CheatUserId: e.CheatUserID,
	}
}
