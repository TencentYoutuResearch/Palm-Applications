package options

import (
	"fmt"
	"os"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	"github.com/sirupsen/logrus"
)

func (s *CompletedServerRunOptions) installConfigOrDie() {

	config, err := s.Config.Complete().New()
	if err != nil {
		logrus.WithError(err).Fatalf("failed to install Config, exit")
		return
	}

	// 敏感字段优先从环境变量覆盖 yaml 值,保证敏感信息不落盘
	overlayPalmConfigFromEnv(config)

	provider.GlobalProvider().Config = config
	logrus.Infof("config loaded: %s", maskedConfigSummary(config))
}

// overlayPalmConfigFromEnv 使用环境变量覆盖 Palm 配置中的敏感字段。
// 支持的环境变量:
//   - PALM_HOST
//   - PALM_API_TOKEN (mapped to secret_key field)
func overlayPalmConfigFromEnv(config *v1.Configuration) {
	if config == nil {
		return
	}
	palm := config.GetPalm()
	if palm == nil {
		return
	}

	if v := os.Getenv("PALM_HOST"); v != "" {
		palm.Host = v
	}
	if v := os.Getenv("PALM_API_TOKEN"); v != "" {
		palm.SecretKey = v
	}
}

// maskedConfigSummary 返回日志友好的脱敏配置摘要。
func maskedConfigSummary(config *v1.Configuration) string {
	if config == nil {
		return "<nil>"
	}
	palm := config.GetPalm()
	if palm == nil {
		return "palm=<nil>"
	}
	return fmt.Sprintf(
		"palm{host=%s, api_token=%s}",
		palm.GetHost(),
		maskToken(palm.GetSecretKey()),
	)
}

// maskToken 仅保留头 4 位和尾 4 位字符。
func maskToken(v string) string {
	if len(v) <= 8 {
		return "***"
	}
	return v[:4] + "***" + v[len(v)-4:]
}
