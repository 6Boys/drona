package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/realtime"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

// UserService owns profiles, the social graph and the onboarding gate.
type UserService struct {
	cfg *config.Config
	db  *store.DB
	bus realtime.Bus
	log *slog.Logger
	now func() time.Time
}

// NewUserService wires the service.
func NewUserService(cfg *config.Config, db *store.DB, bus realtime.Bus, log *slog.Logger, now func() time.Time) *UserService {
	if now == nil {
		now = time.Now
	}
	return &UserService{cfg: cfg, db: db, bus: bus, log: log, now: now}
}

// Public projects an internal record into the wire shape.
//
// Two rules from the PRD are enforced here rather than trusted to handlers:
// the date of birth never leaves the server (10), and follower counts appear on
// profiles but never on posts (6.7) — which is why Post carries no author counts.
func Public(u *domain.UserPrivate, self bool, rel store.Relationship, now time.Time) domain.User {
	out := u.User
	out.OwlRankLabel = u.OwlRank.Label()
	out.PhotoVerified = u.PhotoVerifiedAt != nil

	if self {
		out.Email = u.Email
		adult := u.IsAdultAt(now)
		out.IsAdult = &adult
	} else {
		out.Email = ""
		out.IsAdult = nil
	}

	out.ViewerFollows = rel.ViewerFollows
	out.FollowsViewer = rel.FollowsViewer
	out.IsBuddy = rel.IsBuddy()
	return out
}

// MeResponse is the home-screen bootstrap payload.
type MeResponse struct {
	User domain.User `json:"user"`
	// Onboarding state, so the client always knows where to send the user.
	OnboardingStep   domain.OnboardingStep `json:"onboardingStep"`
	FollowingCount   int                   `json:"followingCount"`
	FollowsRemaining int                   `json:"followsRemaining"`
	// Feature availability, resolved server-side so the client never has to
	// guess at a gate (PRD 6.3: these gate at the account level, not the UI).
	LoveFinderAvailable bool   `json:"loveFinderAvailable"`
	LoveFinderReason    string `json:"loveFinderReason,omitempty"`
	CampusVerifiedUsers int    `json:"campusVerifiedUsers"`
}

// Me returns the signed-in user plus their gates.
func (s *UserService) Me(ctx context.Context, userID string) (*MeResponse, error) {
	u, err := s.db.UserByID(ctx, userID)
	if err != nil {
		return nil, notFoundOr(err, "we could not find your account")
	}

	following, err := s.db.FollowingCount(ctx, userID)
	if err != nil {
		return nil, httpx.Internal("could not load your follows").WithCause(err)
	}
	campusCount, err := s.db.CampusVerifiedCount(ctx, u.CampusID)
	if err != nil {
		return nil, httpx.Internal("could not load your campus").WithCause(err)
	}

	now := s.now()
	resp := &MeResponse{
		User:                Public(u, true, store.Relationship{}, now),
		OnboardingStep:      u.OnboardingStep,
		FollowingCount:      following,
		FollowsRemaining:    max(s.cfg.OnboardingMinFollows-following, 0),
		CampusVerifiedUsers: campusCount,
	}

	if err := s.loveFinderGate(u, campusCount, now); err != nil {
		resp.LoveFinderReason = err.Error()
	} else {
		resp.LoveFinderAvailable = true
	}
	return resp, nil
}

// loveFinderGate collects every dating gate into one answer.
//
// PRD 6.3, verbatim in spirit: 18+ only, gated at the account level; photo
// verification before entering the deck; and the feature stays locked until the
// campus has DATING_UNLOCK_MIN_USERS verified users, because below that the pool
// is so thin the feature dies on arrival.
func (s *UserService) loveFinderGate(u *domain.UserPrivate, campusVerified int, now time.Time) error {
	if campusVerified < s.cfg.DatingUnlockMinUsers {
		return fmt.Errorf("Love Finder unlocks once %d students from your campus have joined (%d so far)",
			s.cfg.DatingUnlockMinUsers, campusVerified)
	}
	return u.CanUseDating(now)
}

// Profile returns another student's profile from the viewer's perspective.
func (s *UserService) Profile(ctx context.Context, viewerID, handle string) (domain.User, error) {
	u, err := s.db.UserByHandle(ctx, handle)
	if err != nil {
		return domain.User{}, notFoundOr(err, "no account with that handle")
	}

	blocked, err := s.db.IsBlockedEitherWay(ctx, viewerID, u.ID)
	if err != nil {
		return domain.User{}, httpx.Internal("could not check that profile").WithCause(err)
	}
	if blocked {
		// Do not confirm the account exists to someone it blocked.
		return domain.User{}, httpx.NotFound("no account with that handle")
	}

	rel, err := s.db.RelationshipBetween(ctx, viewerID, u.ID)
	if err != nil {
		return domain.User{}, httpx.Internal("could not load that profile").WithCause(err)
	}

	out := Public(u, viewerID == u.ID, rel, s.now())
	// A private account shows the shell, not the contents (PRD 6.7).
	if u.IsPrivate && !rel.ViewerFollows && viewerID != u.ID {
		out.Bio = ""
	}
	return out, nil
}

// UpdateProfileRequest is a partial profile update. Nil fields are untouched.
type UpdateProfileRequest struct {
	Handle      *string `json:"handle"`
	DisplayName *string `json:"displayName"`
	Bio         *string `json:"bio"`
	// DOB is write-only. It is collected at signup for the age gate and never
	// displayed (PRD 6.3, 10).
	DOB       *string `json:"dob"`
	Batch     *string `json:"batch"`
	Branch    *string `json:"branch"`
	Year      *int    `json:"year"`
	IsPrivate *bool   `json:"isPrivate"`
}

// UpdateProfile validates and applies a profile change, then advances onboarding.
func (s *UserService) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (*MeResponse, error) {
	current, err := s.db.UserByID(ctx, userID)
	if err != nil {
		return nil, notFoundOr(err, "we could not find your account")
	}

	params := store.UpdateProfileParams{IsPrivate: req.IsPrivate}
	fields := map[string]string{}

	if req.Handle != nil {
		h := strings.ToLower(strings.TrimSpace(*req.Handle))
		if err := ValidateHandle(h); err != nil {
			return nil, err
		}
		taken, err := s.db.HandleTaken(ctx, h, userID)
		if err != nil {
			return nil, httpx.Internal("could not check that handle").WithCause(err)
		}
		if taken {
			return nil, httpx.Conflict("that handle is taken").WithFriendly("That one is taken — try another.")
		}
		params.Handle = &h
	}

	if req.DisplayName != nil {
		name := strings.TrimSpace(*req.DisplayName)
		if len(name) < 2 || len(name) > 40 {
			fields["displayName"] = "2–40 characters"
		} else {
			params.DisplayName = &name
		}
	}

	if req.Bio != nil {
		bio := strings.TrimSpace(*req.Bio)
		if len(bio) > 160 {
			fields["bio"] = "160 characters max"
		} else {
			params.Bio = &bio
		}
	}

	if req.DOB != nil {
		dob, err := time.Parse("2006-01-02", strings.TrimSpace(*req.DOB))
		switch {
		case err != nil:
			fields["dob"] = "use YYYY-MM-DD"
		case dob.After(s.now()):
			fields["dob"] = "that date is in the future"
		case s.now().Sub(dob) > 100*365*24*time.Hour:
			fields["dob"] = "please check that date"
		case dob.AddDate(13, 0, 0).After(s.now()):
			// Under 13 is not a moderation call; the account cannot exist.
			return nil, httpx.AgeRestricted("You must be at least 13 years old to use DronaSphere.")
		default:
			params.DOB = &dob
		}
	}

	if req.Batch != nil {
		batch := strings.TrimSpace(*req.Batch)
		if len(batch) > 20 {
			fields["batch"] = "20 characters max"
		} else {
			params.Batch = &batch
		}
	}
	if req.Branch != nil {
		branch := strings.ToUpper(strings.TrimSpace(*req.Branch))
		if len(branch) > 20 {
			fields["branch"] = "20 characters max"
		} else {
			params.Branch = &branch
		}
	}
	if req.Year != nil {
		if *req.Year < 1 || *req.Year > 6 {
			fields["year"] = "must be 1–6"
		} else {
			params.Year = req.Year
		}
	}

	if len(fields) > 0 {
		return nil, httpx.Validation(fields)
	}

	updated, err := s.db.UpdateProfile(ctx, userID, params)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			return nil, httpx.Conflict("that handle is taken")
		}
		return nil, httpx.Internal("could not save your profile").WithCause(err)
	}
	_ = current

	if err := s.advanceOnboarding(ctx, updated); err != nil {
		s.log.WarnContext(ctx, "could not advance onboarding", "error", err, "user", userID)
	}
	return s.Me(ctx, userID)
}

// UpdateAvatar stores the Dronu character.
func (s *UserService) UpdateAvatar(ctx context.Context, userID string, avatar domain.Avatar) (*MeResponse, error) {
	if err := validateAvatar(avatar); err != nil {
		return nil, err
	}
	updated, err := s.db.UpdateAvatar(ctx, userID, avatar)
	if err != nil {
		return nil, httpx.Internal("could not save your avatar").WithCause(err)
	}
	if err := s.advanceOnboarding(ctx, updated); err != nil {
		s.log.WarnContext(ctx, "could not advance onboarding", "error", err, "user", userID)
	}
	return s.Me(ctx, userID)
}

// Avatar option sets. Kept server-side so a client cannot invent a hat that has
// no artwork, and so the shop can gate cosmetics later.
var (
	avatarHats        = map[string]bool{"none": true, "beanie": true, "grad-cap": true, "flower": true, "headphones": true, "bandana": true}
	avatarEyes        = map[string]bool{"sparkle": true, "sleepy": true, "wink": true, "wide": true, "closed": true}
	avatarColours     = map[string]bool{"ube": true, "peach": true, "mint": true, "butter": true, "cocoa": true, "cream": true}
	avatarAccessories = map[string]bool{"none": true, "scarf": true, "glasses": true, "earbuds": true, "bowtie": true}
)

func validateAvatar(a domain.Avatar) error {
	fields := map[string]string{}
	if !avatarHats[a.Hat] {
		fields["hat"] = "not one of the available hats"
	}
	if !avatarEyes[a.Eyes] {
		fields["eyes"] = "not one of the available eyes"
	}
	if !avatarColours[a.Colour] {
		fields["colour"] = "not one of the available colours"
	}
	if !avatarAccessories[a.Accessory] {
		fields["accessory"] = "not one of the available accessories"
	}
	if len(fields) > 0 {
		return httpx.Validation(fields)
	}
	return nil
}

// AvatarOptions exposes what the avatar builder may offer.
func AvatarOptions() map[string][]string {
	keys := func(m map[string]bool) []string {
		out := make([]string, 0, len(m))
		for k := range m {
			out = append(out, k)
		}
		return out
	}
	return map[string][]string{
		"hat":       keys(avatarHats),
		"eyes":      keys(avatarEyes),
		"colour":    keys(avatarColours),
		"accessory": keys(avatarAccessories),
	}
}

// Suggestions seeds the follow-8 gate.
func (s *UserService) Suggestions(ctx context.Context, userID, campusID string, limit int) ([]domain.User, error) {
	users, err := s.db.SuggestFollows(ctx, userID, campusID, limit)
	if err != nil {
		return nil, httpx.Internal("could not load suggestions").WithCause(err)
	}
	out := make([]domain.User, 0, len(users))
	now := s.now()
	for _, u := range users {
		out = append(out, Public(u, false, store.Relationship{}, now))
	}
	return out, nil
}

// FollowResult reports the outcome of a follow, including onboarding progress —
// the client needs it to know when the follow-8 gate opens.
type FollowResult struct {
	Following        bool                  `json:"following"`
	FollowerCount    int                   `json:"followerCount"`
	OnboardingStep   domain.OnboardingStep `json:"onboardingStep"`
	FollowsRemaining int                   `json:"followsRemaining"`
	IsBuddy          bool                  `json:"isBuddy"`
}

// Follow creates a follow edge.
func (s *UserService) Follow(ctx context.Context, followerID, targetHandle string) (*FollowResult, error) {
	target, err := s.db.UserByHandle(ctx, targetHandle)
	if err != nil {
		return nil, notFoundOr(err, "no account with that handle")
	}
	if target.ID == followerID {
		return nil, httpx.BadRequest("you cannot follow yourself").
			WithFriendly("You cannot follow yourself.")
	}

	created, err := s.db.Follow(ctx, followerID, target.ID)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			return nil, httpx.Forbidden("you cannot follow this account")
		}
		return nil, httpx.Internal("could not follow that account").WithCause(err)
	}

	if created {
		s.publishToUser(ctx, target.ID, realtime.EventFollow, map[string]any{
			"followerId": followerID,
			"handle":     targetHandle,
		})
	}
	return s.followResult(ctx, followerID, target.ID, true)
}

// Unfollow removes a follow edge.
func (s *UserService) Unfollow(ctx context.Context, followerID, targetHandle string) (*FollowResult, error) {
	target, err := s.db.UserByHandle(ctx, targetHandle)
	if err != nil {
		return nil, notFoundOr(err, "no account with that handle")
	}
	if _, err := s.db.Unfollow(ctx, followerID, target.ID); err != nil {
		return nil, httpx.Internal("could not unfollow that account").WithCause(err)
	}
	return s.followResult(ctx, followerID, target.ID, false)
}

func (s *UserService) followResult(ctx context.Context, followerID, targetID string, following bool) (*FollowResult, error) {
	me, err := s.db.UserByID(ctx, followerID)
	if err != nil {
		return nil, httpx.Internal("could not reload your account").WithCause(err)
	}
	if err := s.advanceOnboarding(ctx, me); err != nil {
		s.log.WarnContext(ctx, "could not advance onboarding", "error", err, "user", followerID)
	}

	count, err := s.db.FollowingCount(ctx, followerID)
	if err != nil {
		return nil, httpx.Internal("could not count your follows").WithCause(err)
	}
	target, err := s.db.UserByID(ctx, targetID)
	if err != nil {
		return nil, httpx.Internal("could not reload that account").WithCause(err)
	}
	rel, err := s.db.RelationshipBetween(ctx, followerID, targetID)
	if err != nil {
		return nil, httpx.Internal("could not load that relationship").WithCause(err)
	}

	return &FollowResult{
		Following:        following,
		FollowerCount:    target.FollowerCount,
		OnboardingStep:   me.OnboardingStep,
		FollowsRemaining: max(s.cfg.OnboardingMinFollows-count, 0),
		IsBuddy:          rel.IsBuddy(),
	}, nil
}

// FollowMany follows several accounts in one call — the "follow all suggested"
// button from PRD 6.1. Individual failures are skipped rather than failing the
// whole batch, so one blocked account cannot strand a user in onboarding.
func (s *UserService) FollowMany(ctx context.Context, followerID string, handles []string) (*FollowResult, error) {
	if len(handles) == 0 {
		return nil, httpx.BadRequest("no accounts to follow")
	}
	if len(handles) > 50 {
		return nil, httpx.BadRequest("that is too many at once")
	}

	var lastTarget string
	for _, h := range handles {
		target, err := s.db.UserByHandle(ctx, h)
		if err != nil || target.ID == followerID {
			continue
		}
		if _, err := s.db.Follow(ctx, followerID, target.ID); err != nil {
			s.log.WarnContext(ctx, "skipping a follow in a batch", "handle", h, "error", err)
			continue
		}
		lastTarget = target.ID
	}
	if lastTarget == "" {
		return nil, httpx.Conflict("none of those accounts could be followed")
	}
	return s.followResult(ctx, followerID, lastTarget, true)
}

// Followers lists a user's followers.
func (s *UserService) Followers(ctx context.Context, viewerID, handle string, limit int) ([]domain.User, error) {
	return s.graphList(ctx, viewerID, handle, limit, s.db.ListFollowers)
}

// Following lists who a user follows.
func (s *UserService) Following(ctx context.Context, viewerID, handle string, limit int) ([]domain.User, error) {
	return s.graphList(ctx, viewerID, handle, limit, s.db.ListFollowing)
}

func (s *UserService) graphList(ctx context.Context, viewerID, handle string, limit int,
	load func(context.Context, string, int) ([]*domain.UserPrivate, error)) ([]domain.User, error) {

	target, err := s.db.UserByHandle(ctx, handle)
	if err != nil {
		return nil, notFoundOr(err, "no account with that handle")
	}
	users, err := load(ctx, target.ID, limit)
	if err != nil {
		return nil, httpx.Internal("could not load that list").WithCause(err)
	}
	return s.hydrateRelationships(ctx, viewerID, users)
}

// Search finds people on campus.
func (s *UserService) Search(ctx context.Context, viewerID, campusID, query string, limit int) ([]domain.User, error) {
	q := strings.TrimSpace(query)
	if len(q) < 2 {
		return []domain.User{}, nil
	}
	users, err := s.db.SearchUsers(ctx, campusID, q, limit)
	if err != nil {
		return nil, httpx.Internal("search failed").WithCause(err)
	}
	return s.hydrateRelationships(ctx, viewerID, users)
}

// hydrateRelationships resolves the viewer's edges for a whole list in one query.
func (s *UserService) hydrateRelationships(ctx context.Context, viewerID string, users []*domain.UserPrivate) ([]domain.User, error) {
	ids := make([]string, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.ID)
	}
	rels, err := s.db.RelationshipsFor(ctx, viewerID, ids)
	if err != nil {
		return nil, httpx.Internal("could not load relationships").WithCause(err)
	}

	now := s.now()
	out := make([]domain.User, 0, len(users))
	for _, u := range users {
		out = append(out, Public(u, u.ID == viewerID, rels[u.ID], now))
	}
	return out, nil
}

// SetLoveFinderEnabled flips the dating opt-in, refusing when a gate is unmet.
func (s *UserService) SetLoveFinderEnabled(ctx context.Context, userID string, on bool) error {
	u, err := s.db.UserByID(ctx, userID)
	if err != nil {
		return notFoundOr(err, "we could not find your account")
	}

	if on {
		campusCount, err := s.db.CampusVerifiedCount(ctx, u.CampusID)
		if err != nil {
			return httpx.Internal("could not check your campus").WithCause(err)
		}
		if err := s.loveFinderGate(u, campusCount, s.now()); err != nil {
			// Plain copy: age and consent surfaces are never cute (PRD 8).
			if !u.IsAdultAt(s.now()) {
				return httpx.AgeRestricted(err.Error())
			}
			return httpx.FeatureLocked(err.Error())
		}
	}

	if err := s.db.SetLoveFinderEnabled(ctx, userID, on); err != nil {
		return httpx.Internal("could not save that setting").WithCause(err)
	}
	return nil
}

// Block blocks an account.
func (s *UserService) Block(ctx context.Context, blockerID, handle string) error {
	target, err := s.db.UserByHandle(ctx, handle)
	if err != nil {
		return notFoundOr(err, "no account with that handle")
	}
	if err := s.db.Block(ctx, blockerID, target.ID); err != nil {
		if errors.Is(err, store.ErrConflict) {
			return httpx.BadRequest("you cannot block yourself")
		}
		return httpx.Internal("could not block that account").WithCause(err)
	}
	return nil
}

// Unblock removes a block.
func (s *UserService) Unblock(ctx context.Context, blockerID, handle string) error {
	target, err := s.db.UserByHandle(ctx, handle)
	if err != nil {
		return notFoundOr(err, "no account with that handle")
	}
	if err := s.db.Unblock(ctx, blockerID, target.ID); err != nil {
		return httpx.Internal("could not unblock that account").WithCause(err)
	}
	return nil
}

// advanceOnboarding recomputes and persists the onboarding step.
func (s *UserService) advanceOnboarding(ctx context.Context, u *domain.UserPrivate) error {
	following, err := s.db.FollowingCount(ctx, u.ID)
	if err != nil {
		return err
	}
	next := NextOnboardingStep(u, following, s.cfg.OnboardingMinFollows)
	if next == u.OnboardingStep {
		return nil
	}
	if err := s.db.SetOnboardingStep(ctx, u.ID, next); err != nil {
		return err
	}
	u.OnboardingStep = next
	return nil
}

func (s *UserService) publishToUser(ctx context.Context, userID string, t realtime.EventType, payload any) {
	ev, err := realtime.NewEvent(t, realtime.UserChannel(userID), payload)
	if err != nil {
		return
	}
	if err := s.bus.Publish(ctx, ev); err != nil {
		s.log.WarnContext(ctx, "publish failed", "error", err, "type", t)
	}
}

// notFoundOr maps a store error to a friendly 404 or an internal error.
func notFoundOr(err error, message string) error {
	if errors.Is(err, store.ErrNotFound) {
		return httpx.NotFound(message)
	}
	return httpx.Internal(message).WithCause(err)
}
