package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

var secret = []byte("a-test-secret-that-is-long-enough-for-hs256")

func testUser() *domain.UserPrivate {
	u := &domain.UserPrivate{}
	u.ID = "22222222-2222-4222-8222-000000000003"
	u.CampusID = "11111111-1111-4111-8111-111111111111"
	u.Handle = "meher"
	u.Role = domain.RoleStudent
	u.OnboardingStep = domain.StepDone
	return u
}

func TestTokenIssuer_AccessRoundTrip(t *testing.T) {
	issuer := NewTokenIssuer(secret, 15*time.Minute, 720*time.Hour, nil)
	user := testUser()

	token, expires, err := issuer.IssueAccess(user)
	require.NoError(t, err)
	assert.WithinDuration(t, time.Now().Add(15*time.Minute), expires, 5*time.Second)

	actor, err := issuer.ParseAccess(token)
	require.NoError(t, err)

	assert.Equal(t, user.ID, actor.UserID)
	assert.Equal(t, user.CampusID, actor.CampusID)
	assert.Equal(t, user.Handle, actor.Handle)
	assert.Equal(t, domain.RoleStudent, actor.Role)
	assert.Equal(t, domain.StepDone, actor.OnboardingStep)
	assert.True(t, actor.IsOnboarded())
}

func TestTokenIssuer_RejectsBadTokens(t *testing.T) {
	issuer := NewTokenIssuer(secret, 15*time.Minute, time.Hour, nil)
	valid, _, err := issuer.IssueAccess(testUser())
	require.NoError(t, err)

	t.Run("a tampered payload", func(t *testing.T) {
		parts := strings.Split(valid, ".")
		require.Len(t, parts, 3)
		// Flip a character in the claims segment.
		mangled := parts[0] + "." + parts[1][:len(parts[1])-2] + "XY." + parts[2]

		_, err := issuer.ParseAccess(mangled)
		assert.ErrorIs(t, err, ErrTokenInvalid)
	})

	t.Run("signed with someone else's secret", func(t *testing.T) {
		other := NewTokenIssuer([]byte("a-completely-different-secret-value-here"), time.Minute, time.Hour, nil)
		foreign, _, err := other.IssueAccess(testUser())
		require.NoError(t, err)

		_, err = issuer.ParseAccess(foreign)
		assert.ErrorIs(t, err, ErrTokenInvalid)
	})

	t.Run("garbage", func(t *testing.T) {
		for _, bad := range []string{"", "not-a-token", "a.b.c", "Bearer x"} {
			_, err := issuer.ParseAccess(bad)
			assert.Error(t, err, "should reject %q", bad)
		}
	})

	t.Run("the alg=none downgrade attack", func(t *testing.T) {
		// eyJhbGciOiJub25lIn0 is {"alg":"none"}.
		none := "eyJhbGciOiJub25lIn0.eyJzdWIiOiJoYWNrZXIiLCJpc3MiOiJkcm9uYXNwaGVyZSJ9."
		_, err := issuer.ParseAccess(none)
		assert.Error(t, err, "unsigned tokens must never be accepted")
	})
}

func TestTokenIssuer_Expiry(t *testing.T) {
	now := time.Date(2026, 9, 9, 12, 0, 0, 0, time.UTC)
	clock := now
	issuer := NewTokenIssuer(secret, 15*time.Minute, time.Hour, func() time.Time { return clock })

	token, _, err := issuer.IssueAccess(testUser())
	require.NoError(t, err)

	clock = now.Add(14 * time.Minute)
	_, err = issuer.ParseAccess(token)
	assert.NoError(t, err, "still valid inside the TTL")

	clock = now.Add(16 * time.Minute)
	_, err = issuer.ParseAccess(token)
	assert.ErrorIs(t, err, ErrTokenExpired, "and expiry is distinguishable, so the client knows to refresh")
}

func TestTokenIssuer_RefreshIsOpaqueAndHashed(t *testing.T) {
	issuer := NewTokenIssuer(secret, time.Minute, 720*time.Hour, nil)

	first, err := issuer.IssueRefresh()
	require.NoError(t, err)
	second, err := issuer.IssueRefresh()
	require.NoError(t, err)

	assert.NotEqual(t, first.Plain, second.Plain, "each refresh token is unique")
	assert.NotEqual(t, first.Plain, first.Hash, "the stored value is not the handed-out value")
	assert.Equal(t, HashToken(first.Plain), first.Hash)
	assert.Len(t, first.Hash, 64, "sha-256 hex")
	assert.WithinDuration(t, time.Now().Add(720*time.Hour), first.ExpiresAt, time.Minute)

	// The plaintext must not be derivable from the hash.
	assert.NotContains(t, first.Hash, first.Plain)
}

func TestActor_CanModerate(t *testing.T) {
	assert.False(t, Actor{Role: domain.RoleStudent}.CanModerate())
	assert.True(t, Actor{Role: domain.RoleSpaceMod}.CanModerate())
	assert.True(t, Actor{Role: domain.RoleCampusAdmin}.CanModerate())
	assert.True(t, Actor{Role: domain.RoleSuperadmin}.CanModerate())
	assert.False(t, Actor{}.CanModerate(), "an unset role is not a moderator")
}

func TestGenerateOTP(t *testing.T) {
	t.Run("length and alphabet", func(t *testing.T) {
		for _, n := range []int{4, 6, 8, 10} {
			code, err := GenerateOTP(n)
			require.NoError(t, err)
			assert.Len(t, code, n)
			for _, r := range code {
				assert.True(t, r >= '0' && r <= '9', "codes are typed on a phone: %q", code)
			}
		}
	})

	t.Run("out of range lengths are refused", func(t *testing.T) {
		for _, n := range []int{0, 1, 3, 11, 100, -1} {
			_, err := GenerateOTP(n)
			assert.Error(t, err, "length %d", n)
		}
	})

	t.Run("codes are not predictable", func(t *testing.T) {
		seen := map[string]bool{}
		for range 200 {
			code, err := GenerateOTP(6)
			require.NoError(t, err)
			seen[code] = true
		}
		// 200 draws from 10^6 should essentially never collide twice.
		assert.Greater(t, len(seen), 190, "codes look drawn from a real random source")
	})
}

func TestCompareOTP(t *testing.T) {
	hash := HashOTP("123456")

	assert.True(t, CompareOTP(hash, "123456"))
	assert.True(t, CompareOTP(hash, " 123456 "), "whitespace from a paste is forgiven")
	assert.True(t, CompareOTP(hash, "123 456"), "so are spaces from an autofill")

	assert.False(t, CompareOTP(hash, "123457"))
	assert.False(t, CompareOTP(hash, "12345"))
	assert.False(t, CompareOTP(hash, ""))
	assert.False(t, CompareOTP("", "123456"))
}

func TestNormaliseEmail(t *testing.T) {
	// PRD 6.1: a duplicate email is a hard block. That only holds if two
	// spellings of the same address cannot become two accounts.
	assert.Equal(t, "meher@dronacharya.info", NormaliseEmail("Meher@Dronacharya.INFO"))
	assert.Equal(t, "meher@dronacharya.info", NormaliseEmail("  meher@dronacharya.info  "))
	assert.Equal(t, "meher@dronacharya.info", NormaliseEmail("MEHER@DRONACHARYA.INFO"))
}

func TestBearerToken(t *testing.T) {
	t.Run("from the authorization header", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Authorization", "Bearer abc.def.ghi")
		assert.Equal(t, "abc.def.ghi", BearerToken(r))
	})

	t.Run("the scheme is case insensitive", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Authorization", "bearer abc")
		assert.Equal(t, "abc", BearerToken(r))
	})

	t.Run("another scheme yields nothing", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
		assert.Empty(t, BearerToken(r))
	})

	t.Run("a websocket upgrade may use the query string", func(t *testing.T) {
		// Browsers cannot set headers on a WebSocket handshake.
		r := httptest.NewRequest(http.MethodGet, "/v1/ws?token=socket-token", nil)
		r.Header.Set("Upgrade", "websocket")
		assert.Equal(t, "socket-token", BearerToken(r))
	})

	t.Run("a plain request may NOT use the query string", func(t *testing.T) {
		// Tokens in URLs end up in logs and referrers, so only the socket, which
		// has no alternative, is allowed to do this.
		r := httptest.NewRequest(http.MethodGet, "/v1/feed?token=leaked", nil)
		assert.Empty(t, BearerToken(r))
	})
}

func TestRequireAuth(t *testing.T) {
	issuer := NewTokenIssuer(secret, 15*time.Minute, time.Hour, nil)
	token, _, err := issuer.IssueAccess(testUser())
	require.NoError(t, err)

	protected := RequireAuth(issuer)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		actor, ok := ActorFrom(r.Context())
		require.True(t, ok)
		assert.Equal(t, "meher", actor.Handle)
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("a valid token passes and the actor is on the context", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Authorization", "Bearer "+token)
		protected.ServeHTTP(w, r)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("no token is a 401", func(t *testing.T) {
		w := httptest.NewRecorder()
		protected.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "unauthorized")
	})

	t.Run("an expired token says so, so the client refreshes instead of signing out", func(t *testing.T) {
		past := NewTokenIssuer(secret, time.Minute, time.Hour, func() time.Time {
			return time.Now().Add(-2 * time.Hour)
		})
		stale, _, err := past.IssueAccess(testUser())
		require.NoError(t, err)

		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Authorization", "Bearer "+stale)
		protected.ServeHTTP(w, r)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "expired")
	})
}

func TestOptionalAuth(t *testing.T) {
	issuer := NewTokenIssuer(secret, 15*time.Minute, time.Hour, nil)
	token, _, _ := issuer.IssueAccess(testUser())

	var hadActor bool
	h := OptionalAuth(issuer)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hadActor = ActorFrom(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, http.StatusOK, w.Code)
	assert.False(t, hadActor, "anonymous is allowed through")

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+token)
	h.ServeHTTP(httptest.NewRecorder(), r)
	assert.True(t, hadActor)

	// An invalid token is treated as anonymous, not as an error.
	r = httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer rubbish")
	h.ServeHTTP(httptest.NewRecorder(), r)
	assert.False(t, hadActor)
}

func TestRequireOnboarded(t *testing.T) {
	// PRD 6.1: a user cannot reach home with zero follows.
	gated := RequireOnboarded(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("a finished user gets through", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r = r.WithContext(WithActor(r.Context(), Actor{UserID: "u", OnboardingStep: domain.StepDone}))
		gated.ServeHTTP(w, r)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("a half-onboarded user is told which step is missing", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r = r.WithContext(WithActor(r.Context(), Actor{UserID: "u", OnboardingStep: domain.StepFollows}))
		gated.ServeHTTP(w, r)

		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Contains(t, w.Body.String(), "onboarding_incomplete")
		assert.Contains(t, w.Body.String(), "FOLLOWS")
	})

	t.Run("an unset step falls back to the first step, never to allowed", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r = r.WithContext(WithActor(r.Context(), Actor{UserID: "u"}))
		gated.ServeHTTP(w, r)

		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Contains(t, w.Body.String(), "HANDLE")
	})

	t.Run("no actor at all is a 401, not a panic", func(t *testing.T) {
		w := httptest.NewRecorder()
		assert.NotPanics(t, func() {
			gated.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
		})
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

func TestRequireModerator(t *testing.T) {
	gated := RequireModerator(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	withRole := func(role domain.UserRole) *http.Request {
		r := httptest.NewRequest(http.MethodDelete, "/", nil)
		return r.WithContext(WithActor(r.Context(), Actor{UserID: "u", Role: role}))
	}

	w := httptest.NewRecorder()
	gated.ServeHTTP(w, withRole(domain.RoleStudent))
	assert.Equal(t, http.StatusForbidden, w.Code)

	w = httptest.NewRecorder()
	gated.ServeHTTP(w, withRole(domain.RoleSpaceMod))
	assert.Equal(t, http.StatusOK, w.Code)
}
