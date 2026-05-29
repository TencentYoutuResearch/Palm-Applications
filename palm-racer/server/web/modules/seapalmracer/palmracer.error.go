// Package seapalmracer web 层错误码到前端响应的映射。
package seapalmracer

import (
	"errors"

	palmdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
	scoredomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/score"
)

// 业务错误码
const (
	CodeOK      int32 = 0
	CodeUnknown int32 = 999

	// InvalidParameter (1000-1999)
	CodeInvalidParameter_UserIDEmpty          int32 = 1001
	CodeInvalidParameter_ScoreOutOfRange      int32 = 1002
	CodeInvalidParameter_MaxSpeedOutOfRange   int32 = 1003
	CodeInvalidParameter_SurviveTimeOutOfRange int32 = 1004
	CodeInvalidParameter_PeriodInvalid        int32 = 1005
	CodeInvalidParameter_RgbImageEmpty        int32 = 1007
	CodeInvalidParameter_RgbImageDataEmpty    int32 = 1008
	CodeInvalidParameter_RgbImageTypeInvalid  int32 = 1009
	CodeInvalidParameter_UserIDInvalid        int32 = 1010

	// InternalError (3000-3999)
	CodeInternalError_MySQLNotEnabled int32 = 3001
	CodeInternalError_DatabaseFailed  int32 = 3002

	// PalmProxyError (4000-4999)
	CodePalmProxyError_Unreachable int32 = 4001

	// RegisterPreCheck (5000-5999)
	CodeRegisterPreCheck_UserAlreadyBound int32 = 5001
	CodeRegisterPreCheck_PalmAlreadyBound int32 = 5002
)

// PaaS 上游错误码（用于 server 层归并映射）
const (
	CodePaaS_UserAlreadyBound int = 1001008 // userId 已绑定满（一号一掌）
	CodePaaS_PalmAlreadyExist int = 1001027 // 掌纹已存在（Palm already exist）
)

// toResponseCode 将 domain/application 层抛出的 error 映射为 (code, msg)。
func toResponseCode(err error, defaultCode int32) (int32, string) {
	if err == nil {
		return CodeOK, "ok"
	}
	msg := err.Error()

	// score domain errors
	switch {
	case errors.Is(err, scoredomain.ErrUserIDEmpty):
		return CodeInvalidParameter_UserIDEmpty, msg
	case errors.Is(err, scoredomain.ErrScoreOutOfRange):
		return CodeInvalidParameter_ScoreOutOfRange, msg
	case errors.Is(err, scoredomain.ErrMaxSpeedOutOfRange):
		return CodeInvalidParameter_MaxSpeedOutOfRange, msg
	case errors.Is(err, scoredomain.ErrSurviveTimeOutOfRange):
		return CodeInvalidParameter_SurviveTimeOutOfRange, msg
	case errors.Is(err, scoredomain.ErrPeriodInvalid):
		return CodeInvalidParameter_PeriodInvalid, msg
	case errors.Is(err, scoredomain.ErrMySQLNotEnabled):
		return CodeInternalError_MySQLNotEnabled, msg
	}

	// palm domain errors
	switch {
	case errors.Is(err, palmdomain.ErrUserIDEmpty):
		return CodeInvalidParameter_UserIDEmpty, msg
	case errors.Is(err, palmdomain.ErrUserIDInvalid):
		return CodeInvalidParameter_UserIDInvalid, msg
	case errors.Is(err, palmdomain.ErrRgbImageEmpty):
		return CodeInvalidParameter_RgbImageEmpty, msg
	case errors.Is(err, palmdomain.ErrRgbImageDataEmpty):
		return CodeInvalidParameter_RgbImageDataEmpty, msg
	case errors.Is(err, palmdomain.ErrRgbImageTypeInvalid):
		return CodeInvalidParameter_RgbImageTypeInvalid, msg
	case errors.Is(err, palmdomain.ErrPalmProxyUnreachable):
		return CodePalmProxyError_Unreachable, msg
	}

	return defaultCode, msg
}
