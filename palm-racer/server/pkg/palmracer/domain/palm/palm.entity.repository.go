package palm

import "context"

// PalmRegistrationRepository 掌纹注册记录数据访问接口（领域层定义）。
// 用于在 palm-racer 本地维护 userId 的注册状态，实现"一号一掌"约束。
type PalmRegistrationRepository interface {
	// ExistsUserID 检查指定 userId 是否已注册过掌纹。
	ExistsUserID(ctx context.Context, userID string) (bool, error)

	// InsertRegistration 记录一次成功的掌纹注册。
	InsertRegistration(ctx context.Context, userID string) error
}
