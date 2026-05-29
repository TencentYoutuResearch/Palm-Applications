// Package provider 提供全局依赖注入容器，管理数据库、缓存等基础设施连接。
package provider

import (
	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/go-redis/redis/v8"
	"github.com/jmoiron/sqlx"
	resolver_ "github.com/kaydxh/golang/pkg/resolver"
)

// Provider 全局依赖注入容器
type Provider struct {
	Config *v1.Configuration

	SqlDB           *sqlx.DB
	RedisDB         *redis.Client
	ResolverService *resolver_.ResolverService
}

var provider = &Provider{}

// GlobalProvider 返回全局 Provider 实例
func GlobalProvider() *Provider {
	return provider
}

// GetSqlDB 获取 MySQL 数据库连接
func GetSqlDB() *sqlx.DB {
	return provider.SqlDB
}

// GetRedisDB 获取 Redis 连接
func GetRedisDB() *redis.Client {
	return provider.RedisDB
}

// GetResolverService 获取服务发现
func GetResolverService() *resolver_.ResolverService {
	return provider.ResolverService
}

// GetConfig 获取 protobuf Configuration 配置
func GetConfig() *v1.Configuration {
	return provider.Config
}

// GetPalmConfig 获取刷掌平台 API 配置
func GetPalmConfig() *v1.Configuration_Palm {
	if provider.Config != nil {
		return provider.Config.GetPalm()
	}
	return nil
}
