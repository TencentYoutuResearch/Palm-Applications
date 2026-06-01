// Package application 合理性校验、GameAuth 编排的单元测试。
package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"

	authdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/auth"
	scoredomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/score"
	sessiondomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/session"
	sessioninfra "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/session"
)

const testJWTSecret = "palm-racer-test-secret-at-least-32!!"

// newTestSessionStore 启动 miniredis + go-redis 客户端，返回与生产路径一致的 Redis session store。
func newTestSessionStore(t *testing.T, ttl, maxLifetime time.Duration) sessiondomain.Store {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return sessioninfra.NewRedisStore(rdb, ttl, maxLifetime)
}

func TestSubmitScoreReasonability(t *testing.T) {
	t.Parallel()

	repo := &mockScoreRepo{}
	h := NewScoreHandler(repo)

	// 60s 上限 = 60*250 = 15000，21000 应被拒。
	err := h.SubmitScore(context.Background(), &SubmitScoreRequest{
		UserID: "u1", Score: 21000, SurviveTime: 60, ServerElapsedSeconds: 60,
	})
	if !errors.Is(err, scoredomain.ErrScoreUnreasonable) {
		t.Errorf("SubmitScore() error = %v, want ErrScoreUnreasonable", err)
	}

	// 服务端真实 60s，客户端伪造 3600s 不应放大额度（取小为 60s → 21000 仍越界）。
	err = h.SubmitScore(context.Background(), &SubmitScoreRequest{
		UserID: "u1", Score: 21000, SurviveTime: 3600, ServerElapsedSeconds: 60,
	})
	if !errors.Is(err, scoredomain.ErrScoreUnreasonable) {
		t.Errorf("SubmitScore() inflate-survive error = %v, want ErrScoreUnreasonable", err)
	}
}

func TestGameAuthHandlerStartAndVerify(t *testing.T) {
	t.Parallel()

	// TTL 必须远大于 LoginTokenRefreshAheadSeconds（24h）才不会触发续命，
	// 这里设 30 天确保测试稳定。
	tokens := authdomain.NewTokenService(testJWTSecret, 30*24*time.Hour)
	store := newTestSessionStore(t, time.Hour, 0)
	h := NewGameAuthHandler(tokens, store)

	loginToken, err := h.IssueLoginToken("alice")
	if err != nil {
		t.Fatalf("IssueLoginToken() error = %v", err)
	}

	res, err := h.StartGame(context.Background(), loginToken)
	if err != nil {
		t.Fatalf("StartGame() error = %v", err)
	}
	if res.UID != "alice" || res.SID == "" {
		t.Fatalf("StartGame() got %+v", res)
	}
	// token TTL=1h，远高于 24h 续命阈值 → 不应触发续命
	if res.RefreshedToken != "" {
		t.Errorf("StartGame() unexpected refreshed token for fresh login token")
	}

	// 一次性消费成功
	authCtx, err := h.VerifySubmission(context.Background(), loginToken, res.SID)
	if err != nil {
		t.Fatalf("VerifySubmission() error = %v", err)
	}
	if authCtx.UID != "alice" || authCtx.ServerElapsedSeconds < 0 {
		t.Errorf("VerifySubmission() ctx = %+v", authCtx)
	}

	// 重放应被拒
	if _, err := h.VerifySubmission(context.Background(), loginToken, res.SID); !errors.Is(err, sessiondomain.ErrSessionSettled) {
		t.Errorf("VerifySubmission() replay error = %v, want ErrSessionSettled", err)
	}
}

// TestGameAuthHandlerStartGameRefreshNearExpiry：原 token 接近过期时 StartGame 应下发新 token。
func TestGameAuthHandlerStartGameRefreshNearExpiry(t *testing.T) {
	t.Parallel()

	// TTL 设为很短，远低于 LoginTokenRefreshAheadSeconds 阈值（24h），
	// 这样 StartGame 会判定为「近过期」并下发新 token。
	tokens := authdomain.NewTokenService(testJWTSecret, 5*time.Minute)
	store := newTestSessionStore(t, time.Hour, 0)
	h := NewGameAuthHandler(tokens, store)

	loginToken, _ := h.IssueLoginToken("alice")
	res, err := h.StartGame(context.Background(), loginToken)
	if err != nil {
		t.Fatalf("StartGame() error = %v", err)
	}
	if res.RefreshedToken == "" {
		t.Fatalf("StartGame() expected refreshed token for near-expiry login token")
	}
	// 续命 token 应能解出同样的 uid
	if uid, verr := tokens.Verify(res.RefreshedToken); verr != nil || uid != "alice" {
		t.Errorf("Verify(refreshed) uid=%q err=%v, want alice/nil", uid, verr)
	}
}

func TestGameAuthHandlerRenewMarksCheat(t *testing.T) {
	t.Parallel()

	tokens := authdomain.NewTokenService(testJWTSecret, time.Hour)
	store := newTestSessionStore(t, time.Hour, 0)
	h := NewGameAuthHandler(tokens, store)

	loginToken, _ := h.IssueLoginToken("alice")
	startRes, _ := h.StartGame(context.Background(), loginToken)
	sid := startRes.SID

	// 核到他人 → 标记替玩
	if err := h.RenewOnVerify(context.Background(), sid, "intruder"); err != nil {
		t.Fatalf("RenewOnVerify() error = %v", err)
	}
	authCtx, _ := h.VerifySubmission(context.Background(), loginToken, sid)
	if !authCtx.Cheated || authCtx.CheatUID != "intruder" {
		t.Errorf("VerifySubmission() ctx = %+v, want cheated=true cheatUID=intruder", authCtx)
	}
}

func TestGameAuthHandlerRejectsInvalidToken(t *testing.T) {
	t.Parallel()

	tokens := authdomain.NewTokenService(testJWTSecret, time.Hour)
	store := newTestSessionStore(t, time.Hour, 0)
	h := NewGameAuthHandler(tokens, store)

	if _, err := h.StartGame(context.Background(), "bad-token"); !errors.Is(err, authdomain.ErrUnauthorized) {
		t.Errorf("StartGame(bad) error = %v, want ErrUnauthorized", err)
	}
	if _, err := h.VerifySubmission(context.Background(), "bad-token", "any"); !errors.Is(err, authdomain.ErrUnauthorized) {
		t.Errorf("VerifySubmission(bad) error = %v, want ErrUnauthorized", err)
	}
}

// TestGameAuthHandlerVerifySubmissionTokenExpiredFallback：
// 游戏中 token 过期不应导致丢分——只要 sid 仍合法，就允许提交，
// 鉴权上下文里的 UID 由 session 提供（创建时已由合法 token 写入）。
func TestGameAuthHandlerVerifySubmissionTokenExpiredFallback(t *testing.T) {
	t.Parallel()

	// jwt exp 精度为秒，ttl 必须 ≥1s 才能稳定让 StartGame 通过。
	// session ttl 设长以确保 sid 在 token 过期后仍活着。
	tokens := authdomain.NewTokenService(testJWTSecret, time.Second)
	store := newTestSessionStore(t, time.Hour, 0)
	h := NewGameAuthHandler(tokens, store)

	loginToken, _ := h.IssueLoginToken("alice")
	startRes, err := h.StartGame(context.Background(), loginToken)
	if err != nil {
		t.Fatalf("StartGame() error = %v", err)
	}

	// 等待 token 过期（≥1s ttl + 1s 缓冲）。sid 在 1h ttl 内仍活着。
	time.Sleep(2 * time.Second)

	authCtx, err := h.VerifySubmission(context.Background(), loginToken, startRes.SID)
	if err != nil {
		t.Fatalf("VerifySubmission(expired token, valid sid) error = %v, want success via session UID", err)
	}
	if authCtx.UID != "alice" {
		t.Errorf("VerifySubmission() UID = %q, want alice (from session)", authCtx.UID)
	}

	// 重放应被原子拒绝，确认降级路径没有破坏一次性消费语义。
	if _, err := h.VerifySubmission(context.Background(), loginToken, startRes.SID); !errors.Is(err, sessiondomain.ErrSessionSettled) {
		t.Errorf("VerifySubmission() replay error = %v, want ErrSessionSettled", err)
	}
}

// TestGameAuthHandlerVerifySubmissionEmptyToken：
// 没带 token 但 sid 合法时也应允许提交（与过期降级一致）。
// 这条路径在「玩家清缓存导致 token 丢失但还没刷新页面」等边缘场景出现。
func TestGameAuthHandlerVerifySubmissionEmptyToken(t *testing.T) {
	t.Parallel()

	tokens := authdomain.NewTokenService(testJWTSecret, time.Hour)
	store := newTestSessionStore(t, time.Hour, 0)
	h := NewGameAuthHandler(tokens, store)

	loginToken, _ := h.IssueLoginToken("bob")
	startRes, _ := h.StartGame(context.Background(), loginToken)

	authCtx, err := h.VerifySubmission(context.Background(), "", startRes.SID)
	if err != nil {
		t.Fatalf("VerifySubmission(empty token, valid sid) error = %v, want success via session UID", err)
	}
	if authCtx.UID != "bob" {
		t.Errorf("VerifySubmission() UID = %q, want bob (from session)", authCtx.UID)
	}
}

// TestGameAuthHandlerVerifySubmissionEmptySid：
// sid 是硬性条件，无论 token 状态如何，sid 缺失都应直接拒绝。
func TestGameAuthHandlerVerifySubmissionEmptySid(t *testing.T) {
	t.Parallel()

	tokens := authdomain.NewTokenService(testJWTSecret, time.Hour)
	store := newTestSessionStore(t, time.Hour, 0)
	h := NewGameAuthHandler(tokens, store)

	loginToken, _ := h.IssueLoginToken("carol")

	if _, err := h.VerifySubmission(context.Background(), loginToken, ""); !errors.Is(err, sessiondomain.ErrSessionNotFound) {
		t.Errorf("VerifySubmission(valid token, empty sid) error = %v, want ErrSessionNotFound", err)
	}
}
