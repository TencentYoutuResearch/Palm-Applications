// Package application 游戏鉴权编排：身份 token 与单局 session 的生命周期。
package application

import (
	"context"
	"errors"
	"time"

	appdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain"
	authdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/auth"
	sessiondomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/session"
)

// GameAuthHandler 编排身份 token 校验与单局 session 的创建、续期、消费。
type GameAuthHandler struct {
	tokens   *authdomain.TokenService
	sessions sessiondomain.Store
}

// ErrAuthNotInitialized 表示 GameAuthHandler 未正确初始化（jwt_secret 未配置）。
var ErrAuthNotInitialized = errors.New("auth: game auth service not initialized (jwt_secret not configured)")

// NewGameAuthHandler 创建游戏鉴权编排处理器。
func NewGameAuthHandler(tokens *authdomain.TokenService, sessions sessiondomain.Store) GameAuthHandler {
	return GameAuthHandler{tokens: tokens, sessions: sessions}
}

// initialized 检查 GameAuthHandler 是否已正确初始化。
// 当 jwt_secret 未配置时 buildGameAuthHandler 返回零值结构体，tokens 和 sessions 均为 nil，
// 此时所有鉴权操作应返回错误而非 panic。
func (h *GameAuthHandler) initialized() error {
	if h.tokens == nil || h.sessions == nil {
		return ErrAuthNotInitialized
	}
	return nil
}

// IssueLoginToken 为登录成功的 uid 签发身份 token。
func (h *GameAuthHandler) IssueLoginToken(uid string) (string, error) {
	if err := h.initialized(); err != nil {
		return "", err
	}
	return h.tokens.Issue(uid)
}

// StartGameResult StartGame 的输出：sid + 可选的续命 token。
type StartGameResult struct {
	// UID 权威用户 ID（来自身份 token）。
	UID string
	// SID 本局 session 标识。
	SID string
	// RefreshedToken 仅当原 token 剩余有效期低于阈值时下发的新 token；为空表示无需更新。
	RefreshedToken string
}

// StartGame 校验身份 token 并创建一局新 session。
//
// 静默续命：当原 token 剩余有效期 < LoginTokenRefreshAheadSeconds 时，
// 在响应中下发新 token。前端写回 user store 即可让玩家在不知不觉中保持登录态，
// 避免「玩到一半 token 过期被踢回登录页」。
func (h *GameAuthHandler) StartGame(ctx context.Context, token string) (*StartGameResult, error) {
	if err := h.initialized(); err != nil {
		return nil, err
	}
	uid, err := h.tokens.Verify(token)
	if err != nil {
		return nil, err
	}
	s, err := h.sessions.Create(ctx, uid)
	if err != nil {
		return nil, err
	}

	res := &StartGameResult{UID: uid, SID: s.SID}

	// 近过期则续命：失败不阻断主流程，仍然返回原 sid 让游戏正常开始。
	if remain, terr := h.tokens.RemainingTTL(token); terr == nil && remain > 0 {
		threshold := time.Duration(appdomain.LoginTokenRefreshAheadSeconds) * time.Second
		if remain < threshold {
			if newToken, ierr := h.tokens.Issue(uid); ierr == nil {
				res.RefreshedToken = newToken
			}
		}
	}

	return res, nil
}

// RenewOnVerify 在局中刷掌核身时被调用，为 session 续期并按需标记替玩。
//
// 续期只要求「核身请求发生」，不要求核身成功：sid 为空则跳过。
// matchedUID 非空且不等于 session 归属用户时，标记该局为替玩。
// 任何续期/标记失败都不应阻断核身主流程，调用方忽略返回的 error 即可。
func (h *GameAuthHandler) RenewOnVerify(ctx context.Context, sid, matchedUID string) error {
	if sid == "" {
		return nil
	}
	if err := h.initialized(); err != nil {
		return err
	}
	if err := h.sessions.Renew(ctx, sid); err != nil {
		return err
	}
	if matchedUID == "" {
		return nil
	}
	s, err := h.sessions.Get(ctx, sid)
	if err != nil {
		return err
	}
	if matchedUID != s.UID {
		return h.sessions.MarkCheated(ctx, sid, matchedUID)
	}
	return nil
}

// SubmissionContext 提交分数的鉴权上下文，由 VerifySubmission 返回。
type SubmissionContext struct {
	// UID 权威用户 ID（来自身份 token，覆盖客户端上报）。
	UID string
	// Cheated 该局是否被局中核身判定为替玩。
	Cheated bool
	// CheatUID 替玩者 userId。
	CheatUID string
	// ServerElapsedSeconds 服务端侧有效时长（开局到提交的真实跨度，秒）。
	ServerElapsedSeconds float64
}

// VerifySubmission 校验单局 session 并一次性消费，返回提交分数所需的鉴权上下文。
//
// 鉴权策略（"sid 是硬性条件，token 是软条件"）：
//   - sid 必须有效：sid 不可猜（128 bit 熵）+ 一次性消费 + 创建时已绑定权威 uid，
//     这是 SubmitScore 的最终防线
//   - token 合法：用 token.uid 作为权威身份（与原行为一致）
//   - token 过期：降级到 session.uid。token 过期≠攻击，玩家可能在游戏中跨过
//     token 失效时刻，不应丢分；session 创建时 uid 是由当时的合法 token 写入，
//     此处直接信任
//   - token 签名错误/格式非法：严格拒绝（错的不是过期，是有人在伪造）
//
// 安全论证：攻击者拿过期 token 想刷分必须同时拿到一个未消费的合法 sid，
// 而 sid 不可猜且一次性消费，因此降级路径不引入新的攻击面。
func (h *GameAuthHandler) VerifySubmission(ctx context.Context, token, sid string) (*SubmissionContext, error) {
	if sid == "" {
		return nil, sessiondomain.ErrSessionNotFound
	}
	if err := h.initialized(); err != nil {
		return nil, err
	}

	// token 校验：仅在「签名错/格式非法」时硬拒；过期/缺失走降级。
	var tokenUID string
	if token != "" {
		uid, err := h.tokens.Verify(token)
		switch {
		case err == nil:
			tokenUID = uid
		case errors.Is(err, authdomain.ErrTokenExpired):
			// 过期：降级用 session.UID，不返回错误
		default:
			return nil, err
		}
	}

	s, err := h.sessions.Consume(ctx, sid)
	if err != nil {
		return nil, err
	}

	uid := tokenUID
	if uid == "" {
		uid = s.UID
	}

	return &SubmissionContext{
		UID:                  uid,
		Cheated:              s.Cheated,
		CheatUID:             s.CheatUID,
		ServerElapsedSeconds: time.Since(s.StartAt).Seconds(),
	}, nil
}
