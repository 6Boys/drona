package store

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

func TestUsers_CreateAndLoad(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()

	created, err := db.CreateUser(ctx, CreateUserParams{
		CampusID:           campusID,
		Email:              "priya@" + campusID[:8] + ".store-test.example",
		Handle:             "priya",
		DisplayName:        "Priya",
		VerificationMethod: "EMAIL_DOMAIN",
		Verified:           true,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.StatusActive, created.Status, "a verified signup is active immediately")
	assert.Equal(t, domain.RoleStudent, created.Role)
	assert.Equal(t, domain.OnboardingStep("HANDLE"), created.OnboardingStep)
	assert.NotNil(t, created.EmailVerifiedAt)

	t.Run("by id", func(t *testing.T) {
		got, err := db.UserByID(ctx, created.ID)
		require.NoError(t, err)
		assert.Equal(t, "priya", got.Handle)
	})

	t.Run("by email", func(t *testing.T) {
		got, err := db.UserByEmail(ctx, created.Email)
		require.NoError(t, err)
		assert.Equal(t, created.ID, got.ID)
	})

	t.Run("by handle, case-insensitively", func(t *testing.T) {
		got, err := db.UserByHandle(ctx, "PRIYA")
		require.NoError(t, err)
		assert.Equal(t, created.ID, got.ID)
	})

	t.Run("a missing user is ErrNotFound, not a driver error leaking out", func(t *testing.T) {
		_, err := db.UserByID(ctx, newID(t))
		assert.ErrorIs(t, err, ErrNotFound)
	})
}

func TestUsers_UnverifiedSignupIsPending(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()

	u, err := db.CreateUser(ctx, CreateUserParams{
		CampusID:    campusID,
		Email:       "pending@" + campusID[:8] + ".store-test.example",
		Handle:      "pendinguser",
		DisplayName: "Pending",
		Verified:    false,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.StatusPendingVerification, u.Status)
	assert.Nil(t, u.EmailVerifiedAt)
}

func TestUsers_DuplicateEmailIsAHardBlock(t *testing.T) {
	// PRD 6.1: duplicate email is a hard block, no account.
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()

	email := "dup@" + campusID[:8] + ".store-test.example"
	_, err := db.CreateUser(ctx, CreateUserParams{
		CampusID: campusID, Email: email, Handle: "dupone", DisplayName: "One", Verified: true,
	})
	require.NoError(t, err)

	_, err = db.CreateUser(ctx, CreateUserParams{
		CampusID: campusID, Email: email, Handle: "duptwo", DisplayName: "Two", Verified: true,
	})
	assert.ErrorIs(t, err, ErrConflict)
}

func TestUsers_HandleTaken(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()

	u := testUserRow(t, db, campusID, "takenhandle")

	taken, err := db.HandleTaken(ctx, "takenhandle", "")
	require.NoError(t, err)
	assert.True(t, taken)

	taken, err = db.HandleTaken(ctx, "TakenHandle", "")
	require.NoError(t, err)
	assert.True(t, taken, "handle checks are case-insensitive")

	t.Run("the holder itself is excluded", func(t *testing.T) {
		taken, err := db.HandleTaken(ctx, "takenhandle", u.ID)
		require.NoError(t, err)
		assert.False(t, taken, "changing your own display case should not self-conflict")
	})

	t.Run("an unclaimed handle is free", func(t *testing.T) {
		taken, err := db.HandleTaken(ctx, "totally-unclaimed-handle", "")
		require.NoError(t, err)
		assert.False(t, taken)
	})
}

func TestUsers_UpdateProfile(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "updateme")

	name := "New Name"
	bio := "new bio"
	batch := "2024-28"
	branch := "CSE"
	year := 2
	dob := time.Date(2005, 6, 1, 0, 0, 0, 0, time.UTC)

	updated, err := db.UpdateProfile(ctx, u.ID, UpdateProfileParams{
		DisplayName: &name, Bio: &bio, Batch: &batch, Branch: &branch, Year: &year, DOB: &dob,
	})
	require.NoError(t, err)
	assert.Equal(t, "New Name", updated.DisplayName)
	assert.Equal(t, "new bio", updated.Bio)
	assert.Equal(t, "2024-28", updated.Batch)
	assert.Equal(t, "CSE", updated.Branch)
	assert.Equal(t, 2, updated.Year)
	require.NotNil(t, updated.DOB)
	assert.True(t, updated.DOB.Equal(dob))

	t.Run("a partial update leaves other fields untouched", func(t *testing.T) {
		newBio := "only the bio changes"
		again, err := db.UpdateProfile(ctx, u.ID, UpdateProfileParams{Bio: &newBio})
		require.NoError(t, err)
		assert.Equal(t, "only the bio changes", again.Bio)
		assert.Equal(t, "New Name", again.DisplayName, "untouched fields must survive a partial update")
	})

	t.Run("an empty string clears an optional field to NULL, not to the literal text", func(t *testing.T) {
		empty := ""
		cleared, err := db.UpdateProfile(ctx, u.ID, UpdateProfileParams{Bio: &empty})
		require.NoError(t, err)
		assert.Empty(t, cleared.Bio)
	})
}

func TestUsers_AvatarRoundTrips(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "avataruser")

	avatar := domain.Avatar{Hat: "beanie", Eyes: "sparkle", Colour: "ube", Accessory: "scarf"}
	updated, err := db.UpdateAvatar(ctx, u.ID, avatar)
	require.NoError(t, err)
	assert.Equal(t, avatar, updated.Avatar)

	reloaded, err := db.UserByID(ctx, u.ID)
	require.NoError(t, err)
	assert.Equal(t, avatar, reloaded.Avatar, "the avatar must survive a reload from JSONB")
}

func TestUsers_PhotoVerification(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "photouser")

	require.Nil(t, u.PhotoVerifiedAt, "unverified by default")
	require.Empty(t, u.PhotoURL)

	updated, err := db.SetPhotoVerified(ctx, u.ID, "https://example.test/media/abc123.jpg")
	require.NoError(t, err)
	assert.Equal(t, "https://example.test/media/abc123.jpg", updated.PhotoURL)
	require.NotNil(t, updated.PhotoVerifiedAt)
	assert.WithinDuration(t, time.Now(), *updated.PhotoVerifiedAt, 5*time.Second)

	reloaded, err := db.UserByID(ctx, u.ID)
	require.NoError(t, err)
	require.NotNil(t, reloaded.PhotoVerifiedAt, "the gate survives a reload, not just the RETURNING row")
	assert.Equal(t, "https://example.test/media/abc123.jpg", reloaded.PhotoURL)
}

func TestUsers_OnboardingStep(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "onboarduser")

	require.NoError(t, db.SetOnboardingStep(ctx, u.ID, domain.StepDone))
	reloaded, err := db.UserByID(ctx, u.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.StepDone, reloaded.OnboardingStep)

	t.Run("an unknown user is ErrNotFound", func(t *testing.T) {
		err := db.SetOnboardingStep(ctx, newID(t), domain.StepDone)
		assert.ErrorIs(t, err, ErrNotFound)
	})
}

func TestUsers_AddStardust_BalanceAndLedgerAgree(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "stardustuser")

	balance, err := db.AddStardust(ctx, u.ID, 250, domain.StardustCocoonBonus, "day-1")
	require.NoError(t, err)
	assert.Equal(t, 250, balance)

	balance, err = db.AddStardust(ctx, u.ID, 40, domain.StardustNoteUpload, "note-1")
	require.NoError(t, err)
	assert.Equal(t, 290, balance, "stardust accumulates rather than replacing the balance")

	reloaded, err := db.UserByID(ctx, u.ID)
	require.NoError(t, err)
	assert.Equal(t, 290, reloaded.Stardust, "the cached balance on the user row must agree with the ledger")
}

func TestUsers_SuggestFollows_OrdersByAffinityThenExcludesTheObvious(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()

	viewer := testUserRow(t, db, campusID, "viewer1")
	sameBoth := testUserRow(t, db, campusID, "samebranchbatch")
	sameBranch := testUserRow(t, db, campusID, "samebranchonly")
	noMatch := testUserRow(t, db, campusID, "nomatch")
	alreadyFollowed := testUserRow(t, db, campusID, "alreadyfollowed")
	blocked := testUserRow(t, db, campusID, "blockeduser")

	batch, branch := "2024-28", "CSE"
	_, err := db.UpdateProfile(ctx, viewer.ID, UpdateProfileParams{Batch: &batch, Branch: &branch})
	require.NoError(t, err)
	_, err = db.UpdateProfile(ctx, sameBoth.ID, UpdateProfileParams{Batch: &batch, Branch: &branch})
	require.NoError(t, err)
	_, err = db.UpdateProfile(ctx, sameBranch.ID, UpdateProfileParams{Branch: &branch})
	require.NoError(t, err)

	_, err = db.Follow(ctx, viewer.ID, alreadyFollowed.ID)
	require.NoError(t, err)
	require.NoError(t, db.Block(ctx, viewer.ID, blocked.ID))

	suggestions, err := db.SuggestFollows(ctx, viewer.ID, campusID, 10)
	require.NoError(t, err)

	var ids []string
	for _, s := range suggestions {
		ids = append(ids, s.ID)
	}
	assert.NotContains(t, ids, viewer.ID, "never suggest yourself")
	assert.NotContains(t, ids, alreadyFollowed.ID, "never re-suggest someone already followed")
	assert.NotContains(t, ids, blocked.ID, "never suggest a blocked account")
	assert.Contains(t, ids, sameBoth.ID)
	assert.Contains(t, ids, sameBranch.ID)
	assert.Contains(t, ids, noMatch.ID, "even a zero-affinity account is still a candidate")

	// Highest affinity (same branch AND batch) sorts before lower affinity.
	posOf := func(id string) int {
		for i, x := range ids {
			if x == id {
				return i
			}
		}
		return -1
	}
	assert.Less(t, posOf(sameBoth.ID), posOf(sameBranch.ID), "same branch+batch should rank above same branch only")
	assert.Less(t, posOf(sameBranch.ID), posOf(noMatch.ID), "same branch should rank above no match")
}

func TestCampus_EnsureIsIdempotent(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	suffix := newID(t)[:8]
	domainName := "ensure-" + suffix + ".example"

	id1, err := db.EnsureCampus(ctx, domainName, "Ensure Test", "ensure-test-"+suffix)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = db.pool.Exec(context.Background(), `DELETE FROM "campuses" WHERE "id" = $1`, id1)
	})

	id2, err := db.EnsureCampus(ctx, domainName, "Ensure Test", "ensure-test-"+suffix)
	require.NoError(t, err)
	assert.Equal(t, id1, id2, "the same domain must resolve to the same campus, not a duplicate")
}

func TestOTP_LifecycleWithAttemptsAndConsumption(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	email := "otp-" + newID(t)[:8] + "@store-test.example"

	rec, err := db.CreateOTP(ctx, email, "somehash", "SIGNUP", time.Now().Add(10*time.Minute))
	require.NoError(t, err)
	assert.False(t, rec.Consumed)
	assert.Equal(t, 0, rec.Attempts)

	latest, err := db.LatestOTP(ctx, email, "SIGNUP")
	require.NoError(t, err)
	assert.Equal(t, rec.ID, latest.ID)

	attempts, err := db.BumpOTPAttempts(ctx, rec.ID)
	require.NoError(t, err)
	assert.Equal(t, 1, attempts)
	attempts, err = db.BumpOTPAttempts(ctx, rec.ID)
	require.NoError(t, err)
	assert.Equal(t, 2, attempts)

	require.NoError(t, db.ConsumeOTP(ctx, rec.ID))

	t.Run("a consumed code no longer counts as latest-unconsumed", func(t *testing.T) {
		_, err := db.LatestOTP(ctx, email, "SIGNUP")
		assert.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("consuming twice is not silently allowed a second time", func(t *testing.T) {
		err := db.ConsumeOTP(ctx, rec.ID)
		assert.ErrorIs(t, err, ErrNotFound, "the second consume must be observably a no-op, not a fresh success")
	})
}

func TestRefreshTokens_RotationAndRevocation(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "refreshuser")

	hash := "hash-" + newID(t)
	require.NoError(t, db.StoreRefreshToken(ctx, u.ID, hash, "test-agent", "127.0.0.1", time.Now().Add(time.Hour)))

	owner, _, err := db.RefreshTokenOwner(ctx, hash)
	require.NoError(t, err)
	assert.Equal(t, u.ID, owner)

	require.NoError(t, db.RevokeRefreshToken(ctx, hash))

	t.Run("a revoked token is dead", func(t *testing.T) {
		_, _, err := db.RefreshTokenOwner(ctx, hash)
		assert.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("an expired token is dead even if never revoked", func(t *testing.T) {
		expiredHash := "expired-" + newID(t)
		require.NoError(t, db.StoreRefreshToken(ctx, u.ID, expiredHash, "", "", time.Now().Add(-time.Hour)))
		_, _, err := db.RefreshTokenOwner(ctx, expiredHash)
		assert.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("revoke-all kills every session", func(t *testing.T) {
		h1, h2 := "multi1-"+newID(t), "multi2-"+newID(t)
		require.NoError(t, db.StoreRefreshToken(ctx, u.ID, h1, "", "", time.Now().Add(time.Hour)))
		require.NoError(t, db.StoreRefreshToken(ctx, u.ID, h2, "", "", time.Now().Add(time.Hour)))

		require.NoError(t, db.RevokeAllRefreshTokens(ctx, u.ID))

		_, _, err1 := db.RefreshTokenOwner(ctx, h1)
		_, _, err2 := db.RefreshTokenOwner(ctx, h2)
		assert.ErrorIs(t, err1, ErrNotFound)
		assert.ErrorIs(t, err2, ErrNotFound)
	})
}

func TestDevices_UpsertIsIdempotentPerUser(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "deviceuser")

	id1, err := db.UpsertDevice(ctx, u.ID, "fingerprint-abc", "web")
	require.NoError(t, err)

	id2, err := db.UpsertDevice(ctx, u.ID, "fingerprint-abc", "web")
	require.NoError(t, err)
	assert.Equal(t, id1, id2, "the same fingerprint for the same user must resolve to the same device row")

	other := testUserRow(t, db, campusID, "deviceuser2")
	id3, err := db.UpsertDevice(ctx, other.ID, "fingerprint-abc", "web")
	require.NoError(t, err)
	assert.NotEqual(t, id1, id3, "the same fingerprint on a different account is a different device row")
}

// TestRefreshTokens_ExpiryIsCorrectRegardlessOfCallerTimezone is a regression
// test for a real bug: pgx encodes a time.Time into a bare TIMESTAMP column
// using its wall-clock digits as given, not its UTC-converted instant. A caller
// running on a non-UTC host (this one, IST/+05:30) that passed a Local-zoned
// "now" straight through used to store a refresh token that appeared to remain
// valid for hours after RevokeRefreshToken/expiry should have killed it,
// because Postgres's own now() (correctly UTC) was being compared against a
// value that had silently drifted forward by the host's UTC offset.
//
// The fix lives in StoreRefreshToken itself (a .UTC() call before binding), so
// this test deliberately hands it a non-UTC time.Time to prove the store, not
// just a disciplined caller, is what keeps this correct.
func TestRefreshTokens_ExpiryIsCorrectRegardlessOfCallerTimezone(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "tzrefreshuser")

	ist, err := time.LoadLocation("Asia/Kolkata")
	require.NoError(t, err, "this test needs the tzdata package; it is not testing tzdata itself")

	t.Run("a token issued to expire in the past, in a non-UTC zone, is already dead", func(t *testing.T) {
		hash := "tz-expired-" + newID(t)
		// "One hour ago" as measured in Kolkata — a real instant in the past,
		// regardless of what clock produced it.
		expiresAt := time.Now().In(ist).Add(-time.Hour)

		require.NoError(t, db.StoreRefreshToken(ctx, u.ID, hash, "", "", expiresAt))

		_, _, err := db.RefreshTokenOwner(ctx, hash)
		assert.ErrorIs(t, err, ErrNotFound,
			"a token that expired an hour ago must be dead no matter what timezone said so")
	})

	t.Run("a token issued to expire in the future, in a non-UTC zone, is still alive", func(t *testing.T) {
		hash := "tz-future-" + newID(t)
		expiresAt := time.Now().In(ist).Add(time.Hour)

		require.NoError(t, db.StoreRefreshToken(ctx, u.ID, hash, "", "", expiresAt))

		owner, _, err := db.RefreshTokenOwner(ctx, hash)
		require.NoError(t, err, "a token an hour from now must still be usable")
		assert.Equal(t, u.ID, owner)
	})

	t.Run("the same instant is treated identically whichever zone it arrives labelled in", func(t *testing.T) {
		instant := time.Now().Add(30 * time.Minute)
		hashUTC := "tz-same-utc-" + newID(t)
		hashIST := "tz-same-ist-" + newID(t)

		require.NoError(t, db.StoreRefreshToken(ctx, u.ID, hashUTC, "", "", instant.UTC()))
		require.NoError(t, db.StoreRefreshToken(ctx, u.ID, hashIST, "", "", instant.In(ist)))

		_, _, errUTC := db.RefreshTokenOwner(ctx, hashUTC)
		_, _, errIST := db.RefreshTokenOwner(ctx, hashIST)
		assert.NoError(t, errUTC)
		assert.NoError(t, errIST, "the IST-labelled version of the exact same instant must behave identically")
	})
}

// TestOTP_ExpiryIsCorrectRegardlessOfCallerTimezone is the same regression,
// for CreateOTP's expiresAt.
func TestOTP_ExpiryIsCorrectRegardlessOfCallerTimezone(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	email := "tzotp-" + newID(t)[:8] + "@store-test.example"

	ist, err := time.LoadLocation("Asia/Kolkata")
	require.NoError(t, err)

	// "10 minutes from now" as measured in Kolkata.
	expiresAt := time.Now().In(ist).Add(10 * time.Minute)
	rec, err := db.CreateOTP(ctx, email, "somehash", "SIGNUP", expiresAt)
	require.NoError(t, err)

	// Read the row back and compare it against Postgres's own now(), the same
	// way a future SQL-side cleanup job or expiry check would. It must still
	// read as roughly 10 minutes out — not-quite-5.5-hours out.
	var secondsRemaining float64
	require.NoError(t, db.pool.QueryRow(ctx,
		`SELECT extract(epoch FROM ("expiresAt" - now())) FROM "email_otps" WHERE "id" = $1`,
		rec.ID).Scan(&secondsRemaining))

	assert.InDelta(t, 600, secondsRemaining, 30,
		"a 10-minute OTP must expire in about 10 minutes of Postgres's own clock, "+
			"not 10 minutes plus the caller's UTC offset")
}
