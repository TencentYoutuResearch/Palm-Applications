// Package seapalmracer Authorization 头解析等 web 工具函数。
package seapalmracer

import (
	"context"
	"strings"

	"google.golang.org/grpc/metadata"
)

// authBearerPrefix Authorization 头的 Bearer schema 前缀（不区分大小写）。
const authBearerPrefix = "bearer "

// extractBearerToken 从 grpc-gateway 注入的 metadata 中提取 Bearer token。
//
// grpc-gateway 默认会把 HTTP header `Authorization` 透传为 metadata 键
// `authorization`（或 `grpcgateway-authorization`，两者都尝试）。
// 未携带或非 Bearer schema 时返回空字符串，由 controller 统一返回未授权错误码。
func extractBearerToken(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	for _, key := range []string{"authorization", "grpcgateway-authorization"} {
		for _, v := range md.Get(key) {
			if t := parseBearer(v); t != "" {
				return t
			}
		}
	}
	return ""
}

// parseBearer 解析 "Bearer xxx" 形式的 Authorization 头值。
func parseBearer(v string) string {
	if len(v) <= len(authBearerPrefix) {
		return ""
	}
	if !strings.EqualFold(v[:len(authBearerPrefix)], authBearerPrefix) {
		return ""
	}
	return strings.TrimSpace(v[len(authBearerPrefix):])
}
