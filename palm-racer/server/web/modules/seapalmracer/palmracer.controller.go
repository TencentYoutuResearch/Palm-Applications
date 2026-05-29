// Package seapalmracer PalmRacer gRPC Controller 骨架。
//
//   - palmracer.controller.go : 定义 Controller 结构体与构造函数（本文件）
//   - submit_score.go         : SubmitScore 方法
//   - get_leaderboard.go      : GetLeaderboard 方法
//   - get_user_history.go     : GetUserHistory 方法
//   - create_token.go         : CreateToken 方法
//   - search_rgb_palm.go      : SearchRgbPalm 方法
//   - register_rgb_palm.go    : RegisterRgbPalm 方法
//   - get_app_version.go      : GetAppVersion 方法
//   - palmracer.error.go      : domain/application error → (code, msg) 映射
//   - palmracer.router.go     : HTTP 路由、CORS、静态资源等
//   - palmracer.cors.go       : CORS 中间件
//
// 一个 RPC 方法一个文件，便于阅读与后续新增方法（例如注册协议扩展）。
package seapalmracer

import (
	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/application"
)

// Controller PalmRacer 控制器，实现 gRPC SeaPalmRacerService 接口。
//
// HTTP / gRPC 双入口通过 grpc-gateway 的 RegisterXxxHandlerServer 模式
// 共用同一个 Controller 实例（参见 palmracer.router.go 的 SetRoutes）。
type Controller struct {
	app application.Application

	// 嵌入未实现的 gRPC server，保证前向兼容 —— 未来 proto 中新增 RPC 方法
	// 但 Go 侧尚未实现时不会编译报错。
	v1.UnimplementedSeaPalmRacerServiceServer
}

// NewController 创建 PalmRacer Controller 实例。
func NewController(app application.Application) *Controller {
	return &Controller{app: app}
}
