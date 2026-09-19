package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
)

type ctxKey int

const actorKey ctxKey = iota

// WithActor stores an actor on a context. Exported for tests and the WebSocket
// handler, which authenticates before it has an http.Handler chain.
func WithActor(ctx context.Context, a Actor) context.Context {
	return context.WithValue(ctx, actorKey, a)
}

// ActorFrom returns the authenticated actor, if any.
func ActorFrom(ctx context.Context) (Actor, bool) {
	a, ok := ctx.Value(actorKey).(Actor)
	return a, ok
}

// MustActor returns the actor or a 401. Handlers behind RequireAuth can rely on
// it; it exists so a routing mistake fails loudly instead of nil-panicking.
func MustActor(ctx context.Context) (Actor, error) {
	a, ok := ActorFrom(ctx)
	if !ok {
		return Actor{}, httpx.Unauthorized("you need to be signed in")
	}
	return a, nil
}

// BearerToken pulls a token out of the Authorization header, or for WebSocket
// upgrades out of ?token= (browsers cannot set headers on a WebSocket).
func BearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if h != "" {
		parts := strings.SplitN(h, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
			return strings.TrimSpace(parts[1])
		}
		return ""
	}
	if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return strings.TrimSpace(r.URL.Query().Get("token"))
	}
	return ""
}

// RequireAuth rejects unauthenticated requests.
func RequireAuth(issuer *TokenIssuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := BearerToken(r)
			if raw == "" {
				httpx.Fail(w, r, httpx.Unauthorized("you need to be signed in"))
				return
			}
			actor, err := issuer.ParseAccess(raw)
			if err != nil {
				switch {
				case errors.Is(err, ErrTokenExpired):
					httpx.Fail(w, r, httpx.Unauthorized("your session expired — refresh and try again"))
				default:
					httpx.Fail(w, r, httpx.Unauthorized("that sign-in token is not valid"))
				}
				return
			}
			next.ServeHTTP(w, r.WithContext(WithActor(r.Context(), actor)))
		})
	}
}

// OptionalAuth attaches an actor when a valid token is present and otherwise
// carries on. Used by surfaces that render differently when signed in.
func OptionalAuth(issuer *TokenIssuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if raw := BearerToken(r); raw != "" {
				if actor, err := issuer.ParseAccess(raw); err == nil {
					r = r.WithContext(WithActor(r.Context(), actor))
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireOnboarded blocks users who have not finished onboarding. PRD 6.1: a
// user cannot reach home with zero follows.
func RequireOnboarded(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		actor, err := MustActor(r.Context())
		if err != nil {
			httpx.Fail(w, r, err)
			return
		}
		if !actor.IsOnboarded() {
			step := actor.OnboardingStep
			if step == "" {
				step = domain.StepHandle
			}
			httpx.Fail(w, r, httpx.OnboardingIncomplete(string(step)))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireModerator gates mod-only routes.
func RequireModerator(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		actor, err := MustActor(r.Context())
		if err != nil {
			httpx.Fail(w, r, err)
			return
		}
		if !actor.CanModerate() {
			httpx.Fail(w, r, httpx.Forbidden("that action is for moderators"))
			return
		}
		next.ServeHTTP(w, r)
	})
}
