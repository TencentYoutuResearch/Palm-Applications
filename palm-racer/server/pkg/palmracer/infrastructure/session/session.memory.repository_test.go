// Package session 内存实现的单元测试。
package session

import (
	"context"
	"errors"
	"testing"
	"time"

	domainsession "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/session"
)

func TestMemoryStoreCreateAndGet(t *testing.T) {
	t.Parallel()

	store := NewMemoryStore(time.Hour, 0)
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

func TestMemoryStoreConsumeOnce(t *testing.T) {
	t.Parallel()

	store := NewMemoryStore(time.Hour, 0)
	ctx := context.Background()
	s, _ := store.Create(ctx, "bob")

	if _, err := store.Consume(ctx, s.SID); err != nil {
		t.Fatalf("first Consume() error = %v", err)
	}
	// 第二次消费应判定为重放。
	if _, err := store.Consume(ctx, s.SID); !errors.Is(err, domainsession.ErrSessionSettled) {
		t.Errorf("second Consume() error = %v, want ErrSessionSettled", err)
	}
}

func TestMemoryStoreExpireAndRenew(t *testing.T) {
	t.Parallel()

	store := NewMemoryStore(30 * time.Millisecond, 0)
	ctx := context.Background()
	s, _ := store.Create(ctx, "carol")

	// 续期前先续一次，确保不过期。
	time.Sleep(20 * time.Millisecond)
	if err := store.Renew(ctx, s.SID); err != nil {
		t.Fatalf("Renew() error = %v", err)
	}
	time.Sleep(20 * time.Millisecond)
	if _, err := store.Get(ctx, s.SID); err != nil {
		t.Errorf("Get() after renew error = %v, want nil", err)
	}

	// 不再续期，等待过期。
	time.Sleep(40 * time.Millisecond)
	if _, err := store.Get(ctx, s.SID); !errors.Is(err, domainsession.ErrSessionExpired) {
		t.Errorf("Get() after expire error = %v, want ErrSessionExpired", err)
	}
}

func TestMemoryStoreMarkCheated(t *testing.T) {
	t.Parallel()

	store := NewMemoryStore(time.Hour, 0)
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

func TestMemoryStoreNotFound(t *testing.T) {
	t.Parallel()

	store := NewMemoryStore(time.Hour, 0)
	if _, err := store.Get(context.Background(), "nope"); !errors.Is(err, domainsession.ErrSessionNotFound) {
		t.Errorf("Get(unknown) error = %v, want ErrSessionNotFound", err)
	}
}

// TestMemoryStoreMaxLifetime 验证绝对寿命上限：即便不停续期也无法突破。
func TestMemoryStoreMaxLifetime(t *testing.T) {
	t.Parallel()

	// 滑动窗口很大，但绝对上限只有 30ms。
	store := NewMemoryStore(time.Hour, 30*time.Millisecond)
	ctx := context.Background()
	s, _ := store.Create(ctx, "alice")

	// 持续续期到接近上限，应仍可用。
	time.Sleep(15 * time.Millisecond)
	if err := store.Renew(ctx, s.SID); err != nil {
		t.Fatalf("Renew() before lifetime error = %v", err)
	}

	// 越过绝对上限后即便再续期也应返回 ErrSessionExpired。
	time.Sleep(40 * time.Millisecond)
	if err := store.Renew(ctx, s.SID); !errors.Is(err, domainsession.ErrSessionExpired) {
		t.Errorf("Renew() after lifetime error = %v, want ErrSessionExpired", err)
	}
	if _, err := store.Consume(ctx, s.SID); !errors.Is(err, domainsession.ErrSessionExpired) {
		t.Errorf("Consume() after lifetime error = %v, want ErrSessionExpired", err)
	}
}
