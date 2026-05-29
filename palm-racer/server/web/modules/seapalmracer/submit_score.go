package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/application"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// SubmitScore 提交游戏分数。
//
// 错误映射：
//   - user_id 缺失 / 分数越界等参数错误 → 1000 段错误码
//   - MySQL 未启用                    → 3001
//   - 其它数据库写入失败              → 3002（默认兜底）
func (c *Controller) SubmitScore(
	ctx context.Context,
	req *v1.SubmitScoreRequest,
) (*v1.SubmitScoreResponse, error) {
	appReq := &application.SubmitScoreRequest{
		UserID:      req.GetUserId(),
		UserName:    req.GetUserName(),
		Score:       int(req.GetScore()),
		MaxSpeed:    req.GetMaxSpeed(),
		SurviveTime: req.GetSurviveTime(),
		Cheated:     req.GetCheated(),
		CheatUserID: req.GetCheatUserId(),
	}
	// 先做参数校验，错误直接返回（不打数据库）
	if err := appReq.Validate(); err != nil {
		logs_.GetLogger(ctx).WithError(err).Warnf("SubmitScore validate failed")
		code, msg := toResponseCode(err, CodeInvalidParameter_UserIDEmpty)
		return &v1.SubmitScoreResponse{Code: code, Message: msg}, nil
	}

	if err := c.app.Commands.ScoreHandler.SubmitScore(ctx, appReq); err != nil {
		logs_.GetLogger(ctx).WithError(err).Errorf("SubmitScore failed")
		code, msg := toResponseCode(err, CodeInternalError_DatabaseFailed)
		return &v1.SubmitScoreResponse{Code: code, Message: msg}, nil
	}

	return &v1.SubmitScoreResponse{Code: CodeOK, Message: "ok"}, nil
}
