package options

import (
	"context"

	opentelemetry_ "github.com/kaydxh/golang/pkg/opentelemetry"
	webserver_ "github.com/kaydxh/golang/pkg/webserver"
	"github.com/sirupsen/logrus"
)

// installOpenTelemetryOrDie initializes TracerProvider and MeterProvider
// Must be called after webserver.New() and before webserver.Run()
func (s *CompletedServerRunOptions) installOpenTelemetryOrDie(ctx context.Context, ws *webserver_.GenericWebServer) {
	// Set gin router for /metrics endpoint registration (Prometheus Pull mode)
	s.opentelemetryConfig.ApplyOptions(opentelemetry_.WithGinRouter(ws.GetGinEngine()))

	c := s.opentelemetryConfig.Complete()

	// Install OpenTelemetry (Tracer + Meter)
	err := c.New(ctx)
	if err != nil {
		logrus.WithError(err).Fatalf("install OpenTelemetry, exit")
		return
	}
}
