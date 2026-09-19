package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// NoteFilter narrows a Note Locker listing.
type NoteFilter struct {
	ViewerID string
	Subject  string
	Semester int
	Kind     string
	Sort     string // "top" or "new"
	Cursor   *domain.Cursor
	Limit    int
}

// ListNotes returns a page of the Note Locker. PRD 7.4: the most useful thing in
// the app and the reason someone opens it on a dead Tuesday.
func (db *DB) ListNotes(ctx context.Context, f NoteFilter) ([]domain.Note, error) {
	limit := clampLimit(f.Limit, 20, 50)

	where := []string{`NOT n."isRemoved"`}
	args := []any{nullString(f.ViewerID)}
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if f.Subject != "" {
		where = append(where, fmt.Sprintf(`lower(n."subject") = lower(%s)`, arg(f.Subject)))
	}
	if f.Semester > 0 {
		where = append(where, fmt.Sprintf(`n."semester" = %s`, arg(f.Semester)))
	}
	if f.Kind != "" {
		where = append(where, fmt.Sprintf(`n."kind" = %s`, arg(f.Kind)))
	}

	orderBy := `n."score" DESC, n."id" DESC`
	if f.Sort == "new" {
		orderBy = `n."createdAt" DESC, n."id" DESC`
	}
	if f.Cursor != nil {
		if f.Sort == "new" {
			where = append(where, fmt.Sprintf(`(n."createdAt", n."id") < (%s, %s)`,
				arg(f.Cursor.Time), arg(f.Cursor.ID)))
		} else {
			where = append(where, fmt.Sprintf(`(n."score", n."id") < (%s, %s)`,
				arg(int(f.Cursor.Score)), arg(f.Cursor.ID)))
		}
	}

	q := fmt.Sprintf(`
		SELECT n."id", n."subject", n."semester", coalesce(n."branch", ''), n."kind", n."title",
			n."fileUrl", coalesce(n."fileSize", 0), n."score", n."downloads", n."createdAt",
			u."id", u."handle", u."displayName", u."avatar", coalesce(u."photoUrl", ''),
			coalesce(nv."value", 0)
		FROM "note_locker_items" n
		JOIN "users" u ON u."id" = n."uploaderId"
		LEFT JOIN "note_votes" nv ON nv."noteId" = n."id" AND nv."userId" = $1::uuid
		WHERE %s
		ORDER BY %s
		LIMIT %s`, joinAnd(where), orderBy, arg(limit+1))

	rows, err := db.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []domain.Note
	for rows.Next() {
		var (
			n         domain.Note
			avatarRaw []byte
		)
		if err := rows.Scan(&n.ID, &n.Subject, &n.Semester, &n.Branch, &n.Kind, &n.Title,
			&n.FileURL, &n.FileSize, &n.Score, &n.Downloads, &n.CreatedAt,
			&n.Uploader.ID, &n.Uploader.Handle, &n.Uploader.DisplayName, &avatarRaw, &n.Uploader.PhotoURL,
			&n.ViewerVote); err != nil {
			return nil, mapErr(err)
		}
		if len(avatarRaw) > 0 {
			_ = json.Unmarshal(avatarRaw, &n.Uploader.Avatar)
		}
		out = append(out, n)
	}
	return out, mapErr(rows.Err())
}

// CreateNoteParams describes an upload.
type CreateNoteParams struct {
	UploaderID string
	Subject    string
	Semester   int
	Branch     string
	Kind       string
	Title      string
	FileURL    string
	FileSize   int
}

// CreateNote records an upload. Uploads earn Stardust — the caller credits it.
func (db *DB) CreateNote(ctx context.Context, p CreateNoteParams) (string, error) {
	var id string
	err := db.pool.QueryRow(ctx, `
		INSERT INTO "note_locker_items" ("id", "uploaderId", "subject", "semester", "branch",
			"kind", "title", "fileUrl", "fileSize", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now())
		RETURNING "id"`,
		p.UploaderID, p.Subject, p.Semester, nullString(p.Branch), p.Kind, p.Title,
		p.FileURL, p.FileSize).Scan(&id)
	return id, mapErr(err)
}

// VoteNote upvotes or clears a vote, returning the new score and the uploader,
// so the caller can credit Stardust for a useful upload.
func (db *DB) VoteNote(ctx context.Context, userID, noteID string, value int) (score int, uploaderID string, err error) {
	if value == 0 {
		if _, err := db.pool.Exec(ctx,
			`DELETE FROM "note_votes" WHERE "noteId" = $1 AND "userId" = $2`, noteID, userID); err != nil {
			return 0, "", mapErr(err)
		}
	} else {
		if _, err := db.pool.Exec(ctx, `
			INSERT INTO "note_votes" ("id", "noteId", "userId", "value", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, $3, now())
			ON CONFLICT ("noteId", "userId") DO UPDATE SET "value" = excluded."value"`,
			noteID, userID, value); err != nil {
			return 0, "", mapErr(err)
		}
	}

	err = db.pool.QueryRow(ctx, `
		UPDATE "note_locker_items" n
		SET "score" = sub.total
		FROM (SELECT coalesce(sum("value"), 0)::int AS total FROM "note_votes" WHERE "noteId" = $1) sub
		WHERE n."id" = $1
		RETURNING n."score", n."uploaderId"`, noteID).Scan(&score, &uploaderID)
	return score, uploaderID, mapErr(err)
}

// IncrementNoteDownloads counts a download, which is a real usage metric (PRD 11).
func (db *DB) IncrementNoteDownloads(ctx context.Context, noteID string) error {
	_, err := db.pool.Exec(ctx,
		`UPDATE "note_locker_items" SET "downloads" = "downloads" + 1 WHERE "id" = $1`, noteID)
	return mapErr(err)
}

// NoteSubjects lists the subjects that actually have files, for the filter UI.
func (db *DB) NoteSubjects(ctx context.Context) ([]string, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT DISTINCT "subject" FROM "note_locker_items"
		WHERE NOT "isRemoved" ORDER BY "subject" ASC`)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, mapErr(err)
		}
		out = append(out, s)
	}
	return out, mapErr(rows.Err())
}

func joinAnd(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " AND "
		}
		out += p
	}
	return out
}
