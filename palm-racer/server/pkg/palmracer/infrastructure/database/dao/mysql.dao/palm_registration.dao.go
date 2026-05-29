package mysqldao

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/dao"
	"github.com/jmoiron/sqlx"
	context_ "github.com/kaydxh/golang/go/context"
)

const palmRegistrationTableName = "t_palm_registrations"

// PalmRegistrationDao 掌纹注册记录数据访问对象。
type PalmRegistrationDao struct {
	db *sqlx.DB
}

// NewPalmRegistrationDao 创建掌纹注册记录 DAO 实例。
func NewPalmRegistrationDao(db *sqlx.DB) *PalmRegistrationDao {
	return &PalmRegistrationDao{db: db}
}

// AutoMigrate 自动创建表（如果不存在）。
func (d *PalmRegistrationDao) AutoMigrate(ctx context.Context) error {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	query := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		user_id VARCHAR(64) NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (id),
		UNIQUE KEY uk_user_id (user_id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, palmRegistrationTableName)

	_, err := d.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("palm_registration_dao: auto_migrate: %w", err)
	}
	return nil
}

// ExistsUserID 检查指定 userId 是否已注册过掌纹。
func (d *PalmRegistrationDao) ExistsUserID(ctx context.Context, userID string) (bool, error) {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	query := fmt.Sprintf(`SELECT 1 FROM %s WHERE user_id = ? LIMIT 1`, palmRegistrationTableName)

	var exists int
	err := d.db.QueryRowContext(ctx, query, userID).Scan(&exists)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("palm_registration_dao: exists_user_id: %w", err)
	}
	return true, nil
}

// InsertRegistration 记录一次成功的掌纹注册（忽略重复插入）。
func (d *PalmRegistrationDao) InsertRegistration(ctx context.Context, userID string) error {
	ctx, cancel := context_.WithTimeout(ctx, dao.DatabaseExecuteTimeout)
	defer cancel()

	query := fmt.Sprintf(`INSERT IGNORE INTO %s (user_id) VALUES (?)`, palmRegistrationTableName)

	_, err := d.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("palm_registration_dao: insert_registration: %w", err)
	}
	return nil
}
