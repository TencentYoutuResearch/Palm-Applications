package options

import (
	"github.com/sirupsen/logrus"
)

func (s *CompletedServerRunOptions) installLogsOrDie() {
	c := s.logConfig.Complete()
	if err := c.Apply(); err != nil {
		logrus.WithError(err).Fatalf("install Logs, exit")
		return
	}
}
