package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/application"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// GetUserHistory 分页获取用户历史成绩，同时返回全量聚合统计。
//
// 错误映射：
//   - user_id 缺失     → 1001
//   - MySQL 未启用     → 3001
//   - 其它 DB 查询失败 → 3002
func (c *Controller) GetUserHistory(
	ctx context.Context,
	req *v1.GetUserHistoryRequest,
) (*v1.GetUserHistoryResponse, error) {
	appReq := &application.GetUserHistoryRequest{
		UserID: req.GetUserId(),
		Offset: req.GetOffset(),
		Limit:  req.GetLimit(),
	}

	result, err := c.app.Commands.ScoreHandler.GetUserHistory(ctx, appReq)
	if err != nil {
		logs_.GetLogger(ctx).WithError(err).Errorf("GetUserHistory failed")
		code, msg := toResponseCode(err, CodeInternalError_DatabaseFailed)
		return &v1.GetUserHistoryResponse{Code: code, Message: msg}, nil
	}

	pbEntries := make([]*v1.HistoryEntry, 0, len(result.List))
	for _, e := range result.List {
		pbEntries = append(pbEntries, &v1.HistoryEntry{
			Index:       int32(e.Index),
			UserId:      e.UserID,
			UserName:    e.UserName,
			Score:       int32(e.Score),
			MaxSpeed:    e.MaxSpeed,
			SurviveTime: e.SurviveTime,
			Cheated:     e.Cheated,
			Timestamp:   e.Timestamp,
			CheatUserId: e.CheatUserID,
		})
	}

	return &v1.GetUserHistoryResponse{
		Code: CodeOK,
		Data: &v1.UserHistoryData{
			List:  pbEntries,
			Total: int32(result.Stats.TotalGames),
			Stats: &v1.UserHistoryStats{
				BestScore:  int32(result.Stats.BestScore),
				TotalGames: int32(result.Stats.TotalGames),
				CheatCount: int32(result.Stats.CheatCount),
			},
		},
	}, nil
}
