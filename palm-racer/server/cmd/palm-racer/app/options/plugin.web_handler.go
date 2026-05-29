package options

import (
	"context"

	webserver_ "github.com/kaydxh/golang/pkg/webserver"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/application"
	palmdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
	palminfra "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/palm"
	dbinfra "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	seapalmracer_ "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/web/app/seapalmracer"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/web/modules/seapalmracer"
	"github.com/sirupsen/logrus"
)

// installWebHandlerOrDie 安装 Web Handler（Controller 层），初始化完整的依赖链：
// ScoreDAO → ScoreRepository → ScoreHandler
// PalmConfig → PalmService → PalmHandler
// PalmRegistrationRepository → PalmHandler
// → Application → Controller → NewWebHandlers
func (s *CompletedServerRunOptions) installWebHandlerOrDie(ws *webserver_.GenericWebServer) {
	// 1. 初始化 Score 相关依赖
	var scoreHandler application.ScoreHandler
	sqlDB := provider.GetSqlDB()
	if sqlDB != nil {
		scoreRepo := dbinfra.NewScoreRepository(sqlDB)
		scoreHandler = application.NewScoreHandler(scoreRepo)
		logrus.Info("[WebHandler] ScoreHandler initialized with MySQL")
	} else {
		logrus.Warn("[WebHandler] MySQL not enabled, ScoreHandler will not work")
	}

	// 2. 初始化 PalmRegistration 相关依赖
	var palmRegRepo palmdomain.PalmRegistrationRepository
	if sqlDB != nil {
		var err error
		palmRegRepo, err = dbinfra.NewPalmRegistrationRepository(context.Background(), sqlDB)
		if err != nil {
			logrus.WithError(err).Error("[WebHandler] PalmRegistrationRepository init failed")
		} else {
			logrus.Info("[WebHandler] PalmRegistrationRepository initialized")
		}
	}

	// 3. 初始化 Palm 相关依赖
	var palmHandler application.PalmHandler
	fullConfig := provider.GetConfig()
	if fullConfig != nil && fullConfig.GetPalm() != nil {
		palmProto := fullConfig.GetPalm()
		palmCfg := &palminfra.PalmConfig{
			Host:     palmProto.GetHost(),
			APIToken: palmProto.GetSecretKey(), // secret_key field holds Bearer token
		}
		var palmSvc palmdomain.PalmService = palminfra.NewPalmService(palmCfg)
		palmHandler = application.NewPalmHandler(palmSvc, palmRegRepo)
		logrus.Infof("[WebHandler] PalmHandler initialized, host: %s", palmCfg.Host)
	} else {
		logrus.Warn("[WebHandler] Palm config not found, PalmHandler will not work")
	}

	// 4. 组装 Application
	app := application.Application{
		Commands: application.Commands{
			ScoreHandler: scoreHandler,
			PalmHandler:  palmHandler,
		},
	}

	// 5. 创建 Controller 并注册到 WebServer
	ctrl := seapalmracer.NewController(app)
	seapalmracer_.NewWebHandlers(ws, ctrl)

	logrus.Info("[WebHandler] PalmRacer web handlers installed")
}
