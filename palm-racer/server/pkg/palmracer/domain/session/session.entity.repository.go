// Package session 定义单局游戏凭证（per-game session）的领域模型与存储接口。
//
// 单局 session 是一张绑定到「一局游戏」的有状态计分凭证：
//   - StartGame 时创建并签发 SID；
//   - 游戏过程中的反作弊核身请求为其续期（renew），并可标记作弊；
//   - SubmitScore 时一次性消费（consume），消费后作废，天然防重放。
//
// 其生命周期独立于登录态身份 token，用于把「提交资格」绑定到具体某一局。
package session

import (
	"context"
	"errors"
	"time"
)

// 单局 session 相关的 sentinel error，web 层用 errors.Is 映射为响应错误码。
var (
	// ErrSessionNotFound 表示 SID 不存在（未 StartGame 或已被清理）。
	ErrSessionNotFound = errors.New("session: not found")
	// ErrSessionExpired 表示 session 已过期。
	ErrSessionExpired = errors.New("session: expired")
	// ErrSessionSettled 表示 session 已被结算消费（重复提交/重放）。
	ErrSessionSettled = errors.New("session: already settled")
)

// Session 单局游戏凭证实体。
type Session struct {
	// SID 服务端生成的不可预测唯一标识。
	SID string
	// UID 该局所属用户（来自登录态身份，权威）。
	UID string
	// StartAt 开局时间，用于推算服务端侧有效游戏时长。
	StartAt time.Time
	// LastSeenAt 最近一次交互（续期）时间。
	LastSeenAt time.Time
	// ExpireAt 过期时间，由续期滑动延长。
	ExpireAt time.Time
	// Settled 是否已结算消费（一次性，防重放）。
	Settled bool
	// Cheated 局中是否被刷掌核身判定为替玩（核到他人）。
	Cheated bool
	// CheatUID 最近一次核到的他人 userId。
	CheatUID string
}

// Expired 判断 session 在给定时刻是否已过期。
func (s *Session) Expired(now time.Time) bool {
	return !now.Before(s.ExpireAt)
}

// Store 单局 session 存储接口（领域层定义，基础设施层实现）。
//
// 实现需保证并发安全；TTL 由实现持有，调用方无需关心。
type Store interface {
	// Create 为 uid 创建一局新 session 并签发 SID。
	Create(ctx context.Context, uid string) (*Session, error)

	// Get 按 SID 获取 session；不存在返回 ErrSessionNotFound，已过期返回 ErrSessionExpired。
	Get(ctx context.Context, sid string) (*Session, error)

	// Renew 为 session 续期（滑动过期）并刷新 LastSeenAt；不存在/过期返回对应错误。
	Renew(ctx context.Context, sid string) error

	// Consume 一次性消费 session 用于结算：成功后置 Settled=true。
	// 不存在返回 ErrSessionNotFound，过期返回 ErrSessionExpired，已消费返回 ErrSessionSettled。
	Consume(ctx context.Context, sid string) (*Session, error)

	// MarkCheated 标记该 session 在局中被核到他人（替玩）。
	MarkCheated(ctx context.Context, sid, cheatUID string) error
}
