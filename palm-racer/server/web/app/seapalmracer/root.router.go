package seapalmracer

import (
	"context"

	"github.com/kaydxh/golang/pkg/webserver"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/web/modules/seapalmracer"
)

// NewWebHandlers 注册 PalmRacer Controller 到 WebServer。
func NewWebHandlers(ws *webserver.GenericWebServer, c *seapalmracer.Controller) []webserver.WebHandler {
	ws.AddPostStartHookOrDie("web_handler", func(ctx context.Context) error {
		ws.InstallWebHandlers(c)
		return nil
	})
	return []webserver.WebHandler{c}
}
