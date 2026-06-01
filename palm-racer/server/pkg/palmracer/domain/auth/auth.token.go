// Package auth 提供登录态身份 token 的签发与校验。
//
// token 用于标识「你是谁」：刷掌 1:N 登录成功后签发，承载权威 uid。
// 底层签名/验签复用基础库 github.com/kaydxh/golang/go/encoding/jwt（HMAC-SHA256），
// 本包仅封装业务语义（claims 约定、过期策略、错误归一）。
package auth

import (
	"errors"
	"fmt"
	"time"

	jwt_ "github.com/kaydxh/golang/go/encoding/jwt"
)

// ErrUnauthorized 表示身份 token 缺失或校验不通过，web 层据此返回未授权错误码。
var ErrUnauthorized = errors.New("auth: unauthorized")

// ErrTokenExpired 表示 token 签名合法但已过期。
//
// 与 ErrUnauthorized 区分开是为了让上层做差异化处理：
//   - StartGame 等"开局前置鉴权"：过期与非法都拒绝（行为一致）
//   - SubmitScore 等"过程中鉴权"：过期可降级到 session.UID 继续，
//     非法（签名错/被篡改）则严格拒绝
//
// 通过 errors.Is(err, ErrTokenExpired) 判断；该错误同时也满足
// errors.Is(err, ErrUnauthorized)，便于不需要细分的调用方仍然兼容。
var ErrTokenExpired = errors.New("auth: token expired")

// claim 字段名约定。
const (
	claimUID = "uid"
	claimIAT = "iat"
	claimEXP = "exp"
)

// TokenService 登录态身份 token 服务。
type TokenService struct {
	secret string
	ttl    time.Duration // 0 表示不设过期
}

// NewTokenService 创建身份 token 服务。secret 不能为空；ttl 为 0 时签发的 token 不过期。
func NewTokenService(secret string, ttl time.Duration) *TokenService {
	return &TokenService{secret: secret, ttl: ttl}
}

// Issue 为 uid 签发身份 token。
func (s *TokenService) Issue(uid string) (string, error) {
	now := time.Now()
	claims := map[string]interface{}{
		claimUID: uid,
		claimIAT: float64(now.Unix()),
	}
	if s.ttl > 0 {
		claims[claimEXP] = float64(now.Add(s.ttl).Unix())
	}

	token, err := jwt_.SignHS256(claims, s.secret)
	if err != nil {
		return "", fmt.Errorf("auth: issue token: %w", err)
	}
	return token, nil
}

// Verify 校验身份 token 并返回其中的权威 uid。
//
// 错误归一：
//   - 仅"过期"返回 ErrTokenExpired（同时满足 errors.Is(err, ErrUnauthorized)）
//   - 其他失败（签名错误、格式非法、uid 缺失）返回 ErrUnauthorized
//
// 这样调用方可以选择是否对"过期"做差异化降级处理。
func (s *TokenService) Verify(token string) (string, error) {
	claims, err := jwt_.VerifyHS256(token, s.secret)
	if err != nil {
		if errors.Is(err, jwt_.ErrTokenExpired) {
			return "", fmt.Errorf("%w: %w", ErrTokenExpired, ErrUnauthorized)
		}
		return "", fmt.Errorf("%w: %v", ErrUnauthorized, err)
	}
	uid := jwt_.GetClaimString(claims, claimUID)
	if uid == "" {
		return "", fmt.Errorf("%w: empty uid", ErrUnauthorized)
	}
	return uid, nil
}

// RemainingTTL 返回 token 距离过期还剩多少时间；
// 校验失败返回 (0, ErrUnauthorized)，不设过期 (exp=0) 时返回 (0, nil)。
func (s *TokenService) RemainingTTL(token string) (time.Duration, error) {
	claims, err := jwt_.VerifyHS256(token, s.secret)
	if err != nil {
		return 0, fmt.Errorf("%w: %v", ErrUnauthorized, err)
	}
	exp := jwt_.GetClaimFloat64(claims, claimEXP)
	if exp <= 0 {
		return 0, nil
	}
	remain := time.Until(time.Unix(int64(exp), 0))
	if remain < 0 {
		remain = 0
	}
	return remain, nil
}
