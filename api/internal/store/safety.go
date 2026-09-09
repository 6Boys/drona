package store

import (
	"context"
	"time"
)

// FlagCrisis queues a crisis match for human review (PRD 10). The user is never
// told they were flagged; they are shown the support card, and a reviewer sees
// this row.
func (db *DB) FlagCrisis(ctx context.Context, userID, surface, refID, pattern string) error {
	_, err := db.pool.Exec(ctx, `
		INSERT INTO "crisis_flags" ("id", "userId", "surface", "refId", "pattern", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`, userID, surface, refID, pattern)
	return mapErr(err)
}

// CreateReport files a report. Report and block are available on every surface
// (PRD 10), so this is called from posts, comments, messages and profiles.
func (db *DB) CreateReport(ctx context.Context, reporterID, targetType, targetID, reason, details string) (string, error) {
	var id string
	err := db.pool.QueryRow(ctx, `
		INSERT INTO "reports" ("id", "reporterId", "targetType", "targetId", "reason", "details", "createdAt")
		VALUES (gen_random_uuid(), $1, $2::"ReportTargetType", $3, $4, $5, now())
		RETURNING "id"`, reporterID, targetType, targetID, reason, nullString(details)).Scan(&id)
	return id, mapErr(err)
}

// ReportRow is one item in the moderation queue.
type ReportRow struct {
	ID         string
	TargetType string
	TargetID   string
	Reason     string
	Details    string
	Status     string
	Reporter   string
	CreatedAt  time.Time
}

// ListOpenReports returns the moderation queue oldest first, because the 24h SLA
// (PRD 10) is measured from when a report arrived.
func (db *DB) ListOpenReports(ctx context.Context, limit int) ([]ReportRow, error) {
	limit = clampLimit(limit, 50, 200)
	rows, err := db.pool.Query(ctx, `
		SELECT r."id", r."targetType"::text, r."targetId", r."reason", coalesce(r."details", ''),
			r."status"::text, u."handle", r."createdAt"
		FROM "reports" r
		JOIN "users" u ON u."id" = r."reporterId"
		WHERE r."status" IN ('OPEN', 'IN_REVIEW')
		ORDER BY r."createdAt" ASC
		LIMIT $1`, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []ReportRow
	for rows.Next() {
		var r ReportRow
		if err := rows.Scan(&r.ID, &r.TargetType, &r.TargetID, &r.Reason, &r.Details,
			&r.Status, &r.Reporter, &r.CreatedAt); err != nil {
			return nil, mapErr(err)
		}
		out = append(out, r)
	}
	return out, mapErr(rows.Err())
}

// ResolveReport closes a report with an outcome.
func (db *DB) ResolveReport(ctx context.Context, reportID, resolverID, status string) error {
	tag, err := db.pool.Exec(ctx, `
		UPDATE "reports"
		SET "status" = $3::"ReportStatus", "resolvedById" = $2, "resolvedAt" = now()
		WHERE "id" = $1`, reportID, resolverID, status)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
