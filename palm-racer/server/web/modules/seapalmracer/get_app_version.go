package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// GetAppVersion 获取 App 最新版本信息。
//
// 版本信息通过配置文件 palm-racer.yaml 的 app_version 段配置，
// 运维侧修改配置文件即可控制客户端升级策略，无需重新编译或设置环境变量。
//
// 配置示例（palm-racer.yaml）：
//
//	app_version:
//	  version: "1.1.0"
//	  download_url: "https://your-server.example.com/palm-racer/download/palm-racer.apk"
//	  force_update: false
//	  changelog: "新增版本检查功能，优化注册页面体验"
func (c *Controller) GetAppVersion(
	ctx context.Context,
	req *v1.GetAppVersionRequest,
) (*v1.GetAppVersionResponse, error) {
	logger := logs_.GetLogger(ctx)
	logger.Infof("GetAppVersion: platform=%s, currentVersion=%s",
		req.GetPlatform(), req.GetCurrentVersion())

	// 从配置文件读取版本信息
	conf := provider.GetConfig()
	var appVersionConf *v1.Configuration_AppVersion
	if conf != nil {
		appVersionConf = conf.GetAppVersion()
	}

	// 设置默认值
	appVersion := "1.0.0"
	downloadURL := ""
	forceUpdate := false
	changelog := "优化体验，修复已知问题"

	if appVersionConf != nil {
		if appVersionConf.GetVersion() != "" {
			appVersion = appVersionConf.GetVersion()
		}
		if appVersionConf.GetDownloadUrl() != "" {
			downloadURL = appVersionConf.GetDownloadUrl()
		}
		forceUpdate = appVersionConf.GetForceUpdate()
		if appVersionConf.GetChangelog() != "" {
			changelog = appVersionConf.GetChangelog()
		}
	}

	return &v1.GetAppVersionResponse{
		Code:    CodeOK,
		Message: "ok",
		Data: &v1.AppVersionData{
			Version:     appVersion,
			DownloadUrl: downloadURL,
			ForceUpdate: forceUpdate,
			Changelog:   changelog,
		},
	}, nil
}
