// Package cache wraps Redis. Three jobs live here: the Owl Board sorted sets,
// presence, and rate limiting.
//
// PRD 6.2 calls out the shape directly: ZINCRBY per scored action, ZREVRANGE for
// the board, ZREVRANK for "you're #47".
package cache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Redis is the client wrapper.
type Redis struct {
	client *redis.Client
}

// Open parses a redis:// URL and verifies the connection.
func Open(ctx context.Context, url string) (*Redis, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}
	opts.MaxRetries = 3
	opts.DialTimeout = 5 * time.Second
	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second

	client := redis.NewClient(opts)
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}
	return &Redis{client: client}, nil
}

// Client exposes the raw client for the pub/sub bus.
func (r *Redis) Client() *redis.Client { return r.client }

// Close releases the connection pool.
func (r *Redis) Close() error { return r.client.Close() }

// Ping is the readiness probe.
func (r *Redis) Ping(ctx context.Context) error { return r.client.Ping(ctx).Err() }

// ------------------------------------------------------------ rate limiting ---

// Allow implements httpx.Limiter with a fixed window per key.
func (r *Redis) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, time.Duration, error) {
	fullKey := "rl:" + key

	pipe := r.client.TxPipeline()
	incr := pipe.Incr(ctx, fullKey)
	pipe.Expire(ctx, fullKey, window) // NX would be nicer but this is a fixed window
	if _, err := pipe.Exec(ctx); err != nil {
		return true, 0, fmt.Errorf("rate limit check: %w", err)
	}

	count := incr.Val()
	if count == 1 {
		// First hit in this window: make sure the TTL is exactly the window.
		_ = r.client.Expire(ctx, fullKey, window).Err()
	}
	if count > int64(limit) {
		ttl, err := r.client.TTL(ctx, fullKey).Result()
		if err != nil || ttl < 0 {
			ttl = window
		}
		return false, ttl, nil
	}
	return true, 0, nil
}

// ----------------------------------------------------------------- presence ---

const presenceTTL = 90 * time.Second

// MarkOnline refreshes a user's presence key. The online dot and the little owl
// icon during the night window both read this (PRD 6.6).
func (r *Redis) MarkOnline(ctx context.Context, userID string, night bool) error {
	val := "day"
	if night {
		val = "night"
	}
	return r.client.Set(ctx, "presence:"+userID, val, presenceTTL).Err()
}

// Presence returns "day", "night" or "" when the user is offline.
func (r *Redis) Presence(ctx context.Context, userID string) (string, error) {
	val, err := r.client.Get(ctx, "presence:"+userID).Result()
	if errors.Is(err, redis.Nil) {
		return "", nil
	}
	return val, err
}

// PresenceMany resolves presence for a list of users in one round trip.
func (r *Redis) PresenceMany(ctx context.Context, userIDs []string) (map[string]string, error) {
	out := make(map[string]string, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	keys := make([]string, len(userIDs))
	for i, id := range userIDs {
		keys[i] = "presence:" + id
	}
	vals, err := r.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("presence mget: %w", err)
	}
	for i, v := range vals {
		if s, ok := v.(string); ok && s != "" {
			out[userIDs[i]] = s
		}
	}
	return out, nil
}

// GoOffline clears presence on a clean disconnect.
func (r *Redis) GoOffline(ctx context.Context, userID string) error {
	return r.client.Del(ctx, "presence:"+userID).Err()
}

// --------------------------------------------------------------- owl board ----

// BoardKey builds the sorted-set key for a scope. scope is one of
// global | campus | batch | buddies (PRD 6.2).
func BoardKey(scope, scopeID, weekKey string) string {
	if scopeID == "" {
		return fmt.Sprintf("owlboard:%s:%s", scope, weekKey)
	}
	return fmt.Sprintf("owlboard:%s:%s:%s", scope, scopeID, weekKey)
}

// boardTTL keeps two seasons of boards around before Redis reclaims them; the
// authoritative history lives in Postgres snapshots.
const boardTTL = 21 * 24 * time.Hour

// AddPoints increments a user's score on one board and returns the new total.
func (r *Redis) AddPoints(ctx context.Context, key, userID string, points int) (float64, error) {
	pipe := r.client.TxPipeline()
	incr := pipe.ZIncrBy(ctx, key, float64(points), userID)
	pipe.Expire(ctx, key, boardTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, fmt.Errorf("zincrby %s: %w", key, err)
	}
	return incr.Val(), nil
}

// BoardEntry is one row read back from Redis.
type BoardEntry struct {
	UserID string
	Points int
}

// Top returns the highest scorers on a board.
func (r *Redis) Top(ctx context.Context, key string, limit int) ([]BoardEntry, error) {
	if limit <= 0 {
		limit = 50
	}
	res, err := r.client.ZRevRangeWithScores(ctx, key, 0, int64(limit-1)).Result()
	if err != nil {
		return nil, fmt.Errorf("zrevrange %s: %w", key, err)
	}
	out := make([]BoardEntry, 0, len(res))
	for _, z := range res {
		id, ok := z.Member.(string)
		if !ok {
			continue
		}
		out = append(out, BoardEntry{UserID: id, Points: int(z.Score)})
	}
	return out, nil
}

// RankOf returns a user's 1-based rank and points, or ok=false when they are not
// on the board. This is the "you're #47" line.
func (r *Redis) RankOf(ctx context.Context, key, userID string) (rank int, points int, ok bool, err error) {
	pipe := r.client.Pipeline()
	rankCmd := pipe.ZRevRank(ctx, key, userID)
	scoreCmd := pipe.ZScore(ctx, key, userID)
	if _, err := pipe.Exec(ctx); err != nil && !errors.Is(err, redis.Nil) {
		return 0, 0, false, fmt.Errorf("zrevrank %s: %w", key, err)
	}
	if errors.Is(rankCmd.Err(), redis.Nil) || errors.Is(scoreCmd.Err(), redis.Nil) {
		return 0, 0, false, nil
	}
	if err := rankCmd.Err(); err != nil {
		return 0, 0, false, err
	}
	return int(rankCmd.Val()) + 1, int(scoreCmd.Val()), true, nil
}

// BoardSize is how many people are on a board this week.
func (r *Redis) BoardSize(ctx context.Context, key string) (int, error) {
	n, err := r.client.ZCard(ctx, key).Result()
	return int(n), err
}

// PointsInHour tracks how many points a user banked in the last hour, which is
// the OWL_MAX_POINTS_PER_HOUR anti-cheat cap (PRD 6.2).
func (r *Redis) PointsInHour(ctx context.Context, userID string) (int, error) {
	val, err := r.client.Get(ctx, "owl:hour:"+userID).Int()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	return val, err
}

// AddPointsInHour records points against the hourly cap.
func (r *Redis) AddPointsInHour(ctx context.Context, userID string, points int) (int, error) {
	key := "owl:hour:" + userID
	pipe := r.client.TxPipeline()
	incr := pipe.IncrBy(ctx, key, int64(points))
	pipe.Expire(ctx, key, time.Hour)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, fmt.Errorf("owl hourly cap: %w", err)
	}
	return int(incr.Val()), nil
}
