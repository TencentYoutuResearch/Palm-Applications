// Package score 游戏分数领域 sentinel error 定义。
package score

import "errors"

// 游戏分数领域的业务错误。
// 统一使用 sentinel error，上层通过 errors.Is 进行识别，
// 然后由 web 层 (palmracer_error.go) 映射为前端可识别的 code/msg。
var (
	// ErrMySQLNotEnabled MySQL 未启用，分数相关功能不可用。
	ErrMySQLNotEnabled = errors.New("score: MySQL not enabled, score feature unavailable")

	// ErrUserIDEmpty user_id 必填。
	ErrUserIDEmpty = errors.New("score: user_id is required")

	// ErrScoreOutOfRange 分数越界。
	ErrScoreOutOfRange = errors.New("score: score out of range")

	// ErrMaxSpeedOutOfRange 最大速度越界。
	ErrMaxSpeedOutOfRange = errors.New("score: max_speed out of range")

	// ErrSurviveTimeOutOfRange 存活时间越界。
	ErrSurviveTimeOutOfRange = errors.New("score: survive_time out of range")

	// ErrPeriodInvalid period 参数非法。
	ErrPeriodInvalid = errors.New("score: period must be one of today/week/all")
)
