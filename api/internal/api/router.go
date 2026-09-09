// Package api wires HTTP routes to services. Handlers here do three things and
// nothing else: parse the request, call one service method, render the result.
// Every product rule lives in internal/service.
package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/aniketrathour/dronasphere/api/internal/auth"
	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/realtime"
	"github.com/aniketrathour/dronasphere/api/internal/safety"
	"github.com/aniketrathour/dronasphere/api/internal/service"
)

// Deps is everything the router needs. Passing one struct keeps main.go honest
// about what the HTTP layer depends on.
type Deps struct {
	Config  *config.Config
	Log     *slog.Logger
	Issuer  *auth.TokenIssuer
	Limiter httpx.Limiter

	Auth  *service.AuthService
	Users *service.UserService
	Feed  *service.FeedService
	Chat  *service.ChatService
	Owl   *service.OwlService
	Notes *service.NoteService

	Gateway *realtime.Gateway

	// Health reports dependency health for the readiness probe.
	Health func(r *http.Request) map[string]string
}

// Server is the HTTP surface.
type Server struct {
	deps   Deps
	router chi.Router
}

// NewServer builds the router.
func NewServer(deps Deps) *Server {
	s := &Server{deps: deps, router: chi.NewRouter()}
	s.routes()
	return s
}

// ServeHTTP implements http.Handler.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

// Handler exposes the router.
func (s *Server) Handler() http.Handler { return s.router }

func (s *Server) routes() {
	r := s.router
	log := s.deps.Log

	r.Use(httpx.RequestID)
	r.Use(httpx.Recoverer(log))
	r.Use(httpx.Logger(log))
	r.Use(httpx.CORS(s.deps.Config.AllowedOrigins))
	r.Use(middleware.Timeout(30 * time.Second))

	// --- probes: no auth, no rate limit, cheap ---
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Get("/readyz", s.handleReady())

	r.Route("/v1", func(v1 chi.Router) {
		// --- auth: unauthenticated, tightly rate limited by IP ---
		v1.Group(func(pub chi.Router) {
			pub.Use(httpx.RateLimit(s.deps.Limiter, 20, time.Minute, byIP))

			pub.Method(http.MethodPost, "/auth/otp/request", httpx.Handler(s.handleRequestOTP))
			pub.Method(http.MethodPost, "/auth/otp/verify", httpx.Handler(s.handleVerifyOTP))
			pub.Method(http.MethodPost, "/auth/refresh", httpx.Handler(s.handleRefresh))
			pub.Method(http.MethodPost, "/auth/logout", httpx.Handler(s.handleLogout))
		})

		// Support resources are deliberately reachable without an account.
		v1.Get("/safety/support", func(w http.ResponseWriter, _ *http.Request) {
			httpx.JSON(w, http.StatusOK, safety.Card())
		})
		v1.Get("/avatar/options", func(w http.ResponseWriter, _ *http.Request) {
			httpx.JSON(w, http.StatusOK, service.AvatarOptions())
		})

		// --- signed in, onboarding allowed ---
		v1.Group(func(pri chi.Router) {
			pri.Use(auth.RequireAuth(s.deps.Issuer))
			pri.Use(httpx.RateLimit(s.deps.Limiter, 300, time.Minute, byUser))

			pri.Method(http.MethodGet, "/me", httpx.Handler(s.handleMe))
			pri.Method(http.MethodPatch, "/me", httpx.Handler(s.handleUpdateProfile))
			pri.Method(http.MethodPut, "/me/avatar", httpx.Handler(s.handleUpdateAvatar))
			pri.Method(http.MethodPost, "/me/love-finder", httpx.Handler(s.handleSetLoveFinder))
			pri.Method(http.MethodPost, "/auth/logout-all", httpx.Handler(s.handleLogoutAll))

			// The follow-8 gate: reachable while onboarding, by design.
			pri.Method(http.MethodGet, "/onboarding/suggestions", httpx.Handler(s.handleSuggestions))
			pri.Method(http.MethodPost, "/onboarding/follow-all", httpx.Handler(s.handleFollowMany))
			pri.Method(http.MethodPost, "/users/{handle}/follow", httpx.Handler(s.handleFollow))
			pri.Method(http.MethodDelete, "/users/{handle}/follow", httpx.Handler(s.handleUnfollow))
		})

		// --- signed in and onboarded: the app proper ---
		v1.Group(func(app chi.Router) {
			app.Use(auth.RequireAuth(s.deps.Issuer))
			app.Use(auth.RequireOnboarded)
			app.Use(httpx.RateLimit(s.deps.Limiter, 600, time.Minute, byUser))

			// people
			app.Method(http.MethodGet, "/users/{handle}", httpx.Handler(s.handleProfile))
			app.Method(http.MethodGet, "/users/{handle}/followers", httpx.Handler(s.handleFollowers))
			app.Method(http.MethodGet, "/users/{handle}/following", httpx.Handler(s.handleFollowing))
			app.Method(http.MethodPost, "/users/{handle}/block", httpx.Handler(s.handleBlock))
			app.Method(http.MethodDelete, "/users/{handle}/block", httpx.Handler(s.handleUnblock))
			app.Method(http.MethodGet, "/search/users", httpx.Handler(s.handleSearchUsers))

			// the nest
			app.Method(http.MethodGet, "/spaces", httpx.Handler(s.handleSpaces))
			app.Method(http.MethodGet, "/feed", httpx.Handler(s.handleFeed))
			app.Method(http.MethodGet, "/posts/{id}", httpx.Handler(s.handlePost))
			app.Method(http.MethodGet, "/posts/{id}/comments", httpx.Handler(s.handleComments))
			app.Method(http.MethodPost, "/posts/{id}/vote", httpx.Handler(s.handleVote))
			app.Method(http.MethodPost, "/posts/{id}/react", httpx.Handler(s.handleReact))
			app.Method(http.MethodPost, "/comments/{id}/vote", httpx.Handler(s.handleVoteComment))

			// chats
			app.Method(http.MethodGet, "/threads", httpx.Handler(s.handleThreads))
			app.Method(http.MethodGet, "/threads/requests", httpx.Handler(s.handleThreadRequests))
			app.Method(http.MethodPost, "/threads/dm", httpx.Handler(s.handleStartDM))
			app.Method(http.MethodPost, "/threads/den", httpx.Handler(s.handleCreateDen))
			app.Method(http.MethodGet, "/threads/{id}", httpx.Handler(s.handleThread))
			app.Method(http.MethodGet, "/threads/{id}/messages", httpx.Handler(s.handleMessages))
			app.Method(http.MethodPost, "/threads/{id}/read", httpx.Handler(s.handleMarkRead))
			app.Method(http.MethodPost, "/threads/{id}/accept", httpx.Handler(s.handleAcceptRequest))
			app.Method(http.MethodDelete, "/threads/{id}/messages/{messageId}", httpx.Handler(s.handleDeleteMessage))

			// owl board
			app.Method(http.MethodPost, "/owl/heartbeat", httpx.Handler(s.handleHeartbeat))
			app.Method(http.MethodGet, "/owl/board", httpx.Handler(s.handleBoard))
			app.Method(http.MethodPost, "/owl/cocoon", httpx.Handler(s.handleCocoon))
			app.Method(http.MethodPost, "/owl/burrow", httpx.Handler(s.handleBurrow))

			// note locker
			app.Method(http.MethodGet, "/notes", httpx.Handler(s.handleNotes))
			app.Method(http.MethodGet, "/notes/subjects", httpx.Handler(s.handleNoteSubjects))
			app.Method(http.MethodPost, "/notes/{id}/vote", httpx.Handler(s.handleVoteNote))
			app.Method(http.MethodPost, "/notes/{id}/download", httpx.Handler(s.handleDownloadNote))

			// reporting is available on every surface (PRD 10)
			app.Method(http.MethodPost, "/reports", httpx.Handler(s.handleReport))

			// the live socket
			app.Method(http.MethodGet, "/ws", httpx.Handler(s.handleWS))
		})

		// --- writes worth their own, stricter budget ---
		v1.Group(func(write chi.Router) {
			write.Use(auth.RequireAuth(s.deps.Issuer))
			write.Use(auth.RequireOnboarded)
			write.Use(httpx.RateLimit(s.deps.Limiter, 30, time.Minute, byUser))

			write.Method(http.MethodPost, "/posts", httpx.Handler(s.handleCreatePost))
			write.Method(http.MethodPost, "/posts/{id}/comments", httpx.Handler(s.handleCreateComment))
			write.Method(http.MethodPost, "/threads/{id}/messages", httpx.Handler(s.handleSendMessage))
			write.Method(http.MethodPost, "/notes", httpx.Handler(s.handleUploadNote))
		})

		// --- moderation ---
		v1.Group(func(mod chi.Router) {
			mod.Use(auth.RequireAuth(s.deps.Issuer))
			mod.Use(auth.RequireModerator)

			mod.Method(http.MethodGet, "/moderation/reports", httpx.Handler(s.handleListReports))
			mod.Method(http.MethodPost, "/moderation/reports/{id}", httpx.Handler(s.handleResolveReport))
			mod.Method(http.MethodDelete, "/posts/{id}", httpx.Handler(s.handleRemovePost))
		})
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, httpx.NotFound("no route here").WithFriendly("nothing lives at this address 🦉"))
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, httpx.BadRequest("that method is not allowed on this route"))
	})
}

// handleReady reports dependency health. Kubernetes reads this.
func (s *Server) handleReady() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		checks := map[string]string{}
		if s.deps.Health != nil {
			checks = s.deps.Health(r)
		}

		status := http.StatusOK
		for _, v := range checks {
			if v != "ok" {
				status = http.StatusServiceUnavailable
				break
			}
		}
		httpx.JSON(w, status, map[string]any{
			"status": map[bool]string{true: "ok", false: "degraded"}[status == http.StatusOK],
			"checks": checks,
		})
	}
}

// byIP and byUser are the rate-limit key functions.
func byIP(r *http.Request) string { return "ip:" + httpx.ClientIP(r) }

func byUser(r *http.Request) string {
	if actor, ok := auth.ActorFrom(r.Context()); ok {
		return "user:" + actor.UserID
	}
	return "ip:" + httpx.ClientIP(r)
}
