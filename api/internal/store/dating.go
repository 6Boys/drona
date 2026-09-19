package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// ------------------------------------------------------------ profile -------

// DatingProfileByUserID returns the Love Finder card, or a zero-value one if
// the user has never saved one — that is the normal state for most accounts,
// not an error.
func (db *DB) DatingProfileByUserID(ctx context.Context, userID string) (domain.DatingProfile, error) {
	var (
		vibe      string
		interests []string
		promptsJS []byte
	)
	err := db.pool.QueryRow(ctx,
		`SELECT "vibe", "interests", "prompts" FROM "dating_profiles" WHERE "userId" = $1`, userID,
	).Scan(&vibe, &interests, &promptsJS)
	if err != nil {
		if mapErr(err) == ErrNotFound {
			return domain.DatingProfile{Interests: []string{}, Prompts: []domain.DatingPrompt{}}, nil
		}
		return domain.DatingProfile{}, mapErr(err)
	}
	return domain.DatingProfile{Vibe: vibe, Interests: interests, Prompts: decodePrompts(promptsJS)}, nil
}

// UpsertDatingProfile replaces the whole card — a Love Finder profile is
// always saved as one unit, the way it is edited.
func (db *DB) UpsertDatingProfile(ctx context.Context, userID string, p domain.DatingProfile) (domain.DatingProfile, error) {
	promptsJS, err := json.Marshal(p.Prompts)
	if err != nil {
		return domain.DatingProfile{}, err
	}
	interests := p.Interests
	if interests == nil {
		interests = []string{}
	}

	var (
		vibe      string
		outInt    []string
		outPrompt []byte
	)
	err = db.pool.QueryRow(ctx, `
		INSERT INTO "dating_profiles" ("id", "userId", "vibe", "interests", "prompts", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, now())
		ON CONFLICT ("userId") DO UPDATE
			SET "vibe" = $2, "interests" = $3, "prompts" = $4::jsonb, "updatedAt" = now()
		RETURNING "vibe", "interests", "prompts"`,
		userID, p.Vibe, interests, promptsJS,
	).Scan(&vibe, &outInt, &outPrompt)
	if err != nil {
		return domain.DatingProfile{}, mapErr(err)
	}
	return domain.DatingProfile{Vibe: vibe, Interests: outInt, Prompts: decodePrompts(outPrompt)}, nil
}

func decodePrompts(raw []byte) []domain.DatingPrompt {
	var prompts []domain.DatingPrompt
	if len(raw) > 0 {
		// A malformed prompts blob should never take down a profile view —
		// same defensive stance store/users.go takes with a bad avatar.
		_ = json.Unmarshal(raw, &prompts)
	}
	if prompts == nil {
		prompts = []domain.DatingPrompt{}
	}
	return prompts
}

// ------------------------------------------------------------ candidates ----
//
// Candidate loads stay private (*domain.UserPrivate), same as every other
// store query in this package — store never decides what a viewer is allowed
// to see, service does (via service.Public), so DOB and the rest of the
// private record pass through here exactly as SuggestFollows already does.

// CandidateRecord pairs one account with its Love Finder card.
type CandidateRecord struct {
	User    *domain.UserPrivate
	Profile domain.DatingProfile
}

// rowScanner is satisfied by both pgx.Row (QueryRow) and pgx.Rows (Query) —
// scanCandidate only ever calls Scan, so it works unchanged for a single
// lookup or a multi-row list without a second copy of the column list.
type rowScanner interface {
	Scan(dest ...any) error
}

// userCandidateColumns is userColumns plus the joined dating_profiles
// projection, in scan order — every deck/like/match query selects exactly
// this so scanCandidate never drifts from what it reads.
func userCandidateColumns(userAlias, profileAlias string) string {
	return userColumnsFor(userAlias) +
		", coalesce(" + profileAlias + `."vibe", '')` +
		", coalesce(" + profileAlias + `."interests", ARRAY[]::text[])` +
		", coalesce(" + profileAlias + `."prompts", '[]'::jsonb)`
}

// scanCandidate scans one userCandidateColumns row: the full user projection
// (see scanUser) plus the three trailing dating-profile columns.
func scanCandidate(row rowScanner) (CandidateRecord, error) {
	var (
		u          domain.UserPrivate
		bio        *string
		avatarRaw  []byte
		photoURL   *string
		dob        *time.Time
		batch      *string
		branch     *string
		year       *int32
		photoVerAt *time.Time
		emailVerAt *time.Time
		lastSeenAt *time.Time
		role       string
		status     string
		step       string
		owlRank    string
		vibe       string
		interests  []string
		promptsJS  []byte
	)
	err := row.Scan(
		&u.ID, &u.CampusID, &u.Email, &u.Handle, &u.DisplayName, &bio,
		&avatarRaw, &photoURL, &dob, &batch, &branch, &year,
		&role, &status, &u.IsPrivate, &step,
		&u.FollowerCount, &u.FollowingCount, &u.Stardust, &owlRank,
		&u.LoveFinderEnabled, &photoVerAt, &emailVerAt,
		&lastSeenAt, &u.CreatedAt,
		&vibe, &interests, &promptsJS,
	)
	if err != nil {
		return CandidateRecord{}, mapErr(err)
	}

	u.Role = domain.UserRole(role)
	u.Status = domain.UserStatus(status)
	u.OnboardingStep = domain.OnboardingStep(step)
	u.OwlRank = domain.OwlRank(owlRank)
	u.Bio = deref(bio)
	u.PhotoURL = deref(photoURL)
	u.Batch = deref(batch)
	u.Branch = deref(branch)
	u.Year = derefInt(year)
	u.DOB = dob
	u.PhotoVerifiedAt = photoVerAt
	u.EmailVerifiedAt = emailVerAt
	u.LastSeenAt = lastSeenAt
	u.PhotoVerified = photoVerAt != nil
	u.OwlRankLabel = u.OwlRank.Label()
	if len(avatarRaw) > 0 {
		if err := json.Unmarshal(avatarRaw, &u.Avatar); err != nil {
			u.Avatar = domain.Avatar{}
		}
	}

	return CandidateRecord{User: &u, Profile: domain.DatingProfile{Vibe: vibe, Interests: interests, Prompts: decodePrompts(promptsJS)}}, nil
}

// Deck returns up to limit people the viewer has never swiped on: same
// campus, opted in, photo-verified, active, and with something actually
// written on their card — everything CanUseDating checks on the *candidate's*
// side, since that gate is never only the viewer's problem.
//
// The 18+ check is left to the caller (domain.UserPrivate.IsAdultAt) rather
// than duplicated as date arithmetic here, so there stays exactly one
// implementation of "is this account an adult" in the whole codebase.
//
// ORDER BY random() is a full sort of the filtered set — correct and simple
// at a single campus's scale, not something to carry to a multi-campus
// rollout without revisiting.
func (db *DB) Deck(ctx context.Context, viewerID, campusID string, limit int) ([]CandidateRecord, error) {
	limit = clampLimit(limit, 20, 50)
	rows, err := db.pool.Query(ctx, `
		SELECT `+userCandidateColumns("u", "dp")+`
		FROM "users" u
		LEFT JOIN "dating_profiles" dp ON dp."userId" = u."id"
		WHERE u."campusId" = $1
		  AND u."id" <> $2
		  AND u."status" = 'ACTIVE'
		  AND u."loveFinderEnabled" = true
		  AND u."photoVerifiedAt" IS NOT NULL
		  -- A card with nothing written on it is a gradient and a name. Ask
		  -- for at least one answered prompt before showing someone to
		  -- anybody: it is also what makes "write your card" mean something.
		  AND jsonb_array_length(coalesce(dp."prompts", '[]'::jsonb)) > 0
		  AND NOT EXISTS (
				SELECT 1 FROM "swipes" s WHERE s."actorId" = $2 AND s."targetId" = u."id"
		  )
		  AND NOT EXISTS (
				SELECT 1 FROM "blocks" b
				WHERE (b."blockerId" = $2 AND b."blockedId" = u."id")
				   OR (b."blockerId" = u."id" AND b."blockedId" = $2)
		  )
		ORDER BY random()
		LIMIT $3`, campusID, viewerID, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	out := make([]CandidateRecord, 0, limit)
	for rows.Next() {
		rec, err := scanCandidate(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, mapErr(rows.Err())
}

// CandidateByHandle loads one person's deck-shaped card — used to render who
// a like or match is about.
func (db *DB) CandidateByHandle(ctx context.Context, handle string) (CandidateRecord, error) {
	row := db.pool.QueryRow(ctx, `
		SELECT `+userCandidateColumns("u", "dp")+`
		FROM "users" u
		LEFT JOIN "dating_profiles" dp ON dp."userId" = u."id"
		WHERE lower(u."handle") = lower($1)`, handle)
	return scanCandidate(row)
}

// ------------------------------------------------------------------ swipes --

// Swipe records one decision and, if it completes a mutual LIKE/TWINKLE,
// creates the Match in the same transaction — the two must never disagree.
// It does NOT create the Match's chat thread; that is a separate call
// (GetOrCreateNestThread + SetMatchThread) made right after, self-healingly
// retried by MatchesForUser if it never landed, rather than nested inside
// this transaction. matched reports whether this swipe was the one that
// completed the pair.
func (db *DB) Swipe(
	ctx context.Context,
	actorID, targetID string,
	action domain.SwipeAction,
	target *domain.SwipeTarget,
	note string,
	wiltsAt time.Time,
) (matchID string, matched bool, err error) {
	var targetKind *string
	var targetPromptIndex *int32
	if target != nil {
		k := string(target.Kind)
		targetKind = &k
		if target.Kind == domain.TargetPrompt && target.PromptIndex != nil {
			idx := int32(*target.PromptIndex)
			targetPromptIndex = &idx
		}
	}

	err = db.InTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			INSERT INTO "swipes" ("id", "actorId", "targetId", "action", "targetKind", "targetPromptIndex", "note", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())`,
			actorID, targetID, string(action), targetKind, targetPromptIndex, nullString(note),
		); err != nil {
			return mapErr(err)
		}

		if action == domain.SwipePass {
			return nil
		}

		var reverse string
		err := tx.QueryRow(ctx,
			`SELECT "action" FROM "swipes" WHERE "actorId" = $1 AND "targetId" = $2`,
			targetID, actorID,
		).Scan(&reverse)
		if err != nil {
			if mapErr(err) == ErrNotFound {
				return nil // they haven't swiped at all yet — no match, not an error
			}
			return mapErr(err)
		}
		if reverse != string(domain.SwipeLike) && reverse != string(domain.SwipeTwinkle) {
			return nil // they passed on the actor previously — never a match
		}

		a, b := actorID, targetID
		if b < a {
			a, b = b, a
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO "matches" ("id", "userAId", "userBId", "status", "wiltsAt", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', $3, now())
			ON CONFLICT ("userAId", "userBId") DO NOTHING
			RETURNING "id"`, a, b, wiltsAt,
		).Scan(&matchID)
		if err != nil {
			if mapErr(err) == ErrNotFound {
				return nil // ON CONFLICT DO NOTHING fired — a match already exists
			}
			return mapErr(err)
		}
		matched = true
		return nil
	})
	return matchID, matched, err
}

// SetMatchThread attaches the NEST thread a match opened, once it exists.
func (db *DB) SetMatchThread(ctx context.Context, matchID, threadID string) error {
	_, err := db.pool.Exec(ctx, `UPDATE "matches" SET "threadId" = $2 WHERE "id" = $1`, matchID, threadID)
	return mapErr(err)
}

// TwinklesUsedSince counts TWINKLE swipes at or after since — the daily
// allowance is tracked here, not trusted from the client, so clearing local
// storage can never buy a second Twinkle.
func (db *DB) TwinklesUsedSince(ctx context.Context, userID string, since time.Time) (int, error) {
	var n int
	err := db.pool.QueryRow(ctx, `
		SELECT count(*) FROM "swipes"
		WHERE "actorId" = $1 AND "action" = 'TWINKLE' AND "createdAt" >= $2`,
		userID, since,
	).Scan(&n)
	return n, mapErr(err)
}

// ------------------------------------------------------------------- likes --

// LikeRecord is one incoming swipe plus what it was about.
type LikeRecord struct {
	ID                string
	Candidate         CandidateRecord
	Action            domain.SwipeAction
	TargetKind        *domain.SwipeTargetKind
	TargetPromptIndex *int
	Note              string
	CreatedAt         time.Time
}

// IncomingLikes lists people who liked or Twinkled the viewer and have not
// been swiped back yet — the moment the viewer swipes on them (from here or
// from the ordinary deck), they drop off this list on their own, because
// that swipe is what "handling" a like means. Nothing separate to track.
func (db *DB) IncomingLikes(ctx context.Context, viewerID string, limit int) ([]LikeRecord, error) {
	limit = clampLimit(limit, 30, 100)
	rows, err := db.pool.Query(ctx, `
		SELECT s."id", s."action", s."targetKind", s."targetPromptIndex", s."note", s."createdAt",
		       `+userCandidateColumns("u", "dp")+`
		FROM "swipes" s
		JOIN "users" u ON u."id" = s."actorId"
		LEFT JOIN "dating_profiles" dp ON dp."userId" = u."id"
		WHERE s."targetId" = $1
		  AND s."action" IN ('LIKE', 'TWINKLE')
		  AND NOT EXISTS (
				SELECT 1 FROM "swipes" s2 WHERE s2."actorId" = $1 AND s2."targetId" = s."actorId"
		  )
		ORDER BY s."createdAt" DESC
		LIMIT $2`, viewerID, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	out := make([]LikeRecord, 0, limit)
	for rows.Next() {
		var (
			id                string
			action            string
			targetKind        *string
			targetPromptIndex *int32
			note              *string
			createdAt         time.Time
		)
		if err := rows.Scan(&id, &action, &targetKind, &targetPromptIndex, &note, &createdAt); err != nil {
			return nil, mapErr(err)
		}
		candidate, err := scanCandidate(rows)
		if err != nil {
			return nil, err
		}

		like := LikeRecord{
			ID:        id,
			Action:    domain.SwipeAction(action),
			Note:      deref(note),
			CreatedAt: createdAt,
			Candidate: candidate,
		}
		if targetKind != nil {
			kind := domain.SwipeTargetKind(*targetKind)
			like.TargetKind = &kind
			if targetPromptIndex != nil {
				idx := int(*targetPromptIndex)
				like.TargetPromptIndex = &idx
			}
		}
		out = append(out, like)
	}
	return out, mapErr(rows.Err())
}

// ------------------------------------------------------------------ matches -

// MatchRecord is one match plus enough of its thread to know whether it has
// wilted.
type MatchRecord struct {
	ID        string
	Candidate CandidateRecord
	ThreadID  string
	CreatedAt time.Time
	// Nil once the thread has a message — a spoken-to match does not wilt.
	WiltsAt *time.Time
	Opener  string
}

// MatchesForUser lists live matches: ones with a message ever sent, or ones
// still inside their wilt window. A silent match past wiltsAt is simply
// omitted — PRD 6.3's "wilts quietly" needs no stored state transition to be
// true from the API's point of view; nothing shows it to anyone once its
// window has closed.
func (db *DB) MatchesForUser(ctx context.Context, viewerID string, now time.Time) ([]MatchRecord, error) {
	rows, err := db.pool.Query(ctx, `
		SELECT m."id",
		       CASE WHEN m."userAId" = $1 THEN m."userBId" ELSE m."userAId" END AS "otherId",
		       m."threadId", m."createdAt", m."wiltsAt",
		       COALESCE(m."threadId" IS NOT NULL AND EXISTS (
		           SELECT 1 FROM "messages" msg WHERE msg."threadId" = m."threadId"
		       ), false) AS "hasMessage",
		       (SELECT msg2."body" FROM "messages" msg2
		         WHERE msg2."threadId" = m."threadId" ORDER BY msg2."createdAt" ASC LIMIT 1) AS "opener"
		FROM "matches" m
		WHERE (m."userAId" = $1 OR m."userBId" = $1) AND m."status" = 'ACTIVE'
		ORDER BY m."createdAt" DESC`, viewerID)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	type rawMatch struct {
		id, otherID string
		threadID    *string
		createdAt   time.Time
		wiltsAt     *time.Time
		hasMessage  bool
		opener      *string
	}

	var raw []rawMatch
	otherIDs := make([]string, 0)
	for rows.Next() {
		var r rawMatch
		if err := rows.Scan(&r.id, &r.otherID, &r.threadID, &r.createdAt, &r.wiltsAt, &r.hasMessage, &r.opener); err != nil {
			return nil, mapErr(err)
		}
		if !r.hasMessage && r.wiltsAt != nil && r.wiltsAt.Before(now) {
			continue // wilted — leave it out rather than mutate status here
		}
		raw = append(raw, r)
		otherIDs = append(otherIDs, r.otherID)
	}
	if err := rows.Err(); err != nil {
		return nil, mapErr(err)
	}
	if len(raw) == 0 {
		return []MatchRecord{}, nil
	}

	candidateRows, err := db.pool.Query(ctx, `
		SELECT `+userCandidateColumns("u", "dp")+`
		FROM "users" u
		LEFT JOIN "dating_profiles" dp ON dp."userId" = u."id"
		WHERE u."id" = ANY($1)`, otherIDs)
	if err != nil {
		return nil, mapErr(err)
	}
	defer candidateRows.Close()

	byID := make(map[string]CandidateRecord, len(otherIDs))
	for candidateRows.Next() {
		rec, err := scanCandidate(candidateRows)
		if err != nil {
			return nil, err
		}
		byID[rec.User.ID] = rec
	}
	if err := candidateRows.Err(); err != nil {
		return nil, mapErr(err)
	}

	out := make([]MatchRecord, 0, len(raw))
	for _, r := range raw {
		candidate, ok := byID[r.otherID]
		if !ok {
			continue // the other account was deleted between the two queries
		}
		m := MatchRecord{
			ID:        r.id,
			Candidate: candidate,
			ThreadID:  deref(r.threadID),
			CreatedAt: r.createdAt,
			Opener:    deref(r.opener),
		}
		if !r.hasMessage {
			m.WiltsAt = r.wiltsAt
		}
		out = append(out, m)
	}
	return out, nil
}

// Unmatch marks a match UNMATCHED. Swipes are permanent, so the pair can
// never re-enter each other's deck or match again — same as the platforms
// this borrows the feature from.
func (db *DB) Unmatch(ctx context.Context, viewerID, otherID string) error {
	tag, err := db.pool.Exec(ctx, `
		UPDATE "matches" SET "status" = 'UNMATCHED'
		WHERE "status" = 'ACTIVE'
		  AND (("userAId" = $1 AND "userBId" = $2) OR ("userAId" = $2 AND "userBId" = $1))`,
		viewerID, otherID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
