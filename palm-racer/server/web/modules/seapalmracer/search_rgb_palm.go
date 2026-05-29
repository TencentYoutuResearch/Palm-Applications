package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	palmdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// SearchRgbPalm 搜索 RGB 手掌。
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

	// 上游返回非 0 code 时透传错误
	if domainResp.Code != 0 {
		return &v1.SearchRgbPalmResponse{
			Code:    int32(domainResp.Code),
			Message: domainResp.Message,
		}, nil
	}

	// 成功响应
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
	}

	return resp, nil
}
