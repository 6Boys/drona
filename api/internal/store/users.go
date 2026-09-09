package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// userColumns is the canonical projection. Every user scan uses it so the
// column order can never drift between queries.
// userColumnNames is the canonical user projection, in scan order. Every user
// query builds its SELECT list from this so the column order can never drift
// between queries and scanUser.
//
// Enums are cast to text: Postgres enum OIDs are not known to pgx, and an
// explicit cast is clearer than relying on the driver's fallback.
var userColumnNames = []string{
	`"id"`, `"campusId"`, `"email"`, `"handle"`, `"displayName"`, `"bio"`,
	`"avatar"`, `"photoUrl"`, `"dob"`, `"batch"`, `"branch"`, `"year"`,
	`"role"::text`, `"status"::text`, `"isPrivate"`, `"onboardingStep"`,
	`"followerCount"`, `"followingCount"`, `"stardust"`, `"owlRank"::text`,
	`"loveFinderEnabled"`, `"photoVerifiedAt"`, `"emailVerifiedAt"`,
	`"lastSeenAt"`, `"createdAt"`,
}

// userColumns is the unqualified projection, for single-table queries and for
// INSERT/UPDATE ... RETURNING, where a table alias is not in scope.
var userColumns = strings.Join(userColumnNames, ", ")

// userColumnsFor qualifies the projection with a table alias. Required whenever
// the query joins another table that also has an "id" column — an unqualified
// "id" in that position is ambiguous and Postgres rejects the statement.
func userColumnsFor(alias string) string {
	qualified := make([]string, len(userColumnNames))
	for i, col := range userColumnNames {
		qualified[i] = alias + "." + col
	}
	return strings.Join(qualified, ", ")
}

func scanUser(row pgx.Row) (*domain.UserPrivate, error) {
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
	)

	err := row.Scan(
		&u.ID, &u.CampusID, &u.Email, &u.Handle, &u.DisplayName, &bio,
		&avatarRaw, &photoURL, &dob, &batch, &branch, &year,
		&role, &status, &u.IsPrivate, &step,
		&u.FollowerCount, &u.FollowingCount, &u.Stardust, &owlRank,
		&u.LoveFinderEnabled, &photoVerAt, &emailVerAt,
		&lastSeenAt, &u.CreatedAt,
	)
	if err != nil {
		return nil, mapErr(err)
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
			// A malformed avatar should never take down a profile view.
			u.Avatar = domain.Avatar{}
		}
	}
	return &u, nil
}

// CreateUserParams is what the OTP flow knows at account creation time: an
// address and whether the domain verified it.
type CreateUserParams struct {
	CampusID           string
	Email              string
	Handle             string
	DisplayName        string
	VerificationMethod string
	Verified           bool
}

// CreateUser inserts a pending account. The handle is provisional — onboarding
// replaces it — but it must be unique from the first insert.
func (db *DB) CreateUser(ctx context.Context, p CreateUserParams) (*domain.UserPrivate, error) {
	now := time.Now().UTC()
	status := domain.StatusPendingVerification
	var verifiedAt *time.Time
	if p.Verified {
		status = domain.StatusActive
		verifiedAt = &now
	}

	row := db.pool.QueryRow(ctx, `
		INSERT INTO "users" ("id", "campusId", "email", "handle", "displayName",
			"avatar", "role", "status", "verificationMethod", "emailVerifiedAt",
			"onboardingStep", "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, '{}'::jsonb, 'STUDENT', $5::"UserStatus",
			$6::"VerificationMethod", $7, $8, $9, $9)
		RETURNING `+userColumns,
		p.CampusID, p.Email, p.Handle, p.DisplayName, string(status),
		nullString(p.VerificationMethod), verifiedAt, string(domain.StepHandle), now)

	return scanUser(row)
}

// UserByID loads one account.
func (db *DB) UserByID(ctx context.Context, id string) (*domain.UserPrivate, error) {
	return scanUser(db.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM "users" WHERE "id" = $1`, id))
}

// UserByEmail loads by address. The caller normalises first.
func (db *DB) UserByEmail(ctx context.Context, email string) (*domain.UserPrivate, error) {
	return scanUser(db.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM "users" WHERE "email" = $1`, email))
}

// UserByHandle loads by handle, case-insensitively.
func (db *DB) UserByHandle(ctx context.Context, handle string) (*domain.UserPrivate, error) {
	return scanUser(db.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM "users" WHERE lower("handle") = lower($1)`, handle))
}

// HandleTaken reports whether a handle is claimed by someone other than exceptID.
// exceptID may be empty, in which case any holder counts.
func (db *DB) HandleTaken(ctx context.Context, handle, exceptID string) (bool, error) {
	var exists bool
	err := db.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM "users"
			WHERE lower("handle") = lower($1)
			  AND ($2::uuid IS NULL OR "id" <> $2::uuid)
		)`, handle, nullString(exceptID)).Scan(&exists)
	return exists, mapErr(err)
}

// UpdateProfileParams carries the onboarding profile step. Nil means "leave it".
type UpdateProfileParams struct {
	Handle      *string
	DisplayName *string
	Bio         *string
	DOB         *time.Time
	Batch       *string
	Branch      *string
	Year        *int
	IsPrivate   *bool
}

// UpdateProfile applies a partial profile update.
func (db *DB) UpdateProfile(ctx context.Context, userID string, p UpdateProfileParams) (*domain.UserPrivate, error) {
	sets := []string{`"updatedAt" = now()`}
	args := []any{userID}
	add := func(col string, val any) {
		args = append(args, val)
		sets = append(sets, fmt.Sprintf(`%q = $%d`, col, len(args)))
	}

	if p.Handle != nil {
		add("handle", *p.Handle)
	}
	if p.DisplayName != nil {
		add("displayName", *p.DisplayName)
	}
	if p.Bio != nil {
		add("bio", nullString(*p.Bio))
	}
	if p.DOB != nil {
		add("dob", *p.DOB)
	}
	if p.Batch != nil {
		add("batch", nullString(*p.Batch))
	}
	if p.Branch != nil {
		add("branch", nullString(*p.Branch))
	}
	if p.Year != nil {
		add("year", int32(*p.Year))
	}
	if p.IsPrivate != nil {
		add("isPrivate", *p.IsPrivate)
	}

	q := fmt.Sprintf(`UPDATE "users" SET %s WHERE "id" = $1 RETURNING %s`,
		strings.Join(sets, ", "), userColumns)
	return scanUser(db.pool.QueryRow(ctx, q, args...))
}

// UpdateAvatar stores the Dronu character (PRD 6.1).
func (db *DB) UpdateAvatar(ctx context.Context, userID string, avatar domain.Avatar) (*domain.UserPrivate, error) {
	raw, err := json.Marshal(avatar)
	if err != nil {
		return nil, fmt.Errorf("encode avatar: %w", err)
	}
	return scanUser(db.pool.QueryRow(ctx,
		`UPDATE "users" SET "avatar" = $2::jsonb, "updatedAt" = now()
		 WHERE "id" = $1 RETURNING `+userColumns, userID, raw))
}

// SetOnboardingStep advances (or completes) onboarding.
func (db *DB) SetOnboardingStep(ctx context.Context, userID string, step domain.OnboardingStep) error {
	tag, err := db.pool.Exec(ctx,
		`UPDATE "users" SET "onboardingStep" = $2, "updatedAt" = now() WHERE "id" = $1`,
		userID, string(step))
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetLoveFinderEnabled flips the dating opt-in (PRD 6.3 — off by default).
func (db *DB) SetLoveFinderEnabled(ctx context.Context, userID string, on bool) error {
	_, err := db.pool.Exec(ctx,
		`UPDATE "users" SET "loveFinderEnabled" = $2, "updatedAt" = now() WHERE "id" = $1`,
		userID, on)
	return mapErr(err)
}

// TouchLastSeen records presence. Cheap enough to call on every authed request.
func (db *DB) TouchLastSeen(ctx context.Context, userID string) error {
	_, err := db.pool.Exec(ctx, `UPDATE "users" SET "lastSeenAt" = now() WHERE "id" = $1`, userID)
	return mapErr(err)
}

// AddStardust moves the balance and writes the ledger row in one transaction,
// so the balance and its audit trail can never disagree.
func (db *DB) AddStardust(ctx context.Context, userID string, delta int, reason domain.StardustReason, refID string) (int, error) {
	var balance int
	err := db.InTx(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx,
			`UPDATE "users" SET "stardust" = "stardust" + $2, "updatedAt" = now()
			 WHERE "id" = $1 RETURNING "stardust"`, userID, delta).Scan(&balance); err != nil {
			return mapErr(err)
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO "stardust_ledger" ("id", "userId", "delta", "reason", "refId", "balanceAfter", "createdAt")
			VALUES (gen_random_uuid(), $1, $2, $3::"StardustReason", $4, $5, now())`,
			userID, delta, string(reason), nullString(refID), balance)
		return mapErr(err)
	})
	return balance, err
}

// SetOwlRank writes the cached rank shown on profiles.
func (db *DB) SetOwlRank(ctx context.Context, userID string, rank domain.OwlRank) error {
	_, err := db.pool.Exec(ctx,
		`UPDATE "users" SET "owlRank" = $2::"OwlRank", "updatedAt" = now() WHERE "id" = $1`,
		userID, string(rank))
	return mapErr(err)
}

// CampusByEmailDomain resolves the campus for an address domain.
func (db *DB) CampusByEmailDomain(ctx context.Context, domainName string) (id, name string, err error) {
	err = db.pool.QueryRow(ctx,
		`SELECT "id", "name" FROM "campuses" WHERE lower("emailDomain") = lower($1)`, domainName).
		Scan(&id, &name)
	return id, name, mapErr(err)
}

// EnsureCampus finds or creates a campus for a domain, so the very first signup
// on a new campus does not 500.
func (db *DB) EnsureCampus(ctx context.Context, domainName, name, slug string) (string, error) {
	var id string
	err := db.pool.QueryRow(ctx, `
		INSERT INTO "campuses" ("id", "name", "slug", "emailDomain", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, now())
		ON CONFLICT ("emailDomain") DO UPDATE SET "name" = "campuses"."name"
		RETURNING "id"`, name, slug, strings.ToLower(domainName)).Scan(&id)
	return id, mapErr(err)
}

// CampusVerifiedCount counts active accounts, which is what gates Love Finder
// (PRD 6.3: dating unlocks only above N verified campus users).
func (db *DB) CampusVerifiedCount(ctx context.Context, campusID string) (int, error) {
	var n int
	err := db.pool.QueryRow(ctx,
		`SELECT count(*) FROM "users" WHERE "campusId" = $1 AND "status" = 'ACTIVE'`, campusID).Scan(&n)
	return n, mapErr(err)
}

// RecountCampusVerified refreshes the denormalised counter on the campus row.
func (db *DB) RecountCampusVerified(ctx context.Context, campusID string) (int, error) {
	var n int
	err := db.pool.QueryRow(ctx, `
		UPDATE "campuses" c
		SET "verifiedUserCount" = sub.n
		FROM (SELECT count(*)::int AS n FROM "users" WHERE "campusId" = $1 AND "status" = 'ACTIVE') sub
		WHERE c."id" = $1
		RETURNING c."verifiedUserCount"`, campusID).Scan(&n)
	return n, mapErr(err)
}

// SuggestFollows seeds the follow-8 gate: same batch and branch first, then the
// campus's most-followed accounts (PRD 6.1).
func (db *DB) SuggestFollows(ctx context.Context, userID, campusID string, limit int) ([]*domain.UserPrivate, error) {
	limit = clampLimit(limit, 12, 50)
	rows, err := db.pool.Query(ctx, `
		WITH me AS (SELECT "batch", "branch" FROM "users" WHERE "id" = $1)
		SELECT `+userColumns+`,
			CASE
				WHEN u."branch" = (SELECT "branch" FROM me) AND u."batch" = (SELECT "batch" FROM me) THEN 0
				WHEN u."branch" = (SELECT "branch" FROM me) THEN 1
				WHEN u."batch"  = (SELECT "batch"  FROM me) THEN 2
				ELSE 3
			END AS affinity
		FROM "users" u
		WHERE u."campusId" = $2
		  AND u."id" <> $1
		  AND u."status" = 'ACTIVE'
		  AND NOT EXISTS (
				SELECT 1 FROM "follows" f WHERE f."followerId" = $1 AND f."followeeId" = u."id"
		  )
		  AND NOT EXISTS (
				SELECT 1 FROM "blocks" b
				WHERE (b."blockerId" = $1 AND b."blockedId" = u."id")
				   OR (b."blockerId" = u."id" AND b."blockedId" = $1)
		  )
		ORDER BY affinity ASC, u."followerCount" DESC, u."createdAt" ASC
		LIMIT $3`, userID, campusID, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var out []*domain.UserPrivate
	for rows.Next() {
		// The extra affinity column is discarded; scanUser reads the first 25.
		u, err := scanUserWithExtra(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, mapErr(rows.Err())
}

// scanUserWithExtra scans the user projection plus one trailing sort column.
func scanUserWithExtra(rows pgx.Rows) (*domain.UserPrivate, error) {
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
		affinity   int
	)
	err := rows.Scan(
		&u.ID, &u.CampusID, &u.Email, &u.Handle, &u.DisplayName, &bio,
		&avatarRaw, &photoURL, &dob, &batch, &branch, &year,
		&role, &status, &u.IsPrivate, &step,
		&u.FollowerCount, &u.FollowingCount, &u.Stardust, &owlRank,
		&u.LoveFinderEnabled, &photoVerAt, &emailVerAt,
		&lastSeenAt, &u.CreatedAt, &affinity,
	)
	if err != nil {
		return nil, mapErr(err)
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
		_ = json.Unmarshal(avatarRaw, &u.Avatar)
	}
	return &u, nil
}

// SearchUsers does a prefix search on handle and display name.
func (db *DB) SearchUsers(ctx context.Context, campusID, q string, limit int) ([]*domain.UserPrivate, error) {
	limit = clampLimit(limit, 20, 50)
	pattern := strings.ToLower(strings.TrimSpace(q)) + "%"
	rows, err := db.pool.Query(ctx, `
		SELECT `+userColumns+`
		FROM "users" u
		WHERE u."campusId" = $1 AND u."status" = 'ACTIVE'
		  AND (lower(u."handle") LIKE $2 OR lower(u."displayName") LIKE $2)
		ORDER BY u."followerCount" DESC, u."handle" ASC
		LIMIT $3`, campusID, pattern, limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	return collectUsers(rows)
}

func collectUsers(rows pgx.Rows) ([]*domain.UserPrivate, error) {
	var out []*domain.UserPrivate
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	if err := rows.Err(); err != nil {
		return nil, mapErr(err)
	}
	return out, nil
}

// ---------------------------------------------------------------- OTP ---------

// OTPRecord is a stored one-time code.
type OTPRecord struct {
	ID        string
	Email     string
	CodeHash  string
	Purpose   string
	Attempts  int
	ExpiresAt time.Time
	Consumed  bool
	CreatedAt time.Time
}

// CreateOTP stores a hashed code.
func (db *DB) CreateOTP(ctx context.Context, email, codeHash, purpose string, expiresAt time.Time) (*OTPRecord, error) {
	rec := &OTPRecord{}
	var consumedAt *time.Time
	err := db.pool.QueryRow(ctx, `
		INSERT INTO "email_otps" ("id", "email", "codeHash", "purpose", "expiresAt", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3::"OtpPurpose", $4, now())
		RETURNING "id", "email", "codeHash", "purpose"::text, "attempts", "expiresAt", "consumedAt", "createdAt"`,
		// .UTC() is not cosmetic: the "expiresAt" column is a bare TIMESTAMP with
		// no timezone, and pgx encodes it from the time.Time's wall-clock digits
		// as given — it does not convert to UTC first. A caller running on a
		// host set to IST (or anything but UTC) would otherwise silently store a
		// code that is valid for OTP_TTL *plus* the host's UTC offset.
		email, codeHash, purpose, expiresAt.UTC()).
		Scan(&rec.ID, &rec.Email, &rec.CodeHash, &rec.Purpose, &rec.Attempts, &rec.ExpiresAt, &consumedAt, &rec.CreatedAt)
	if err != nil {
		return nil, mapErr(err)
	}
	rec.Consumed = consumedAt != nil
	return rec, nil
}

// LatestOTP returns the newest unconsumed code for an address.
func (db *DB) LatestOTP(ctx context.Context, email, purpose string) (*OTPRecord, error) {
	rec := &OTPRecord{}
	var consumedAt *time.Time
	err := db.pool.QueryRow(ctx, `
		SELECT "id", "email", "codeHash", "purpose"::text, "attempts", "expiresAt", "consumedAt", "createdAt"
		FROM "email_otps"
		WHERE "email" = $1 AND "purpose" = $2::"OtpPurpose" AND "consumedAt" IS NULL
		ORDER BY "createdAt" DESC
		LIMIT 1`, email, purpose).
		Scan(&rec.ID, &rec.Email, &rec.CodeHash, &rec.Purpose, &rec.Attempts, &rec.ExpiresAt, &consumedAt, &rec.CreatedAt)
	if err != nil {
		return nil, mapErr(err)
	}
	rec.Consumed = consumedAt != nil
	return rec, nil
}

// BumpOTPAttempts increments the attempt counter and returns the new value.
func (db *DB) BumpOTPAttempts(ctx context.Context, id string) (int, error) {
	var attempts int
	err := db.pool.QueryRow(ctx,
		`UPDATE "email_otps" SET "attempts" = "attempts" + 1 WHERE "id" = $1 RETURNING "attempts"`, id).
		Scan(&attempts)
	return attempts, mapErr(err)
}

// ConsumeOTP marks a code used. It is a no-op the second time, which is what
// makes verify idempotent under a double-tap.
func (db *DB) ConsumeOTP(ctx context.Context, id string) error {
	tag, err := db.pool.Exec(ctx,
		`UPDATE "email_otps" SET "consumedAt" = now() WHERE "id" = $1 AND "consumedAt" IS NULL`, id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------------------------------------------------- refresh tokens ---------

// StoreRefreshToken persists the hash of a refresh credential.
func (db *DB) StoreRefreshToken(ctx context.Context, userID, hash, userAgent, ip string, expiresAt time.Time) error {
	_, err := db.pool.Exec(ctx, `
		INSERT INTO "refresh_tokens" ("id", "userId", "tokenHash", "userAgent", "ip", "expiresAt", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
		// .UTC() matters here: this expiresAt is compared against Postgres's own
		// now() in RefreshTokenOwner below. "expiresAt" is a bare TIMESTAMP with
		// no timezone, and pgx encodes a time.Time's wall-clock digits as given,
		// not its UTC-converted instant — so a caller on a non-UTC host would
		// otherwise store a token that outlives REFRESH_TTL by the host's offset,
		// or on a negative-offset host, one that expires early.
		userID, hash, nullString(userAgent), nullString(ip), expiresAt.UTC())
	return mapErr(err)
}

// RefreshTokenOwner resolves a refresh hash to its user, rejecting expired and
// revoked rows.
func (db *DB) RefreshTokenOwner(ctx context.Context, hash string) (userID, tokenID string, err error) {
	err = db.pool.QueryRow(ctx, `
		SELECT "userId", "id" FROM "refresh_tokens"
		WHERE "tokenHash" = $1 AND "revokedAt" IS NULL AND "expiresAt" > now()`, hash).
		Scan(&userID, &tokenID)
	return userID, tokenID, mapErr(err)
}

// RevokeRefreshToken revokes one credential. Rotation calls this on the old one.
func (db *DB) RevokeRefreshToken(ctx context.Context, hash string) error {
	_, err := db.pool.Exec(ctx,
		`UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "tokenHash" = $1 AND "revokedAt" IS NULL`, hash)
	return mapErr(err)
}

// RevokeAllRefreshTokens signs a user out everywhere.
func (db *DB) RevokeAllRefreshTokens(ctx context.Context, userID string) error {
	_, err := db.pool.Exec(ctx,
		`UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "userId" = $1 AND "revokedAt" IS NULL`, userID)
	return mapErr(err)
}

// UpsertDevice records a device fingerprint, used for Owl Board dedupe and ban
// evasion (PRD 6.2, 10).
func (db *DB) UpsertDevice(ctx context.Context, userID, fingerprint, platform string) (string, error) {
	if fingerprint == "" {
		return "", errors.New("fingerprint is required")
	}
	var id string
	err := db.pool.QueryRow(ctx, `
		INSERT INTO "devices" ("id", "userId", "fingerprint", "platform", "lastSeenAt", "createdAt")
		VALUES (gen_random_uuid(), $1, $2, $3, now(), now())
		ON CONFLICT ("userId", "fingerprint")
		DO UPDATE SET "lastSeenAt" = now()
		RETURNING "id"`, userID, fingerprint, nullString(platform)).Scan(&id)
	return id, mapErr(err)
}
