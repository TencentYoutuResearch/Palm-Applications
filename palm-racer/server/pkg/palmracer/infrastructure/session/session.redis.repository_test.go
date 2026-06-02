// Package session Redis 实现的单元测试。
//
// 使用 miniredis 启动一个进程内 Redis 协议服务，确保测试覆盖与生产路径一致的代码。
package session

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"

	domainsession "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/session"
)

// newTestStore 启动一个 miniredis + go-redis 客户端，返回 store 与 miniredis 句柄
// （用于在测试里推进时间，避免真实 sleep）。
func newTestStore(t *testing.T, ttl, maxLifetime time.Duration) (domainsession.Store, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return NewRedisStore(rdb, ttl, maxLifetime), mr
}

func TestRedisStoreCreateAndGet(t *testing.T) {
	t.Parallel()

	store, _ := newTestStore(t, time.Hour, 0)
	ctx := context.Background()

	s, err := store.Create(ctx, "alice")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if s.SID == "" || s.UID != "alice" {
		t.Fatalf("Create() got sid=%q uid=%q", s.SID, s.UID)
	}

	got, err := store.Get(ctx, s.SID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got.UID != "alice" {
		t.Errorf("Get() uid = %q, want alice", got.UID)
	}
}

func TestRedisStoreConsumeOnce(t *testing.T) {
	t.Parallel()

	store, _ := newTestStore(t, time.Hour, 0)
	ctx := context.Background()
	s, _ := store.Create(ctx, "bob")

	if _, err := store.Consume(ctx, s.SID); err != nil {
		t.Fatalf("first Consume() error = %v", err)
	}
	// 第二次消费应被判定为重放
	if _, err := store.Consume(ctx, s.SID); !errors.Is(err, domainsession.ErrSessionSettled) {
		t.Errorf("second Consume() error = %v, want ErrSessionSettled", err)
	}
}

func TestRedisStoreExpireAndRenew(t *testing.T) {
	t.Parallel()

	store, mr := newTestStore(t, 30*time.Second, 0)
	ctx := context.Background()
	s, _ := store.Create(ctx, "carol")

	// 推进 20s（未过期），续期应成功
	mr.FastForward(20 * time.Second)
	if err := store.Renew(ctx, s.SID); err != nil {
		t.Fatalf("Renew() error = %v", err)
	}
	mr.FastForward(20 * time.Second)
	if _, err := store.Get(ctx, s.SID); err != nil {
		t.Errorf("Get() after renew error = %v, want nil", err)
	}

	// 不再续期，越过 TTL 后 Redis 自动驱逐 → ErrSessionNotFound
	mr.FastForward(40 * time.Second)
	if _, err := store.Get(ctx, s.SID); !errors.Is(err, domainsession.ErrSessionNotFound) {
		t.Errorf("Get() after expire error = %v, want ErrSessionNotFound", err)
	}
}

func TestRedisStoreMarkCheated(t *testing.T) {
	t.Parallel()

	store, _ := newTestStore(t, time.Hour, 0)
	ctx := context.Background()
	s, _ := store.Create(ctx, "dave")

	if err := store.MarkCheated(ctx, s.SID, "intruder"); err != nil {
		t.Fatalf("MarkCheated() error = %v", err)
	}
	got, _ := store.Get(ctx, s.SID)
	if !got.Cheated || got.CheatUID != "intruder" {
		t.Errorf("MarkCheated() got cheated=%v cheatUID=%q", got.Cheated, got.CheatUID)
	}
}

func TestRedisStoreNotFound(t *testing.T) {
	t.Parallel()

	store, _ := newTestStore(t, time.Hour, 0)
	if _, err := store.Get(context.Background(), "nope"); !errors.Is(err, domainsession.ErrSessionNotFound) {
		t.Errorf("Get(unknown) error = %v, want ErrSessionNotFound", err)
	}
}

// TestRedisStoreMaxLifetime 验证绝对寿命上限：即便不停续期也无法突破。
//
// 注意：Redis 里 start_at 以秒级精度存储，因此测试用的 maxLifetime 应 ≥ 2s
// 以避开秒边界舍入。这里取 2s + 真实 sleep 来覆盖判定逻辑。
func TestRedisStoreMaxLifetime(t *testing.T) {
	t.Parallel()

	store, _ := newTestStore(t, time.Hour, 2*time.Second)
	ctx := context.Background()
	s, _ := store.Create(ctx, "alice")

	// 立刻续期，肯定还在上限内
	if err := store.Renew(ctx, s.SID); err != nil {
		t.Fatalf("Renew() before lifetime error = %v", err)
	}

	// 越过绝对上限后即便 TTL 还远没到，Renew/Consume 也应返回 ErrSessionExpired
	time.Sleep(2500 * time.Millisecond)
	if err := store.Renew(ctx, s.SID); !errors.Is(err, domainsession.ErrSessionExpired) {
		t.Errorf("Renew() after lifetime error = %v, want ErrSessionExpired", err)
	}
	if _, err := store.Consume(ctx, s.SID); !errors.Is(err, domainsession.ErrSessionExpired) {
		t.Errorf("Consume() after lifetime error = %v, want ErrSessionExpired", err)
	}
}
