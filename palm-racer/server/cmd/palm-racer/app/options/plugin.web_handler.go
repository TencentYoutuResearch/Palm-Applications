package options

import (
	"context"
	"os"
	"strconv"
	"time"

	webserver_ "github.com/kaydxh/golang/pkg/webserver"
	"github.com/go-redis/redis/v8"
	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/application"
	appdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain"
	authdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/auth"
	palmdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
	sessiondomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/session"
	dbinfra "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database"
	palminfra "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/palm"
	sessioninfra "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/session"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	seapalmracer_ "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/web/app/seapalmracer"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/web/modules/seapalmracer"
	"github.com/sirupsen/logrus"
)

// installWebHandlerOrDie 安装 Web Handler（Controller 层），初始化完整的依赖链：
// ScoreDAO → ScoreRepository → ScoreHandler
// PalmConfig → PalmService → PalmHandler
// PalmRegistrationRepository → PalmHandler
// AuthConfig → TokenService + SessionStore → GameAuthHandler
// → Application → Controller → NewWebHandlers
func (s *CompletedServerRunOptions) installWebHandlerOrDie(ws *webserver_.GenericWebServer) {
	rdb := provider.GetRedisDB()
	fullConfig := provider.GetConfig()

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

	// 4. 初始化 GameAuth（身份 token + 单局 session：Redis 优先，fallback 内存）
	gameAuthHandler := buildGameAuthHandler(fullConfig, rdb)

	// 5. 组装 Application
	app := application.Application{
		Commands: application.Commands{
			ScoreHandler:    scoreHandler,
			PalmHandler:     palmHandler,
			GameAuthHandler: gameAuthHandler,
		},
	}

	// 6. 创建 Controller 并注册到 WebServer
	ctrl := seapalmracer.NewController(app)
	seapalmracer_.NewWebHandlers(ws, ctrl)

	logrus.Info("[WebHandler] PalmRacer web handlers installed")
}

// buildGameAuthHandler 根据配置构建游戏鉴权编排：
//   - jwt_secret 必填，否则 GameAuthHandler 留空（所有提交被拒）；
//   - rdb 非空：使用 Redis session store（生产推荐，多节点共享）；
//   - rdb 为空：使用内存 session store（单实例开发/演示），但若部署期检测到
//     多副本（INSTANCE_COUNT>1）则 fatal 拒绝启动，避免数据按节点错乱。
//
// 与 mysql.enabled=false（计分功能不可用但服务能跑）保持一致的语义：
// redis.enabled=false 时计分链路退化为单实例可用，多副本必须配 Redis。
func buildGameAuthHandler(cfg *v1.Configuration, rdb *redis.Client) application.GameAuthHandler {
	secret := os.Getenv("JWT_SECRET")
	tokenTTL := time.Duration(appdomain.DefaultTokenTTLSeconds) * time.Second
	sessionTTL := time.Duration(appdomain.DefaultSessionTTLSeconds) * time.Second

	if cfg != nil {
		if auth := cfg.GetAuth(); auth != nil {
			if secret == "" {
				secret = auth.GetJwtSecret()
			}
			tokenTTL = resolveTokenTTL(auth.GetTokenTtlSeconds(), tokenTTL)
			if v := auth.GetSessionTtlSeconds(); v > 0 {
				sessionTTL = time.Duration(v) * time.Second
			}
		}
	}

	if secret == "" {
		logrus.Warn("[WebHandler] jwt_secret is empty, GameAuthHandler will reject all submissions")
		return application.GameAuthHandler{}
	}

	tokenSvc := authdomain.NewTokenService(secret, tokenTTL)

	// 单局 session 绝对寿命 = 单局最大有效时长 + 缓冲，防止滑动续期被滥用。
	maxLifetime := time.Duration(appdomain.MaxSurviveSeconds)*time.Second + 10*time.Minute

	store := chooseSessionStore(rdb, sessionTTL, maxLifetime)
	return application.NewGameAuthHandler(tokenSvc, store)
}

// chooseSessionStore 在 Redis 可用时返回 Redis 实现，否则降级到内存实现。
//
// 多副本部署 + 内存实现 = 数据按节点错乱（同一玩家的请求被路由到不同 Pod
// 时 sid 找不到），因此通过环境变量 INSTANCE_COUNT 做启动期硬校验：
// 多副本却没配 Redis 时 fatal，避免静默降级造成数据问题。
//
// INSTANCE_COUNT 由部署侧注入（K8s downward API / docker-compose / 启动脚本），
// 未设置时默认按单实例处理。
func chooseSessionStore(rdb *redis.Client, sessionTTL, maxLifetime time.Duration) sessiondomain.Store {
	if rdb != nil {
		logrus.Infof("[WebHandler] Session store: redis (sessionTTL=%v, maxLifetime=%v)",
			sessionTTL, maxLifetime)
		return sessioninfra.NewRedisStore(rdb, sessionTTL, maxLifetime)
	}

	if isMultiInstanceDeployment() {
		logrus.Fatal("[WebHandler] redis is disabled but INSTANCE_COUNT>1; " +
			"memory session store cannot work across replicas. " +
			"Either enable redis or run as single instance.")
	}

	logrus.Warnf("[WebHandler] Session store: memory (single-instance only; "+
		"sessionTTL=%v, maxLifetime=%v). Enable redis for multi-replica deployment.",
		sessionTTL, maxLifetime)
	return sessioninfra.NewMemoryStore(sessionTTL, maxLifetime)
}

// isMultiInstanceDeployment 通过 INSTANCE_COUNT 环境变量识别多副本部署。
// 解析失败或未设置都视作单实例（保守，避免误 fatal 干扰本地开发）。
func isMultiInstanceDeployment() bool {
	v := os.Getenv("INSTANCE_COUNT")
	if v == "" {
		return false
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		logrus.Warnf("[WebHandler] invalid INSTANCE_COUNT=%q, treated as single-instance", v)
		return false
	}
	return n > 1
}

// resolveTokenTTL 把配置里的 token_ttl_seconds 翻译为 TokenService 能用的 ttl。
//
// 语义：
//   - cfgValue > 0  ：显式有限有效期，直接采用
//   - cfgValue == 0 ：未配置（proto 标量默认 0），使用 fallback（默认 7 天）
//   - cfgValue < 0  ：显式声明永不过期；TokenService 用 ttl=0 表达此语义
//                     （见 auth.token.go：ttl<=0 时不写 exp claim）
//
// 用 -1 而不是 0 表达「永不过期」是为了把「未配置」和「显式声明无限」区分开，
// 避免空配置静默关闭过期校验造成安全事故。
func resolveTokenTTL(cfgValue int32, fallback time.Duration) time.Duration {
	switch {
	case cfgValue > 0:
		return time.Duration(cfgValue) * time.Second
	case cfgValue < 0:
		return 0 // domain 层 ttl=0 即不签发 exp claim
	default: // cfgValue == 0：未配置
		return fallback
	}
}
