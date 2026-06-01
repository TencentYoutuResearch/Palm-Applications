package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// StartGame 校验身份 token 并签发单局 session。
//
// 若原身份 token 即将过期，会一并下发续命后的新 token，前端写回登录态即可。
//
// 错误映射：
//   - Authorization 头缺失 / token 非法 → 2001 UNAUTHORIZED
func (c *Controller) StartGame(
	ctx context.Context,
	_ *v1.StartGameRequest,
) (*v1.StartGameResponse, error) {
	logger := logs_.GetLogger(ctx)

	token := extractBearerToken(ctx)
	res, err := c.app.Commands.GameAuthHandler.StartGame(ctx, token)
	if err != nil {
		logger.WithError(err).Warnf("StartGame auth failed")
		code, msg := toResponseCode(err, CodeUnauthorized)
		return &v1.StartGameResponse{Code: code, Message: msg}, nil
	}

	logger.Infof("StartGame ok: uid=%s sid=%s refreshed=%v", res.UID, res.SID, res.RefreshedToken != "")
	return &v1.StartGameResponse{
		Code:    CodeOK,
		Message: "ok",
		Data: &v1.StartGameData{
			Sid:   res.SID,
			Token: res.RefreshedToken,
		},
	}, nil
}
