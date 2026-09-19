// Package owl holds the night-window arithmetic behind the Owl Board.
//
// It is deliberately pure: no database, no Redis, no clock of its own. Every
// function takes the time it should reason about, which is the only way this
// logic is testable — and it is the logic most worth testing, because it decides
// whether the app rewards someone for staying up.
//
// The design follows PRD 6.2. Points accrue for activity between 22:00 and the
// 03:00 hard curfew. At the curfew points stop, permanently, for that night: no
// amount of further use adds a single point. Recovery (the Cocoon Bonus) is
// worth more than a full night of grinding.
package owl

import (
	"fmt"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/config"
)

// Action is a scoreable thing a student did. Idle app-open time is absent from
// this list on purpose — presence earns nothing.
type Action string

const (
	ActionPost         Action = "POST"
	ActionComment      Action = "COMMENT"
	ActionMessage      Action = "MESSAGE"
	ActionBurrowMinute Action = "BURROW_MINUTE"
)

// Points is what one action is worth. Weighted so that making something counts
// for more than reacting to something.
func (a Action) Points() int {
	switch a {
	case ActionPost:
		return 15
	case ActionComment:
		return 8
	case ActionMessage:
		return 3
	case ActionBurrowMinute:
		return 1
	}
	return 0
}

// Valid reports whether an action is scoreable.
func (a Action) Valid() bool { return a.Points() > 0 }

// CozyDuration is how long Cozy Mode lasts after the curfew: the palette dims,
// Dronu curls up, and the copy tells you to go to bed.
const CozyDuration = 4 * time.Hour

// Window is a resolved night window for a given day.
type Window struct {
	// Opens is when scoring starts, e.g. 22:00 today.
	Opens time.Time
	// Curfew is when scoring stops for good, e.g. 03:00 tomorrow.
	Curfew time.Time
	// Key identifies the night by the calendar date it began on, so 02:00
	// belongs to the night before rather than starting a new one.
	Key string
}

// resolveLoc defaults a nil location to UTC rather than letting every caller
// below panic on time.Time.In(nil). config.Load validates NightLocation is
// always set in the running app, so nil here means a caller built its inputs
// by hand (as tests do) without one, and UTC is a safe, deterministic default.
func resolveLoc(loc *time.Location) *time.Location {
	if loc == nil {
		return time.UTC
	}
	return loc
}

// WindowFor resolves the night window that t belongs to: the night currently
// running, or — outside it — the most recent one. It never returns a night that
// has not started yet, because the two things callers ask about are "can I score
// right now" and "did the curfew just stop me", and both are about the night
// behind you.
//
// loc is the timezone "22:00" and "03:00" are wall-clock hours in — PRD 6.2's
// "local" (config.NightLocation). t is converted into loc first, so the answer
// is correct no matter what zone t itself carries: a UTC-tagged instant and an
// IST-tagged instant that name the same moment produce the same Window.
func WindowFor(t time.Time, start, curfew config.TimeOfDay, loc *time.Location) Window {
	loc = resolveLoc(loc)
	t = t.In(loc)
	minutes := t.Hour()*60 + t.Minute()

	// The date the night began on. Any time before the opening hour still
	// belongs to the night that started the previous evening — that covers 2 AM
	// (mid-night), 4 AM (just after the curfew) and 3 PM (long after it) with
	// one rule.
	nightDate := t
	if minutes < start.Minutes() {
		nightDate = t.AddDate(0, 0, -1)
	}

	opens := time.Date(nightDate.Year(), nightDate.Month(), nightDate.Day(),
		start.Hour, start.Minute, 0, 0, loc)

	// The curfew is the next occurrence of the curfew time after opening.
	curfewAt := time.Date(nightDate.Year(), nightDate.Month(), nightDate.Day(),
		curfew.Hour, curfew.Minute, 0, 0, loc)
	if !curfewAt.After(opens) {
		curfewAt = curfewAt.AddDate(0, 0, 1)
	}

	return Window{
		Opens:  opens,
		Curfew: curfewAt,
		Key:    nightDate.Format("2006-01-02"),
	}
}

// NightKey is the night's identifier, used as the night_sessions key.
func NightKey(t time.Time, start, curfew config.TimeOfDay, loc *time.Location) string {
	return WindowFor(t, start, curfew, loc).Key
}

// IsOpen reports whether scoring is live at t.
func (w Window) IsOpen(t time.Time) bool {
	return !t.Before(w.Opens) && t.Before(w.Curfew)
}

// IsCozy reports whether the app should be in Cozy Mode: the curfew has passed
// and it is still the small hours.
func (w Window) IsCozy(t time.Time) bool {
	return !t.Before(w.Curfew) && t.Before(w.Curfew.Add(CozyDuration))
}

// UntilCurfew is how long is left to score. Zero once the curfew has passed.
func (w Window) UntilCurfew(t time.Time) time.Duration {
	if !t.Before(w.Curfew) {
		return 0
	}
	if t.Before(w.Opens) {
		return w.Curfew.Sub(w.Opens)
	}
	return w.Curfew.Sub(t)
}

// Grant is the decision about one heartbeat: how much to bank, and why.
type Grant struct {
	// Points to add to the leaderboard right now.
	BoardPoints int
	// Points to record against the night session, whether or not they count yet.
	SessionPoints int
	// Actions to add to the session's distinct-action counter.
	Actions int
	// Reason is a machine-readable explanation the client can render honestly.
	Reason string
	// CurfewHit is true when this heartbeat arrived after the hard curfew.
	CurfewHit bool
}

// Reasons a heartbeat scored nothing.
const (
	ReasonScored        = "scored"
	ReasonOutsideWindow = "outside_night_window"
	ReasonCurfew        = "curfew"
	ReasonWarmingUp     = "warming_up"
	ReasonHourlyCap     = "hourly_cap"
	ReasonUnknownAction = "unknown_action"
)

// ScoreInput is everything needed to decide a heartbeat, gathered by the caller.
type ScoreInput struct {
	Now    time.Time
	Action Action

	// SessionActions is the distinct-action count *before* this heartbeat.
	SessionActions int
	// SessionPoints is the points banked in the session before this heartbeat.
	SessionPoints int
	// PointsThisHour is what the user already banked in the trailing hour.
	PointsThisHour int

	MinActions     int
	MaxPointsPerHr int
	Start          config.TimeOfDay
	Curfew         config.TimeOfDay
	Location       *time.Location
}

// Score decides what a single scored action is worth.
//
// Three anti-cheat rules from PRD 6.2 live here:
//
//   - Nothing counts until MinActions distinct actions have happened, so a
//     script tapping the screen earns nothing. When the threshold is crossed,
//     the points banked while warming up are released in one go — a real user
//     is not punished for the ramp.
//   - Points are capped per hour, so a tight loop cannot outscore a person.
//   - After the curfew the answer is always zero.
func Score(in ScoreInput) Grant {
	if !in.Action.Valid() {
		return Grant{Reason: ReasonUnknownAction}
	}

	window := WindowFor(in.Now, in.Start, in.Curfew, in.Location)

	if !window.IsOpen(in.Now) {
		// Distinguish "the night has not started" from "the curfew stopped you",
		// because the UI says very different things about each. Cozy Mode is
		// exactly the window in which the curfew is the reason — later in the
		// day the honest answer is simply that the board is shut.
		if window.IsCozy(in.Now) {
			return Grant{Reason: ReasonCurfew, CurfewHit: true}
		}
		return Grant{Reason: ReasonOutsideWindow}
	}

	value := in.Action.Points()
	actions := in.SessionActions + 1

	if actions < in.MinActions {
		// Record it, do not publish it yet.
		return Grant{
			SessionPoints: value,
			Actions:       1,
			Reason:        ReasonWarmingUp,
		}
	}

	// Release the warm-up backlog exactly once, on the crossing heartbeat.
	board := value
	if actions == in.MinActions {
		board += in.SessionPoints
	}

	if in.MaxPointsPerHr > 0 {
		remaining := in.MaxPointsPerHr - in.PointsThisHour
		if remaining <= 0 {
			return Grant{SessionPoints: value, Actions: 1, Reason: ReasonHourlyCap}
		}
		if board > remaining {
			board = remaining
		}
	}

	return Grant{
		BoardPoints:   board,
		SessionPoints: value,
		Actions:       1,
		Reason:        ReasonScored,
	}
}

// ------------------------------------------------------------ week + cocoon ---

// WeekKey is the ISO year-week a time belongs to, e.g. "2026-W37". The Owl Board
// resets weekly and a season badge is kept forever (PRD 6.2).
//
// loc matters here too: a night that runs past midnight local time can fall on
// a different ISO week than the same instant read in UTC, right at a week
// boundary. Converting first keeps this in step with WindowFor and NightKey.
func WeekKey(t time.Time, loc *time.Location) string {
	year, week := t.In(resolveLoc(loc)).ISOWeek()
	return fmt.Sprintf("%d-W%02d", year, week)
}

// WeekEnd is when the current board resets: the start of the next ISO week
// (Monday 00:00 local) after t.
func WeekEnd(t time.Time, loc *time.Location) time.Time {
	loc = resolveLoc(loc)
	t = t.In(loc)
	// Go's Weekday has Sunday=0; ISO weeks start on Monday.
	offset := (int(time.Monday) - int(t.Weekday()) + 7) % 7
	if offset == 0 {
		offset = 7
	}
	next := t.AddDate(0, 0, offset)
	return time.Date(next.Year(), next.Month(), next.Day(), 0, 0, 0, 0, loc)
}

// NightKeysForWeek lists the night keys that belong to the ISO week containing t.
// Used to reconcile the Redis board against the authoritative Postgres totals.
func NightKeysForWeek(t time.Time, start, curfew config.TimeOfDay, loc *time.Location) []string {
	loc = resolveLoc(loc)
	t = t.In(loc)
	// Walk back to Monday of this ISO week.
	offset := (int(t.Weekday()) - int(time.Monday) + 7) % 7
	monday := t.AddDate(0, 0, -offset)

	keys := make([]string, 0, 7)
	for i := range 7 {
		day := monday.AddDate(0, 0, i)
		// Sample a moment inside the night that *begins* on this date, so the
		// key is that date rather than the day before it.
		inside := time.Date(day.Year(), day.Month(), day.Day(), start.Hour, start.Minute, 1, 0, loc)
		keys = append(keys, NightKey(inside, start, curfew, loc))
	}
	return keys
}

// CocoonCheck is the result of testing a rest gap for the recovery bonus.
type CocoonCheck struct {
	Eligible   bool
	SleepHours float64
	DayKey     string
	Reason     string
}

// Cocoon decides whether an inactivity gap earns the recovery bonus. PRD 6.2:
// go fully inactive for COCOON_MIN_SLEEP_HOURS in a 24h period and the badge
// plus Stardust is worth more than a full night's grinding.
//
// The rest-gap math (a Duration, from Sub) is location-independent and correct
// regardless of loc; loc only decides which calendar day the claim is filed
// under, so a claim made just after local midnight lands on the right day.
func Cocoon(now time.Time, lastActivity *time.Time, minSleep time.Duration, loc *time.Location) CocoonCheck {
	dayKey := now.In(resolveLoc(loc)).Format("2006-01-02")

	if lastActivity == nil {
		// No activity on record at all is not the same as resting.
		return CocoonCheck{DayKey: dayKey, Reason: "no_activity_recorded"}
	}
	gap := now.Sub(*lastActivity)
	if gap < 0 {
		gap = 0
	}
	hours := gap.Hours()

	if gap < minSleep {
		return CocoonCheck{DayKey: dayKey, SleepHours: hours, Reason: "not_enough_rest"}
	}
	if gap > 24*time.Hour {
		// A multi-day absence is not a night's sleep; cap the credited hours so
		// a dormant account cannot farm the bonus by simply not logging in.
		hours = 24
	}
	return CocoonCheck{Eligible: true, SleepHours: hours, DayKey: dayKey, Reason: "eligible"}
}
