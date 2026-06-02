// Package session 提供单局 session 的内存存储实现，用于单实例开发/演示部署。
//
// 本实现仅在单进程内有效，多副本部署下分数会按节点各记一份导致数据错乱。
// 多节点部署 **必须** 使用 NewRedisStore（见 session.redis.repository.go）。
//
// 启动期由 plugin.web_handler 根据 `redis.enabled` 配置二选一：
//   - true  → NewRedisStore（生产推荐）
//   - false → NewMemoryStore（仅本地开发/单实例演示）
package session

import (
	"context"
	"sync"
	"time"

	idgen_ "github.com/kaydxh/golang/go/idgen"

	domainsession "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/session"
)

// memoryStore 基于内存 map 的单局 session 存储，并发安全。
//
// 适用于单实例部署或单元测试；多副本部署应使用 NewRedisStore。
type memoryStore struct {
	mu          sync.Mutex
	sessions    map[string]*domainsession.Session
	ttl         time.Duration
	maxLifetime time.Duration
}

// NewMemoryStore 创建内存 session 存储；maxLifetime 为绝对寿命上限（0 表示不限）。
//
// 注意：只在单实例进程内有效。多副本部署绝不要用——同一玩家请求被路由到不同节点
// 时会出现「sid 找不到」「分数重复入库」等数据错乱。多节点请用 NewRedisStore。
func NewMemoryStore(ttl, maxLifetime time.Duration) domainsession.Store {
	return &memoryStore{
		sessions:    make(map[string]*domainsession.Session),
		ttl:         ttl,
		maxLifetime: maxLifetime,
	}
}

// Create 创建一局新 session 并签发不可预测的 SID。
func (m *memoryStore) Create(_ context.Context, uid string) (*domainsession.Session, error) {
	sid, err := idgen_.NewUUIDHex()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	s := &domainsession.Session{
		SID:        sid,
		UID:        uid,
		StartAt:    now,
		LastSeenAt: now,
		ExpireAt:   now.Add(m.ttl),
	}

	m.mu.Lock()
	m.sessions[sid] = s
	m.evictExpiredLocked(now)
	m.mu.Unlock()

	return s, nil
}

// Get 按 SID 获取 session 的副本。
func (m *memoryStore) Get(_ context.Context, sid string) (*domainsession.Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.sessions[sid]
	if !ok {
		return nil, domainsession.ErrSessionNotFound
	}
	now := time.Now()
	if s.Expired(now) || m.lifetimeExceeded(s, now) {
		return nil, domainsession.ErrSessionExpired
	}
	cp := *s
	return &cp, nil
}

// Renew 滑动续期并刷新 LastSeenAt；超过 maxLifetime 视为已过期。
func (m *memoryStore) Renew(_ context.Context, sid string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.sessions[sid]
	if !ok {
		return domainsession.ErrSessionNotFound
	}
	now := time.Now()
	if s.Expired(now) || m.lifetimeExceeded(s, now) {
		return domainsession.ErrSessionExpired
	}
	s.LastSeenAt = now
	s.ExpireAt = now.Add(m.ttl)
	return nil
}

// Consume 一次性消费 session 用于结算。
func (m *memoryStore) Consume(_ context.Context, sid string) (*domainsession.Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.sessions[sid]
	if !ok {
		return nil, domainsession.ErrSessionNotFound
	}
	now := time.Now()
	if s.Expired(now) || m.lifetimeExceeded(s, now) {
		return nil, domainsession.ErrSessionExpired
	}
	if s.Settled {
		return nil, domainsession.ErrSessionSettled
	}
	s.Settled = true
	cp := *s
	return &cp, nil
}

// MarkCheated 标记该 session 在局中被核到他人。
func (m *memoryStore) MarkCheated(_ context.Context, sid, cheatUID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.sessions[sid]
	if !ok {
		return domainsession.ErrSessionNotFound
	}
	s.Cheated = true
	if cheatUID != "" {
		s.CheatUID = cheatUID
	}
	return nil
}

// lifetimeExceeded 判断是否超过绝对寿命上限。
func (m *memoryStore) lifetimeExceeded(s *domainsession.Session, now time.Time) bool {
	return m.maxLifetime > 0 && now.Sub(s.StartAt) >= m.maxLifetime
}

// evictExpiredLocked 惰性清理过期 session，调用方须持锁。
func (m *memoryStore) evictExpiredLocked(now time.Time) {
	for sid, s := range m.sessions {
		if s.Expired(now) || m.lifetimeExceeded(s, now) {
			delete(m.sessions, sid)
		}
	}
}
