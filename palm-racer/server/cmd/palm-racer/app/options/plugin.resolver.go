package options

import (
	"context"

	webserver_ "github.com/kaydxh/golang/pkg/webserver"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	"github.com/sirupsen/logrus"
)

func (s *CompletedServerRunOptions) installResolverOrDie(ctx context.Context, ws *webserver_.GenericWebServer) {
	c := s.resolverConfig.Complete()
	if !c.Proto.GetEnabled() {
		return
	}

	resolverService, err := c.New(ctx)
	if err != nil {
		logrus.WithError(err).Fatalf("install Resolver, exit")
		return
	}

	provider.GlobalProvider().ResolverService = resolverService
}
