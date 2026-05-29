// Package options 提供 palm-racer 服务的启动配置和插件安装选项。
package options

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	config_ "github.com/kaydxh/golang/pkg/config"
	mysql_ "github.com/kaydxh/golang/pkg/database/mysql"
	redis_ "github.com/kaydxh/golang/pkg/database/redis"
	filecleanup_ "github.com/kaydxh/golang/pkg/file-cleanup"
	logs_ "github.com/kaydxh/golang/pkg/logs"
	opentelemetry_ "github.com/kaydxh/golang/pkg/opentelemetry"
	resolver_ "github.com/kaydxh/golang/pkg/resolver"
	viper_ "github.com/kaydxh/golang/pkg/viper"
	webserver_ "github.com/kaydxh/golang/pkg/webserver"
	app_ "github.com/kaydxh/golang/pkg/webserver/app"
	healthz_ "github.com/kaydxh/golang/pkg/webserver/controller/healthz"
	"github.com/spf13/viper"

	"github.com/sirupsen/logrus"
)

// ServerRunOptions 服务启动运行时配置选项。
type ServerRunOptions struct {
	Config              *config_.Config[*v1.Configuration]
	webServerConfig     *webserver_.Config
	logConfig           *logs_.Config
	mysqlConfig         *mysql_.Config
	redisConfig         *redis_.Config
	resolverConfig      *resolver_.Config
	opentelemetryConfig *opentelemetry_.Config
	diskCleanerConfig   *filecleanup_.Config
}

// completedServerRunOptions is a private wrapper that enforces a call of Complete() before Run can be invoked.
type completedServerRunOptions struct {
	*ServerRunOptions
}

// CompletedServerRunOptions is a private wrapper that enforces a call of Complete() before Run can be invoked.
type CompletedServerRunOptions struct {
	*completedServerRunOptions
}

// NewServerRunOptions 创建服务启动运行时配置选项。
func NewServerRunOptions(configFile string) *ServerRunOptions {
	var gatewayOpts []webserver_.ConfigOption
	gatewayOpts = append(gatewayOpts, webserver_.WithViper(viper_.GetViper(configFile, "web")))

	// 禁用 healthz 控制器的根路径注册，因为本项目使用 SPA 前端，
	// 根路径 "/" 由 static 控制器处理（返回 index.html）。
	// 负载均衡器应使用 /healthz 或 /livez 进行健康探测。
	gatewayOpts = append(gatewayOpts, webserver_.WithHealthzOptions(healthz_.WithDisableRootRoute()))

	// 加载QPS限流配置
	qpsLimitViper := viper_.GetViper(configFile, "web.qps_limit")
	if qpsLimitViper != nil {
		grpcQPSLimit := loadQPSLimitConfig(qpsLimitViper, "grpc")
		httpQPSLimit := loadQPSLimitConfig(qpsLimitViper, "http")
		if grpcQPSLimit != nil {
			gatewayOpts = append(gatewayOpts, webserver_.WithGRPCQPSLimit(grpcQPSLimit))
		}
		if httpQPSLimit != nil {
			gatewayOpts = append(gatewayOpts, webserver_.WithHTTPQPSLimit(httpQPSLimit))
		}
	}

	var config v1.Configuration

	return &ServerRunOptions{
		Config:          config_.NewConfig(&config, config_.WithViper[*v1.Configuration](viper_.GetViper(configFile, ""))),
		webServerConfig: webserver_.NewConfig(gatewayOpts...),
		logConfig:       logs_.NewConfig(logs_.WithViper(viper_.GetViper(configFile, "log"))),
		mysqlConfig: mysql_.NewConfig(
			mysql_.WithViper(viper_.GetViper(configFile, "database.mysql")),
		),
		redisConfig:    redis_.NewConfig(redis_.WithViper(viper_.GetViper(configFile, "database.redis"))),
		resolverConfig: resolver_.NewConfig(resolver_.WithViper(viper_.GetViper(configFile, "reslover"))),
		opentelemetryConfig: opentelemetry_.NewConfig(
			opentelemetry_.WithViper(viper_.GetViper(configFile, "web.open_telemetry")),
		),
		diskCleanerConfig: filecleanup_.NewConfig(filecleanup_.WithViper(viper_.GetViper(configFile, "diskcleaner"))),
	}
}

// loadQPSLimitConfig 从viper加载QPS限流配置
func loadQPSLimitConfig(v *viper.Viper, key string) *webserver_.QPSLimitConfig {
	if v == nil {
		return nil
	}

	subViper := v.Sub(key)
	if subViper == nil {
		return nil
	}

	defaultQPS := subViper.GetFloat64("default_qps")
	defaultBurst := subViper.GetInt("default_burst")
	maxConcurrency := subViper.GetInt("max_concurrency")

	if defaultQPS <= 0 && maxConcurrency <= 0 {
		return nil
	}

	config := &webserver_.QPSLimitConfig{
		DefaultQPS:     defaultQPS,
		DefaultBurst:   defaultBurst,
		MaxConcurrency: maxConcurrency,
	}

	methodQPS := subViper.Get("method_qps")
	if methodQPS != nil {
		if methods, ok := methodQPS.([]interface{}); ok {
			for _, m := range methods {
				if methodMap, ok := m.(map[string]interface{}); ok {
					item := webserver_.MethodQPSConfigItem{}
					if method, ok := methodMap["method"].(string); ok {
						item.Method = method
					}
					if qps, ok := methodMap["qps"].(float64); ok {
						item.QPS = qps
					}
					if burst, ok := methodMap["burst"].(int); ok {
						item.Burst = burst
					} else if burst, ok := methodMap["burst"].(float64); ok {
						item.Burst = int(burst)
					}
					if mc, ok := methodMap["max_concurrency"].(int); ok {
						item.MaxConcurrency = mc
					} else if mc, ok := methodMap["max_concurrency"].(float64); ok {
						item.MaxConcurrency = int(mc)
					}
					if item.Method != "" && (item.QPS > 0 || item.MaxConcurrency > 0) {
						config.MethodQPS = append(config.MethodQPS, item)
					}
				}
			}
		}
	}

	return config
}

// Complete set default ServerRunOptions.
func (s *ServerRunOptions) Complete() (CompletedServerRunOptions, error) {
	return CompletedServerRunOptions{&completedServerRunOptions{s}}, nil
}

// Run runs the specified APIServer. This should never exit.
func (s *CompletedServerRunOptions) Run(ctx context.Context) error {
	logrus.Infof("Starting %+v", app_.GetVersion())

	s.installLogsOrDie()
	s.installConfigOrDie()

	ws, err := s.webServerConfig.Complete().New(ctx)
	if err != nil {
		return err
	}

	// 按需安装插件（依赖 yaml 配置中的 enabled 字段）
	s.installMysqlOrDie(ctx)
	s.installRedisOrDie(ctx)
	s.installOpenTelemetryOrDie(ctx, ws)
	s.installResolverOrDie(ctx, ws)
	s.installDiskCleanerOrDie(ctx)

	// 安装 web handler
	s.installWebHandlerOrDie(ws)

	prepared, err := ws.PrepareRun()
	if err != nil {
		return err
	}

	return prepared.Run(ctx)
}
