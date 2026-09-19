package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// ------------------------------------------------------------------ spaces ---

// ListSpaces returns the campus's spaces plus any global ones.
func (db *DB) ListSpaces(ctx context.Context, campusID string) ([]domain.Space, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT s."id", s."campusId", s."slug", s."name", coalesce(s."description", ''),
			coalesce(s."icon", ''), s."isDefault",
			(SELECT count(*)::int FROM "posts" p WHERE p."spaceId" = s."id" AND NOT p."isRemoved")
		FROM "spaces" s
		WHERE s."campusId" = $1 OR s."campusId" IS NULL
		ORDER BY s."isDefault" DESC, s."name" ASC`, campusID)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []domain.Space
	for rows.Next() {
		var s domain.Space
		if err := rows.Scan(&s.ID, &s.CampusID, &s.Slug, &s.Name, &s.Description,
			&s.Icon, &s.IsDefault, &s.PostCount); err != nil {
			return nil, mapErr(err)
		}
		out = append(out, s)
	}
	return out, mapErr(rows.Err())
}

// SpaceBySlug resolves a space within a campus, falling back to a global space.
func (db *DB) SpaceBySlug(ctx context.Context, campusID, slug string) (*domain.Space, error) {
	var s domain.Space
	err := db.pool.QueryRow(ctx, `
		SELECT "id", "campusId", "slug", "name", coalesce("description", ''),
			coalesce("icon", ''), "isDefault"
		FROM "spaces"
		WHERE lower("slug") = lower($2) AND ("campusId" = $1 OR "campusId" IS NULL)
		ORDER BY "campusId" NULLS LAST
		LIMIT 1`, campusID, slug).
		Scan(&s.ID, &s.CampusID, &s.Slug, &s.Name, &s.Description, &s.Icon, &s.IsDefault)
	if err != nil {
		return nil, mapErr(err)
	}
	return &s, nil
}

// CreateSpace adds a space, e.g. for a club.
func (db *DB) CreateSpace(ctx context.Context, campusID, slug, name, description, icon, createdByID string) (*domain.Space, error) {
	var s domain.Space
	err := db.pool.QueryRow(ctx, `
		INSERT INTO "spaces" ("id", "campusId", "slug", "name", "description", "icon", "createdById", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())
		RETURNING "id", "campusId", "slug", "name", coalesce("description", ''), coalesce("icon", ''), "isDefault"`,
		campusID, strings.ToLower(slug), name, nullString(description), nullString(icon), createdByID).
		Scan(&s.ID, &s.CampusID, &s.Slug, &s.Name, &s.Description, &s.Icon, &s.IsDefault)
	if err != nil {
		return nil, mapErr(err)
	}
	return &s, nil
}

// IsSpaceModerator reports whether a user can moderate a space.
func (db *DB) IsSpaceModerator(ctx context.Context, spaceID, userID string) (bool, error) {
	var ok bool
	err := db.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM "space_moderators" WHERE "spaceId" = $1 AND "userId" = $2)`,
		spaceID, userID).Scan(&ok)
	return ok, mapErr(err)
}

// ------------------------------------------------------------------- posts ---

// postProjection joins the author and space every post needs. Handles are
// always attached: the Nest has Reddit's structure but Instagram's identity.
const postProjection = `
	p."id", p."type"::text, coalesce(p."title", ''), coalesce(p."body", ''),
	coalesce(p."imageUrl", ''), coalesce(p."linkUrl", ''),
	p."score", p."commentCount", p."hotRank",
	p."isPinned", p."isLocked", p."isRemoved", p."createdAt",
	s."id", s."campusId", s."slug", s."name", coalesce(s."icon", ''),
	u."id", u."handle", u."displayName", u."avatar", coalesce(u."photoUrl", ''),
	coalesce(u."batch", ''), coalesce(u."branch", ''), u."owlRank"::text,
	coalesce(v."value", 0)`

func scanPost(rows pgx.Rows) (*domain.Post, error) {
	var (
		p         domain.Post
		postType  string
		avatarRaw []byte
		owlRank   string
	)
	err := rows.Scan(
		&p.ID, &postType, &p.Title, &p.Body, &p.ImageURL, &p.LinkURL,
		&p.Score, &p.CommentCount, &p.HotRank,
		&p.IsPinned, &p.IsLocked, &p.IsRemoved, &p.CreatedAt,
		&p.Space.ID, &p.Space.CampusID, &p.Space.Slug, &p.Space.Name, &p.Space.Icon,
		&p.Author.ID, &p.Author.Handle, &p.Author.DisplayName, &avatarRaw, &p.Author.PhotoURL,
		&p.Author.Batch, &p.Author.Branch, &owlRank,
		&p.ViewerVote,
	)
	if err != nil {
		return nil, mapErr(err)
	}
	p.Type = domain.PostType(postType)
	p.Author.OwlRank = domain.OwlRank(owlRank)
	p.Author.OwlRankLabel = p.Author.OwlRank.Label()
	if len(avatarRaw) > 0 {
		_ = json.Unmarshal(avatarRaw, &p.Author.Avatar)
	}
	p.Stickers = []domain.StickerCount{}
	return &p, nil
}

// CreatePostParams describes a new Nest entry.
type CreatePostParams struct {
	SpaceID  string
	AuthorID string
	Type     domain.PostType
	Title    string
	Body     string
	ImageURL string
	LinkURL  string
	HotRank  float64
}

// CreatePost inserts a post with its initial hot rank.
func (db *DB) CreatePost(ctx context.Context, p CreatePostParams) (string, error) {
	var id string
	err := db.pool.QueryRow(ctx, `
		INSERT INTO "posts" ("id", "spaceId", "authorId", "type", "title", "body",
			"imageUrl", "linkUrl", "score", "hotRank", "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3::"PostType", $4, $5, $6, $7, 0, $8, now(), now())
		RETURNING "id"`,
		p.SpaceID, p.AuthorID, string(p.Type), nullString(p.Title), nullString(p.Body),
		nullString(p.ImageURL), nullString(p.LinkURL), p.HotRank).Scan(&id)
	return id, mapErr(err)
}

// PostByID loads one post from the viewer's perspective.
func (db *DB) PostByID(ctx context.Context, viewerID, postID string) (*domain.Post, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT `+postProjection+`
		FROM "posts" p
		JOIN "spaces" s ON s."id" = p."spaceId"
		JOIN "users"  u ON u."id" = p."authorId"
		LEFT JOIN "post_votes" v ON v."postId" = p."id" AND v."userId" = $1::uuid
		WHERE p."id" = $2`, nullString(viewerID), postID)
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
	post, err := scanPost(rows)
	if err != nil {
		return nil, err
	}
	rows.Close()

	if err := db.attachStickers(ctx, viewerID, "POST", []*domain.Post{post}); err != nil {
		return nil, err
	}
	return post, nil
}

// FeedParams describes a feed query.
type FeedParams struct {
	ViewerID string
	CampusID string
	// Campus-scoped by default with a global toggle in the header (PRD 6.5).
	Global bool
	// Only posts from accounts the viewer follows. One graph, many surfaces.
	FollowingOnly bool
	SpaceID       string
	Sort          string // "hot" or "new"
	Cursor        *domain.Cursor
	Limit         int
}

// ListFeed returns one page of posts. Keyset pagination throughout: PRD 12 says
// cursor pagination, no offset paging, because a feed being written to while you
// scroll will skip and duplicate rows under OFFSET.
func (db *DB) ListFeed(ctx context.Context, p FeedParams) ([]*domain.Post, error) {
	limit := clampLimit(p.Limit, 20, 50)

	where := []string{`NOT p."isRemoved"`}
	args := []any{nullString(p.ViewerID)} // $1 is always the viewer
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if !p.Global {
		where = append(where, fmt.Sprintf(`(s."campusId" = %s OR s."campusId" IS NULL)`, arg(p.CampusID)))
	}
	if p.SpaceID != "" {
		where = append(where, fmt.Sprintf(`p."spaceId" = %s`, arg(p.SpaceID)))
	}
	if p.FollowingOnly && p.ViewerID != "" {
		where = append(where, fmt.Sprintf(
			`(p."authorId" = %[1]s OR EXISTS (
				SELECT 1 FROM "follows" f WHERE f."followerId" = %[1]s AND f."followeeId" = p."authorId"))`,
			arg(p.ViewerID)))
	}
	// Never show a blocked account's posts, in either direction.
	if p.ViewerID != "" {
		where = append(where, fmt.Sprintf(`NOT EXISTS (
			SELECT 1 FROM "blocks" b
			WHERE (b."blockerId" = %[1]s AND b."blockedId" = p."authorId")
			   OR (b."blockerId" = p."authorId" AND b."blockedId" = %[1]s))`, arg(p.ViewerID)))
	}

	orderBy := `p."hotRank" DESC, p."id" DESC`
	if p.Sort == "new" {
		orderBy = `p."createdAt" DESC, p."id" DESC`
	}

	if p.Cursor != nil {
		if p.Sort == "new" {
			where = append(where, fmt.Sprintf(`(p."createdAt", p."id") < (%s, %s)`,
				arg(p.Cursor.Time), arg(p.Cursor.ID)))
		} else {
			where = append(where, fmt.Sprintf(`(p."hotRank", p."id") < (%s, %s)`,
				arg(p.Cursor.Score), arg(p.Cursor.ID)))
		}
	}

	// Over-fetch by one so the caller can tell whether another page exists.
	q := fmt.Sprintf(`
		SELECT %s
		FROM "posts" p
		JOIN "spaces" s ON s."id" = p."spaceId"
		JOIN "users"  u ON u."id" = p."authorId"
		LEFT JOIN "post_votes" v ON v."postId" = p."id" AND v."userId" = $1::uuid
		WHERE %s
		ORDER BY %s
		LIMIT %s`, postProjection, strings.Join(where, " AND "), orderBy, arg(limit+1))

	rows, err := db.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var posts []*domain.Post
	for rows.Next() {
		post, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		posts = append(posts, post)
	}
	if err := rows.Err(); err != nil {
		return nil, mapErr(err)
	}
	rows.Close()

	if err := db.attachStickers(ctx, p.ViewerID, "POST", posts); err != nil {
		return nil, err
	}
	return posts, nil
}

// attachStickers fills the reaction bar for a page of posts in one query, so a
// 20-post feed costs two round trips rather than 21.
func (db *DB) attachStickers(ctx context.Context, viewerID, targetType string, posts []*domain.Post) error {
	if len(posts) == 0 {
		return nil
	}
	ids := make([]string, len(posts))
	index := make(map[string]*domain.Post, len(posts))
	for i, p := range posts {
		ids[i] = p.ID
		index[p.ID] = p
	}

	rows, err := db.pool.Query(ctx, `
		SELECT r."targetId", r."sticker"::text, count(*)::int,
			bool_or(r."userId" = $3::uuid) AS reacted
		FROM "reactions" r
		WHERE r."targetType" = $1::"ReactionTargetType" AND r."targetId" = ANY($2::uuid[])
		GROUP BY r."targetId", r."sticker"
		ORDER BY count(*) DESC`, targetType, ids, nullString(viewerID))
	if err != nil {
		return mapErr(err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			targetID string
			sticker  string
			count    int
			reacted  *bool
		)
		if err := rows.Scan(&targetID, &sticker, &count, &reacted); err != nil {
			return mapErr(err)
		}
		post, ok := index[targetID]
		if !ok {
			continue
		}
		s := domain.Sticker(sticker)
		post.Stickers = append(post.Stickers, domain.StickerCount{
			Sticker: s,
			Emoji:   s.Emoji(),
			Count:   count,
			Reacted: reacted != nil && *reacted,
		})
	}
	return mapErr(rows.Err())
}

// VotePost records or clears a vote and recomputes score plus hot rank in one
// transaction. value must be -1, 0 or +1; 0 removes the vote.
func (db *DB) VotePost(ctx context.Context, userID, postID string, value int, rank func(score int, createdAt time.Time) float64) (score int, hot float64, err error) {
	err = db.InTx(ctx, func(tx pgx.Tx) error {
		if value == 0 {
			if _, err := tx.Exec(ctx,
				`DELETE FROM "post_votes" WHERE "postId" = $1 AND "userId" = $2`, postID, userID); err != nil {
				return mapErr(err)
			}
		} else {
			if _, err := tx.Exec(ctx, `
				INSERT INTO "post_votes" ("id", "postId", "userId", "value", "createdAt")
				VALUES (gen_random_uuid(), $1, $2, $3, now())
				ON CONFLICT ("postId", "userId") DO UPDATE SET "value" = excluded."value"`,
				postID, userID, value); err != nil {
				return mapErr(err)
			}
		}

		// Recompute from the votes table. Incrementing a counter drifts the
		// moment a vote is switched from up to down.
		var createdAt time.Time
		if err := tx.QueryRow(ctx, `
			UPDATE "posts" p
			SET "score" = sub.total, "updatedAt" = now()
			FROM (SELECT coalesce(sum("value"), 0)::int AS total FROM "post_votes" WHERE "postId" = $1) sub
			WHERE p."id" = $1
			RETURNING p."score", p."createdAt"`, postID).Scan(&score, &createdAt); err != nil {
			return mapErr(err)
		}

		hot = rank(score, createdAt)
		_, err := tx.Exec(ctx, `UPDATE "posts" SET "hotRank" = $2 WHERE "id" = $1`, postID, hot)
		return mapErr(err)
	})
	return score, hot, err
}

// ReactPost toggles a sticker. Stickers deliberately do not touch score or hot
// rank — their whole purpose is a zero-risk interaction for lurkers (PRD 6.5).
func (db *DB) ReactPost(ctx context.Context, userID, postID string, sticker domain.Sticker) (added bool, err error) {
	tag, err := db.pool.Exec(ctx, `
		DELETE FROM "reactions"
		WHERE "userId" = $1 AND "targetType" = 'POST' AND "targetId" = $2
		  AND "sticker" = $3::"ReactionSticker"`, userID, postID, string(sticker))
	if err != nil {
		return false, mapErr(err)
	}
	if tag.RowsAffected() > 0 {
		return false, nil // toggled off
	}

	_, err = db.pool.Exec(ctx, `
		INSERT INTO "reactions" ("id", "userId", "targetType", "targetId", "sticker", "createdAt")
		VALUES (gen_random_uuid(), $1, 'POST', $2, $3::"ReactionSticker", now())`,
		userID, postID, string(sticker))
	if err != nil {
		return false, mapErr(err)
	}
	return true, nil
}

// RemovePost is the moderator action (remove / pin / lock — PRD 6.5).
func (db *DB) RemovePost(ctx context.Context, postID, reason string) error {
	tag, err := db.pool.Exec(ctx,
		`UPDATE "posts" SET "isRemoved" = true, "removedReason" = $2, "updatedAt" = now() WHERE "id" = $1`,
		postID, nullString(reason))
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetPostFlags pins or locks a post.
func (db *DB) SetPostFlags(ctx context.Context, postID string, pinned, locked *bool) error {
	sets := []string{`"updatedAt" = now()`}
	args := []any{postID}
	if pinned != nil {
		args = append(args, *pinned)
		sets = append(sets, fmt.Sprintf(`"isPinned" = $%d`, len(args)))
	}
	if locked != nil {
		args = append(args, *locked)
		sets = append(sets, fmt.Sprintf(`"isLocked" = $%d`, len(args)))
	}
	_, err := db.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE "posts" SET %s WHERE "id" = $1`, strings.Join(sets, ", ")), args...)
	return mapErr(err)
}

// ---------------------------------------------------------------- comments ---

// CreateComment appends a comment and bumps the post's counter.
func (db *DB) CreateComment(ctx context.Context, postID, authorID, body string, parentID *string) (string, error) {
	var id string
	err := db.InTx(ctx, func(tx pgx.Tx) error {
		depth := 0
		if parentID != nil {
			var parentDepth int
			var parentPost string
			if err := tx.QueryRow(ctx,
				`SELECT "depth", "postId" FROM "comments" WHERE "id" = $1`, *parentID).
				Scan(&parentDepth, &parentPost); err != nil {
				return mapErr(err)
			}
			if parentPost != postID {
				return fmt.Errorf("%w: parent comment belongs to another post", ErrConflict)
			}
			depth = parentDepth + 1
		}

		if err := tx.QueryRow(ctx, `
			INSERT INTO "comments" ("id", "postId", "authorId", "parentId", "body", "depth", "createdAt", "updatedAt")
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now())
			RETURNING "id"`, postID, authorID, parentID, body, depth).Scan(&id); err != nil {
			return mapErr(err)
		}

		_, err := tx.Exec(ctx,
			`UPDATE "posts" SET "commentCount" = "commentCount" + 1, "updatedAt" = now() WHERE "id" = $1`, postID)
		return mapErr(err)
	})
	return id, err
}

// ListComments returns every comment on a post, flat. The service assembles the
// tree — at campus scale a post's comments comfortably fit in one query.
func (db *DB) ListComments(ctx context.Context, viewerID, postID string, limit int) ([]domain.Comment, error) {
	limit = clampLimit(limit, 300, 1000)
	rows, err := db.pool.Query(ctx, `
		SELECT c."id", c."postId", c."parentId", c."body", c."depth", c."score",
			c."isRemoved", c."createdAt",
			u."id", u."handle", u."displayName", u."avatar", coalesce(u."photoUrl", ''),
			u."owlRank"::text, coalesce(cv."value", 0)
		FROM "comments" c
		JOIN "users" u ON u."id" = c."authorId"
		LEFT JOIN "comment_votes" cv ON cv."commentId" = c."id" AND cv."userId" = $1::uuid
		WHERE c."postId" = $2
		  AND ($1::uuid IS NULL OR NOT EXISTS (
				SELECT 1 FROM "blocks" b
				WHERE (b."blockerId" = $1::uuid AND b."blockedId" = c."authorId")
				   OR (b."blockerId" = c."authorId" AND b."blockedId" = $1::uuid)))
		ORDER BY c."depth" ASC, c."score" DESC, c."createdAt" ASC
		LIMIT $3`, nullString(viewerID), postID, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []domain.Comment
	for rows.Next() {
		var (
			c         domain.Comment
			avatarRaw []byte
			owlRank   string
		)
		if err := rows.Scan(&c.ID, &c.PostID, &c.ParentID, &c.Body, &c.Depth, &c.Score,
			&c.IsRemoved, &c.CreatedAt,
			&c.Author.ID, &c.Author.Handle, &c.Author.DisplayName, &avatarRaw, &c.Author.PhotoURL,
			&owlRank, &c.ViewerVote); err != nil {
			return nil, mapErr(err)
		}
		c.Author.OwlRank = domain.OwlRank(owlRank)
		c.Author.OwlRankLabel = c.Author.OwlRank.Label()
		if len(avatarRaw) > 0 {
			_ = json.Unmarshal(avatarRaw, &c.Author.Avatar)
		}
		if c.IsRemoved {
			c.Body = "[removed by a moderator]"
		}
		out = append(out, c)
	}
	return out, mapErr(rows.Err())
}

// VoteComment records a vote on a comment and recomputes its score.
func (db *DB) VoteComment(ctx context.Context, userID, commentID string, value int) (int, error) {
	var score int
	err := db.InTx(ctx, func(tx pgx.Tx) error {
		if value == 0 {
			if _, err := tx.Exec(ctx,
				`DELETE FROM "comment_votes" WHERE "commentId" = $1 AND "userId" = $2`, commentID, userID); err != nil {
				return mapErr(err)
			}
		} else {
			if _, err := tx.Exec(ctx, `
				INSERT INTO "comment_votes" ("id", "commentId", "userId", "value", "createdAt")
				VALUES (gen_random_uuid(), $1, $2, $3, now())
				ON CONFLICT ("commentId", "userId") DO UPDATE SET "value" = excluded."value"`,
				commentID, userID, value); err != nil {
				return mapErr(err)
			}
		}
		return mapErr(tx.QueryRow(ctx, `
			UPDATE "comments" c
			SET "score" = sub.total, "updatedAt" = now()
			FROM (SELECT coalesce(sum("value"), 0)::int AS total FROM "comment_votes" WHERE "commentId" = $1) sub
			WHERE c."id" = $1
			RETURNING c."score"`, commentID).Scan(&score))
	})
	return score, err
}

// PostAuthor returns a post's author and lock state, for permission checks.
func (db *DB) PostAuthor(ctx context.Context, postID string) (authorID string, spaceID string, locked bool, err error) {
	err = db.pool.QueryRow(ctx,
		`SELECT "authorId", "spaceId", "isLocked" FROM "posts" WHERE "id" = $1 AND NOT "isRemoved"`, postID).
		Scan(&authorID, &spaceID, &locked)
	return authorID, spaceID, locked, mapErr(err)
}
