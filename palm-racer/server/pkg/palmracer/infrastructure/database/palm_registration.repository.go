package database

import (
	"context"

	"github.com/jmoiron/sqlx"
	mysqldao "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/dao/mysql.dao"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
)

// PalmRegistrationRepository 基于 MySQL 的掌纹注册记录数据访问实现。
type PalmRegistrationRepository struct {
	dao *mysqldao.PalmRegistrationDao
}

// NewPalmRegistrationRepository 创建 MySQL 掌纹注册记录仓储实例。
// 初始化时自动创建表（如果不存在）。
func NewPalmRegistrationRepository(ctx context.Context, db *sqlx.DB) (palm.PalmRegistrationRepository, error) {
	d := mysqldao.NewPalmRegistrationDao(db)
	if err := d.AutoMigrate(ctx); err != nil {
		return nil, err
	}
	return &PalmRegistrationRepository{dao: d}, nil
}

// ExistsUserID 检查指定 userId 是否已注册过掌纹。
func (r *PalmRegistrationRepository) ExistsUserID(ctx context.Context, userID string) (bool, error) {
	return r.dao.ExistsUserID(ctx, userID)
}

// InsertRegistration 记录一次成功的掌纹注册。
func (r *PalmRegistrationRepository) InsertRegistration(ctx context.Context, userID string) error {
	return r.dao.InsertRegistration(ctx, userID)
}
