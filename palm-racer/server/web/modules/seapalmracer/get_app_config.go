package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// GetAppConfig 获取应用功能配置（feature flags）。
//
// 从配置文件 palm-racer.yaml 的 features 段读取功能开关，
// 运维侧修改配置文件并重启服务即可控制前端功能展示。
//
// 配置示例（palm-racer.yaml）：
//
//	features:
//	  guest_mode: true
func (c *Controller) GetAppConfig(
	ctx context.Context,
	req *v1.GetAppConfigRequest,
) (*v1.GetAppConfigResponse, error) {
	logger := logs_.GetLogger(ctx)
	logger.Infof("GetAppConfig called")

	conf := provider.GetConfig()
	var featuresConf *v1.Configuration_Features
	if conf != nil {
		featuresConf = conf.GetFeatures()
	}

	// Default: guest_mode enabled
	guestMode := true
	if featuresConf != nil {
		guestMode = featuresConf.GetGuestMode()
	}

	return &v1.GetAppConfigResponse{
		Code:    CodeOK,
		Message: "ok",
		Data: &v1.AppConfigData{
			Features: &v1.AppConfigFeatures{
				GuestMode: guestMode,
			},
		},
	}, nil
}
