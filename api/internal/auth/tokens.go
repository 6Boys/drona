// Package auth issues and verifies credentials.
//
// Access tokens are short-lived signed JWTs. Refresh tokens are opaque random
// strings; only their SHA-256 hash is stored, so a database leak does not hand
// an attacker working sessions.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// Errors callers are expected to branch on.
var (
	ErrTokenInvalid = errors.New("token is invalid")
	ErrTokenExpired = errors.New("token has expired")
	ErrWrongType    = errors.New("token is of the wrong type")
)

const issuer = "dronasphere"

// Claims is what an access token carries. Keep it small: the client should not
// be trusted for anything but identity, and identity is all we put in here.
type Claims struct {
	jwt.RegisteredClaims
	CampusID       string                `json:"cid"`
	Handle         string                `json:"hdl"`
	Role           domain.UserRole       `json:"rol"`
	OnboardingStep domain.OnboardingStep `json:"stp"`
	TokenType      string                `json:"typ"`
}

// Actor is the authenticated caller, as reconstructed from a token.
type Actor struct {
	UserID         string
	CampusID       string
	Handle         string
	Role           domain.UserRole
	OnboardingStep domain.OnboardingStep
}

// IsOnboarded reports whether the actor cleared the follow-8 gate (PRD 6.1).
func (a Actor) IsOnboarded() bool { return a.OnboardingStep == domain.StepDone }

// CanModerate reports whether the actor may act on other people's content.
func (a Actor) CanModerate() bool {
	switch a.Role {
	case domain.RoleSpaceMod, domain.RoleCampusAdmin, domain.RoleSuperadmin:
		return true
	}
	return false
}

// TokenIssuer mints and validates tokens. It holds no state beyond the secret.
type TokenIssuer struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
	now        func() time.Time
}

// NewTokenIssuer builds an issuer. now may be nil, in which case time.Now is used.
func NewTokenIssuer(secret []byte, accessTTL, refreshTTL time.Duration, now func() time.Time) *TokenIssuer {
	if now == nil {
		now = time.Now
	}
	return &TokenIssuer{secret: secret, accessTTL: accessTTL, refreshTTL: refreshTTL, now: now}
}

// AccessTTL exposes the configured lifetime so handlers can tell the client.
func (t *TokenIssuer) AccessTTL() time.Duration { return t.accessTTL }

// RefreshTTL exposes the refresh lifetime.
func (t *TokenIssuer) RefreshTTL() time.Duration { return t.refreshTTL }

// IssueAccess signs a short-lived access token for a user.
func (t *TokenIssuer) IssueAccess(u *domain.UserPrivate) (string, time.Time, error) {
	now := t.now()
	expires := now.Add(t.accessTTL)

	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   u.ID,
			Issuer:    issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-2 * time.Second)),
			ExpiresAt: jwt.NewNumericDate(expires),
			ID:        newJTI(),
		},
		CampusID:       u.CampusID,
		Handle:         u.Handle,
		Role:           u.Role,
		OnboardingStep: u.OnboardingStep,
		TokenType:      "access",
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign access token: %w", err)
	}
	return signed, expires, nil
}

// ParseAccess verifies a token and returns the actor it names.
func (t *TokenIssuer) ParseAccess(raw string) (Actor, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method %q", token.Method.Alg())
		}
		return t.secret, nil
	},
		jwt.WithIssuer(issuer),
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithTimeFunc(t.now),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return Actor{}, ErrTokenExpired
		}
		return Actor{}, fmt.Errorf("%w: %v", ErrTokenInvalid, err)
	}
	if claims.TokenType != "access" {
		return Actor{}, ErrWrongType
	}
	if claims.Subject == "" {
		return Actor{}, ErrTokenInvalid
	}

	return Actor{
		UserID:         claims.Subject,
		CampusID:       claims.CampusID,
		Handle:         claims.Handle,
		Role:           claims.Role,
		OnboardingStep: claims.OnboardingStep,
	}, nil
}

// RefreshToken is a freshly minted refresh credential. Plain is handed to the
// client exactly once; Hash is what we persist.
type RefreshToken struct {
	Plain     string
	Hash      string
	ExpiresAt time.Time
}

// IssueRefresh mints an opaque refresh token.
func (t *TokenIssuer) IssueRefresh() (RefreshToken, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return RefreshToken{}, fmt.Errorf("read random bytes: %w", err)
	}
	plain := base64.RawURLEncoding.EncodeToString(buf)
	return RefreshToken{
		Plain:     plain,
		Hash:      HashToken(plain),
		ExpiresAt: t.now().Add(t.refreshTTL),
	}, nil
}

// HashToken is the one-way function used for refresh tokens. It is not a
// password hash on purpose: the input is 256 bits of entropy we generated, so
// there is nothing to brute force and bcrypt would only add latency.
func HashToken(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(sum[:])
}

func newJTI() string {
	buf := make([]byte, 12)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
