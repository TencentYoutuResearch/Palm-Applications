package app

import (
	"context"
	"os"

	app_ "github.com/kaydxh/golang/pkg/webserver/app"
	logs_ "github.com/kaydxh/golang/pkg/logs"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/cmd/palm-racer/app/options"
	"github.com/spf13/cobra"
)

// NewCommand creates a *cobra.Command object with default parameters
func NewCommand(ctx context.Context) *cobra.Command {
	return app_.NewCommand(ctx, runCommand)
}

func runCommand(ctx context.Context, cmd *cobra.Command) error {
	cfgFile, err := cmd.Flags().GetString("config")
	if err != nil {
		return err
	}
	s := options.NewServerRunOptions(cfgFile)

	// set default options
	completedOptions, err := s.Complete()
	if err != nil {
		return err
	}

	if err := completedOptions.Run(ctx); err != nil {
		logs_.GetLogger(ctx).Errorf("failed to run server: %v", err)
		os.Exit(1)
	}

	return nil
}
