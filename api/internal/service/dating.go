package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/realtime"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

// DatingService owns Love Finder: the deck, swipes, the matches they make,
// and the card each person writes for it (PRD 6.3).
//
// Every entry point starts at users.EnsureCanUseDating, so the 18+ / photo /
// campus-size / opted-in gate is asked once, of one implementation, and a
// client that skips the UI still cannot reach a single one of these.
type DatingService struct {
	cfg   *config.Config
	db    *store.DB
	users *UserService
	bus   realtime.Bus
	log   *slog.Logger
	now   func() time.Time
}

// NewDatingService wires the service.
func NewDatingService(cfg *config.Config, db *store.DB, users *UserService, bus realtime.Bus, log *slog.Logger, now func() time.Time) *DatingService {
	if now == nil {
		now = time.Now
	}
	return &DatingService{cfg: cfg, db: db, users: users, bus: bus, log: log, now: now}
}

// Card limits. Hardcoded beside the rule they encode rather than in .env, the
// same call CreateDen makes for the 256-member cap: these are product shape,
// not deployment tuning, and a campus that "fixes" them by loosening an env
// var has changed the product, not configured it.
const (
	maxVibeLen      = 60
	maxInterests    = 6
	maxInterestLen  = 40
	maxPrompts      = 3
	maxQuestionLen  = 120
	maxAnswerLen    = 160
	dailyTwinkles   = 1 // PRD 6.3 — scarce on purpose; a signal that costs nothing says nothing
	deckDefaultSize = 20
)

// ------------------------------------------------------------------ card ----

// Profile returns the viewer's own Love Finder card.
func (s *DatingService) Profile(ctx context.Context, userID string) (domain.DatingProfile, error) {
	if _, err := s.users.EnsureCanUseDating(ctx, userID); err != nil {
		return domain.DatingProfile{}, err
	}
	p, err := s.db.DatingProfileByUserID(ctx, userID)
	if err != nil {
		return domain.DatingProfile{}, httpx.Internal("could not load your card").WithCause(err)
	}
	return p, nil
}

// SaveProfileRequest is the whole card — it is written as one unit, the way
// it is edited, so a partial update is not a thing here.
type SaveProfileRequest struct {
	Vibe      string                `json:"vibe"`
	Interests []string              `json:"interests"`
	Prompts   []domain.DatingPrompt `json:"prompts"`
}

// SaveProfile validates and replaces the viewer's card.
func (s *DatingService) SaveProfile(ctx context.Context, userID string, req SaveProfileRequest) (domain.DatingProfile, error) {
	if _, err := s.users.EnsureCanUseDating(ctx, userID); err != nil {
		return domain.DatingProfile{}, err
	}

	fields := map[string]string{}

	vibe := strings.TrimSpace(req.Vibe)
	if len(vibe) > maxVibeLen {
		fields["vibe"] = "60 characters max"
	}

	interests := make([]string, 0, len(req.Interests))
	seen := map[string]bool{}
	for _, raw := range req.Interests {
		interest := strings.TrimSpace(raw)
		if interest == "" {
			continue
		}
		if len(interest) > maxInterestLen {
			fields["interests"] = "40 characters each, max"
			break
		}
		if seen[strings.ToLower(interest)] {
			continue
		}
		seen[strings.ToLower(interest)] = true
		interests = append(interests, interest)
	}
	if len(interests) > maxInterests {
		fields["interests"] = "six at most"
	}

	prompts := make([]domain.DatingPrompt, 0, len(req.Prompts))
	for _, raw := range req.Prompts {
		question := strings.TrimSpace(raw.Question)
		answer := strings.TrimSpace(raw.Answer)
		if question == "" || answer == "" {
			// A half-written block is dropped, not an error — the editor lets
			// you add a prompt before answering it.
			continue
		}
		if len(question) > maxQuestionLen {
			fields["prompts"] = "that question is too long"
			break
		}
		if len(answer) > maxAnswerLen {
			fields["prompts"] = "160 characters per answer"
			break
		}
		prompts = append(prompts, domain.DatingPrompt{Question: question, Answer: answer})
	}
	if len(prompts) > maxPrompts {
		fields["prompts"] = "three at most"
	}

	if len(fields) > 0 {
		return domain.DatingProfile{}, httpx.Validation(fields)
	}

	saved, err := s.db.UpsertDatingProfile(ctx, userID, domain.DatingProfile{
		Vibe: vibe, Interests: interests, Prompts: prompts,
	})
	if err != nil {
		return domain.DatingProfile{}, httpx.Internal("could not save your card").WithCause(err)
	}
	return saved, nil
}

// ------------------------------------------------------------------ deck ----

// DeckResponse carries the cards plus the one piece of state the deck's UI
// needs alongside them, so rendering it is one request, not two.
type DeckResponse struct {
	Items        []domain.DatingCandidate `json:"items"`
	TwinklesLeft int                      `json:"twinklesLeft"`
}

// Deck returns people the viewer has not swiped on yet.
func (s *DatingService) Deck(ctx context.Context, userID string, limit int) (*DeckResponse, error) {
	viewer, err := s.users.EnsureCanUseDating(ctx, userID)
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = deckDefaultSize
	}

	now := s.now()
	records, err := s.db.Deck(ctx, userID, viewer.CampusID, limit)
	if err != nil {
		return nil, httpx.Internal("could not load the deck").WithCause(err)
	}

	items := make([]domain.DatingCandidate, 0, len(records))
	for _, rec := range records {
		// The candidate's own 18+ gate — never only the viewer's problem.
		if !rec.User.IsAdultAt(now) {
			continue
		}
		items = append(items, domain.DatingCandidate{
			User:          Public(rec.User, false, store.Relationship{}, now),
			DatingProfile: rec.Profile,
		})
	}

	left, err := s.twinklesLeft(ctx, userID, now)
	if err != nil {
		return nil, err
	}
	return &DeckResponse{Items: items, TwinklesLeft: left}, nil
}

// twinklesLeft counts today's Twinkles against the daily allowance. "Today"
// is a calendar day in the campus's own timezone (the same NIGHT_TIMEZONE the
// Owl Board's night window uses) — a day boundary at UTC midnight would land
// at 05:30 local for the beachhead campus, mid-evening for others.
func (s *DatingService) twinklesLeft(ctx context.Context, userID string, now time.Time) (int, error) {
	local := now.In(s.cfg.NightLocation)
	midnight := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, s.cfg.NightLocation)

	used, err := s.db.TwinklesUsedSince(ctx, userID, midnight.UTC())
	if err != nil {
		return 0, httpx.Internal("could not check your Twinkles").WithCause(err)
	}
	return max(dailyTwinkles-used, 0), nil
}

// ----------------------------------------------------------------- swipe ----

// SwipeRequest is one decision on one person.
type SwipeRequest struct {
	Handle string             `json:"handle"`
	Action domain.SwipeAction `json:"action"`
	// What was liked. Optional: a plain right-swipe with no target is a like
	// on the picture, which is what the drag gesture means.
	Target *domain.SwipeTarget `json:"target,omitempty"`
	// The optional comment sent with a like (Hinge's "like with a comment").
	Note string `json:"note"`
}

// SwipeResult reports what the decision did.
type SwipeResult struct {
	Matched      bool                `json:"matched"`
	Match        *domain.DatingMatch `json:"match,omitempty"`
	TwinklesLeft int                 `json:"twinklesLeft"`
}

// maxNoteLen bounds the comment that rides along with a like.
const maxNoteLen = 220

// Swipe records a decision, and opens a Nest if it completed a mutual like.
func (s *DatingService) Swipe(ctx context.Context, userID string, req SwipeRequest) (*SwipeResult, error) {
	viewer, err := s.users.EnsureCanUseDating(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !domain.ValidSwipeAction(req.Action) {
		return nil, httpx.Validation(map[string]string{"action": "must be PASS, LIKE or TWINKLE"})
	}

	note := strings.TrimSpace(req.Note)
	if len(note) > maxNoteLen {
		return nil, httpx.Validation(map[string]string{"note": "220 characters max"})
	}
	if req.Action == domain.SwipePass {
		// A pass carries no comment and no target; drop both rather than
		// storing something nobody will ever read.
		note = ""
		req.Target = nil
	}

	if req.Target != nil {
		switch req.Target.Kind {
		case domain.TargetPhoto:
			req.Target.PromptIndex = nil
		case domain.TargetPrompt:
			if req.Target.PromptIndex == nil || *req.Target.PromptIndex < 0 || *req.Target.PromptIndex >= maxPrompts {
				return nil, httpx.Validation(map[string]string{"target": "that answer does not exist"})
			}
		default:
			return nil, httpx.Validation(map[string]string{"target": "must be PHOTO or PROMPT"})
		}
	}

	target, err := s.db.UserByHandle(ctx, req.Handle)
	if err != nil {
		return nil, notFoundOr(err, "no account with that handle")
	}
	if target.ID == userID {
		return nil, httpx.BadRequest("you cannot swipe on yourself")
	}

	blocked, err := s.db.IsBlockedEitherWay(ctx, userID, target.ID)
	if err != nil {
		return nil, httpx.Internal("could not check that account").WithCause(err)
	}
	if blocked {
		// Do not confirm the account exists to someone it blocked.
		return nil, httpx.NotFound("no account with that handle")
	}

	now := s.now()
	left, err := s.twinklesLeft(ctx, userID, now)
	if err != nil {
		return nil, err
	}
	if req.Action == domain.SwipeTwinkle && left <= 0 {
		return nil, httpx.RateLimited("no Twinkles left today").
			WithFriendly("that's today's Twinkle spent — there's another tomorrow ✨")
	}

	matchID, matched, err := s.db.Swipe(ctx, userID, target.ID, req.Action, req.Target, note, now.Add(s.cfg.MatchWilt))
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			return nil, httpx.Conflict("you already decided on this person").
				WithFriendly("you've already seen this one")
		}
		return nil, httpx.Internal("could not save that").WithCause(err)
	}

	result := &SwipeResult{Matched: matched}
	if result.TwinklesLeft, err = s.twinklesLeft(ctx, userID, now); err != nil {
		return nil, err
	}
	if !matched {
		return result, nil
	}

	// A match opens a Nest. If this fails the match still stands — Matches()
	// backfills the thread on the next read rather than losing the match over
	// a transient database error.
	if threadID, err := s.db.GetOrCreateNestThread(ctx, userID, target.ID); err != nil {
		s.log.WarnContext(ctx, "match thread not created", "error", err, "match", matchID)
	} else if err := s.db.SetMatchThread(ctx, matchID, threadID); err != nil {
		s.log.WarnContext(ctx, "match thread not attached", "error", err, "match", matchID)
	}

	matches, err := s.Matches(ctx, userID)
	if err == nil {
		for i := range matches {
			if matches[i].Handle == target.Handle {
				result.Match = &matches[i]
				break
			}
		}
	}

	// Tell the other side, so a match shows up without a refresh. They hear
	// about the person who just completed it — the viewer — not themselves.
	s.publish(ctx, target.ID, realtime.EventMatchNew, map[string]any{
		"handle":      viewer.Handle,
		"displayName": viewer.DisplayName,
	})
	return result, nil
}

// ----------------------------------------------------------------- lists ----

// Likes lists people who liked the viewer and are still waiting on an answer.
func (s *DatingService) Likes(ctx context.Context, userID string, limit int) ([]domain.DatingLike, error) {
	if _, err := s.users.EnsureCanUseDating(ctx, userID); err != nil {
		return nil, err
	}

	records, err := s.db.IncomingLikes(ctx, userID, limit)
	if err != nil {
		return nil, httpx.Internal("could not load your likes").WithCause(err)
	}

	now := s.now()
	out := make([]domain.DatingLike, 0, len(records))
	for _, rec := range records {
		if !rec.Candidate.User.IsAdultAt(now) {
			continue
		}
		like := domain.DatingLike{
			ID:        rec.ID,
			Action:    rec.Action,
			Note:      rec.Note,
			CreatedAt: rec.CreatedAt,
			Candidate: domain.DatingCandidate{
				User:          Public(rec.Candidate.User, false, store.Relationship{}, now),
				DatingProfile: rec.Candidate.Profile,
			},
		}
		if rec.TargetKind != nil {
			like.Target = domain.SwipeTarget{Kind: *rec.TargetKind, PromptIndex: rec.TargetPromptIndex}
		} else {
			like.Target = domain.SwipeTarget{Kind: domain.TargetPhoto}
		}
		out = append(out, like)
	}
	return out, nil
}

// Matches lists the viewer's live matches, backfilling any Nest thread that
// did not get created at match time.
func (s *DatingService) Matches(ctx context.Context, userID string) ([]domain.DatingMatch, error) {
	if _, err := s.users.EnsureCanUseDating(ctx, userID); err != nil {
		return nil, err
	}

	now := s.now()
	records, err := s.db.MatchesForUser(ctx, userID, now)
	if err != nil {
		return nil, httpx.Internal("could not load your matches").WithCause(err)
	}

	out := make([]domain.DatingMatch, 0, len(records))
	for _, rec := range records {
		threadID := rec.ThreadID
		if threadID == "" {
			// Self-healing: the match exists, its thread did not land. Make it
			// now rather than hand the client a match it cannot open.
			if id, err := s.db.GetOrCreateNestThread(ctx, userID, rec.Candidate.User.ID); err != nil {
				s.log.WarnContext(ctx, "match thread backfill failed", "error", err, "match", rec.ID)
			} else {
				threadID = id
				if err := s.db.SetMatchThread(ctx, rec.ID, id); err != nil {
					s.log.WarnContext(ctx, "match thread backfill not saved", "error", err, "match", rec.ID)
				}
			}
		}

		out = append(out, domain.DatingMatch{
			Handle:    rec.Candidate.User.Handle,
			ThreadID:  threadID,
			CreatedAt: rec.CreatedAt,
			WiltsAt:   rec.WiltsAt,
			Opener:    rec.Opener,
			Candidate: domain.DatingCandidate{
				User:          Public(rec.Candidate.User, false, store.Relationship{}, now),
				DatingProfile: rec.Candidate.Profile,
			},
		})
	}
	return out, nil
}

// Unmatch closes a match. The other side is not notified (PRD 6.3 — quietly).
func (s *DatingService) Unmatch(ctx context.Context, userID, handle string) error {
	if _, err := s.users.EnsureCanUseDating(ctx, userID); err != nil {
		return err
	}
	target, err := s.db.UserByHandle(ctx, handle)
	if err != nil {
		return notFoundOr(err, "no account with that handle")
	}
	if err := s.db.Unmatch(ctx, userID, target.ID); err != nil {
		return notFoundOr(err, "you are not matched with them")
	}
	return nil
}

func (s *DatingService) publish(ctx context.Context, userID string, t realtime.EventType, payload any) {
	if s.bus == nil {
		return
	}
	ev, err := realtime.NewEvent(t, realtime.UserChannel(userID), payload)
	if err != nil {
		return
	}
	if err := s.bus.Publish(ctx, ev); err != nil {
		s.log.WarnContext(ctx, "publish failed", "error", err, "type", t)
	}
}
