// Package service holds the product rules. Handlers parse and render; the store
// speaks SQL; everything that decides what the app is allowed to do lives here.
package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/auth"
	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/mailer"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

// AuthStore is the slice of the database the auth flow needs. Narrow on purpose:
// it is what lets these rules be tested without Postgres.
type AuthStore interface {
	UserByEmail(ctx context.Context, email string) (*domain.UserPrivate, error)
	UserByID(ctx context.Context, id string) (*domain.UserPrivate, error)
	HandleTaken(ctx context.Context, handle, exceptID string) (bool, error)
	CreateUser(ctx context.Context, p store.CreateUserParams) (*domain.UserPrivate, error)
	EnsureCampus(ctx context.Context, domainName, name, slug string) (string, error)
	RecountCampusVerified(ctx context.Context, campusID string) (int, error)

	CreateOTP(ctx context.Context, email, codeHash, purpose string, expiresAt time.Time) (*store.OTPRecord, error)
	LatestOTP(ctx context.Context, email, purpose string) (*store.OTPRecord, error)
	BumpOTPAttempts(ctx context.Context, id string) (int, error)
	ConsumeOTP(ctx context.Context, id string) error

	StoreRefreshToken(ctx context.Context, userID, hash, userAgent, ip string, expiresAt time.Time) error
	RefreshTokenOwner(ctx context.Context, hash string) (userID, tokenID string, err error)
	RevokeRefreshToken(ctx context.Context, hash string) error
	RevokeAllRefreshTokens(ctx context.Context, userID string) error

	UpsertDevice(ctx context.Context, userID, fingerprint, platform string) (string, error)
	FollowingCount(ctx context.Context, userID string) (int, error)
	SetOnboardingStep(ctx context.Context, userID string, step domain.OnboardingStep) error
}

// AuthService runs signup, sign-in and session rotation.
type AuthService struct {
	cfg    *config.Config
	store  AuthStore
	issuer *auth.TokenIssuer
	mail   mailer.Mailer
	log    *slog.Logger
	now    func() time.Time
}

// NewAuthService wires the service. now may be nil.
func NewAuthService(cfg *config.Config, st AuthStore, issuer *auth.TokenIssuer, m mailer.Mailer, log *slog.Logger, now func() time.Time) *AuthService {
	if now == nil {
		now = time.Now
	}
	return &AuthService{cfg: cfg, store: st, issuer: issuer, mail: m, log: log, now: now}
}

// handlePattern is what a handle may look like: lowercase, unmistakable, typable.
var handlePattern = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

// reservedHandles cannot be claimed by a student account.
var reservedHandles = map[string]bool{
	"admin": true, "dronasphere": true, "support": true, "help": true,
	"moderator": true, "mod": true, "official": true, "api": true, "root": true,
	"system": true, "staff": true, "security": true, "me": true, "new": true,
}

// OTPRequest is the result of asking for a code.
type OTPRequest struct {
	Email string `json:"email"`
	// Whether this address already has an account, so the UI can say
	// "welcome back" instead of "let's get you set up".
	Existing  bool `json:"existing"`
	ExpiresIn int  `json:"expiresIn"`
	// Only populated when MAILER=log and the API is not in production, so local
	// development does not require reading server logs.
	DevCode string `json:"devCode,omitempty"`
}

// RequestOTP validates the address, mints a code and mails it.
//
// PRD 6.1: verification is by institutional email domain, with an ID-card upload
// as the fallback. A non-campus address is refused here with an error the client
// turns into the ID-card path, rather than being quietly accepted.
func (s *AuthService) RequestOTP(ctx context.Context, rawEmail string) (*OTPRequest, error) {
	email := auth.NormaliseEmail(rawEmail)

	if _, err := mail.ParseAddress(email); err != nil {
		return nil, httpx.Validation(map[string]string{
			"email": "that does not look like an email address",
		})
	}
	if !s.cfg.IsCampusEmail(email) {
		// Plain copy: this is a verification gate, not a cute moment.
		return nil, httpx.Forbidden(fmt.Sprintf(
			"DronaSphere is limited to verified students. Use your college email (%s), or upload your ID card for manual review.",
			strings.Join(s.cfg.CampusEmailDomains, ", ")))
	}

	// Resend cooldown, so the mailer cannot be used to spam an address.
	if latest, err := s.store.LatestOTP(ctx, email, "SIGNUP"); err == nil {
		if age := s.now().Sub(latest.CreatedAt); age < s.cfg.OTPResendCooldown {
			wait := (s.cfg.OTPResendCooldown - age).Round(time.Second)
			return nil, httpx.RateLimited(fmt.Sprintf("a code was just sent — try again in %s", wait)).
				WithFriendly("we just sent one! check your inbox 📬")
		}
	} else if !errors.Is(err, store.ErrNotFound) {
		return nil, httpx.Internal("could not check recent codes").WithCause(err)
	}

	code, err := auth.GenerateOTP(s.cfg.OTPLength)
	if err != nil {
		return nil, httpx.Internal("could not generate a code").WithCause(err)
	}

	expiresAt := s.now().Add(s.cfg.OTPTTL)
	if _, err := s.store.CreateOTP(ctx, email, auth.HashOTP(code), "SIGNUP", expiresAt); err != nil {
		return nil, httpx.Internal("could not store the code").WithCause(err)
	}

	if err := s.mail.SendOTP(ctx, email, code, int(s.cfg.OTPTTL.Minutes())); err != nil {
		return nil, httpx.Internal("could not send the email").WithCause(err)
	}

	existing := false
	if _, err := s.store.UserByEmail(ctx, email); err == nil {
		existing = true
	}

	out := &OTPRequest{
		Email:     email,
		Existing:  existing,
		ExpiresIn: int(s.cfg.OTPTTL.Seconds()),
	}
	// Convenience for local development only, and never in production.
	if !s.cfg.IsProduction() && strings.EqualFold(s.cfg.Mailer, "log") {
		out.DevCode = code
	}
	return out, nil
}

// Session is a signed-in session handed back to the client.
type Session struct {
	AccessToken  string              `json:"accessToken"`
	RefreshToken string              `json:"refreshToken"`
	ExpiresIn    int                 `json:"expiresIn"`
	User         *domain.UserPrivate `json:"-"`
}

// VerifyParams carries everything the verify step needs about the caller.
type VerifyParams struct {
	Email             string
	Code              string
	UserAgent         string
	IP                string
	DeviceFingerprint string
	Platform          string
}

// VerifyOTP checks a code and returns a session, creating the account on first
// successful verification.
func (s *AuthService) VerifyOTP(ctx context.Context, p VerifyParams) (*Session, error) {
	email := auth.NormaliseEmail(p.Email)
	code := strings.TrimSpace(p.Code)

	if email == "" || code == "" {
		return nil, httpx.Validation(map[string]string{
			"email": "required",
			"code":  "required",
		})
	}

	rec, err := s.store.LatestOTP(ctx, email, "SIGNUP")
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, httpx.Unauthorized("that code is not valid — request a new one")
		}
		return nil, httpx.Internal("could not look up the code").WithCause(err)
	}

	if s.now().After(rec.ExpiresAt) {
		return nil, httpx.Unauthorized("that code has expired — request a new one").
			WithFriendly("that code timed out — want a new one?")
	}
	if rec.Attempts >= s.cfg.OTPMaxAttempts {
		return nil, httpx.RateLimited("too many attempts on this code — request a new one")
	}

	if !auth.CompareOTP(rec.CodeHash, code) {
		attempts, bumpErr := s.store.BumpOTPAttempts(ctx, rec.ID)
		if bumpErr != nil {
			s.log.WarnContext(ctx, "could not record a failed otp attempt", "error", bumpErr)
		}
		remaining := max(s.cfg.OTPMaxAttempts-attempts, 0)
		return nil, httpx.Unauthorized(fmt.Sprintf("that code is not right — %d attempts left", remaining))
	}

	// Consume before issuing anything: a replayed code must not mint a second session.
	if err := s.store.ConsumeOTP(ctx, rec.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, httpx.Unauthorized("that code has already been used")
		}
		return nil, httpx.Internal("could not consume the code").WithCause(err)
	}

	user, err := s.store.UserByEmail(ctx, email)
	switch {
	case err == nil:
		// Existing account.
		if user.Status == domain.StatusSuspended {
			return nil, httpx.Forbidden("this account is suspended. Contact support if you think that is a mistake.")
		}
	case errors.Is(err, store.ErrNotFound):
		user, err = s.createAccount(ctx, email)
		if err != nil {
			return nil, err
		}
	default:
		return nil, httpx.Internal("could not look up the account").WithCause(err)
	}

	if p.DeviceFingerprint != "" {
		if _, err := s.store.UpsertDevice(ctx, user.ID, p.DeviceFingerprint, p.Platform); err != nil {
			s.log.WarnContext(ctx, "could not record device", "error", err, "user", user.ID)
		}
	}

	// Keep the onboarding step honest: a user who followed 8 people on another
	// device should not be sent back through the gate.
	if err := s.reconcileOnboarding(ctx, user); err != nil {
		s.log.WarnContext(ctx, "could not reconcile onboarding", "error", err, "user", user.ID)
	}

	return s.issueSession(ctx, user, p.UserAgent, p.IP)
}

// createAccount makes a verified student account for a campus address.
func (s *AuthService) createAccount(ctx context.Context, email string) (*domain.UserPrivate, error) {
	at := strings.LastIndex(email, "@")
	domainName := email[at+1:]
	local := email[:at]

	campusID, err := s.store.EnsureCampus(ctx, domainName, campusNameFor(domainName), slugify(domainName))
	if err != nil {
		return nil, httpx.Internal("could not resolve your campus").WithCause(err)
	}

	handle, err := s.freeHandle(ctx, local)
	if err != nil {
		return nil, err
	}

	user, err := s.store.CreateUser(ctx, store.CreateUserParams{
		CampusID:           campusID,
		Email:              email,
		Handle:             handle,
		DisplayName:        displayNameFor(local),
		VerificationMethod: "EMAIL_DOMAIN",
		Verified:           true, // the domain is the verification
	})
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			// PRD 6.1: duplicate email is a hard block, no account.
			return nil, httpx.Conflict("an account already exists for that email")
		}
		return nil, httpx.Internal("could not create your account").WithCause(err)
	}

	// Keep the campus counter fresh; the dating unlock gate reads it.
	if _, err := s.store.RecountCampusVerified(ctx, campusID); err != nil {
		s.log.WarnContext(ctx, "could not recount campus", "error", err, "campus", campusID)
	}

	s.log.InfoContext(ctx, "account created", "user", user.ID, "handle", user.Handle, "campus", campusID)
	return user, nil
}

// freeHandle derives an available handle from an email local part.
func (s *AuthService) freeHandle(ctx context.Context, local string) (string, error) {
	base := sanitiseHandle(local)
	if len(base) < 3 {
		base = "student" + base
	}
	if len(base) > 15 {
		base = base[:15]
	}

	candidate := base
	for attempt := range 50 {
		if attempt > 0 {
			candidate = fmt.Sprintf("%s%d", base, attempt+1)
		}
		taken, err := s.store.HandleTaken(ctx, candidate, "")
		if err != nil {
			return "", httpx.Internal("could not check handle availability").WithCause(err)
		}
		if !taken && !reservedHandles[candidate] {
			return candidate, nil
		}
	}
	return "", httpx.Internal("could not find a free handle")
}

// issueSession mints an access and refresh pair.
func (s *AuthService) issueSession(ctx context.Context, user *domain.UserPrivate, userAgent, ip string) (*Session, error) {
	access, _, err := s.issuer.IssueAccess(user)
	if err != nil {
		return nil, httpx.Internal("could not sign you in").WithCause(err)
	}
	refresh, err := s.issuer.IssueRefresh()
	if err != nil {
		return nil, httpx.Internal("could not sign you in").WithCause(err)
	}
	if err := s.store.StoreRefreshToken(ctx, user.ID, refresh.Hash, userAgent, ip, refresh.ExpiresAt); err != nil {
		return nil, httpx.Internal("could not store your session").WithCause(err)
	}

	return &Session{
		AccessToken:  access,
		RefreshToken: refresh.Plain,
		ExpiresIn:    int(s.issuer.AccessTTL().Seconds()),
		User:         user,
	}, nil
}

// Refresh rotates a refresh token. The old one is revoked, so a stolen token is
// good for exactly one use and the theft shows up as a signed-out user.
func (s *AuthService) Refresh(ctx context.Context, refreshToken, userAgent, ip string) (*Session, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return nil, httpx.Unauthorized("no refresh token was provided")
	}

	hash := auth.HashToken(refreshToken)
	userID, _, err := s.store.RefreshTokenOwner(ctx, hash)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, httpx.Unauthorized("that session is no longer valid — sign in again")
		}
		return nil, httpx.Internal("could not check your session").WithCause(err)
	}

	user, err := s.store.UserByID(ctx, userID)
	if err != nil {
		return nil, httpx.Unauthorized("that session is no longer valid — sign in again")
	}
	if user.Status == domain.StatusSuspended || user.Status == domain.StatusDeactivated {
		return nil, httpx.Forbidden("this account is not active")
	}

	if err := s.store.RevokeRefreshToken(ctx, hash); err != nil {
		return nil, httpx.Internal("could not rotate your session").WithCause(err)
	}
	return s.issueSession(ctx, user, userAgent, ip)
}

// Logout revokes one session.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if strings.TrimSpace(refreshToken) == "" {
		return nil // already signed out; nothing to report
	}
	if err := s.store.RevokeRefreshToken(ctx, auth.HashToken(refreshToken)); err != nil {
		return httpx.Internal("could not sign you out").WithCause(err)
	}
	return nil
}

// LogoutEverywhere revokes every session for a user.
func (s *AuthService) LogoutEverywhere(ctx context.Context, userID string) error {
	if err := s.store.RevokeAllRefreshTokens(ctx, userID); err != nil {
		return httpx.Internal("could not sign you out everywhere").WithCause(err)
	}
	return nil
}

// reconcileOnboarding recomputes the onboarding step from the facts on the
// account, and persists it if it moved.
func (s *AuthService) reconcileOnboarding(ctx context.Context, user *domain.UserPrivate) error {
	following, err := s.store.FollowingCount(ctx, user.ID)
	if err != nil {
		return err
	}
	next := NextOnboardingStep(user, following, s.cfg.OnboardingMinFollows)
	if next == user.OnboardingStep {
		return nil
	}
	if err := s.store.SetOnboardingStep(ctx, user.ID, next); err != nil {
		return err
	}
	user.OnboardingStep = next
	return nil
}

// NextOnboardingStep decides where a user is in onboarding.
//
// PRD 6.1 defines the gate: a user cannot reach home with zero follows, and a
// feed with fewer than ~8 sources looks empty. The steps are ordered so a user
// builds a Dronu avatar before they are ever asked for a photo.
func NextOnboardingStep(u *domain.UserPrivate, followingCount, minFollows int) domain.OnboardingStep {
	if u.Handle == "" || u.DisplayName == "" {
		return domain.StepHandle
	}
	if u.DOB == nil || u.Batch == "" || u.Branch == "" || u.Year == 0 {
		return domain.StepProfile
	}
	if u.Avatar == (domain.Avatar{}) {
		return domain.StepAvatar
	}
	if followingCount < minFollows {
		return domain.StepFollows
	}
	return domain.StepDone
}

// ------------------------------------------------------------------ helpers ---

var nonHandleChars = regexp.MustCompile(`[^a-z0-9_]`)

func sanitiseHandle(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	// Email local parts often carry dots and plus-addressing; drop the tag.
	if i := strings.IndexByte(s, '+'); i > 0 {
		s = s[:i]
	}
	return nonHandleChars.ReplaceAllString(s, "")
}

// ValidateHandle checks a user-chosen handle.
func ValidateHandle(handle string) error {
	h := strings.ToLower(strings.TrimSpace(handle))
	if !handlePattern.MatchString(h) {
		return httpx.Validation(map[string]string{
			"handle": "3–20 characters, lowercase letters, numbers and underscores only",
		})
	}
	if reservedHandles[h] {
		return httpx.Validation(map[string]string{"handle": "that handle is reserved"})
	}
	return nil
}

func displayNameFor(local string) string {
	cleaned := strings.Map(func(r rune) rune {
		if r == '.' || r == '_' || r == '-' || r == '+' {
			return ' '
		}
		return r
	}, local)

	words := strings.Fields(cleaned)
	for i, w := range words {
		if w == "" {
			continue
		}
		words[i] = strings.ToUpper(w[:1]) + strings.ToLower(w[1:])
	}
	name := strings.Join(words, " ")
	if name == "" {
		return "Student"
	}
	if len(name) > 40 {
		name = name[:40]
	}
	return name
}

func campusNameFor(domainName string) string {
	base := strings.SplitN(domainName, ".", 2)[0]
	if base == "" {
		return domainName
	}
	return strings.ToUpper(base[:1]) + base[1:]
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		default:
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}
