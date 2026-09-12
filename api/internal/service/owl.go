package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/cache"
	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/owl"
	"github.com/aniketrathour/dronasphere/api/internal/realtime"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

// OwlService runs the night presence leaderboard.
//
// The redesign in PRD 6.2 is load-bearing and this code implements it literally:
// points come from activity, not from being awake; the 3 AM curfew is hard; and
// the Cocoon Bonus for actually sleeping is worth more than a night of grinding.
// There is no code path here that scores "hours awake".
type OwlService struct {
	cfg   *config.Config
	db    *store.DB
	cache *cache.Redis
	bus   realtime.Bus
	log   *slog.Logger
	now   func() time.Time
}

// NewOwlService wires the service. cache may be nil, in which case Postgres is
// the only source of truth and the board is read from snapshots.
func NewOwlService(cfg *config.Config, db *store.DB, c *cache.Redis, bus realtime.Bus, log *slog.Logger, now func() time.Time) *OwlService {
	if now == nil {
		now = time.Now
	}
	return &OwlService{cfg: cfg, db: db, cache: c, bus: bus, log: log, now: now}
}

// OwlGrant is what one action earned, and an honest explanation when it earned
// nothing. The client shows this verbatim rather than guessing.
type OwlGrant struct {
	Points          int            `json:"points"`
	SessionPoints   int            `json:"sessionPoints"`
	WeekPoints      int            `json:"weekPoints"`
	Reason          string         `json:"reason"`
	NightOpen       bool           `json:"nightOpen"`
	CozyMode        bool           `json:"cozyMode"`
	MinutesToCurfew int            `json:"minutesToCurfew"`
	OwlRank         domain.OwlRank `json:"owlRank"`
	OwlRankLabel    string         `json:"owlRankLabel"`
}

// resolveDevice turns a client-supplied fingerprint into the uuid of a row in
// devices. Callers pass the raw X-Device-Fingerprint header, which is an opaque
// string, but night_sessions references devices by id — so the fingerprint has
// to be registered before it can scope a night session.
//
// A missing or unregisterable fingerprint yields "", which means "one shared
// session for this user tonight" rather than an error: the per-device dedupe is
// a defence against multi-device farming, not a reason to refuse a post.
func (s *OwlService) resolveDevice(ctx context.Context, userID, fingerprint string) string {
	if fingerprint == "" {
		return ""
	}
	id, err := s.db.UpsertDevice(ctx, userID, fingerprint, "")
	if err != nil {
		s.log.WarnContext(ctx, "could not register device", "error", err, "user", userID)
		return ""
	}
	return id
}

// RecordAction credits an action to the Owl Board. It never returns an error
// that should fail the underlying action — a leaderboard is not worth losing a
// post over — so callers log and carry on.
//
// fingerprint is the raw X-Device-Fingerprint header, not a device id.
func (s *OwlService) RecordAction(ctx context.Context, userID, fingerprint string, action owl.Action) (*OwlGrant, error) {
	now := s.now()
	window := owl.WindowFor(now, s.cfg.NightWindowStart, s.cfg.NightCurfew, s.cfg.NightLocation)

	deviceID := s.resolveDevice(ctx, userID, fingerprint)
	session, err := s.db.OpenNightSession(ctx, userID, deviceID, window.Key)
	if err != nil {
		return nil, err
	}

	pointsThisHour := 0
	if s.cache != nil {
		if n, err := s.cache.PointsInHour(ctx, userID); err == nil {
			pointsThisHour = n
		}
	}

	grant := owl.Score(owl.ScoreInput{
		Now:            now,
		Action:         action,
		SessionActions: session.ActionCount,
		SessionPoints:  session.Points,
		PointsThisHour: pointsThisHour,
		MinActions:     s.cfg.OwlMinActions,
		MaxPointsPerHr: s.cfg.OwlMaxPointsPerHour,
		Start:          s.cfg.NightWindowStart,
		Curfew:         s.cfg.NightCurfew,
		Location:       s.cfg.NightLocation,
	})

	out := &OwlGrant{
		Points:          grant.BoardPoints,
		Reason:          grant.Reason,
		NightOpen:       window.IsOpen(now),
		CozyMode:        window.IsCozy(now),
		MinutesToCurfew: int(window.UntilCurfew(now).Minutes()),
	}

	if grant.CurfewHit {
		if err := s.db.MarkCurfew(ctx, session.ID); err != nil {
			s.log.WarnContext(ctx, "could not mark curfew", "error", err, "session", session.ID)
		}
		s.publishUser(ctx, userID, realtime.EventOwlCurfew, map[string]any{
			"message":  "The board is closed for tonight. Points resume when the window reopens.",
			"cozyMode": true,
		})
	}

	if grant.Actions == 0 && grant.SessionPoints == 0 {
		return out, nil
	}

	_, sessionPoints, err := s.db.RecordNightActivity(ctx, session.ID, grant.Actions, grant.SessionPoints)
	if err != nil {
		return nil, err
	}
	out.SessionPoints = sessionPoints

	if grant.BoardPoints <= 0 {
		return out, nil
	}

	user, err := s.db.UserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	weekKey := owl.WeekKey(now, s.cfg.NightLocation)
	weekPoints := 0

	if s.cache != nil {
		if _, err := s.cache.AddPointsInHour(ctx, userID, grant.BoardPoints); err != nil {
			s.log.WarnContext(ctx, "could not record the hourly cap", "error", err)
		}
		// PRD 6.2: boards are Global, Campus, Batch and Buddies. The first three
		// are sorted sets; Buddies is derived at read time from the follow graph.
		for _, key := range s.boardKeys(user, weekKey) {
			total, err := s.cache.AddPoints(ctx, key, userID, grant.BoardPoints)
			if err != nil {
				s.log.WarnContext(ctx, "could not add points to a board", "error", err, "key", key)
				continue
			}
			if key == cache.BoardKey("campus", user.CampusID, weekKey) {
				weekPoints = int(total)
			}
		}
	}

	if weekPoints == 0 {
		// No Redis, or the campus board write failed: fall back to the
		// authoritative Postgres totals.
		nightKeys := owl.NightKeysForWeek(now, s.cfg.NightWindowStart, s.cfg.NightCurfew, s.cfg.NightLocation)
		if total, err := s.db.NightPointsForWeek(ctx, userID, nightKeys); err == nil {
			weekPoints = total
		}
	}
	out.WeekPoints = weekPoints

	rank := domain.RankForPoints(weekPoints)
	out.OwlRank = rank
	out.OwlRankLabel = rank.Label()
	if rank != user.OwlRank {
		if err := s.db.SetOwlRank(ctx, userID, rank); err != nil {
			s.log.WarnContext(ctx, "could not update owl rank", "error", err)
		}
	}

	s.publishUser(ctx, userID, realtime.EventOwlPoints, out)
	return out, nil
}

// boardKeys lists the sorted sets an action should credit.
func (s *OwlService) boardKeys(u *domain.UserPrivate, weekKey string) []string {
	keys := []string{
		cache.BoardKey("global", "", weekKey),
		cache.BoardKey("campus", u.CampusID, weekKey),
	}
	if u.Batch != "" {
		keys = append(keys, cache.BoardKey("batch", u.CampusID+":"+u.Batch, weekKey))
	}
	return keys
}

// HeartbeatStatus is what a heartbeat reports back. Note what is missing: a
// heartbeat never earns points. Passive presence earns nothing (PRD 6.2), so
// this only keeps the session and the presence key alive.
type HeartbeatStatus struct {
	NightOpen       bool           `json:"nightOpen"`
	CozyMode        bool           `json:"cozyMode"`
	NightKey        string         `json:"nightKey"`
	OpensAt         time.Time      `json:"opensAt"`
	CurfewAt        time.Time      `json:"curfewAt"`
	MinutesToCurfew int            `json:"minutesToCurfew"`
	SessionPoints   int            `json:"sessionPoints"`
	SessionActions  int            `json:"sessionActions"`
	ActionsToCount  int            `json:"actionsToCount"`
	WeekPoints      int            `json:"weekPoints"`
	Rank            int            `json:"rank"`
	OwlRank         domain.OwlRank `json:"owlRank"`
	OwlRankLabel    string         `json:"owlRankLabel"`
	// Message is the honest line the UI shows. After the curfew it says go to bed.
	Message string `json:"message"`
}

// Heartbeat keeps a night session and presence alive.
func (s *OwlService) Heartbeat(ctx context.Context, userID, campusID, fingerprint string) (*HeartbeatStatus, error) {
	now := s.now()
	window := owl.WindowFor(now, s.cfg.NightWindowStart, s.cfg.NightCurfew, s.cfg.NightLocation)

	deviceID := s.resolveDevice(ctx, userID, fingerprint)
	session, err := s.db.OpenNightSession(ctx, userID, deviceID, window.Key)
	if err != nil {
		return nil, httpx.Internal("could not open your night session").WithCause(err)
	}
	if _, _, err := s.db.RecordNightActivity(ctx, session.ID, 0, 0); err != nil {
		s.log.WarnContext(ctx, "could not touch the night session", "error", err)
	}
	if err := s.db.TouchLastSeen(ctx, userID); err != nil {
		s.log.WarnContext(ctx, "could not touch last seen", "error", err)
	}

	nightOpen := window.IsOpen(now)
	if s.cache != nil {
		if err := s.cache.MarkOnline(ctx, userID, nightOpen); err != nil {
			s.log.WarnContext(ctx, "could not mark presence", "error", err)
		}
	}

	weekKey := owl.WeekKey(now, s.cfg.NightLocation)
	status := &HeartbeatStatus{
		NightOpen:       nightOpen,
		CozyMode:        window.IsCozy(now),
		NightKey:        window.Key,
		OpensAt:         window.Opens,
		CurfewAt:        window.Curfew,
		MinutesToCurfew: int(window.UntilCurfew(now).Minutes()),
		SessionPoints:   session.Points,
		SessionActions:  session.ActionCount,
		ActionsToCount:  max(s.cfg.OwlMinActions-session.ActionCount, 0),
	}

	if s.cache != nil {
		if rank, points, ok, err := s.cache.RankOf(ctx, cache.BoardKey("campus", campusID, weekKey), userID); err == nil && ok {
			status.Rank = rank
			status.WeekPoints = points
		}
	}
	if status.WeekPoints == 0 {
		nightKeys := owl.NightKeysForWeek(now, s.cfg.NightWindowStart, s.cfg.NightCurfew, s.cfg.NightLocation)
		if total, err := s.db.NightPointsForWeek(ctx, userID, nightKeys); err == nil {
			status.WeekPoints = total
		}
	}
	status.OwlRank = domain.RankForPoints(status.WeekPoints)
	status.OwlRankLabel = status.OwlRank.Label()

	switch {
	case status.CozyMode:
		status.Message = "The board closed at " + s.cfg.NightCurfew.String() + ". Points are paused until tomorrow night."
	case nightOpen:
		status.Message = "Night window is open. " + s.cfg.NightCurfew.String() + " is the hard stop."
	default:
		status.Message = "The board opens at " + s.cfg.NightWindowStart.String() + "."
	}
	return status, nil
}

// BurrowMinutes credits completed focus time from a Study Burrow (PRD 7.3),
// which is the one way to earn points without posting anything.
func (s *OwlService) BurrowMinutes(ctx context.Context, userID, fingerprint string, minutes int) (*OwlGrant, error) {
	if minutes <= 0 || minutes > 180 {
		return nil, httpx.BadRequest("minutes must be 1–180")
	}

	var last *OwlGrant
	for range minutes {
		grant, err := s.RecordAction(ctx, userID, fingerprint, owl.ActionBurrowMinute)
		if err != nil {
			return nil, httpx.Internal("could not credit your focus time").WithCause(err)
		}
		last = grant
		if grant.Reason == owl.ReasonCurfew || grant.Reason == owl.ReasonHourlyCap {
			break
		}
	}
	return last, nil
}

// Board reads a leaderboard.
//
// scope is global | campus | batch | buddies. Redis is the fast path; if a board
// is cold — a fresh deploy, a Redis restart — the Postgres snapshots are used so
// the board is never empty.
func (s *OwlService) Board(ctx context.Context, viewerID, campusID, scope string, limit int) (*domain.OwlBoard, error) {
	now := s.now()
	weekKey := owl.WeekKey(now, s.cfg.NightLocation)
	window := owl.WindowFor(now, s.cfg.NightWindowStart, s.cfg.NightCurfew, s.cfg.NightLocation)

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	board := &domain.OwlBoard{
		Scope:     scope,
		WeekKey:   weekKey,
		CozyMode:  window.IsCozy(now),
		NightOpen: window.IsOpen(now),
		ResetsAt:  owl.WeekEnd(now, s.cfg.NightLocation),
		Entries:   []domain.OwlEntry{},
	}

	if scope == "buddies" {
		return s.buddiesBoard(ctx, viewerID, weekKey, board, limit)
	}

	scopeID := ""
	switch scope {
	case "campus":
		scopeID = campusID
	case "batch":
		viewer, err := s.db.UserByID(ctx, viewerID)
		if err != nil {
			return nil, notFoundOr(err, "we could not find your account")
		}
		if viewer.Batch == "" {
			return board, nil
		}
		scopeID = viewer.CampusID + ":" + viewer.Batch
	case "global":
	default:
		return nil, httpx.BadRequest("scope must be global, campus, batch or buddies")
	}

	key := cache.BoardKey(scope, scopeID, weekKey)

	var entries []cache.BoardEntry
	if s.cache != nil {
		var err error
		entries, err = s.cache.Top(ctx, key, limit)
		if err != nil {
			s.log.WarnContext(ctx, "owl board read from redis failed, falling back", "error", err)
		}
	}

	if len(entries) == 0 {
		snapshotCampus := campusID
		if scope == "global" {
			snapshotCampus = ""
		}
		rows, err := s.db.OwlBoardFromSnapshots(ctx, weekKey, snapshotCampus, limit)
		if err != nil {
			return nil, httpx.Internal("could not load the board").WithCause(err)
		}
		for i, r := range rows {
			board.Entries = append(board.Entries, domain.OwlEntry{
				Rank:         i + 1,
				User:         r.User,
				Points:       r.Points,
				OwlRank:      domain.RankForPoints(r.Points),
				OwlRankLabel: domain.RankForPoints(r.Points).Label(),
				IsViewer:     r.User.ID == viewerID,
			})
			if r.User.ID == viewerID {
				board.ViewerRank = i + 1
				board.ViewerPoints = r.Points
			}
		}
		return board, nil
	}

	ids := make([]string, 0, len(entries))
	for _, e := range entries {
		ids = append(ids, e.UserID)
	}
	users, err := s.db.UsersByIDs(ctx, ids)
	if err != nil {
		return nil, httpx.Internal("could not load the board").WithCause(err)
	}

	for i, e := range entries {
		u, ok := users[e.UserID]
		if !ok {
			continue // a deleted account still sitting in the sorted set
		}
		rank := domain.RankForPoints(e.Points)
		board.Entries = append(board.Entries, domain.OwlEntry{
			Rank:         i + 1,
			User:         u,
			Points:       e.Points,
			OwlRank:      rank,
			OwlRankLabel: rank.Label(),
			IsViewer:     e.UserID == viewerID,
		})
	}

	// "You're #47" even when the viewer is far off the visible page.
	if s.cache != nil {
		if rank, points, ok, err := s.cache.RankOf(ctx, key, viewerID); err == nil && ok {
			board.ViewerRank = rank
			board.ViewerPoints = points
		}
	}
	return board, nil
}

// buddiesBoard ranks mutual follows only, derived from the graph at read time.
func (s *OwlService) buddiesBoard(ctx context.Context, viewerID, weekKey string, board *domain.OwlBoard, limit int) (*domain.OwlBoard, error) {
	following, err := s.db.ListFollowing(ctx, viewerID, 500)
	if err != nil {
		return nil, httpx.Internal("could not load your buddies").WithCause(err)
	}

	ids := []string{viewerID}
	for _, u := range following {
		rel, err := s.db.RelationshipBetween(ctx, viewerID, u.ID)
		if err != nil {
			continue
		}
		if rel.IsBuddy() {
			ids = append(ids, u.ID)
		}
	}

	viewer, err := s.db.UserByID(ctx, viewerID)
	if err != nil {
		return nil, notFoundOr(err, "we could not find your account")
	}
	campusKey := cache.BoardKey("campus", viewer.CampusID, weekKey)

	type scored struct {
		id     string
		points int
	}
	rows := make([]scored, 0, len(ids))
	fromRedis := 0
	for _, id := range ids {
		points := 0
		if s.cache != nil {
			if _, p, ok, err := s.cache.RankOf(ctx, campusKey, id); err == nil && ok {
				points = p
				fromRedis++
			}
		}
		rows = append(rows, scored{id: id, points: points})
	}

	// Cold Redis: fall back to the Postgres snapshots, same as the scoped boards.
	if fromRedis == 0 {
		if snapshot, err := s.db.OwlPointsForUsers(ctx, weekKey, ids); err == nil {
			for i := range rows {
				rows[i].points = snapshot[rows[i].id]
			}
		}
	}

	// Small n (a buddy list, not a campus), so an insertion sort is plenty.
	for i := 1; i < len(rows); i++ {
		for j := i; j > 0 && rows[j].points > rows[j-1].points; j-- {
			rows[j], rows[j-1] = rows[j-1], rows[j]
		}
	}
	if len(rows) > limit {
		rows = rows[:limit]
	}

	users, err := s.db.UsersByIDs(ctx, ids)
	if err != nil {
		return nil, httpx.Internal("could not load your buddies").WithCause(err)
	}
	for i, r := range rows {
		u, ok := users[r.id]
		if !ok {
			continue
		}
		rank := domain.RankForPoints(r.points)
		board.Entries = append(board.Entries, domain.OwlEntry{
			Rank: i + 1, User: u, Points: r.points,
			OwlRank: rank, OwlRankLabel: rank.Label(), IsViewer: r.id == viewerID,
		})
		if r.id == viewerID {
			board.ViewerRank = i + 1
			board.ViewerPoints = r.points
		}
	}
	return board, nil
}

// CocoonResult is the outcome of claiming the recovery bonus.
type CocoonResult struct {
	Awarded    bool    `json:"awarded"`
	SleepHours float64 `json:"sleepHours"`
	Stardust   int     `json:"stardust"`
	Balance    int     `json:"balance"`
	Message    string  `json:"message"`
}

// ClaimCocoon awards the recovery bonus for a real rest gap.
//
// PRD 11 tracks the claim rate as a health signal: if it is near zero, the
// curfew design has failed. That makes this the most important endpoint in the
// Owl Board, not a footnote.
func (s *OwlService) ClaimCocoon(ctx context.Context, userID string) (*CocoonResult, error) {
	now := s.now()

	lastActivity, err := s.db.LastActivityAt(ctx, userID)
	if err != nil {
		return nil, httpx.Internal("could not check your rest").WithCause(err)
	}

	check := owl.Cocoon(now, lastActivity, s.cfg.CocoonMinSleep, s.cfg.NightLocation)
	if !check.Eligible {
		return &CocoonResult{
			SleepHours: check.SleepHours,
			Message: "no bonus yet — it needs " +
				formatHours(s.cfg.CocoonMinSleep) + " away from the app in a day 🛏️",
		}, nil
	}

	claimed, err := s.db.CocoonAlreadyClaimed(ctx, userID, check.DayKey)
	if err != nil {
		return nil, httpx.Internal("could not check today's bonus").WithCause(err)
	}
	if claimed {
		return &CocoonResult{SleepHours: check.SleepHours, Message: "Already claimed today. Come back after your next full rest."}, nil
	}

	if err := s.db.ClaimCocoon(ctx, userID, check.DayKey, check.SleepHours, s.cfg.CocoonStardust); err != nil {
		if errors.Is(err, store.ErrConflict) {
			return &CocoonResult{SleepHours: check.SleepHours, Message: "Already claimed today. Come back after your next full rest."}, nil
		}
		return nil, httpx.Internal("could not award the bonus").WithCause(err)
	}

	balance, err := s.db.AddStardust(ctx, userID, s.cfg.CocoonStardust, domain.StardustCocoonBonus, check.DayKey)
	if err != nil {
		return nil, httpx.Internal("the bonus was recorded but the Stardust was not").WithCause(err)
	}
	if err := s.db.GrantBadge(ctx, userID, "COCOON"); err != nil {
		s.log.WarnContext(ctx, "could not grant the cocoon badge", "error", err)
	}

	result := &CocoonResult{
		Awarded:    true,
		SleepHours: check.SleepHours,
		Stardust:   s.cfg.CocoonStardust,
		Balance:    balance,
		Message:    "A full rest logged. That beats a whole night of grinding.",
	}
	s.publishUser(ctx, userID, realtime.EventOwlCocoon, result)
	return result, nil
}

// SnapshotBoards copies the current week's Redis boards into Postgres. Run on a
// timer so history survives the weekly reset (PRD 6.2) and so a Redis loss does
// not erase the season.
func (s *OwlService) SnapshotBoards(ctx context.Context, campusIDs []string) error {
	if s.cache == nil {
		return nil
	}
	weekKey := owl.WeekKey(s.now(), s.cfg.NightLocation)

	for _, campusID := range campusIDs {
		key := cache.BoardKey("campus", campusID, weekKey)
		entries, err := s.cache.Top(ctx, key, 500)
		if err != nil {
			return err
		}
		for i, e := range entries {
			rank := domain.RankForPoints(e.Points)
			if err := s.db.SnapshotOwlScore(ctx, e.UserID, campusID, weekKey, e.Points, i+1, rank); err != nil {
				s.log.WarnContext(ctx, "could not snapshot an owl score", "error", err, "user", e.UserID)
			}
		}
		s.log.InfoContext(ctx, "owl board snapshot written", "campus", campusID, "week", weekKey, "rows", len(entries))
	}
	return nil
}

func (s *OwlService) publishUser(ctx context.Context, userID string, t realtime.EventType, payload any) {
	ev, err := realtime.NewEvent(t, realtime.UserChannel(userID), payload)
	if err != nil {
		return
	}
	if err := s.bus.Publish(ctx, ev); err != nil {
		s.log.WarnContext(ctx, "publish failed", "error", err, "type", t)
	}
}

func formatHours(d time.Duration) string {
	h := d.Hours()
	if h == float64(int(h)) {
		return time.Duration(d).String()
	}
	return d.Round(time.Minute).String()
}
