package application

import (
	"context"

	palmdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
)

// PalmHandler 刷掌平台 API 代理应用层 Handler。
type PalmHandler struct {
	svc  palmdomain.PalmService
	repo palmdomain.PalmRegistrationRepository
}

// NewPalmHandler 创建 PalmHandler 实例。
func NewPalmHandler(svc palmdomain.PalmService, repo palmdomain.PalmRegistrationRepository) PalmHandler {
	return PalmHandler{svc: svc, repo: repo}
}

// SearchRgbPalm 搜索 RGB 手掌。
func (h PalmHandler) SearchRgbPalm(ctx context.Context, req *palmdomain.SearchRgbPalmRequest) (*palmdomain.SearchRgbPalmResponse, error) {
	return h.svc.SearchRgbPalm(ctx, req)
}

// RegisterRgbPalm 注册 RGB 手掌。
func (h PalmHandler) RegisterRgbPalm(ctx context.Context, req *palmdomain.RegisterRgbPalmRequest) (*palmdomain.RegisterRgbPalmResponse, error) {
	return h.svc.RegisterRgbPalm(ctx, req)
}

// IsUserRegistered 检查 userId 是否已在本地注册过掌纹。
// 如果 repo 为 nil（MySQL 未启用），返回 false 不阻塞流程。
func (h PalmHandler) IsUserRegistered(ctx context.Context, userID string) (bool, error) {
	if h.repo == nil {
		return false, nil
	}
	return h.repo.ExistsUserID(ctx, userID)
}

// RecordRegistration 注册成功后记录 userId 到本地数据库。
// 如果 repo 为 nil（MySQL 未启用），静默跳过。
func (h PalmHandler) RecordRegistration(ctx context.Context, userID string) error {
	if h.repo == nil {
		return nil
	}
	return h.repo.InsertRegistration(ctx, userID)
}
