package store

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// datingUser makes an account that passes every candidate-side deck filter:
// active, opted in, photo-verified, and an adult.
func datingUser(t *testing.T, db *DB, campusID, handle string) *domain.UserPrivate {
	t.Helper()
	ctx := context.Background()
	u := testUserRow(t, db, campusID, handle)

	_, err := db.SetPhotoVerified(ctx, u.ID, "/media/"+handle+".jpg")
	require.NoError(t, err)
	require.NoError(t, db.SetLoveFinderEnabled(ctx, u.ID, true))

	dob := time.Now().AddDate(-21, 0, 0)
	_, err = db.UpdateProfile(ctx, u.ID, UpdateProfileParams{DOB: &dob})
	require.NoError(t, err)

	reloaded, err := db.UserByID(ctx, u.ID)
	require.NoError(t, err)
	return reloaded
}

func TestDating_ProfileRoundTrips(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	u := testUserRow(t, db, campusID, "cardwriter")

	empty, err := db.DatingProfileByUserID(ctx, u.ID)
	require.NoError(t, err)
	assert.Empty(t, empty.Vibe, "no card yet is a blank card, not an error")
	assert.NotNil(t, empty.Interests, "never nil — the client always gets a list to render")
	assert.NotNil(t, empty.Prompts)

	want := domain.DatingProfile{
		Vibe:      "sings in the stairwell, unbothered",
		Interests: []string{"chai at 3am", "bad horror films"},
		Prompts: []domain.DatingPrompt{
			{Question: "The way to win me over is", Answer: "argue with me about a song for forty minutes."},
		},
	}
	saved, err := db.UpsertDatingProfile(ctx, u.ID, want)
	require.NoError(t, err)
	assert.Equal(t, want, saved)

	reloaded, err := db.DatingProfileByUserID(ctx, u.ID)
	require.NoError(t, err)
	assert.Equal(t, want, reloaded, "the card survives a reload, prompts included")

	// Upsert replaces rather than accumulating — the card is saved whole.
	second := domain.DatingProfile{Vibe: "quiet", Interests: []string{}, Prompts: []domain.DatingPrompt{}}
	saved, err = db.UpsertDatingProfile(ctx, u.ID, second)
	require.NoError(t, err)
	assert.Equal(t, second, saved)
}

func TestDating_SwipeMatchesOnlyWhenMutual(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	now := time.Now().UTC()
	wiltsAt := now.Add(7 * 24 * time.Hour)

	a := datingUser(t, db, campusID, "swiper_a")
	b := datingUser(t, db, campusID, "swiper_b")

	// A likes B — nothing mutual yet.
	_, matched, err := db.Swipe(ctx, a.ID, b.ID, domain.SwipeLike, &domain.SwipeTarget{Kind: domain.TargetPhoto}, "", wiltsAt)
	require.NoError(t, err)
	assert.False(t, matched, "one-sided like is not a match")

	// The same pair cannot be swiped twice.
	_, _, err = db.Swipe(ctx, a.ID, b.ID, domain.SwipeLike, nil, "", wiltsAt)
	require.ErrorIs(t, err, ErrConflict)

	// B likes back — that completes it.
	idx := 0
	matchID, matched, err := db.Swipe(ctx, b.ID, a.ID, domain.SwipeLike,
		&domain.SwipeTarget{Kind: domain.TargetPrompt, PromptIndex: &idx}, "which song though", wiltsAt)
	require.NoError(t, err)
	require.True(t, matched, "a mutual like is a match")
	require.NotEmpty(t, matchID)

	for _, viewer := range []*domain.UserPrivate{a, b} {
		matches, err := db.MatchesForUser(ctx, viewer.ID, now)
		require.NoError(t, err)
		require.Len(t, matches, 1, "both sides see the same match")
		assert.NotEqual(t, viewer.ID, matches[0].Candidate.User.ID, "a match shows the *other* person")
	}
}

func TestDating_PassNeverMatches(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	now := time.Now().UTC()

	a := datingUser(t, db, campusID, "passer_a")
	b := datingUser(t, db, campusID, "passer_b")

	_, _, err := db.Swipe(ctx, a.ID, b.ID, domain.SwipePass, nil, "", now.Add(time.Hour))
	require.NoError(t, err)

	_, matched, err := db.Swipe(ctx, b.ID, a.ID, domain.SwipeLike, nil, "", now.Add(time.Hour))
	require.NoError(t, err)
	assert.False(t, matched, "liking someone who passed on you is not a match")

	matches, err := db.MatchesForUser(ctx, b.ID, now)
	require.NoError(t, err)
	assert.Empty(t, matches)
}

func TestDating_DeckExcludesSelfAndAlreadySwiped(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()

	viewer := datingUser(t, db, campusID, "deck_viewer")
	seen := datingUser(t, db, campusID, "deck_seen")
	fresh := datingUser(t, db, campusID, "deck_fresh")
	// Opted out — never in anyone's deck.
	optedOut := datingUser(t, db, campusID, "deck_optedout")
	require.NoError(t, db.SetLoveFinderEnabled(ctx, optedOut.ID, false))

	_, _, err := db.Swipe(ctx, viewer.ID, seen.ID, domain.SwipePass, nil, "", time.Now().Add(time.Hour))
	require.NoError(t, err)

	deck, err := db.Deck(ctx, viewer.ID, campusID, 50)
	require.NoError(t, err)

	handles := map[string]bool{}
	for _, rec := range deck {
		handles[rec.User.Handle] = true
	}
	assert.True(t, handles["deck_fresh"], "someone never swiped on is in the deck")
	assert.False(t, handles["deck_viewer"], "you are never in your own deck")
	assert.False(t, handles["deck_seen"], "a swipe is final — they do not come back")
	assert.False(t, handles["deck_optedout"], "opted out means out of the deck")
	_ = fresh
}

func TestDating_IncomingLikesClearWhenSwipedBack(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	wiltsAt := time.Now().Add(7 * 24 * time.Hour)

	viewer := datingUser(t, db, campusID, "likes_viewer")
	admirer := datingUser(t, db, campusID, "likes_admirer")

	_, _, err := db.Swipe(ctx, admirer.ID, viewer.ID, domain.SwipeTwinkle,
		&domain.SwipeTarget{Kind: domain.TargetPhoto}, "hi", wiltsAt)
	require.NoError(t, err)

	likes, err := db.IncomingLikes(ctx, viewer.ID, 30)
	require.NoError(t, err)
	require.Len(t, likes, 1)
	assert.Equal(t, "likes_admirer", likes[0].Candidate.User.Handle)
	assert.Equal(t, domain.SwipeTwinkle, likes[0].Action)
	assert.Equal(t, "hi", likes[0].Note)

	// Answering it — either way — is what clears it. Nothing else to track.
	_, _, err = db.Swipe(ctx, viewer.ID, admirer.ID, domain.SwipePass, nil, "", wiltsAt)
	require.NoError(t, err)

	likes, err = db.IncomingLikes(ctx, viewer.ID, 30)
	require.NoError(t, err)
	assert.Empty(t, likes, "a like you have answered is no longer waiting on you")
}

func TestDating_SilentMatchWiltsOutOfTheList(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	now := time.Now().UTC()

	a := datingUser(t, db, campusID, "wilt_a")
	b := datingUser(t, db, campusID, "wilt_b")

	// A wilt window that has already closed.
	past := now.Add(-time.Hour)
	_, _, err := db.Swipe(ctx, a.ID, b.ID, domain.SwipeLike, nil, "", past)
	require.NoError(t, err)
	_, matched, err := db.Swipe(ctx, b.ID, a.ID, domain.SwipeLike, nil, "", past)
	require.NoError(t, err)
	require.True(t, matched)

	matches, err := db.MatchesForUser(ctx, a.ID, now)
	require.NoError(t, err)
	assert.Empty(t, matches, "nobody spoke before it wilted, so nobody sees it")
}

func TestDating_TwinklesAreCountedServerSide(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	now := time.Now().UTC()
	wiltsAt := now.Add(time.Hour)

	viewer := datingUser(t, db, campusID, "twinkler")
	first := datingUser(t, db, campusID, "twinkle_target_a")
	second := datingUser(t, db, campusID, "twinkle_target_b")

	used, err := db.TwinklesUsedSince(ctx, viewer.ID, now.Add(-time.Hour))
	require.NoError(t, err)
	assert.Zero(t, used)

	_, _, err = db.Swipe(ctx, viewer.ID, first.ID, domain.SwipeTwinkle, nil, "", wiltsAt)
	require.NoError(t, err)
	_, _, err = db.Swipe(ctx, viewer.ID, second.ID, domain.SwipeLike, nil, "", wiltsAt)
	require.NoError(t, err)

	used, err = db.TwinklesUsedSince(ctx, viewer.ID, now.Add(-time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 1, used, "only the Twinkle counts, not the plain like")

	used, err = db.TwinklesUsedSince(ctx, viewer.ID, now.Add(time.Hour))
	require.NoError(t, err)
	assert.Zero(t, used, "yesterday's Twinkle does not spend today's")
}

func TestDating_Unmatch(t *testing.T) {
	db := testDB(t)
	campusID := testCampus(t, db)
	ctx := context.Background()
	now := time.Now().UTC()
	wiltsAt := now.Add(7 * 24 * time.Hour)

	a := datingUser(t, db, campusID, "unmatch_a")
	b := datingUser(t, db, campusID, "unmatch_b")

	_, _, err := db.Swipe(ctx, a.ID, b.ID, domain.SwipeLike, nil, "", wiltsAt)
	require.NoError(t, err)
	_, _, err = db.Swipe(ctx, b.ID, a.ID, domain.SwipeLike, nil, "", wiltsAt)
	require.NoError(t, err)

	require.NoError(t, db.Unmatch(ctx, a.ID, b.ID))

	for _, viewer := range []*domain.UserPrivate{a, b} {
		matches, err := db.MatchesForUser(ctx, viewer.ID, now)
		require.NoError(t, err)
		assert.Empty(t, matches, "an unmatch closes it for both sides at once")
	}

	require.ErrorIs(t, db.Unmatch(ctx, a.ID, b.ID), ErrNotFound, "unmatching twice is not a silent no-op")
}
