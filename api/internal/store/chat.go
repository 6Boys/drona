package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// messageProjection carries the sender, because a message without an identity
// is not something this product ships.
const messageProjection = `
	m."id", m."threadId", m."kind"::text, coalesce(m."body", ''), coalesce(m."mediaUrl", ''),
	m."replyToId", coalesce(m."clientId", ''), m."editedAt", m."deletedAt", m."createdAt",
	u."id", u."handle", u."displayName", u."avatar", coalesce(u."photoUrl", ''), u."owlRank"::text`

func scanMessage(rows pgx.Rows) (*domain.Message, error) {
	var (
		m         domain.Message
		kind      string
		avatarRaw []byte
		owlRank   string
	)
	err := rows.Scan(
		&m.ID, &m.ThreadID, &kind, &m.Body, &m.MediaURL,
		&m.ReplyToID, &m.ClientID, &m.EditedAt, &m.DeletedAt, &m.CreatedAt,
		&m.Sender.ID, &m.Sender.Handle, &m.Sender.DisplayName, &avatarRaw, &m.Sender.PhotoURL, &owlRank,
	)
	if err != nil {
		return nil, mapErr(err)
	}
	m.Kind = domain.MessageKind(kind)
	m.Sender.OwlRank = domain.OwlRank(owlRank)
	m.Sender.OwlRankLabel = m.Sender.OwlRank.Label()
	if len(avatarRaw) > 0 {
		_ = json.Unmarshal(avatarRaw, &m.Sender.Avatar)
	}
	// Deletes are recorded, not destructive — the row stays, the body goes.
	if m.DeletedAt != nil {
		m.Body = ""
		m.MediaURL = ""
	}
	return &m, nil
}

// Membership is a user's standing in a thread.
type Membership struct {
	ThreadID          string
	UserID            string
	Role              string
	State             domain.MemberState
	Muted             bool
	LastReadMessageID *string
	LastReadAt        *time.Time
}

// Membership loads a user's row in a thread. ErrNotFound means "not a member",
// which every caller treats as a 403/404 rather than an error to log.
func (db *DB) Membership(ctx context.Context, threadID, userID string) (*Membership, error) {
	var m Membership
	var state string
	err := db.pool.QueryRow(ctx, `
		SELECT "threadId", "userId", "role"::text, "state"::text, "muted", "lastReadMessageId", "lastReadAt"
		FROM "thread_members" WHERE "threadId" = $1 AND "userId" = $2`, threadID, userID).
		Scan(&m.ThreadID, &m.UserID, &m.Role, &state, &m.Muted, &m.LastReadMessageID, &m.LastReadAt)
	if err != nil {
		return nil, mapErr(err)
	}
	m.State = domain.MemberState(state)
	return &m, nil
}

// ThreadMemberIDs lists everyone who should receive a realtime event for a
// thread. This is the fanout list for the WebSocket gateway.
func (db *DB) ThreadMemberIDs(ctx context.Context, threadID string) ([]string, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT "userId" FROM "thread_members"
		WHERE "threadId" = $1 AND "state" IN ('ACTIVE', 'REQUESTED')`, threadID)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, mapErr(err)
		}
		ids = append(ids, id)
	}
	return ids, mapErr(rows.Err())
}

// ThreadByID loads a thread with its members and the viewer's standing.
func (db *DB) ThreadByID(ctx context.Context, viewerID, threadID string) (*domain.Thread, error) {
	var (
		t           domain.Thread
		threadType  string
		title       *string
		icon        *string
		viewerState *string
		muted       *bool
	)
	err := db.pool.QueryRow(ctx, `
		SELECT t."id", t."type"::text, t."title", t."icon", t."lastMessageAt", t."createdAt",
			(SELECT count(*)::int FROM "thread_members" tm
			 WHERE tm."threadId" = t."id" AND tm."state" = 'ACTIVE'),
			(SELECT tm."state"::text FROM "thread_members" tm
			 WHERE tm."threadId" = t."id" AND tm."userId" = $1::uuid),
			(SELECT tm."muted" FROM "thread_members" tm
			 WHERE tm."threadId" = t."id" AND tm."userId" = $1::uuid)
		FROM "threads" t WHERE t."id" = $2`, nullString(viewerID), threadID).
		Scan(&t.ID, &threadType, &title, &icon, &t.LastMessageAt, &t.CreatedAt,
			&t.MemberCount, &viewerState, &muted)
	if err != nil {
		return nil, mapErr(err)
	}
	t.Type = domain.ThreadType(threadType)
	t.Title = deref(title)
	t.Icon = deref(icon)
	if viewerState != nil {
		t.ViewerState = domain.MemberState(*viewerState)
	}
	t.Muted = muted != nil && *muted

	members, err := db.threadMembers(ctx, threadID)
	if err != nil {
		return nil, err
	}
	t.Members = members
	return &t, nil
}

func (db *DB) threadMembers(ctx context.Context, threadID string) ([]domain.User, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT u."id", u."handle", u."displayName", u."avatar", coalesce(u."photoUrl", ''),
			coalesce(u."batch", ''), coalesce(u."branch", ''), u."owlRank"::text, u."lastSeenAt"
		FROM "thread_members" tm
		JOIN "users" u ON u."id" = tm."userId"
		WHERE tm."threadId" = $1 AND tm."state" = 'ACTIVE'
		ORDER BY tm."joinedAt" ASC
		LIMIT 256`, threadID)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []domain.User
	for rows.Next() {
		var (
			u         domain.User
			avatarRaw []byte
			owlRank   string
		)
		if err := rows.Scan(&u.ID, &u.Handle, &u.DisplayName, &avatarRaw, &u.PhotoURL,
			&u.Batch, &u.Branch, &owlRank, &u.LastSeenAt); err != nil {
			return nil, mapErr(err)
		}
		u.OwlRank = domain.OwlRank(owlRank)
		u.OwlRankLabel = u.OwlRank.Label()
		if len(avatarRaw) > 0 {
			_ = json.Unmarshal(avatarRaw, &u.Avatar)
		}
		out = append(out, u)
	}
	return out, mapErr(rows.Err())
}

// ListThreads returns the viewer's threads, most recent first. state selects the
// main list ("ACTIVE") or the request inbox ("REQUESTED") — PRD 6.6.
func (db *DB) ListThreads(ctx context.Context, viewerID string, state domain.MemberState, limit int) ([]domain.Thread, error) {
	limit = clampLimit(limit, 30, 100)
	rows, err := db.pool.Query(ctx, `
		SELECT t."id", t."type"::text, t."title", t."icon", t."lastMessageAt", t."createdAt",
			tm."state"::text, tm."muted",
			(SELECT count(*)::int FROM "thread_members" x
			 WHERE x."threadId" = t."id" AND x."state" = 'ACTIVE'),
			(SELECT count(*)::int FROM "messages" msg
			 WHERE msg."threadId" = t."id"
			   AND msg."senderId" <> $1
			   AND msg."deletedAt" IS NULL
			   AND (tm."lastReadAt" IS NULL OR msg."createdAt" > tm."lastReadAt"))
		FROM "thread_members" tm
		JOIN "threads" t ON t."id" = tm."threadId"
		WHERE tm."userId" = $1 AND tm."state" = $2::"ThreadMemberState"
		ORDER BY t."lastMessageAt" DESC NULLS LAST, t."createdAt" DESC
		LIMIT $3`, viewerID, string(state), limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var threads []domain.Thread
	for rows.Next() {
		var (
			t           domain.Thread
			threadType  string
			title       *string
			icon        *string
			memberState string
		)
		if err := rows.Scan(&t.ID, &threadType, &title, &icon, &t.LastMessageAt, &t.CreatedAt,
			&memberState, &t.Muted, &t.MemberCount, &t.UnreadCount); err != nil {
			return nil, mapErr(err)
		}
		t.Type = domain.ThreadType(threadType)
		t.Title = deref(title)
		t.Icon = deref(icon)
		t.ViewerState = domain.MemberState(memberState)
		threads = append(threads, t)
	}
	if err := rows.Err(); err != nil {
		return nil, mapErr(err)
	}
	rows.Close()

	// Fill members and the last message for each thread. Bounded by the page
	// size, and a DM list without the other person's name is useless.
	for i := range threads {
		members, err := db.threadMembers(ctx, threads[i].ID)
		if err != nil {
			return nil, err
		}
		threads[i].Members = members

		last, err := db.lastMessage(ctx, threads[i].ID)
		if err != nil {
			return nil, err
		}
		threads[i].LastMessage = last
	}
	return threads, nil
}

func (db *DB) lastMessage(ctx context.Context, threadID string) (*domain.Message, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT `+messageProjection+`
		FROM "messages" m
		JOIN "users" u ON u."id" = m."senderId"
		WHERE m."threadId" = $1
		ORDER BY m."createdAt" DESC, m."id" DESC
		LIMIT 1`, threadID)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, mapErr(rows.Err())
	}
	return scanMessage(rows)
}

// GetOrCreateDM finds the 1:1 thread between two users, creating it if needed.
// mutual decides whether the recipient sees the thread immediately or in their
// request inbox (PRD 6.6: non-mutuals land in a request inbox).
func (db *DB) GetOrCreateDM(ctx context.Context, a, b string, mutual bool) (threadID string, created bool, err error) {
	err = db.InTx(ctx, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			SELECT t."id"
			FROM "threads" t
			JOIN "thread_members" m1 ON m1."threadId" = t."id" AND m1."userId" = $1
			JOIN "thread_members" m2 ON m2."threadId" = t."id" AND m2."userId" = $2
			WHERE t."type" = 'DM'
			LIMIT 1`, a, b).Scan(&threadID)
		if err == nil {
			return nil
		}
		if mapErr(err) != ErrNotFound {
			return mapErr(err)
		}

		if err := tx.QueryRow(ctx, `
			INSERT INTO "threads" ("id", "type", "createdById", "createdAt")
			VALUES (gen_random_uuid(), 'DM', $1, now())
			RETURNING "id"`, a).Scan(&threadID); err != nil {
			return mapErr(err)
		}
		created = true

		recipientState := "REQUESTED"
		if mutual {
			recipientState = "ACTIVE"
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO "thread_members" ("id", "threadId", "userId", "role", "state", "joinedAt")
			VALUES (gen_random_uuid(), $1, $2, 'OWNER', 'ACTIVE', now()),
			       (gen_random_uuid(), $1, $3, 'MEMBER', $4::"ThreadMemberState", now())`,
			threadID, a, b, recipientState); err != nil {
			return mapErr(err)
		}
		return nil
	})
	return threadID, created, err
}

// CreateDen opens a group chat (PRD 6.6, 256 member cap).
func (db *DB) CreateDen(ctx context.Context, ownerID, title, icon string, memberIDs []string) (string, error) {
	var threadID string
	err := db.InTx(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `
			INSERT INTO "threads" ("id", "type", "title", "icon", "createdById", "memberLimit", "createdAt")
			VALUES (gen_random_uuid(), 'DEN', $1, $2, $3, 256, now())
			RETURNING "id"`, title, nullString(icon), ownerID).Scan(&threadID); err != nil {
			return mapErr(err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO "thread_members" ("id", "threadId", "userId", "role", "state", "joinedAt")
			VALUES (gen_random_uuid(), $1, $2, 'OWNER', 'ACTIVE', now())`, threadID, ownerID); err != nil {
			return mapErr(err)
		}
		for _, id := range memberIDs {
			if id == ownerID {
				continue
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO "thread_members" ("id", "threadId", "userId", "role", "state", "joinedAt")
				VALUES (gen_random_uuid(), $1, $2, 'MEMBER', 'ACTIVE', now())
				ON CONFLICT ("threadId", "userId") DO NOTHING`, threadID, id); err != nil {
				return mapErr(err)
			}
		}
		return nil
	})
	return threadID, err
}

// ActiveMemberCount enforces the Den cap.
func (db *DB) ActiveMemberCount(ctx context.Context, threadID string) (int, error) {
	var n int
	err := db.pool.QueryRow(ctx,
		`SELECT count(*)::int FROM "thread_members" WHERE "threadId" = $1 AND "state" = 'ACTIVE'`,
		threadID).Scan(&n)
	return n, mapErr(err)
}

// AcceptRequest moves a REQUESTED member into the main list.
func (db *DB) AcceptRequest(ctx context.Context, threadID, userID string) error {
	tag, err := db.pool.Exec(ctx, `
		UPDATE "thread_members" SET "state" = 'ACTIVE'
		WHERE "threadId" = $1 AND "userId" = $2 AND "state" = 'REQUESTED'`, threadID, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// CreateMessageParams describes an outgoing message.
type CreateMessageParams struct {
	ThreadID  string
	SenderID  string
	Kind      domain.MessageKind
	Body      string
	MediaURL  string
	ReplyToID *string
	// ClientID makes send idempotent across a reconnect — the client generates
	// it, so a retry after a dropped socket cannot double-post.
	ClientID string
}

// CreateMessage appends a message and touches the thread's lastMessageAt.
// A repeat of the same (threadId, clientId) returns the original row.
func (db *DB) CreateMessage(ctx context.Context, p CreateMessageParams) (*domain.Message, error) {
	var messageID string
	err := db.InTx(ctx, func(tx pgx.Tx) error {
		var mediaExpires *time.Time
		if p.MediaURL != "" {
			// Media leaves hot storage after 90 days (PRD 6.6).
			t := time.Now().UTC().AddDate(0, 0, 90)
			mediaExpires = &t
		}

		// ON CONFLICT DO NOTHING rather than catching the unique violation: a
		// failed statement aborts the surrounding transaction, so the "look up
		// the original" fallback could not run inside it.
		//
		// clientId is nullable and Postgres treats NULLs as distinct, so a
		// message sent without one never conflicts.
		err := tx.QueryRow(ctx, `
			INSERT INTO "messages" ("id", "threadId", "senderId", "kind", "body", "mediaUrl",
				"mediaExpiresAt", "replyToId", "clientId", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, $3::"MessageKind", $4, $5, $6, $7, $8, now())
			ON CONFLICT ("threadId", "clientId") DO NOTHING
			RETURNING "id"`,
			p.ThreadID, p.SenderID, string(p.Kind), nullString(p.Body), nullString(p.MediaURL),
			mediaExpires, p.ReplyToID, nullString(p.ClientID)).Scan(&messageID)

		switch {
		case err == nil:
			// Inserted. Fall through and touch the thread.
		case errors.Is(mapErr(err), ErrNotFound):
			// The client is replaying a send after a reconnect. Hand back the
			// message we already stored and leave lastMessageAt alone.
			return mapErr(tx.QueryRow(ctx,
				`SELECT "id" FROM "messages" WHERE "threadId" = $1 AND "clientId" = $2`,
				p.ThreadID, p.ClientID).Scan(&messageID))
		default:
			return mapErr(err)
		}

		_, err = tx.Exec(ctx, `UPDATE "threads" SET "lastMessageAt" = now() WHERE "id" = $1`, p.ThreadID)
		return mapErr(err)
	})
	if err != nil {
		return nil, err
	}
	return db.MessageByID(ctx, messageID)
}

// MessageByID loads one message with its sender.
func (db *DB) MessageByID(ctx context.Context, id string) (*domain.Message, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT `+messageProjection+`
		FROM "messages" m
		JOIN "users" u ON u."id" = m."senderId"
		WHERE m."id" = $1`, id)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return nil, mapErr(err)
		}
		return nil, ErrNotFound
	}
	return scanMessage(rows)
}

// ListMessages returns a page of history, newest first, keyset paginated.
func (db *DB) ListMessages(ctx context.Context, threadID string, cursor *domain.Cursor, limit int) ([]*domain.Message, error) {
	limit = clampLimit(limit, 40, 100)

	args := []any{threadID}
	where := `m."threadId" = $1`
	if cursor != nil {
		args = append(args, cursor.Time, cursor.ID)
		where += fmt.Sprintf(` AND (m."createdAt", m."id") < ($%d, $%d)`, len(args)-1, len(args))
	}
	args = append(args, limit+1)

	rows, err := db.pool.Query(ctx, fmt.Sprintf(`
		SELECT %s
		FROM "messages" m
		JOIN "users" u ON u."id" = m."senderId"
		WHERE %s
		ORDER BY m."createdAt" DESC, m."id" DESC
		LIMIT $%d`, messageProjection, where, len(args)), args...)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []*domain.Message
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, mapErr(rows.Err())
}

// MarkRead moves the read cursor. Read receipts are toggleable per user
// (PRD 6.6), which the service checks before broadcasting the event.
func (db *DB) MarkRead(ctx context.Context, threadID, userID, messageID string) error {
	_, err := db.pool.Exec(ctx, `
		UPDATE "thread_members"
		SET "lastReadMessageId" = $3, "lastReadAt" = now()
		WHERE "threadId" = $1 AND "userId" = $2`, threadID, userID, nullString(messageID))
	return mapErr(err)
}

// DeleteMessage soft-deletes a message. The row survives for moderation.
func (db *DB) DeleteMessage(ctx context.Context, messageID, senderID string) error {
	tag, err := db.pool.Exec(ctx, `
		UPDATE "messages" SET "deletedAt" = now()
		WHERE "id" = $1 AND "senderId" = $2 AND "deletedAt" IS NULL`, messageID, senderID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ReadReceiptsEnabled reports a user's preference.
func (db *DB) ReadReceiptsEnabled(ctx context.Context, userID string) (bool, error) {
	var on bool
	err := db.pool.QueryRow(ctx, `SELECT "readReceiptsOn" FROM "users" WHERE "id" = $1`, userID).Scan(&on)
	return on, mapErr(err)
}
