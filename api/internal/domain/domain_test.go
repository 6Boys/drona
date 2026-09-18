package domain

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCursor_RoundTrip(t *testing.T) {
	original := Cursor{
		Time:  time.Date(2026, 9, 9, 14, 30, 45, 123456000, time.UTC),
		Score: 1234.5678901,
		ID:    "44444444-4444-4444-8444-000000000001",
	}

	decoded, err := DecodeCursor(original.Encode())
	require.NoError(t, err)
	require.NotNil(t, decoded)

	assert.True(t, decoded.Time.Equal(original.Time), "got %s want %s", decoded.Time, original.Time)
	assert.InDelta(t, original.Score, decoded.Score, 1e-9)
	assert.Equal(t, original.ID, decoded.ID)
}

func TestCursor_EncodeIsURLSafe(t *testing.T) {
	token := Cursor{Time: time.Now(), Score: -99.5, ID: "abc"}.Encode()
	for _, r := range token {
		assert.NotContains(t, "+/=?&#", string(r), "token must survive a query string: %q", token)
	}
}

func TestDecodeCursor(t *testing.T) {
	t.Run("an empty token is the start of the list, not an error", func(t *testing.T) {
		got, err := DecodeCursor("")
		assert.NoError(t, err)
		assert.Nil(t, got)

		got, err = DecodeCursor("   ")
		assert.NoError(t, err)
		assert.Nil(t, got)
	})

	t.Run("garbage is rejected rather than silently paging from zero", func(t *testing.T) {
		for _, bad := range []string{"!!!not-base64!!!", "aGVsbG8", "MXwy", "fHw"} {
			_, err := DecodeCursor(bad)
			assert.Error(t, err, "should reject %q", bad)
		}
	})
}

func TestRankForPoints(t *testing.T) {
	tests := []struct {
		points int
		want   OwlRank
	}{
		{0, RankSleepySparrow},
		{79, RankSleepySparrow},
		{80, RankFledgling},
		{249, RankFledgling},
		{250, RankNightOwl},
		{499, RankNightOwl},
		{500, RankMoonMoth},
		{899, RankMoonMoth},
		{900, RankComet},
		{100000, RankComet},
		{-50, RankSleepySparrow},
	}

	for _, tc := range tests {
		t.Run(tc.want.Label(), func(t *testing.T) {
			assert.Equal(t, tc.want, RankForPoints(tc.points), "%d points", tc.points)
		})
	}
}

func TestOwlRank_Labels(t *testing.T) {
	assert.Equal(t, "Starter", RankSleepySparrow.Label())
	assert.Equal(t, "Fledgling", RankFledgling.Label())
	assert.Equal(t, "Night Owl", RankNightOwl.Label())
	assert.Equal(t, "Moon Moth", RankMoonMoth.Label())
	assert.Equal(t, "Comet", RankComet.Label())
	assert.Equal(t, "MYSTERY", OwlRank("MYSTERY").Label(), "an unknown rank falls back to its code")
}

func TestSticker_Emoji(t *testing.T) {
	assert.Equal(t, "🍪", StickerCookie.Emoji())
	assert.Equal(t, "✨", StickerSparkle.Emoji())
	assert.Equal(t, "😭", StickerSob.Emoji())
	assert.Equal(t, "🔥", StickerFire.Emoji())
	assert.Equal(t, "🫶", StickerHeartHands.Emoji())

	assert.Empty(t, Sticker("POOP").Emoji())
	assert.False(t, ValidSticker("POOP"), "the sticker set is closed")
	assert.True(t, ValidSticker(StickerCookie))
}

func TestValidPostType(t *testing.T) {
	for _, ok := range []PostType{PostText, PostImage, PostPoll, PostLink, PostAsk} {
		assert.True(t, ValidPostType(ok), string(ok))
	}
	assert.False(t, ValidPostType("VIDEO"), "video is an explicit non-goal for V1")
	assert.False(t, ValidPostType(""))
}

// The 18+ gate is described as non-negotiable in PRD 6.3, so it gets the
// treatment: exact boundaries, and a missing DOB must fail closed.
func TestUserPrivate_IsAdultAt(t *testing.T) {
	now := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)

	dob := func(y, m, d int) *time.Time {
		v := time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
		return &v
	}

	tests := []struct {
		name string
		dob  *time.Time
		want bool
	}{
		{"comfortably an adult", dob(2000, 1, 1), true},
		{"eighteen today", dob(2008, 9, 9), true},
		{"eighteen yesterday", dob(2008, 9, 8), true},
		{"eighteen tomorrow", dob(2008, 9, 10), false},
		{"clearly a minor", dob(2012, 5, 5), false},
		{"no date of birth on record", nil, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			u := &UserPrivate{DOB: tc.dob}
			assert.Equal(t, tc.want, u.IsAdultAt(now))
		})
	}
}

func TestUserPrivate_CanUseDating(t *testing.T) {
	now := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)
	adult := time.Date(2004, 1, 1, 0, 0, 0, 0, time.UTC)
	minor := time.Date(2012, 1, 1, 0, 0, 0, 0, time.UTC)
	verified := now.Add(-24 * time.Hour)

	t.Run("an adult with photo verification may enter the deck", func(t *testing.T) {
		u := &UserPrivate{DOB: &adult, PhotoVerifiedAt: &verified}
		u.Status = StatusActive
		assert.NoError(t, u.CanUseDating(now))
	})

	t.Run("a minor never may, whatever else is true", func(t *testing.T) {
		u := &UserPrivate{DOB: &minor, PhotoVerifiedAt: &verified}
		u.Status = StatusActive
		err := u.CanUseDating(now)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "18")
	})

	t.Run("no DOB fails closed", func(t *testing.T) {
		u := &UserPrivate{PhotoVerifiedAt: &verified}
		u.Status = StatusActive
		assert.Error(t, u.CanUseDating(now))
	})

	t.Run("photo verification is required — it is what kills catfishing", func(t *testing.T) {
		u := &UserPrivate{DOB: &adult}
		u.Status = StatusActive
		err := u.CanUseDating(now)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "verification")
	})

	t.Run("a suspended account is refused first", func(t *testing.T) {
		u := &UserPrivate{DOB: &adult, PhotoVerifiedAt: &verified}
		u.Status = StatusSuspended
		assert.Error(t, u.CanUseDating(now))
	})
}

// The DOB is collected for the age gate and never displayed (PRD 10). Prove it
// cannot leak through the JSON encoder.
func TestUser_DOBIsNeverSerialised(t *testing.T) {
	dob := time.Date(2004, 3, 15, 0, 0, 0, 0, time.UTC)
	u := UserPrivate{DOB: &dob}
	u.Handle = "meher"

	raw, err := json.Marshal(u.User)
	require.NoError(t, err)

	assert.NotContains(t, string(raw), "dob")
	assert.NotContains(t, string(raw), "2004-03-15")
	assert.Contains(t, string(raw), "meher")
}

func TestNewPage(t *testing.T) {
	cursorOf := func(i int) Cursor { return Cursor{Score: float64(i), ID: "id"} }

	t.Run("an over-fetched extra row becomes the next cursor", func(t *testing.T) {
		page := NewPage([]int{1, 2, 3, 4}, 3, cursorOf)

		assert.Len(t, page.Items, 3, "the extra row is trimmed, not returned")
		assert.True(t, page.HasMore)
		assert.NotEmpty(t, page.NextCursor)

		decoded, err := DecodeCursor(page.NextCursor)
		require.NoError(t, err)
		assert.Equal(t, 3.0, decoded.Score, "the cursor points at the last returned row")
	})

	t.Run("an exactly-full page is the end of the list", func(t *testing.T) {
		page := NewPage([]int{1, 2, 3}, 3, cursorOf)
		assert.Len(t, page.Items, 3)
		assert.False(t, page.HasMore)
		assert.Empty(t, page.NextCursor)
	})

	t.Run("no rows serialises as [] and never null", func(t *testing.T) {
		page := NewPage([]int(nil), 10, cursorOf)
		assert.NotNil(t, page.Items)

		raw, err := json.Marshal(page)
		require.NoError(t, err)
		assert.Contains(t, string(raw), `"items":[]`)
	})
}
