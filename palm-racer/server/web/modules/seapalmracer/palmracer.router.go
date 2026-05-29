package seapalmracer

import (
	"context"
	"fmt"
	"net/http"
	"os"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/gin-gonic/gin"
	http_ "github.com/kaydxh/golang/go/net/http"
	gw_ "github.com/kaydxh/golang/pkg/grpc-gateway"
	httpinterceptorcors_ "github.com/kaydxh/golang/pkg/middleware/http-middleware/cors"
	httpinterceptordebug_ "github.com/kaydxh/golang/pkg/middleware/http-middleware/debug"
	httpinterceptorhttp_ "github.com/kaydxh/golang/pkg/middleware/http-middleware/http"
	static_ "github.com/kaydxh/golang/pkg/webserver/controller/static"
	"github.com/sirupsen/logrus"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
)

// pathPrefix 是 Ingress 层配置的路径前缀，用于 TKE 部署时 strip prefix。
// 可通过环境变量 PATH_PREFIX 覆盖，默认为 "/palm-racer"。
const defaultPathPrefix = "/palm-racer"

// getPathPrefix 返回当前配置的路径前缀。
func getPathPrefix() string {
	if v := os.Getenv("PATH_PREFIX"); v != "" {
		return v
	}
	return defaultPathPrefix
}

// SetRoutes 注册 gRPC 和 HTTP 路由，包括 CORS、静态文件服务和旧路径兼容。
func (c *Controller) SetRoutes(ginRouter gin.IRouter, grpcRouter *gw_.GRPCGateway) {
	pathPrefix := getPathPrefix()

	// 0. 注册 Gin 中间件（StripPrefix + CORS）
	c.setupGinMiddleware(ginRouter, pathPrefix)

	// 1. 注册 gRPC-gateway 中间件（StripPrefix + CORS + Debug）
	c.setupGRPCGatewayMiddleware(grpcRouter, pathPrefix)

	// 2. 注册 gRPC handler 和 HTTP handler。
	grpcRouter.RegisterGRPCHandler(func(srv *grpc.Server) {
		v1.RegisterSeaPalmRacerServiceServer(srv, c)
	})
	_ = grpcRouter.RegisterHTTPHandler(
		context.Background(),
		func(ctx context.Context, mux *runtime.ServeMux, endpoint string, opts []grpc.DialOption) error {
			return v1.RegisterSeaPalmRacerServiceHandlerServer(ctx, mux, c)
		},
	)

	// 3. 注册静态文件服务
	c.setupStaticFiles(ginRouter, grpcRouter)

	logrus.Infof("[Router] Path prefix strip enabled: %s", pathPrefix)
}

// setupGinMiddleware 注册 Gin 路由的 StripPrefix 和 CORS 中间件。
func (c *Controller) setupGinMiddleware(ginRouter gin.IRouter, pathPrefix string) {
	// StripPrefix 中间件：当请求经过 Ingress 的路径前缀到达时，strip 掉前缀使后续路由正常匹配。
	ginRouter.Use(func(ctx *gin.Context) {
		httpinterceptorhttp_.StripPrefix(pathPrefix)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx.Request = r
		})).ServeHTTP(ctx.Writer, ctx.Request)
		ctx.Next()
	})

	// CORS 中间件：使用基础库 httpinterceptorcors_.CORSAllowAll 实现。
	ginRouter.Use(func(ctx *gin.Context) {
		httpinterceptorcors_.CORSAllowAll(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		})).ServeHTTP(ctx.Writer, ctx.Request)
		if ctx.Request.Method == http.MethodOptions {
			ctx.AbortWithStatus(http.StatusNoContent)
			return
		}
		ctx.Next()
	})
}

// setupGRPCGatewayMiddleware 注册 gRPC-gateway 路由的中间件。
func (c *Controller) setupGRPCGatewayMiddleware(grpcRouter *gw_.GRPCGateway, pathPrefix string) {
	// 路径前缀重定向：/palm-racer -> /palm-racer/
	grpcRouter.ApplyOptions(gw_.WithHttpPreHandlerInterceptorOptions(
		func(w http.ResponseWriter, r *http.Request) error {
			if r.URL.Path == pathPrefix && r.Method == http.MethodGet {
				http.Redirect(w, r, pathPrefix+"/", http.StatusMovedPermanently)
				return fmt.Errorf("redirected %s to %s/", pathPrefix, pathPrefix)
			}
			return nil
		},
	))

	// StripPrefix + CORS + Debug 中间件
	grpcRouter.ApplyOptions(gw_.WithHttpHandlerInterceptorStripPrefixOptions(pathPrefix))
	grpcRouter.ApplyOptions(gw_.WithHttpHandlerInterceptorCORSAllowAllOptions())
	grpcRouter.ApplyOptions(
		gw_.WithHttpHandlerInterceptorOptions(http_.HandlerInterceptor{
			Interceptor: httpinterceptordebug_.InOutputPrinterWithTruncate,
		}),
	)
}

// setupStaticFiles 注册静态文件服务。
// SPAMode=true：根路径 "/" 返回 index.html，支持 Vue/React SPA 前端路由。
func (c *Controller) setupStaticFiles(ginRouter gin.IRouter, grpcRouter *gw_.GRPCGateway) {
	staticCtrl := static_.NewController(static_.Config{
		Root:    "../web/dist",
		SPAMode: true,
		EnvKey:  "STATIC_ROOT",
		AssetDirs: map[string]string{
			"assets":    "assets",
			"mediapipe": "mediapipe",
			"models":    "models",
		},
		StaticFiles: map[string]string{
			"/favicon.svg": "favicon.svg",
		},
	})
	staticCtrl.SetRoutes(ginRouter, grpcRouter)
	logrus.Infof("[Router] Static files served from: %s", staticCtrl.GetRoot())
}


