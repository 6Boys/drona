package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
)

func TestHotRank_MoreUpvotesRanksHigherAtTheSameAge(t *testing.T) {
	now := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)

	low := HotRank(5, now)
	mid := HotRank(50, now)
	high := HotRank(500, now)

	assert.Less(t, low, mid)
	assert.Less(t, mid, high)
}

func TestHotRank_NewerRanksHigherAtTheSameScore(t *testing.T) {
	base := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)

	older := HotRank(50, base.Add(-24*time.Hour))
	newer := HotRank(50, base)

	assert.Less(t, older, newer)
}

func TestHotRank_TimeDecayLetsAFreshPostOvertakeAnOlderBetterOne(t *testing.T) {
	// The point of the decay: a good morning post is still visible that evening
	// and gone by tomorrow, so the feed keeps moving.
	base := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)

	yesterdaysHit := HotRank(100, base.Add(-24*time.Hour))
	freshModest := HotRank(10, base)

	assert.Greater(t, freshModest, yesterdaysHit,
		"a modest post from an hour ago should beat yesterday's hit")

	// But not instantly: within the same few hours, score still wins.
	recentHit := HotRank(100, base.Add(-2*time.Hour))
	brandNewSingleVote := HotRank(1, base)
	assert.Greater(t, recentHit, brandNewSingleVote,
		"score still decides among posts of a similar age")
}

func TestHotRank_ZeroAndNegativeScores(t *testing.T) {
	now := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)

	zero := HotRank(0, now)
	one := HotRank(1, now)
	negative := HotRank(-5, now)

	assert.Less(t, negative, zero, "a downvoted post sinks below an unvoted one")
	assert.Less(t, zero, one)
	assert.NotPanics(t, func() { HotRank(0, time.Time{}) }, "a zero time must not blow up")
}

func TestHotRank_IsDeterministicAndRounded(t *testing.T) {
	now := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)

	first := HotRank(42, now)
	second := HotRank(42, now)
	require.Equal(t, first, second, "the same inputs must always give the same rank")

	// Rounded to 7 decimals so Postgres, Go and prisma/seed.ts agree.
	scaled := first * 1e7
	assert.InDelta(t, scaled, float64(int64(scaled+0.5)), 0.001,
		"the value should already be rounded to 7 places")
}

// The Go and TypeScript implementations must agree, or seeded posts sort
// differently from real ones. This pins the formula against a hand-computed value.
func TestHotRank_MatchesTheSeedScriptFormula(t *testing.T) {
	// hotEpoch is 2026-01-01T00:00:00Z. Pick a time exactly 45000s later, so the
	// time term is exactly 1.0, with a score of 100 so the order term is 2.0.
	at := time.Date(2026, 1, 1, 12, 30, 0, 0, time.UTC) // 45000 seconds in
	require.Equal(t, int64(45000), at.Unix()-hotEpoch.Unix())

	assert.InDelta(t, 3.0, HotRank(100, at), 1e-6, "log10(100) + 1*45000/45000 = 2 + 1")
}

func TestBuildCommentTree(t *testing.T) {
	id := func(s string) *string { return &s }

	t.Run("flat comments all become roots", func(t *testing.T) {
		tree := BuildCommentTree([]domain.Comment{
			{ID: "a"}, {ID: "b"}, {ID: "c"},
		})
		require.Len(t, tree, 3)
		for _, c := range tree {
			assert.Empty(t, c.Children)
		}
	})

	t.Run("children attach to their parent", func(t *testing.T) {
		tree := BuildCommentTree([]domain.Comment{
			{ID: "root", Depth: 0},
			{ID: "child1", ParentID: id("root"), Depth: 1},
			{ID: "child2", ParentID: id("root"), Depth: 1},
		})

		require.Len(t, tree, 1)
		assert.Equal(t, "root", tree[0].ID)
		require.Len(t, tree[0].Children, 2)
		assert.Equal(t, "child1", tree[0].Children[0].ID)
		assert.Equal(t, "child2", tree[0].Children[1].ID)
	})

	t.Run("grandchildren survive — this is the one value copies lose", func(t *testing.T) {
		tree := BuildCommentTree([]domain.Comment{
			{ID: "root", Depth: 0},
			{ID: "child", ParentID: id("root"), Depth: 1},
			{ID: "grandchild", ParentID: id("child"), Depth: 2},
			{ID: "greatgrandchild", ParentID: id("grandchild"), Depth: 3},
		})

		require.Len(t, tree, 1)
		require.Len(t, tree[0].Children, 1)
		require.Len(t, tree[0].Children[0].Children, 1)
		require.Len(t, tree[0].Children[0].Children[0].Children, 1)
		assert.Equal(t, "greatgrandchild", tree[0].Children[0].Children[0].Children[0].ID)
	})

	t.Run("an orphan is promoted rather than dropped", func(t *testing.T) {
		// Happens when the parent's author is blocked by the viewer: the parent
		// is filtered out of the query but the reply is not.
		tree := BuildCommentTree([]domain.Comment{
			{ID: "visible", Depth: 0},
			{ID: "orphan", ParentID: id("filtered-out-parent"), Depth: 1},
		})

		require.Len(t, tree, 2, "losing a conversation is worse than losing its indentation")
		ids := []string{tree[0].ID, tree[1].ID}
		assert.Contains(t, ids, "orphan")
	})

	t.Run("a comment claiming itself as parent does not loop forever", func(t *testing.T) {
		done := make(chan []domain.Comment, 1)
		go func() {
			done <- BuildCommentTree([]domain.Comment{{ID: "self", ParentID: id("self")}})
		}()

		select {
		case tree := <-done:
			require.Len(t, tree, 1)
			assert.Empty(t, tree[0].Children)
		case <-time.After(2 * time.Second):
			t.Fatal("BuildCommentTree hung on a self-referencing comment")
		}
	})

	t.Run("no comments returns an empty slice, not nil", func(t *testing.T) {
		tree := BuildCommentTree(nil)
		assert.NotNil(t, tree)
		assert.Empty(t, tree)
	})

	t.Run("the caller's slice is not mutated", func(t *testing.T) {
		flat := []domain.Comment{
			{ID: "root"},
			{ID: "child", ParentID: id("root")},
		}
		BuildCommentTree(flat)
		assert.Empty(t, flat[0].Children, "the input must be left alone")
	})
}

func TestNextOnboardingStep(t *testing.T) {
	const minFollows = 8

	dob := time.Date(2005, 5, 5, 0, 0, 0, 0, time.UTC)
	complete := func() *domain.UserPrivate {
		u := &domain.UserPrivate{DOB: &dob}
		u.Handle = "meher"
		u.DisplayName = "Meher Kaur"
		u.Batch = "2024-28"
		u.Branch = "ECE"
		u.Year = 2
		u.Avatar = domain.Avatar{Hat: "beanie", Eyes: "sparkle", Colour: "ube", Accessory: "none"}
		return u
	}

	t.Run("a finished profile with enough follows is done", func(t *testing.T) {
		assert.Equal(t, domain.StepDone, NextOnboardingStep(complete(), 8, minFollows))
		assert.Equal(t, domain.StepDone, NextOnboardingStep(complete(), 40, minFollows))
	})

	t.Run("the follow-8 gate is the last thing standing", func(t *testing.T) {
		for _, follows := range []int{0, 1, 7} {
			assert.Equal(t, domain.StepFollows, NextOnboardingStep(complete(), follows, minFollows),
				"%d follows is not enough", follows)
		}
	})

	t.Run("the avatar comes before follows — and before any photo is asked for", func(t *testing.T) {
		u := complete()
		u.Avatar = domain.Avatar{}
		assert.Equal(t, domain.StepAvatar, NextOnboardingStep(u, 20, minFollows))
	})

	t.Run("missing profile details come before the avatar", func(t *testing.T) {
		for _, mutate := range []func(*domain.UserPrivate){
			func(u *domain.UserPrivate) { u.DOB = nil },
			func(u *domain.UserPrivate) { u.Batch = "" },
			func(u *domain.UserPrivate) { u.Branch = "" },
			func(u *domain.UserPrivate) { u.Year = 0 },
		} {
			u := complete()
			u.Avatar = domain.Avatar{}
			mutate(u)
			assert.Equal(t, domain.StepProfile, NextOnboardingStep(u, 20, minFollows))
		}
	})

	t.Run("no handle or name is the very first step", func(t *testing.T) {
		u := complete()
		u.Handle = ""
		assert.Equal(t, domain.StepHandle, NextOnboardingStep(u, 20, minFollows))

		u = complete()
		u.DisplayName = ""
		assert.Equal(t, domain.StepHandle, NextOnboardingStep(u, 20, minFollows))
	})

	t.Run("a brand new account starts at the beginning", func(t *testing.T) {
		assert.Equal(t, domain.StepHandle, NextOnboardingStep(&domain.UserPrivate{}, 0, minFollows))
	})
}

func TestValidateHandle(t *testing.T) {
	// Input is case-insensitive and whitespace-trimmed; the caller stores the
	// lowercased form, so "Meher" and " meher " are both accepted spellings of
	// the same handle rather than errors a user has to decode.
	valid := []string{"meher", "aniket_r", "zoya123", "abc", "a_very_long_handle_x", "Meher", "  meher  "}
	for _, h := range valid {
		assert.NoError(t, ValidateHandle(h), "%q should be valid", h)
	}

	invalid := []string{
		"ab",                            // too short
		"a_handle_that_is_way_too_long", // over 20
		"me her",                        // space
		"me-her",                        // hyphen
		"me.her",                        // dot
		"emoji🦉",
		"",
		"admin",       // reserved
		"dronasphere", // reserved
		"support",     // reserved
	}
	for _, h := range invalid {
		assert.Error(t, ValidateHandle(h), "%q should be rejected", h)
	}
}

func TestValidateAvatar(t *testing.T) {
	good := domain.Avatar{Hat: "beanie", Eyes: "sparkle", Colour: "ube", Accessory: "scarf"}
	assert.NoError(t, validateAvatar(good))

	t.Run("a client cannot invent options that have no artwork", func(t *testing.T) {
		bad := good
		bad.Hat = "sombrero"
		err := validateAvatar(bad)
		require.Error(t, err)

		var apiErr *httpx.APIError
		require.ErrorAs(t, err, &apiErr)
		assert.Contains(t, apiErr.Fields, "hat", "the client needs to know which field to fix")
	})

	t.Run("an empty avatar is not valid — that is what StepAvatar detects", func(t *testing.T) {
		assert.Error(t, validateAvatar(domain.Avatar{}))
	})
}

func TestAvatarOptions_AreNonEmptyAndSelfConsistent(t *testing.T) {
	opts := AvatarOptions()

	for _, key := range []string{"hat", "eyes", "colour", "accessory"} {
		require.Contains(t, opts, key)
		assert.NotEmpty(t, opts[key])
	}

	// Every advertised option must pass validation, or the builder offers
	// choices the API then rejects.
	for _, hat := range opts["hat"] {
		a := domain.Avatar{Hat: hat, Eyes: "sparkle", Colour: "ube", Accessory: "none"}
		assert.NoError(t, validateAvatar(a), "hat %q is offered but rejected", hat)
	}
	for _, eyes := range opts["eyes"] {
		a := domain.Avatar{Hat: "none", Eyes: eyes, Colour: "ube", Accessory: "none"}
		assert.NoError(t, validateAvatar(a), "eyes %q is offered but rejected", eyes)
	}
	for _, colour := range opts["colour"] {
		a := domain.Avatar{Hat: "none", Eyes: "sparkle", Colour: colour, Accessory: "none"}
		assert.NoError(t, validateAvatar(a), "colour %q is offered but rejected", colour)
	}
	for _, acc := range opts["accessory"] {
		a := domain.Avatar{Hat: "none", Eyes: "sparkle", Colour: "ube", Accessory: acc}
		assert.NoError(t, validateAvatar(a), "accessory %q is offered but rejected", acc)
	}
}

func TestHelpers(t *testing.T) {
	t.Run("sanitiseHandle", func(t *testing.T) {
		assert.Equal(t, "meherkaur", sanitiseHandle("Meher.Kaur"))
		assert.Equal(t, "aniket", sanitiseHandle("aniket+spam"), "plus-addressing tags are dropped")
		assert.Equal(t, "zoya123", sanitiseHandle("zoya.123"))
		assert.Equal(t, "", sanitiseHandle("!!!"))
	})

	t.Run("displayNameFor", func(t *testing.T) {
		assert.Equal(t, "Meher Kaur", displayNameFor("meher.kaur"))
		assert.Equal(t, "Aniket Rathour", displayNameFor("aniket_rathour"))
		assert.Equal(t, "Zoya", displayNameFor("zoya"))
		assert.Equal(t, "Student", displayNameFor(""))
	})

	t.Run("slugify", func(t *testing.T) {
		assert.Equal(t, "dronacharya-info", slugify("dronacharya.info"))
		assert.Equal(t, "gcet-ac-in", slugify("gcet.ac.in"))
		assert.Equal(t, "abc", slugify("--abc--"))
	})

	t.Run("isHTTPURL", func(t *testing.T) {
		assert.True(t, isHTTPURL("https://careers.zohocorp.com"))
		assert.True(t, isHTTPURL("http://localhost:3000"))
		assert.False(t, isHTTPURL("javascript:alert(1)"))
		assert.False(t, isHTTPURL("ftp://files.example"))
		assert.False(t, isHTTPURL("careers.zohocorp.com"))
		assert.False(t, isHTTPURL(""))
	})

	t.Run("normaliseSort", func(t *testing.T) {
		assert.Equal(t, "hot", normaliseSort(""))
		assert.Equal(t, "hot", normaliseSort("garbage"))
		assert.Equal(t, "new", normaliseSort("new"))
	})
}
