package httpx

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type ctxKey int

const requestIDKey ctxKey = iota

// RequestIDHeader is echoed back so a user can quote it in a bug report.
const RequestIDHeader = "X-Request-Id"

// RequestID stamps every request with an id and puts it in the context.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(RequestIDHeader)
		if id == "" || len(id) > 64 {
			buf := make([]byte, 12)
			_, _ = rand.Read(buf)
			id = hex.EncodeToString(buf)
		}
		w.Header().Set(RequestIDHeader, id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
	})
}

// RequestIDFromContext returns the id stamped by RequestID, or "".
func RequestIDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	n, err := s.ResponseWriter.Write(b)
	s.bytes += n
	return n, err
}

// Unwrap lets http.ResponseController reach the real writer, which the
// WebSocket hijack needs.
func (s *statusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }

// Logger logs one line per request.
func Logger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// WebSocket upgrades hijack the connection; wrapping breaks them.
			if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w}
			next.ServeHTTP(rec, r)

			if rec.status == 0 {
				rec.status = http.StatusOK
			}
			level := slog.LevelInfo
			switch {
			case rec.status >= 500:
				level = slog.LevelError
			case rec.status >= 400:
				level = slog.LevelWarn
			}
			log.Log(r.Context(), level, "request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"bytes", rec.bytes,
				"duration_ms", time.Since(start).Milliseconds(),
				"request_id", RequestIDFromContext(r.Context()),
			)
		})
	}
}

// Recoverer turns a panic into a 500 instead of killing the process.
func Recoverer(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.ErrorContext(r.Context(), "panic recovered",
						"panic", rec,
						"path", r.URL.Path,
						"request_id", RequestIDFromContext(r.Context()),
					)
					JSON(w, http.StatusInternalServerError, map[string]any{
						"error": map[string]any{
							"code":     CodeInternal,
							"message":  "something went wrong on our side",
							"friendly": "oops, that broke on our end — try again?",
						},
					})
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// CORS allows exactly the origins in ALLOWED_ORIGINS, with credentials.
func CORS(allowed []string) func(http.Handler) http.Handler {
	allowSet := make(map[string]bool, len(allowed))
	for _, o := range allowed {
		allowSet[strings.TrimRight(strings.TrimSpace(o), "/")] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimRight(r.Header.Get("Origin"), "/")
			if origin != "" && allowSet[origin] {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Set("Vary", "Origin")
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, "+RequestIDHeader+", X-Device-Fingerprint")
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				h.Set("Access-Control-Max-Age", "300")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Limiter is the rate limiting contract. Redis backs it in production; the
// in-memory one below keeps tests hermetic.
type Limiter interface {
	// Allow reports whether this key may act, and how long until it may retry.
	Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, time.Duration, error)
}

// MemoryLimiter is a fixed-window counter held in process memory.
type MemoryLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	now     func() time.Time
}

type bucket struct {
	count     int
	expiresAt time.Time
}

// NewMemoryLimiter returns an in-process limiter.
func NewMemoryLimiter() *MemoryLimiter {
	return &MemoryLimiter{buckets: map[string]*bucket{}, now: time.Now}
}

// Allow implements Limiter.
func (m *MemoryLimiter) Allow(_ context.Context, key string, limit int, window time.Duration) (bool, time.Duration, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.now()
	b, ok := m.buckets[key]
	if !ok || now.After(b.expiresAt) {
		b = &bucket{expiresAt: now.Add(window)}
		m.buckets[key] = b
	}
	b.count++
	if b.count > limit {
		return false, b.expiresAt.Sub(now), nil
	}
	return true, 0, nil
}

// RateLimit rejects requests once a key exceeds limit within window. The key is
// the authenticated user when available, otherwise the client IP.
func RateLimit(l Limiter, limit int, window time.Duration, keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFn(r)
			ok, retryAfter, err := l.Allow(r.Context(), key, limit, window)
			if err != nil {
				// Never fail closed on a limiter outage; log and let it through.
				slog.WarnContext(r.Context(), "rate limiter unavailable", "error", err)
				next.ServeHTTP(w, r)
				return
			}
			if !ok {
				w.Header().Set("Retry-After", strconv.Itoa(int(retryAfter.Seconds())+1))
				Fail(w, r, RateLimited("too many requests — slow down a moment").
					WithFriendly("whoa, slow down! try again in a few seconds 🫶"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClientIP extracts the caller address, honouring one proxy hop.
func ClientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if i := strings.IndexByte(fwd, ','); i > 0 {
			return strings.TrimSpace(fwd[:i])
		}
		return strings.TrimSpace(fwd)
	}
	if realIP := r.Header.Get("X-Real-Ip"); realIP != "" {
		return realIP
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
