package options

import (
	"context"

	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	"github.com/sirupsen/logrus"
)

func (s *CompletedServerRunOptions) installRedisOrDie(ctx context.Context) {
	c := s.redisConfig.Complete()
	if !c.Proto.GetEnabled() {
		return
	}

	db, err := c.New(ctx)
	if err != nil {
		logrus.WithError(err).Fatalf("install Redis, exit")
		return
	}

	provider.GlobalProvider().RedisDB = db
}
