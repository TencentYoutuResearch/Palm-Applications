// Package session 提供单局 session 的 Redis 存储实现，用于多节点部署。
//
// 数据模型：每个 sid 对应一个 hash key（带 TTL）。
//
//	Key:  palmracer:session:<sid>
//	Hash 字段：uid / start_at / settled / cheated / cheat_uid
//
// TTL 由滑动续期控制；同时通过 start_at + maxLifetime 强制绝对寿命上限，
// 防止「持续挂机+持续续期」让单局 session 永久不过期被滥用。
package session

import (
	"context"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
	idgen_ "github.com/kaydxh/golang/go/idgen"

	domainsession "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/session"
)

const (
	keyPrefix         = "palmracer:session:"
	fieldUID          = "uid"
	fieldStartAt      = "start_at"   // unix 秒
	fieldSettled      = "settled"    // "1" / 不存在
	fieldCheated      = "cheated"    // "1" / 不存在
	fieldCheatUID     = "cheat_uid"  // string
	fieldLastSeenAt   = "last_seen"  // unix 秒
)

// redisStore 基于 Redis Hash 的单局 session 存储，多节点共享。
type redisStore struct {
	rdb         *redis.Client
	ttl         time.Duration // 滑动续期窗口
	maxLifetime time.Duration // 绝对寿命上限（从 start_at 起算）
}

// NewRedisStore 创建 Redis session 存储。
//
// ttl 为单次续期窗口（从 last_seen 起算）；maxLifetime 为单局绝对寿命硬上限
// （从 start_at 起算），用于防止滑动续期被滥用为「永久 session」。
// maxLifetime <= 0 时不强制绝对上限。
func NewRedisStore(rdb *redis.Client, ttl, maxLifetime time.Duration) domainsession.Store {
	return &redisStore{rdb: rdb, ttl: ttl, maxLifetime: maxLifetime}
}

func (r *redisStore) key(sid string) string { return keyPrefix + sid }

// Create 创建一局新 session 并签发不可预测的 SID。
func (r *redisStore) Create(ctx context.Context, uid string) (*domainsession.Session, error) {
	sid, err := idgen_.NewUUIDHex()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	values := map[string]interface{}{
		fieldUID:        uid,
		fieldStartAt:    strconv.FormatInt(now.Unix(), 10),
		fieldLastSeenAt: strconv.FormatInt(now.Unix(), 10),
	}

	pipe := r.rdb.TxPipeline()
	pipe.HSet(ctx, r.key(sid), values)
	pipe.Expire(ctx, r.key(sid), r.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, err
	}

	return &domainsession.Session{
		SID:        sid,
		UID:        uid,
		StartAt:    now,
		LastSeenAt: now,
		ExpireAt:   now.Add(r.ttl),
	}, nil
}

// Get 按 SID 获取 session。Redis key 自然过期 ⇒ ErrSessionNotFound。
func (r *redisStore) Get(ctx context.Context, sid string) (*domainsession.Session, error) {
	s, err := r.load(ctx, sid)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// Renew 滑动续期；超过 maxLifetime 视为已过期。
func (r *redisStore) Renew(ctx context.Context, sid string) error {
	s, err := r.load(ctx, sid)
	if err != nil {
		return err
	}
	now := time.Now()
	if r.maxLifetime > 0 && now.Sub(s.StartAt) >= r.maxLifetime {
		return domainsession.ErrSessionExpired
	}

	pipe := r.rdb.TxPipeline()
	pipe.HSet(ctx, r.key(sid), fieldLastSeenAt, strconv.FormatInt(now.Unix(), 10))
	pipe.Expire(ctx, r.key(sid), r.ttl)
	_, err = pipe.Exec(ctx)
	return err
}

// Consume 一次性消费 session 用于结算：通过 HSETNX 保证原子置位。
func (r *redisStore) Consume(ctx context.Context, sid string) (*domainsession.Session, error) {
	s, err := r.load(ctx, sid)
	if err != nil {
		return nil, err
	}
	ok, err := r.rdb.HSetNX(ctx, r.key(sid), fieldSettled, "1").Result()
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domainsession.ErrSessionSettled
	}
	s.Settled = true
	return s, nil
}

// MarkCheated 标记该 session 在局中被核到他人。
func (r *redisStore) MarkCheated(ctx context.Context, sid, cheatUID string) error {
	if exists, err := r.rdb.Exists(ctx, r.key(sid)).Result(); err != nil {
		return err
	} else if exists == 0 {
		return domainsession.ErrSessionNotFound
	}
	values := map[string]interface{}{fieldCheated: "1"}
	if cheatUID != "" {
		values[fieldCheatUID] = cheatUID
	}
	return r.rdb.HSet(ctx, r.key(sid), values).Err()
}

// load 从 Redis 加载 session 并归一错误。
func (r *redisStore) load(ctx context.Context, sid string) (*domainsession.Session, error) {
	if sid == "" {
		return nil, domainsession.ErrSessionNotFound
	}
	m, err := r.rdb.HGetAll(ctx, r.key(sid)).Result()
	if err != nil {
		return nil, err
	}
	if len(m) == 0 {
		return nil, domainsession.ErrSessionNotFound
	}

	startAt := parseUnix(m[fieldStartAt])
	lastSeen := parseUnix(m[fieldLastSeenAt])
	if lastSeen.IsZero() {
		lastSeen = startAt
	}

	// 软校验绝对寿命：避免读到处于「将过期但 Redis 尚未驱逐」的边缘记录。
	if r.maxLifetime > 0 && time.Since(startAt) >= r.maxLifetime {
		return nil, domainsession.ErrSessionExpired
	}

	return &domainsession.Session{
		SID:        sid,
		UID:        m[fieldUID],
		StartAt:    startAt,
		LastSeenAt: lastSeen,
		ExpireAt:   lastSeen.Add(r.ttl),
		Settled:    m[fieldSettled] == "1",
		Cheated:    m[fieldCheated] == "1",
		CheatUID:   m[fieldCheatUID],
	}, nil
}

func parseUnix(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return time.Time{}
	}
	return time.Unix(v, 0)
}
