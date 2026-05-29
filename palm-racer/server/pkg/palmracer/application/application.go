// Package application 提供业务应用层的 Command Handler 聚合。
package application

// Application 应用层顶层结构，聚合所有 Command Handler。
type Application struct {
	Commands Commands
}

// Commands 聚合所有业务 Handler。
type Commands struct {
	ScoreHandler ScoreHandler
	PalmHandler  PalmHandler
}
