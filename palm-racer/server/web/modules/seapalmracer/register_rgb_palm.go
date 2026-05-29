package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	palmdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// RegisterRgbPalm 注册 RGB 手掌。
//
// 注册前会通过本地 DB 检查 userId 是否已注册（一号一掌），
// 掌纹维度的查重由 PaaS 内部保证（重复注册会返回 CodePaaS_UserAlreadyBound）。
func (c *Controller) RegisterRgbPalm(
	ctx context.Context,
	req *v1.RegisterRgbPalmRequest,
) (*v1.RegisterRgbPalmResponse, error) {
	logger := logs_.GetLogger(ctx)

	// 构建 domain 层请求
	domainReq := &palmdomain.RegisterRgbPalmRequest{
		UserId:  req.GetUserId(),
		IsForce: req.GetIsForce(),
	}
	if rgbImage := req.GetRgbImage(); rgbImage != nil {
		domainReq.RgbImage = &palmdomain.RgbImageInfo{
			Data:      rgbImage.GetData(),
			ImageType: int(rgbImage.GetImageType()),
		}
	}

	// 参数校验
	if err := domainReq.Validate(); err != nil {
		logger.WithError(err).Warnf("RegisterRgbPalm validate failed")
		code, msg := toResponseCode(err, CodeInvalidParameter_RgbImageEmpty)
		return &v1.RegisterRgbPalmResponse{Code: code, Message: msg}, nil
	}

	// ─── 注册前预检查 1：DB 检查 userId 是否已注册 ─────────────────
	registered, dbErr := c.app.Commands.PalmHandler.IsUserRegistered(ctx, req.GetUserId())
	if dbErr != nil {
		logger.WithError(dbErr).Warnf("RegisterRgbPalm DB pre-check failed, skip check")
	} else if registered {
		logger.Infof("RegisterRgbPalm pre-check: userId=%s already registered in DB", req.GetUserId())
		return &v1.RegisterRgbPalmResponse{
			Code:    CodeRegisterPreCheck_UserAlreadyBound,
			Message: "this user already has a registered palm",
		}, nil
	}

	// ─── 执行注册 ─────────────────────────────────────────────────
	domainResp, err := c.app.Commands.PalmHandler.RegisterRgbPalm(ctx, domainReq)
	if err != nil {
		logger.WithError(err).Errorf("RegisterRgbPalm failed")
		code, msg := toResponseCode(err, CodePalmProxyError_Unreachable)
		return &v1.RegisterRgbPalmResponse{Code: code, Message: msg}, nil
	}

	// 上游返回非 0 code 时，将 PaaS 错误码归并为自定义错误码
	if domainResp.Code != 0 {
		code := int32(domainResp.Code)
		msg := domainResp.Message
		switch domainResp.Code {
		case CodePaaS_UserAlreadyBound: // PaaS: userId 已绑定满 → 用户已注册
			code = CodeRegisterPreCheck_UserAlreadyBound
			msg = "this user already has a registered palm"
		case CodePaaS_PalmAlreadyExist: // PaaS: Palm already exist → 掌纹已被绑定
			code = CodeRegisterPreCheck_PalmAlreadyBound
			msg = "this palm is already bound to another user"
		}
		return &v1.RegisterRgbPalmResponse{
			Code:    code,
			Message: msg,
		}, nil
	}

	// 成功响应
	resp := &v1.RegisterRgbPalmResponse{
		Code:    0,
		Message: domainResp.Message,
	}
	if domainResp.Data != nil {
		resp.Data = &v1.RegisterRgbPalmData{
			PalmId: domainResp.Data.PalmId,
		}
	}

	// 注册成功后记录 userId 到本地 DB（异步容错，不影响响应）
	if recordErr := c.app.Commands.PalmHandler.RecordRegistration(ctx, req.GetUserId()); recordErr != nil {
		logger.WithError(recordErr).Warnf("RegisterRgbPalm record registration to DB failed, userId=%s", req.GetUserId())
	}

	return resp, nil
}
