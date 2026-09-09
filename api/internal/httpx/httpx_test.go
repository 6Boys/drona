package httpx

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

type body struct {
	Name string `json:"name"`
	Age  int    `json:"age"`
}

func postJSON(payload string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(payload))
	r.Header.Set("Content-Type", "application/json")
	return r
}

func TestDecode(t *testing.T) {
	t.Run("valid json", func(t *testing.T) {
		var got body
		require.NoError(t, Decode(postJSON(`{"name":"meher","age":20}`), &got))
		assert.Equal(t, body{Name: "meher", Age: 20}, got)
	})

	t.Run("unknown fields are rejected so a client typo is never silent", func(t *testing.T) {
		var got body
		err := Decode(postJSON(`{"name":"meher","nmae":"typo"}`), &got)
		require.Error(t, err)

		var apiErr *APIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, http.StatusBadRequest, apiErr.Status)
		assert.Contains(t, apiErr.Message, "nmae")
	})

	t.Run("a wrong type names the field", func(t *testing.T) {
		var got body
		err := Decode(postJSON(`{"age":"twenty"}`), &got)

		var apiErr *APIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, CodeValidation, apiErr.Code)
		assert.Contains(t, apiErr.Fields, "age")
	})

	t.Run("malformed json reports where", func(t *testing.T) {
		var got body
		err := Decode(postJSON(`{"name":`), &got)

		var apiErr *APIError
		require.ErrorAs(t, err, &apiErr)
		assert.Equal(t, CodeBadRequest, apiErr.Code)
	})

	t.Run("an empty body says so plainly", func(t *testing.T) {
		var got body
		err := Decode(postJSON(``), &got)

		var apiErr *APIError
		require.ErrorAs(t, err, &apiErr)
		assert.Contains(t, apiErr.Message, "empty")
	})

	t.Run("two json documents in one body are refused", func(t *testing.T) {
		var got body
		err := Decode(postJSON(`{"name":"a"}{"name":"b"}`), &got)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "single JSON object")
	})

	t.Run("the wrong content type is refused", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{}`))
		r.Header.Set("Content-Type", "text/plain")

		var got body
		err := Decode(r, &got)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "application/json")
	})

	t.Run("a charset parameter is still json", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"ok"}`))
		r.Header.Set("Content-Type", "application/json; charset=utf-8")

		var got body
		assert.NoError(t, Decode(r, &got))
	})

	t.Run("an oversized body cannot exhaust memory", func(t *testing.T) {
		huge := `{"name":"` + strings.Repeat("x", MaxBodyBytes+1024) + `"}`
		var got body
		err := Decode(postJSON(huge), &got)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "too large")
	})
}

func TestAPIError_Rendering(t *testing.T) {
	t.Run("a 4xx is rendered as-is", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)

		Fail(w, r, NotFound("no such post").WithFriendly("that post wandered off 🦉"))

		assert.Equal(t, http.StatusNotFound, w.Code)
		assert.Equal(t, "application/json; charset=utf-8", w.Header().Get("Content-Type"))
		assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))

		var got struct {
			Error struct {
				Code     string `json:"code"`
				Message  string `json:"message"`
				Friendly string `json:"friendly"`
			} `json:"error"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
		assert.Equal(t, "not_found", got.Error.Code)
		assert.Equal(t, "no such post", got.Error.Message)
		assert.Equal(t, "that post wandered off 🦉", got.Error.Friendly)
	})

	t.Run("an internal cause is logged but never sent to the client", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)

		secret := errors.New(`pq: password authentication failed for user "drona"`)
		Fail(w, r, Internal("something went wrong on our side").WithCause(secret))

		assert.Equal(t, http.StatusInternalServerError, w.Code)
		assert.NotContains(t, w.Body.String(), "password")
		assert.NotContains(t, w.Body.String(), "drona")
		assert.Contains(t, w.Body.String(), "something went wrong on our side")
	})

	t.Run("a bare error becomes a 500 without leaking its text", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)

		Fail(w, r, errors.New("connection refused to 10.0.0.5:5432"))

		assert.Equal(t, http.StatusInternalServerError, w.Code)
		assert.NotContains(t, w.Body.String(), "10.0.0.5")
	})

	t.Run("WithCause and WithFriendly do not mutate the shared value", func(t *testing.T) {
		base := NotFound("gone")
		withCause := base.WithCause(errors.New("boom"))

		assert.Nil(t, base.Unwrap(), "the original must be untouched")
		assert.NotNil(t, withCause.Unwrap())
	})
}

// Safety, consent, age-gate and privacy copy stays plain — cuteness there reads
// as manipulation (PRD 8).
func TestSafetyErrorsCarryNoCuteCopy(t *testing.T) {
	for _, err := range []*APIError{
		AgeRestricted("You must be at least 18 years old to use Love Finder."),
		FeatureLocked("Love Finder unlocks once 400 students have joined."),
	} {
		assert.Empty(t, err.Friendly, "%s must not ship cute copy", err.Code)
		assert.NotContains(t, err.Message, "🦉")
		assert.NotContains(t, err.Message, "oops")
	}
}

func TestValidation(t *testing.T) {
	err := Validation(map[string]string{"handle": "3–20 characters"})
	assert.Equal(t, http.StatusUnprocessableEntity, err.Status)
	assert.Equal(t, CodeValidation, err.Code)
	assert.Equal(t, "3–20 characters", err.Fields["handle"])
}

func TestOnboardingIncomplete_TellsTheClientWhereToGo(t *testing.T) {
	err := OnboardingIncomplete("FOLLOWS")
	assert.Equal(t, http.StatusForbidden, err.Status)
	assert.Equal(t, CodeOnboardingNeeded, err.Code)
	assert.Equal(t, "FOLLOWS", err.Fields["step"])
}

func TestRequestID(t *testing.T) {
	t.Run("a request without one is given one", func(t *testing.T) {
		var seen string
		h := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			seen = RequestIDFromContext(r.Context())
		}))

		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

		assert.NotEmpty(t, seen)
		assert.Equal(t, seen, w.Header().Get(RequestIDHeader), "and it is echoed back for bug reports")
	})

	t.Run("a caller's id is honoured", func(t *testing.T) {
		h := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "trace-me", RequestIDFromContext(r.Context()))
		}))
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set(RequestIDHeader, "trace-me")
		h.ServeHTTP(httptest.NewRecorder(), r)
	})

	t.Run("an absurdly long id is replaced", func(t *testing.T) {
		var seen string
		h := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			seen = RequestIDFromContext(r.Context())
		}))
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set(RequestIDHeader, strings.Repeat("a", 500))
		h.ServeHTTP(httptest.NewRecorder(), r)

		assert.NotEqual(t, strings.Repeat("a", 500), seen)
		assert.LessOrEqual(t, len(seen), 64)
	})
}

func TestRecoverer_TurnsAPanicIntoA500(t *testing.T) {
	h := Recoverer(discardLogger())(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("the database exploded")
	}))

	w := httptest.NewRecorder()
	assert.NotPanics(t, func() {
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
	})

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.NotContains(t, w.Body.String(), "exploded", "the panic text is for the log, not the user")
	assert.Contains(t, w.Body.String(), "internal_error")
}

func TestCORS(t *testing.T) {
	allowed := []string{"http://localhost:3000", "https://dronasphere.app/"}
	h := CORS(allowed)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("an allowed origin gets the headers", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Origin", "http://localhost:3000")
		h.ServeHTTP(w, r)

		assert.Equal(t, "http://localhost:3000", w.Header().Get("Access-Control-Allow-Origin"))
		assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
		assert.Equal(t, "Origin", w.Header().Get("Vary"))
	})

	t.Run("a trailing slash in config still matches", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Origin", "https://dronasphere.app")
		h.ServeHTTP(w, r)
		assert.Equal(t, "https://dronasphere.app", w.Header().Get("Access-Control-Allow-Origin"))
	})

	t.Run("an unlisted origin gets nothing", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.Header.Set("Origin", "https://evil.example")
		h.ServeHTTP(w, r)

		assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
	})

	t.Run("a preflight is answered without reaching the handler", func(t *testing.T) {
		reached := false
		h := CORS(allowed)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { reached = true }))

		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodOptions, "/", nil)
		r.Header.Set("Origin", "http://localhost:3000")
		h.ServeHTTP(w, r)

		assert.Equal(t, http.StatusNoContent, w.Code)
		assert.False(t, reached)
	})
}

func TestMemoryLimiter(t *testing.T) {
	l := NewMemoryLimiter()
	ctx := context.Background()

	for i := 1; i <= 3; i++ {
		ok, _, err := l.Allow(ctx, "user:1", 3, time.Minute)
		require.NoError(t, err)
		assert.True(t, ok, "request %d of 3 should be allowed", i)
	}

	ok, retryAfter, err := l.Allow(ctx, "user:1", 3, time.Minute)
	require.NoError(t, err)
	assert.False(t, ok, "the fourth exceeds the limit")
	assert.Positive(t, retryAfter, "and it says when to come back")

	ok, _, err = l.Allow(ctx, "user:2", 3, time.Minute)
	require.NoError(t, err)
	assert.True(t, ok, "limits are per key")
}

func TestMemoryLimiter_WindowExpires(t *testing.T) {
	l := NewMemoryLimiter()
	now := time.Now()
	l.now = func() time.Time { return now }
	ctx := context.Background()

	_, _, _ = l.Allow(ctx, "k", 1, time.Minute)
	ok, _, _ := l.Allow(ctx, "k", 1, time.Minute)
	require.False(t, ok)

	now = now.Add(61 * time.Second)
	ok, _, _ = l.Allow(ctx, "k", 1, time.Minute)
	assert.True(t, ok, "a new window starts fresh")
}

func TestRateLimit_Middleware(t *testing.T) {
	h := RateLimit(NewMemoryLimiter(), 1, time.Minute, func(*http.Request) string { return "same" })(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))

	first := httptest.NewRecorder()
	h.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, http.StatusOK, first.Code)

	second := httptest.NewRecorder()
	h.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, http.StatusTooManyRequests, second.Code)
	assert.NotEmpty(t, second.Header().Get("Retry-After"))
	assert.Contains(t, second.Body.String(), "rate_limited")
}

// A limiter outage must not take the API down with it.
type brokenLimiter struct{}

func (brokenLimiter) Allow(context.Context, string, int, time.Duration) (bool, time.Duration, error) {
	return false, 0, errors.New("redis is on fire")
}

func TestRateLimit_FailsOpenWhenTheLimiterIsBroken(t *testing.T) {
	reached := false
	h := RateLimit(brokenLimiter{}, 1, time.Minute, func(*http.Request) string { return "k" })(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reached = true
			w.WriteHeader(http.StatusOK)
		}))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

	assert.True(t, reached, "a broken limiter must not lock everyone out")
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestClientIP(t *testing.T) {
	tests := []struct {
		name    string
		headers map[string]string
		remote  string
		want    string
	}{
		{name: "no proxy", remote: "203.0.113.9:54321", want: "203.0.113.9"},
		{name: "one proxy hop", headers: map[string]string{"X-Forwarded-For": "198.51.100.7"}, remote: "10.0.0.1:1", want: "198.51.100.7"},
		{name: "a chain takes the client", headers: map[string]string{"X-Forwarded-For": "198.51.100.7, 10.0.0.1, 10.0.0.2"}, remote: "10.0.0.1:1", want: "198.51.100.7"},
		{name: "x-real-ip", headers: map[string]string{"X-Real-Ip": "192.0.2.5"}, remote: "10.0.0.1:1", want: "192.0.2.5"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.RemoteAddr = tc.remote
			for k, v := range tc.headers {
				r.Header.Set(k, v)
			}
			assert.Equal(t, tc.want, ClientIP(r))
		})
	}
}

func TestHandler_RendersReturnedErrors(t *testing.T) {
	h := Handler(func(w http.ResponseWriter, r *http.Request) error {
		return Conflict("that handle is taken")
	})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

	assert.Equal(t, http.StatusConflict, w.Code)
	assert.Contains(t, w.Body.String(), "conflict")
}

func TestJSON_NilBodyWritesNothing(t *testing.T) {
	w := httptest.NewRecorder()
	JSON(w, http.StatusAccepted, nil)

	assert.Equal(t, http.StatusAccepted, w.Code)
	assert.Empty(t, bytes.TrimSpace(w.Body.Bytes()))
}
