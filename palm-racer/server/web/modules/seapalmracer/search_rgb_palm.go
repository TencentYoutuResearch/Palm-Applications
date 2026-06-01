package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	palmdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// SearchRgbPalm 搜索 RGB 手掌。
//
// 计分鉴权辅路：
//   - 登录场景（请求未带 sid）：1:N 命中后下发身份 token（response.token）。
//   - 局中反作弊场景（请求带 sid）：服务端为该 session 续期；如核到他人则标记替玩。
//     续期只要求「核身请求发生」，对刷掌召回率不敏感，正常玩家不会因质量差被惩罚。
func (c *Controller) SearchRgbPalm(
	ctx context.Context,
	req *v1.SearchRgbPalmRequest,
) (*v1.SearchRgbPalmResponse, error) {
	logger := logs_.GetLogger(ctx)

	// 构建 domain 层请求
	domainReq := &palmdomain.SearchRgbPalmRequest{
		UserId: req.GetUserId(),
	}
	if rgbImage := req.GetRgbImage(); rgbImage != nil {
		domainReq.RgbImage = &palmdomain.RgbImageInfo{
			Data:      rgbImage.GetData(),
			ImageType: int(rgbImage.GetImageType()),
		}
	}

	// 参数校验
	if err := domainReq.Validate(); err != nil {
		logger.WithError(err).Warnf("SearchRgbPalm validate failed")
		code, msg := toResponseCode(err, CodeInvalidParameter_RgbImageEmpty)
		return &v1.SearchRgbPalmResponse{Code: code, Message: msg}, nil
	}

	domainResp, err := c.app.Commands.PalmHandler.SearchRgbPalm(ctx, domainReq)
	if err != nil {
		logger.WithError(err).Errorf("SearchRgbPalm failed")
		code, msg := toResponseCode(err, CodePalmProxyError_Unreachable)
		return &v1.SearchRgbPalmResponse{Code: code, Message: msg}, nil
	}

	// 局中反作弊续期：sid 非空时尝试续期并按需标记替玩。
	// 失败不阻断主流程，仅记录日志（避免因鉴权侧故障影响游戏体验）。
	if sid := req.GetSid(); sid != "" {
		matchedUID := ""
		if domainResp.Code == 0 && domainResp.Data != nil {
			matchedUID = domainResp.Data.UserId
		}
		if rerr := c.app.Commands.GameAuthHandler.RenewOnVerify(ctx, sid, matchedUID); rerr != nil {
			logger.WithError(rerr).Debugf("SearchRgbPalm renew session failed: sid=%s", sid)
		}
	}

	// 上游返回非 0 code 时透传错误
	if domainResp.Code != 0 {
		return &v1.SearchRgbPalmResponse{
			Code:    int32(domainResp.Code),
			Message: domainResp.Message,
		}, nil
	}

	resp := &v1.SearchRgbPalmResponse{
		Code:    0,
		Message: domainResp.Message,
	}
	if domainResp.Data != nil {
		resp.Data = &v1.SearchRgbPalmData{
			UserId:           domainResp.Data.UserId,
			Score:            domainResp.Data.Score,
			AlgorithmVersion: domainResp.Data.AlgorithmVersion,
			PalmDirection:    int32(domainResp.Data.PalmDirection),
		}

		// 登录场景：未带 sid 且命中用户时签发身份 token。
		if req.GetSid() == "" && domainResp.Data.UserId != "" {
			if token, terr := c.app.Commands.GameAuthHandler.IssueLoginToken(domainResp.Data.UserId); terr == nil {
				resp.Token = token
			} else {
				logger.WithError(terr).Warnf("SearchRgbPalm issue token failed: uid=%s", domainResp.Data.UserId)
			}
		}
	}

	return resp, nil
}
