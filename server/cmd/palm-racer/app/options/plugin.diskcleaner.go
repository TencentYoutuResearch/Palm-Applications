package options

import (
	"context"

	"github.com/sirupsen/logrus"
)

// installDiskCleanerOrDie 安装磁盘清理服务（DiskCleanerSerivce）。
// 配置来自 yaml 中的 diskcleaner 节点，enabled=false 时跳过安装。
func (s *CompletedServerRunOptions) installDiskCleanerOrDie(ctx context.Context) {
	c := s.diskCleanerConfig.Complete()

	svc, err := c.New(ctx)
	if err != nil {
		logrus.WithError(err).Fatalf("install DiskCleaner, exit")
		return
	}
	if svc == nil {
		return // enabled=false 时返回 nil
	}

	if err := svc.Run(ctx); err != nil {
		logrus.WithError(err).Fatalf("run DiskCleaner, exit")
		return
	}

	logrus.Infof("DiskCleaner installed successfully")
}
