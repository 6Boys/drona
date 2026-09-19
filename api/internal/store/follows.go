package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// Follow creates a follow edge and keeps the denormalised counters in step.
// Following yourself is rejected; following twice is a no-op, not an error,
// because a double-tap on a slow connection should not surface a failure.
func (db *DB) Follow(ctx context.Context, followerID, followeeID string) (created bool, err error) {
	if followerID == followeeID {
		return false, ErrConflict
	}

	err = db.InTx(ctx, func(tx pgx.Tx) error {
		// A block in either direction beats a follow.
		var blocked bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM "blocks"
				WHERE ("blockerId" = $1 AND "blockedId" = $2)
				   OR ("blockerId" = $2 AND "blockedId" = $1)
			)`, followerID, followeeID).Scan(&blocked); err != nil {
			return mapErr(err)
		}
		if blocked {
			return ErrConflict
		}

		tag, err := tx.Exec(ctx, `
			INSERT INTO "follows" ("id", "followerId", "followeeId", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, now())
			ON CONFLICT ("followerId", "followeeId") DO NOTHING`, followerID, followeeID)
		if err != nil {
			return mapErr(err)
		}
		if tag.RowsAffected() == 0 {
			return nil // already following
		}
		created = true

		if _, err := tx.Exec(ctx,
			`UPDATE "users" SET "followingCount" = "followingCount" + 1, "updatedAt" = now() WHERE "id" = $1`,
			followerID); err != nil {
			return mapErr(err)
		}
		if _, err := tx.Exec(ctx,
			`UPDATE "users" SET "followerCount" = "followerCount" + 1, "updatedAt" = now() WHERE "id" = $1`,
			followeeID); err != nil {
			return mapErr(err)
		}
		return nil
	})
	return created, err
}

// Unfollow removes an edge, keeping counters non-negative.
func (db *DB) Unfollow(ctx context.Context, followerID, followeeID string) (removed bool, err error) {
	err = db.InTx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx,
			`DELETE FROM "follows" WHERE "followerId" = $1 AND "followeeId" = $2`, followerID, followeeID)
		if err != nil {
			return mapErr(err)
		}
		if tag.RowsAffected() == 0 {
			return nil
		}
		removed = true

		if _, err := tx.Exec(ctx,
			`UPDATE "users" SET "followingCount" = greatest("followingCount" - 1, 0), "updatedAt" = now() WHERE "id" = $1`,
			followerID); err != nil {
			return mapErr(err)
		}
		if _, err := tx.Exec(ctx,
			`UPDATE "users" SET "followerCount" = greatest("followerCount" - 1, 0), "updatedAt" = now() WHERE "id" = $1`,
			followeeID); err != nil {
			return mapErr(err)
		}
		return nil
	})
	return removed, err
}

// FollowingCount is what the follow-8 onboarding gate checks (PRD 6.1).
func (db *DB) FollowingCount(ctx context.Context, userID string) (int, error) {
	var n int
	err := db.pool.QueryRow(ctx,
		`SELECT count(*)::int FROM "follows" WHERE "followerId" = $1`, userID).Scan(&n)
	return n, mapErr(err)
}

// Relationship describes how two accounts stand. A mutual follow is a Buddy,
// which is what unlocks direct DMs (PRD 6.7).
type Relationship struct {
	ViewerFollows bool
	FollowsViewer bool
}

// IsBuddy reports a mutual follow.
func (r Relationship) IsBuddy() bool { return r.ViewerFollows && r.FollowsViewer }

// RelationshipBetween resolves both directions in one round trip.
func (db *DB) RelationshipBetween(ctx context.Context, viewerID, otherID string) (Relationship, error) {
	var rel Relationship
	if viewerID == "" || otherID == "" || viewerID == otherID {
		return rel, nil
	}
	err := db.pool.QueryRow(ctx, `
		SELECT
			EXISTS (SELECT 1 FROM "follows" WHERE "followerId" = $1 AND "followeeId" = $2),
			EXISTS (SELECT 1 FROM "follows" WHERE "followerId" = $2 AND "followeeId" = $1)`,
		viewerID, otherID).Scan(&rel.ViewerFollows, &rel.FollowsViewer)
	return rel, mapErr(err)
}

// RelationshipsFor resolves the viewer's relationship to many users at once,
// which is how list endpoints avoid an N+1.
func (db *DB) RelationshipsFor(ctx context.Context, viewerID string, otherIDs []string) (map[string]Relationship, error) {
	out := make(map[string]Relationship, len(otherIDs))
	if viewerID == "" || len(otherIDs) == 0 {
		return out, nil
	}

	rows, err := db.pool.Query(ctx, `
		SELECT t.id,
			EXISTS (SELECT 1 FROM "follows" f WHERE f."followerId" = $1 AND f."followeeId" = t.id),
			EXISTS (SELECT 1 FROM "follows" f WHERE f."followerId" = t.id AND f."followeeId" = $1)
		FROM unnest($2::uuid[]) AS t(id)`, viewerID, otherIDs)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var rel Relationship
		if err := rows.Scan(&id, &rel.ViewerFollows, &rel.FollowsViewer); err != nil {
			return nil, mapErr(err)
		}
		out[id] = rel
	}
	return out, mapErr(rows.Err())
}

// ListFollowing returns who a user follows, newest edge first.
func (db *DB) ListFollowing(ctx context.Context, userID string, limit int) ([]*domain.UserPrivate, error) {
	limit = clampLimit(limit, 30, 100)
	rows, err := db.pool.Query(ctx, `
		SELECT `+userColumnsFor("u")+`
		FROM "follows" f
		JOIN "users" u ON u."id" = f."followeeId"
		WHERE f."followerId" = $1
		ORDER BY f."createdAt" DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	return collectUsers(rows)
}

// ListFollowers returns who follows a user.
func (db *DB) ListFollowers(ctx context.Context, userID string, limit int) ([]*domain.UserPrivate, error) {
	limit = clampLimit(limit, 30, 100)
	rows, err := db.pool.Query(ctx, `
		SELECT `+userColumnsFor("u")+`
		FROM "follows" f
		JOIN "users" u ON u."id" = f."followerId"
		WHERE f."followeeId" = $1
		ORDER BY f."createdAt" DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	return collectUsers(rows)
}

// Block creates a block and tears down any follow edges between the two.
func (db *DB) Block(ctx context.Context, blockerID, blockedID string) error {
	if blockerID == blockedID {
		return ErrConflict
	}
	return db.InTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			INSERT INTO "blocks" ("id", "blockerId", "blockedId", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, now())
			ON CONFLICT ("blockerId", "blockedId") DO NOTHING`, blockerID, blockedID); err != nil {
			return mapErr(err)
		}
		if _, err := tx.Exec(ctx, `
			DELETE FROM "follows"
			WHERE ("followerId" = $1 AND "followeeId" = $2)
			   OR ("followerId" = $2 AND "followeeId" = $1)`, blockerID, blockedID); err != nil {
			return mapErr(err)
		}
		// Recompute rather than decrement: we may have deleted 0, 1 or 2 edges.
		for _, id := range []string{blockerID, blockedID} {
			if _, err := tx.Exec(ctx, `
				UPDATE "users" SET
					"followerCount"  = (SELECT count(*) FROM "follows" WHERE "followeeId" = $1),
					"followingCount" = (SELECT count(*) FROM "follows" WHERE "followerId" = $1),
					"updatedAt" = now()
				WHERE "id" = $1`, id); err != nil {
				return mapErr(err)
			}
		}
		return nil
	})
}

// Unblock removes a block.
func (db *DB) Unblock(ctx context.Context, blockerID, blockedID string) error {
	_, err := db.pool.Exec(ctx,
		`DELETE FROM "blocks" WHERE "blockerId" = $1 AND "blockedId" = $2`, blockerID, blockedID)
	return mapErr(err)
}

// IsBlockedEitherWay reports whether either party blocked the other.
func (db *DB) IsBlockedEitherWay(ctx context.Context, a, b string) (bool, error) {
	var blocked bool
	err := db.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM "blocks"
			WHERE ("blockerId" = $1 AND "blockedId" = $2)
			   OR ("blockerId" = $2 AND "blockedId" = $1)
		)`, a, b).Scan(&blocked)
	return blocked, mapErr(err)
}
