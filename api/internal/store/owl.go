package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// NightSession is one device's activity record for one night.
type NightSession struct {
	ID          string
	UserID      string
	DeviceID    *string
	NightKey    string
	StartedAt   time.Time
	LastBeatAt  time.Time
	ActionCount int
	Points      int
	CurfewHitAt *time.Time
}

// OpenNightSession returns the session for (user, night, device), creating it on
// first heartbeat. deviceID may be empty; Postgres treats NULLs as distinct in a
// unique index, so this does an explicit lookup rather than ON CONFLICT.
func (db *DB) OpenNightSession(ctx context.Context, userID, deviceID, nightKey string) (*NightSession, error) {
	var s NightSession
	scan := func(row pgx.Row) error {
		return row.Scan(&s.ID, &s.UserID, &s.DeviceID, &s.NightKey, &s.StartedAt,
			&s.LastBeatAt, &s.ActionCount, &s.Points, &s.CurfewHitAt)
	}
	const cols = `"id", "userId", "deviceId", "nightKey", "startedAt", "lastBeatAt", "actionCount", "points", "curfewHitAt"`

	err := db.InTx(ctx, func(tx pgx.Tx) error {
		err := scan(tx.QueryRow(ctx, `
			SELECT `+cols+` FROM "night_sessions"
			WHERE "userId" = $1 AND "nightKey" = $2 AND "deviceId" IS NOT DISTINCT FROM $3::uuid`,
			userID, nightKey, nullString(deviceID)))
		if err == nil {
			return nil
		}
		if mapErr(err) != ErrNotFound {
			return mapErr(err)
		}
		return mapErr(scan(tx.QueryRow(ctx, `
			INSERT INTO "night_sessions" ("id", "userId", "deviceId", "nightKey", "startedAt", "lastBeatAt")
			VALUES (gen_random_uuid(), $1, $3::uuid, $2, now(), now())
			RETURNING `+cols, userID, nightKey, nullString(deviceID))))
	})
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// RecordNightActivity adds actions and points to a session and returns the new
// totals. Points are only ever added here, and only by the owl service, which
// has already checked the window, the curfew and the rate caps (PRD 6.2).
func (db *DB) RecordNightActivity(ctx context.Context, sessionID string, actions, points int) (totalActions, totalPoints int, err error) {
	err = db.pool.QueryRow(ctx, `
		UPDATE "night_sessions"
		SET "actionCount" = "actionCount" + $2,
		    "points" = "points" + $3,
		    "lastBeatAt" = now()
		WHERE "id" = $1
		RETURNING "actionCount", "points"`, sessionID, actions, points).Scan(&totalActions, &totalPoints)
	return totalActions, totalPoints, mapErr(err)
}

// MarkCurfew stamps the moment the 3 AM hard curfew stopped scoring.
func (db *DB) MarkCurfew(ctx context.Context, sessionID string) error {
	_, err := db.pool.Exec(ctx,
		`UPDATE "night_sessions" SET "curfewHitAt" = coalesce("curfewHitAt", now()) WHERE "id" = $1`,
		sessionID)
	return mapErr(err)
}

// NightPointsForWeek sums a user's night points across a set of night keys. This
// is the authoritative total; Redis is a cache in front of it.
func (db *DB) NightPointsForWeek(ctx context.Context, userID string, nightKeys []string) (int, error) {
	var total int
	err := db.pool.QueryRow(ctx, `
		SELECT coalesce(sum("points"), 0)::int FROM "night_sessions"
		WHERE "userId" = $1 AND "nightKey" = ANY($2::text[])`, userID, nightKeys).Scan(&total)
	return total, mapErr(err)
}

// SnapshotOwlScore persists a weekly total, so history survives the weekly reset
// of the Redis sorted sets (PRD 6.2: weekly reset with a season badge kept forever).
func (db *DB) SnapshotOwlScore(ctx context.Context, userID, campusID, weekKey string, points, rank int, owlRank domain.OwlRank) error {
	_, err := db.pool.Exec(ctx, `
		INSERT INTO "owl_scores" ("id", "userId", "campusId", "weekKey", "points", "rank", "owlRank", "snapshotAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::"OwlRank", now())
		ON CONFLICT ("userId", "weekKey")
		DO UPDATE SET "points" = excluded."points",
		              "rank" = excluded."rank",
		              "owlRank" = excluded."owlRank",
		              "snapshotAt" = now()`,
		userID, campusID, weekKey, points, rank, string(owlRank))
	return mapErr(err)
}

// OwlScoreRow is a persisted leaderboard row.
type OwlScoreRow struct {
	User   domain.User
	Points int
	Rank   int
}

// OwlBoardFromSnapshots reads the leaderboard out of Postgres. Used when Redis
// is cold (a restart, a fresh deploy) so the board is never empty.
func (db *DB) OwlBoardFromSnapshots(ctx context.Context, weekKey, campusID string, limit int) ([]OwlScoreRow, error) {
	limit = clampLimit(limit, 50, 200)

	rows, err := db.pool.Query(ctx, `
		SELECT u."id", u."handle", u."displayName", u."avatar", coalesce(u."photoUrl", ''),
			coalesce(u."batch", ''), coalesce(u."branch", ''), o."points", o."owlRank"::text
		FROM "owl_scores" o
		JOIN "users" u ON u."id" = o."userId"
		WHERE o."weekKey" = $1 AND ($2::uuid IS NULL OR o."campusId" = $2::uuid)
		ORDER BY o."points" DESC, u."handle" ASC
		LIMIT $3`, weekKey, nullString(campusID), limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []OwlScoreRow
	for rows.Next() {
		var (
			r         OwlScoreRow
			avatarRaw []byte
			owlRank   string
		)
		if err := rows.Scan(&r.User.ID, &r.User.Handle, &r.User.DisplayName, &avatarRaw,
			&r.User.PhotoURL, &r.User.Batch, &r.User.Branch, &r.Points, &owlRank); err != nil {
			return nil, mapErr(err)
		}
		r.User.OwlRank = domain.OwlRank(owlRank)
		r.User.OwlRankLabel = r.User.OwlRank.Label()
		if len(avatarRaw) > 0 {
			_ = json.Unmarshal(avatarRaw, &r.User.Avatar)
		}
		r.Rank = len(out) + 1
		out = append(out, r)
	}
	return out, mapErr(rows.Err())
}

// UsersByIDs hydrates leaderboard rows read from Redis, preserving the order of
// the ids it was given.
func (db *DB) UsersByIDs(ctx context.Context, ids []string) (map[string]domain.User, error) {
	out := make(map[string]domain.User, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := db.pool.Query(ctx, `
		SELECT u."id", u."handle", u."displayName", u."avatar", coalesce(u."photoUrl", ''),
			coalesce(u."batch", ''), coalesce(u."branch", ''), u."owlRank"::text
		FROM "users" u WHERE u."id" = ANY($1::uuid[])`, ids)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			u         domain.User
			avatarRaw []byte
			owlRank   string
		)
		if err := rows.Scan(&u.ID, &u.Handle, &u.DisplayName, &avatarRaw, &u.PhotoURL,
			&u.Batch, &u.Branch, &owlRank); err != nil {
			return nil, mapErr(err)
		}
		u.OwlRank = domain.OwlRank(owlRank)
		u.OwlRankLabel = u.OwlRank.Label()
		if len(avatarRaw) > 0 {
			_ = json.Unmarshal(avatarRaw, &u.Avatar)
		}
		out[u.ID] = u
	}
	return out, mapErr(rows.Err())
}

// CocoonAlreadyClaimed reports whether the recovery bonus was already paid today.
func (db *DB) CocoonAlreadyClaimed(ctx context.Context, userID, dayKey string) (bool, error) {
	var exists bool
	err := db.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM "cocoon_claims" WHERE "userId" = $1 AND "dayKey" = $2)`,
		userID, dayKey).Scan(&exists)
	return exists, mapErr(err)
}

// ClaimCocoon records the recovery bonus. PRD 6.2: recovery outscores damage,
// by design — this is the one bonus worth more than a full night of grinding.
func (db *DB) ClaimCocoon(ctx context.Context, userID, dayKey string, sleepHours float64, stardust int) error {
	tag, err := db.pool.Exec(ctx, `
		INSERT INTO "cocoon_claims" ("id", "userId", "dayKey", "sleepHours", "stardust", "awardedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
		ON CONFLICT ("userId", "dayKey") DO NOTHING`, userID, dayKey, sleepHours, stardust)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrConflict
	}
	return nil
}

// LastActivityAt is the newest signal we have that a user was awake: their last
// heartbeat, message or post. The gap since then is what the Cocoon Bonus reads.
func (db *DB) LastActivityAt(ctx context.Context, userID string) (*time.Time, error) {
	var at *time.Time
	err := db.pool.QueryRow(ctx, `
		SELECT greatest(
			(SELECT max("lastSeenAt")  FROM "users"          WHERE "id" = $1),
			(SELECT max("lastBeatAt")  FROM "night_sessions" WHERE "userId" = $1),
			(SELECT max("createdAt")   FROM "messages"       WHERE "senderId" = $1),
			(SELECT max("createdAt")   FROM "posts"          WHERE "authorId" = $1)
		)`, userID).Scan(&at)
	return at, mapErr(err)
}

// GrantBadge awards a badge by code, ignoring a repeat award.
func (db *DB) GrantBadge(ctx context.Context, userID, code string) error {
	_, err := db.pool.Exec(ctx, `
		INSERT INTO "user_badges" ("id", "userId", "badgeId", "earnedAt")
		SELECT gen_random_uuid(), $1, b."id", now() FROM "badges" b WHERE b."code" = $2
		ON CONFLICT ("userId", "badgeId") DO NOTHING`, userID, code)
	return mapErr(err)
}

// OwlPointsForUsers reads weekly points for specific users out of the snapshots.
// The Buddies board needs this: it is derived from the follow graph at read time
// rather than kept as its own sorted set, so when Redis is cold there is no key
// to read and Postgres has to answer.
func (db *DB) OwlPointsForUsers(ctx context.Context, weekKey string, userIDs []string) (map[string]int, error) {
	out := make(map[string]int, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	rows, err := db.pool.Query(ctx, `
		SELECT "userId", "points" FROM "owl_scores"
		WHERE "weekKey" = $1 AND "userId" = ANY($2::uuid[])`, weekKey, userIDs)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var points int
		if err := rows.Scan(&id, &points); err != nil {
			return nil, mapErr(err)
		}
		out[id] = points
	}
	return out, mapErr(rows.Err())
}
