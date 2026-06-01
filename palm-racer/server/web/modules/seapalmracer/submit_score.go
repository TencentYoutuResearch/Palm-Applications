package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/application"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// SubmitScore 提交游戏分数。
//
// 鉴权链路：
//  1. Authorization: Bearer <login token> 校验身份；
//  2. 请求体 sid 校验单局 session（一次性消费，防重放）；
//  3. 用 token 中的权威 uid 覆盖请求体 UserId（防冒名）；
//  4. 用服务端真实跨度做合理性校验（防伪造 survive_time）；
//  5. 单 uid 30s 内最多 1 次（防机刷）。
//
// 错误映射：
//   - 鉴权失败 → 2001
//   - session 过期 → 2004 / session 不存在或已结算 → 2005
//   - 分数越界等参数错误 → 1000 段
//   - 分数不合理 → 2002
//   - 限流 → 2003
//   - DB 写入失败 → 3002
func (c *Controller) SubmitScore(
	ctx context.Context,
	req *v1.SubmitScoreRequest,
) (*v1.SubmitScoreResponse, error) {
	logger := logs_.GetLogger(ctx)

	token := extractBearerToken(ctx)
	authCtx, err := c.app.Commands.GameAuthHandler.VerifySubmission(ctx, token, req.GetSid())
	if err != nil {
		logger.WithError(err).Warnf("SubmitScore auth failed")
		code, msg := toResponseCode(err, CodeUnauthorized)
		return &v1.SubmitScoreResponse{Code: code, Message: msg}, nil
	}

	// 用 token 中的权威 uid 覆盖请求体；session 中的 cheated 信号合并到本次提交。
	cheated := req.GetCheated() || authCtx.Cheated
	cheatUserID := req.GetCheatUserId()
	if cheatUserID == "" {
		cheatUserID = authCtx.CheatUID
	}

	appReq := &application.SubmitScoreRequest{
		UserID:               authCtx.UID,
		UserName:             req.GetUserName(),
		Score:                int(req.GetScore()),
		MaxSpeed:             req.GetMaxSpeed(),
		SurviveTime:          req.GetSurviveTime(),
		Cheated:              cheated,
		CheatUserID:          cheatUserID,
		GameSessionID:        req.GetGameSessionId(),
		ServerElapsedSeconds: authCtx.ServerElapsedSeconds,
	}

	if err := appReq.Validate(); err != nil {
		logger.WithError(err).Warnf("SubmitScore validate failed")
		code, msg := toResponseCode(err, CodeInvalidParameter_UserIDEmpty)
		return &v1.SubmitScoreResponse{Code: code, Message: msg}, nil
	}

	if err := c.app.Commands.ScoreHandler.SubmitScore(ctx, appReq); err != nil {
		logger.WithError(err).Errorf("SubmitScore failed")
		code, msg := toResponseCode(err, CodeInternalError_DatabaseFailed)
		return &v1.SubmitScoreResponse{Code: code, Message: msg}, nil
	}

	return &v1.SubmitScoreResponse{Code: CodeOK, Message: "ok"}, nil
}
