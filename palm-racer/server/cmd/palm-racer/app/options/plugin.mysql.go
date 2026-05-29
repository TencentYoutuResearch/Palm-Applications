package options

import (
	"context"
	"fmt"
	"os"

	mysql_ "github.com/kaydxh/golang/pkg/database/mysql"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	"github.com/sirupsen/logrus"
)

func (s *CompletedServerRunOptions) installMysqlOrDie(ctx context.Context) {
	c := s.mysqlConfig.Complete()
	if !c.Proto.GetEnabled() {
		return
	}

	// 敏感连接信息优先从环境变量覆盖 yaml 值
	overlayMysqlConfigFromEnv(&c.Proto)

	db, err := c.New(ctx)
	if err != nil {
		logrus.WithError(err).Fatalf("install Mysql, exit")
		return
	}

	provider.GlobalProvider().SqlDB = db
}

// overlayMysqlConfigFromEnv 使用环境变量覆盖 MySQL 连接配置。
// 优先级: 环境变量 > yaml 文件。
//
// 支持的环境变量:
//   - DB_ADDRESS   (完整 host:port,设置后优先于 DB_HOST/DB_PORT)
//   - DB_HOST      (与 DB_PORT 组合成 address)
//   - DB_PORT
//   - DB_USERNAME
//   - DB_PASSWORD
//   - DB_NAME
func overlayMysqlConfigFromEnv(proto *mysql_.Mysql) {
	if proto == nil {
		return
	}

	if addr := os.Getenv("DB_ADDRESS"); addr != "" {
		proto.Address = addr
	} else {
		host := os.Getenv("DB_HOST")
		port := os.Getenv("DB_PORT")
		if host != "" && port != "" {
			proto.Address = fmt.Sprintf("%s:%s", host, port)
		}
	}

	if v := os.Getenv("DB_USERNAME"); v != "" {
		proto.Username = v
	}
	if v := os.Getenv("DB_PASSWORD"); v != "" {
		proto.Password = v
	}
	if v := os.Getenv("DB_NAME"); v != "" {
		proto.DbName = v
	}
}
