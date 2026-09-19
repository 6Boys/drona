package owl

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/aniketrathour/dronasphere/api/internal/config"
)

// The default window from .env: opens 22:00, hard curfew 03:00.
var (
	start  = config.TimeOfDay{Hour: 22, Minute: 0}
	curfew = config.TimeOfDay{Hour: 3, Minute: 0}
)

func at(day, hour, minute int) time.Time {
	return time.Date(2026, 9, day, hour, minute, 0, 0, time.UTC)
}

func TestWindowFor_AssignsTheNightToTheEveningItBeganOn(t *testing.T) {
	tests := []struct {
		name     string
		now      time.Time
		wantKey  string
		wantOpen time.Time
		wantCurf time.Time
	}{
		{
			// One minute before tonight opens, the most recent night is still
			// last night — the window never points at a night yet to start.
			name:     "just before the window opens",
			now:      at(9, 21, 59),
			wantKey:  "2026-09-08",
			wantOpen: at(8, 22, 0),
			wantCurf: at(9, 3, 0),
		},
		{
			name:     "the moment it opens",
			now:      at(9, 22, 0),
			wantKey:  "2026-09-09",
			wantOpen: at(9, 22, 0),
			wantCurf: at(10, 3, 0),
		},
		{
			name:     "2 AM belongs to the night before, not a new one",
			now:      at(10, 2, 0),
			wantKey:  "2026-09-09",
			wantOpen: at(9, 22, 0),
			wantCurf: at(10, 3, 0),
		},
		{
			name:     "the curfew instant still belongs to the night it ended",
			now:      at(10, 3, 0),
			wantKey:  "2026-09-09",
			wantOpen: at(9, 22, 0),
			wantCurf: at(10, 3, 0),
		},
		{
			// Not the night that is coming: the window is always the current or
			// most recent night, so "did the curfew stop me" has an answer.
			name:     "the afternoon still refers to last night",
			now:      at(10, 12, 0),
			wantKey:  "2026-09-09",
			wantOpen: at(9, 22, 0),
			wantCurf: at(10, 3, 0),
		},
		{
			name:     "just after the curfew is still that night",
			now:      at(10, 4, 30),
			wantKey:  "2026-09-09",
			wantOpen: at(9, 22, 0),
			wantCurf: at(10, 3, 0),
		},
		{
			name:     "midnight belongs to yesterday's night",
			now:      at(10, 0, 0),
			wantKey:  "2026-09-09",
			wantOpen: at(9, 22, 0),
			wantCurf: at(10, 3, 0),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := WindowFor(tc.now, start, curfew, time.UTC)
			assert.Equal(t, tc.wantKey, w.Key, "night key")
			assert.True(t, w.Opens.Equal(tc.wantOpen), "opens: got %s want %s", w.Opens, tc.wantOpen)
			assert.True(t, w.Curfew.Equal(tc.wantCurf), "curfew: got %s want %s", w.Curfew, tc.wantCurf)
		})
	}
}

func TestWindow_IsOpen(t *testing.T) {
	tests := []struct {
		now  time.Time
		open bool
	}{
		{at(9, 21, 59), false}, // one minute early
		{at(9, 22, 0), true},   // inclusive at the start
		{at(10, 0, 0), true},   // across midnight
		{at(10, 2, 59), true},  // last scoring minute
		{at(10, 3, 0), false},  // exclusive at the curfew
		{at(10, 3, 1), false},
		{at(10, 14, 0), false}, // the middle of the afternoon
	}

	for _, tc := range tests {
		t.Run(tc.now.Format("Jan2_15:04"), func(t *testing.T) {
			w := WindowFor(tc.now, start, curfew, time.UTC)
			assert.Equal(t, tc.open, w.IsOpen(tc.now))
		})
	}
}

func TestWindow_CozyModeFollowsTheCurfew(t *testing.T) {
	// The curfew has passed and it is still the small hours: dim the palette,
	// Dronu curls up, the copy says go to bed.
	w := WindowFor(at(10, 3, 30), start, curfew, time.UTC)
	require.Equal(t, "2026-09-09", w.Key, "cozy mode belongs to the night that just ended")
	assert.True(t, w.IsCozy(at(10, 3, 30)), "half an hour past the curfew is cozy")
	assert.True(t, w.IsCozy(at(10, 6, 59)), "just inside the cozy window")
	assert.False(t, w.IsCozy(at(10, 7, 0)), "cozy mode ends after CozyDuration")
	assert.False(t, w.IsCozy(at(10, 1, 0)), "before the curfew is not cozy, it is scoring")
}

func TestWindow_UntilCurfew(t *testing.T) {
	w := WindowFor(at(9, 23, 0), start, curfew, time.UTC)
	assert.Equal(t, 4*time.Hour, w.UntilCurfew(at(9, 23, 0)))
	assert.Equal(t, time.Duration(0), w.UntilCurfew(at(10, 3, 0)), "no time left once the curfew hits")
	assert.Equal(t, time.Duration(0), w.UntilCurfew(at(10, 5, 0)), "and it does not go negative")

	// Long after the curfew there is no time left to score tonight; the client
	// shows "opens at 22:00" instead of a countdown.
	after := WindowFor(at(10, 12, 0), start, curfew, time.UTC)
	assert.Equal(t, time.Duration(0), after.UntilCurfew(at(10, 12, 0)))
}

func TestAction_Points(t *testing.T) {
	// Making something is worth more than reacting to something.
	assert.Equal(t, 15, ActionPost.Points())
	assert.Equal(t, 8, ActionComment.Points())
	assert.Equal(t, 3, ActionMessage.Points())
	assert.Equal(t, 1, ActionBurrowMinute.Points())

	assert.Equal(t, 0, Action("SCROLLING").Points(), "idle presence is not an action")
	assert.False(t, Action("APP_OPEN").Valid(), "opening the app earns nothing")
}

// baseInput is a heartbeat that would score, so each test can change one thing.
func baseInput(now time.Time) ScoreInput {
	return ScoreInput{
		Now:            now,
		Action:         ActionPost,
		SessionActions: 5, // already past the warm-up
		SessionPoints:  40,
		PointsThisHour: 0,
		MinActions:     3,
		MaxPointsPerHr: 120,
		Start:          start,
		Curfew:         curfew,
		Location:       time.UTC,
	}
}

func TestScore_InsideTheWindowAnActionScores(t *testing.T) {
	g := Score(baseInput(at(10, 1, 0)))

	assert.Equal(t, ReasonScored, g.Reason)
	assert.Equal(t, 15, g.BoardPoints)
	assert.Equal(t, 15, g.SessionPoints)
	assert.Equal(t, 1, g.Actions)
	assert.False(t, g.CurfewHit)
}

func TestScore_OutsideTheWindowScoresNothing(t *testing.T) {
	in := baseInput(at(10, 15, 0)) // three in the afternoon, hours past cozy
	g := Score(in)

	assert.Equal(t, ReasonOutsideWindow, g.Reason)
	assert.Zero(t, g.BoardPoints)
	assert.Zero(t, g.Actions, "an action outside the window is not even counted")
	assert.False(t, g.CurfewHit, "the afternoon is not a curfew hit")
}

func TestScore_TheCurfewIsHard(t *testing.T) {
	// PRD 6.2: "No amount of further use adds a single point."
	for _, minute := range []int{0, 1, 30, 90} {
		now := at(10, 3, 0).Add(time.Duration(minute) * time.Minute)
		g := Score(baseInput(now))

		assert.Equal(t, ReasonCurfew, g.Reason, "at %s", now.Format("15:04"))
		assert.Zero(t, g.BoardPoints, "at %s", now.Format("15:04"))
		assert.Zero(t, g.SessionPoints, "at %s", now.Format("15:04"))
		assert.True(t, g.CurfewHit)
	}
}

func TestScore_AVeryLongSessionStillCannotBeatTheCurfew(t *testing.T) {
	// Somebody who has been grinding all night and has thousands of session
	// points still gets nothing after 3 AM.
	in := baseInput(at(10, 4, 0))
	in.SessionActions = 500
	in.SessionPoints = 5000

	g := Score(in)
	assert.Zero(t, g.BoardPoints)
	assert.Equal(t, ReasonCurfew, g.Reason)
}

func TestScore_WarmUpWithholdsPointsUntilMinActions(t *testing.T) {
	// PRD 6.2 anti-cheat: passive presence earns nothing, and a script tapping
	// the screen has to do real, distinct things before anything counts.
	in := baseInput(at(10, 1, 0))
	in.SessionActions = 0
	in.SessionPoints = 0

	first := Score(in)
	assert.Equal(t, ReasonWarmingUp, first.Reason)
	assert.Zero(t, first.BoardPoints, "nothing published on the first action")
	assert.Equal(t, 15, first.SessionPoints, "but it is still recorded")
	assert.Equal(t, 1, first.Actions)

	in.SessionActions = 1
	in.SessionPoints = 15
	second := Score(in)
	assert.Equal(t, ReasonWarmingUp, second.Reason)
	assert.Zero(t, second.BoardPoints)
}

func TestScore_CrossingMinActionsReleasesTheBacklogExactlyOnce(t *testing.T) {
	// A real user should not be punished for the ramp: the points banked while
	// warming up are released on the crossing heartbeat.
	in := baseInput(at(10, 1, 0))
	in.MinActions = 3
	in.SessionActions = 2 // this heartbeat makes it 3
	in.SessionPoints = 23 // 15 + 8 withheld so far

	g := Score(in)
	assert.Equal(t, ReasonScored, g.Reason)
	assert.Equal(t, 38, g.BoardPoints, "15 for this action plus the 23 withheld")

	// The next action publishes only its own value; the backlog is not re-paid.
	in.SessionActions = 3
	in.SessionPoints = 38
	next := Score(in)
	assert.Equal(t, 15, next.BoardPoints)
}

func TestScore_HourlyCapStopsARunawayLoop(t *testing.T) {
	in := baseInput(at(10, 1, 0))
	in.MaxPointsPerHr = 120

	t.Run("partially over the cap grants only the remainder", func(t *testing.T) {
		in.PointsThisHour = 110
		g := Score(in)
		assert.Equal(t, 10, g.BoardPoints, "capped to what is left of the hour")
		assert.Equal(t, ReasonScored, g.Reason)
		assert.Equal(t, 15, g.SessionPoints, "the session still records the real value")
	})

	t.Run("at the cap grants nothing", func(t *testing.T) {
		in.PointsThisHour = 120
		g := Score(in)
		assert.Zero(t, g.BoardPoints)
		assert.Equal(t, ReasonHourlyCap, g.Reason)
		assert.Equal(t, 1, g.Actions, "the action still happened")
	})

	t.Run("a disabled cap is unlimited", func(t *testing.T) {
		in.PointsThisHour = 100000
		in.MaxPointsPerHr = 0
		g := Score(in)
		assert.Equal(t, 15, g.BoardPoints)
	})
}

func TestScore_UnknownActionIsRefused(t *testing.T) {
	in := baseInput(at(10, 1, 0))
	in.Action = "STARED_AT_SCREEN"

	g := Score(in)
	assert.Equal(t, ReasonUnknownAction, g.Reason)
	assert.Zero(t, g.BoardPoints)
	assert.Zero(t, g.Actions)
}

// This is the property the PRD redesign turns on: time awake is not an input.
func TestScore_HoursAwakeIsNeverAnInput(t *testing.T) {
	early := baseInput(at(9, 22, 30))
	late := baseInput(at(10, 2, 30))

	assert.Equal(t, Score(early).BoardPoints, Score(late).BoardPoints,
		"the same action is worth the same at 10:30 PM and at 2:30 AM — staying up longer is not rewarded")
}

func TestWeekKey(t *testing.T) {
	// ISO weeks, matching the helper in prisma/seed.ts.
	assert.Equal(t, "2026-W37", WeekKey(at(9, 12, 0), time.UTC))
	assert.Equal(t, "2026-W37", WeekKey(at(13, 23, 0), time.UTC), "Sunday is still the same ISO week")
	assert.Equal(t, "2026-W38", WeekKey(at(14, 0, 1), time.UTC), "Monday starts a new one")
}

func TestWeekEnd_IsTheNextMonday(t *testing.T) {
	// 2026-09-09 is a Wednesday.
	reset := WeekEnd(at(9, 12, 0), time.UTC)
	assert.Equal(t, time.Monday, reset.Weekday())
	assert.Equal(t, "2026-09-14 00:00:00", reset.Format("2006-01-02 15:04:05"))

	// On a Monday, the reset is the *following* Monday, not right now.
	fromMonday := WeekEnd(at(14, 9, 0), time.UTC)
	assert.Equal(t, "2026-09-21 00:00:00", fromMonday.Format("2006-01-02 15:04:05"))
}

func TestNightKeysForWeek(t *testing.T) {
	keys := NightKeysForWeek(at(9, 12, 0), start, curfew, time.UTC)

	require.Len(t, keys, 7)
	assert.Equal(t, "2026-09-07", keys[0], "the ISO week starts on Monday")
	assert.Equal(t, "2026-09-13", keys[6])

	// Every day of that week must produce the same set, or a Sunday-night
	// session would be counted against a different week from a Monday one.
	sunday := NightKeysForWeek(at(13, 23, 0), start, curfew, time.UTC)
	assert.Equal(t, keys, sunday)
}

func TestCocoon(t *testing.T) {
	now := at(10, 9, 0)
	minSleep := 7 * time.Hour

	t.Run("a full night of rest is eligible", func(t *testing.T) {
		last := at(9, 23, 30) // 9.5 hours earlier
		got := Cocoon(now, &last, minSleep, time.UTC)

		assert.True(t, got.Eligible)
		assert.InDelta(t, 9.5, got.SleepHours, 0.01)
		assert.Equal(t, "2026-09-10", got.DayKey)
	})

	t.Run("just under the threshold is not", func(t *testing.T) {
		last := at(10, 2, 30) // 6.5 hours
		got := Cocoon(now, &last, minSleep, time.UTC)

		assert.False(t, got.Eligible)
		assert.Equal(t, "not_enough_rest", got.Reason)
		assert.InDelta(t, 6.5, got.SleepHours, 0.01)
	})

	t.Run("exactly the threshold counts", func(t *testing.T) {
		last := at(10, 2, 0) // exactly 7 hours
		assert.True(t, Cocoon(now, &last, minSleep, time.UTC).Eligible)
	})

	t.Run("a dormant account cannot farm the bonus", func(t *testing.T) {
		last := at(1, 9, 0) // nine days ago
		got := Cocoon(now, &last, minSleep, time.UTC)

		assert.True(t, got.Eligible, "still eligible — they did rest")
		assert.Equal(t, 24.0, got.SleepHours, "but the credited hours are capped at a day")
	})

	t.Run("no activity on record is not the same as resting", func(t *testing.T) {
		got := Cocoon(now, nil, minSleep, time.UTC)
		assert.False(t, got.Eligible)
		assert.Equal(t, "no_activity_recorded", got.Reason)
	})

	t.Run("a clock skew into the future does not produce negative rest", func(t *testing.T) {
		future := at(10, 10, 0)
		got := Cocoon(now, &future, minSleep, time.UTC)
		assert.False(t, got.Eligible)
		assert.Zero(t, got.SleepHours)
	})
}

// The Cocoon Bonus has to be worth more than a night of grinding, or the curfew
// design fails (PRD 6.2, and PRD 11 tracks the claim rate as a health signal).
func TestCocoonOutscoresAFullNightOfGrinding(t *testing.T) {
	const cocoonStardust = 250 // COCOON_STARDUST default

	// The very best a capped night can do: five hours at the hourly cap.
	maxPointsPerHour := 120
	nightHours := 5
	bestNight := maxPointsPerHour * nightHours

	assert.Greater(t, cocoonStardust*2, bestNight/2,
		"the recovery bonus must remain a competitive alternative to grinding, not a consolation prize")
	assert.LessOrEqual(t, nightHours, 5, "the window is five hours wide and the curfew is hard")
}
