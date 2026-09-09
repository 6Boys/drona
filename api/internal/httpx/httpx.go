// Package httpx holds the HTTP plumbing shared by every handler: one JSON
// envelope, one error shape, and request decoding that cannot be used to
// exhaust memory.
package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
)

// MaxBodyBytes caps request bodies. Images go through signed upload URLs, so
// no JSON body has any business being larger than this.
const MaxBodyBytes = 1 << 20 // 1 MiB

// ErrorCode is a stable, machine-readable reason. The web client switches on
// these; it never parses the message.
type ErrorCode string

const (
	CodeBadRequest       ErrorCode = "bad_request"
	CodeUnauthorized     ErrorCode = "unauthorized"
	CodeForbidden        ErrorCode = "forbidden"
	CodeNotFound         ErrorCode = "not_found"
	CodeConflict         ErrorCode = "conflict"
	CodeRateLimited      ErrorCode = "rate_limited"
	CodeValidation       ErrorCode = "validation_failed"
	CodeOnboardingNeeded ErrorCode = "onboarding_incomplete"
	CodeAgeRestricted    ErrorCode = "age_restricted"
	CodeFeatureLocked    ErrorCode = "feature_locked"
	CodeInternal         ErrorCode = "internal_error"
)

// APIError is both an error and a renderable response.
type APIError struct {
	Status  int               `json:"-"`
	Code    ErrorCode         `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
	// Cute copy for the UI. Deliberately absent for safety, consent, age-gate
	// and privacy errors — PRD 8 says cuteness there reads as manipulation.
	Friendly string `json:"friendly,omitempty"`
	cause    error
}

func (e *APIError) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *APIError) Unwrap() error { return e.cause }

// WithCause attaches an internal error for the logs. It is never serialised.
func (e *APIError) WithCause(err error) *APIError {
	clone := *e
	clone.cause = err
	return &clone
}

// WithFriendly attaches user-facing cute copy.
func (e *APIError) WithFriendly(s string) *APIError {
	clone := *e
	clone.Friendly = s
	return &clone
}

// WithFields attaches per-field validation messages.
func (e *APIError) WithFields(f map[string]string) *APIError {
	clone := *e
	clone.Fields = f
	return &clone
}

func newErr(status int, code ErrorCode, msg string) *APIError {
	return &APIError{Status: status, Code: code, Message: msg}
}

func BadRequest(msg string) *APIError { return newErr(http.StatusBadRequest, CodeBadRequest, msg) }
func Unauthorized(msg string) *APIError {
	return newErr(http.StatusUnauthorized, CodeUnauthorized, msg)
}
func Forbidden(msg string) *APIError { return newErr(http.StatusForbidden, CodeForbidden, msg) }
func NotFound(msg string) *APIError  { return newErr(http.StatusNotFound, CodeNotFound, msg) }
func Conflict(msg string) *APIError  { return newErr(http.StatusConflict, CodeConflict, msg) }
func RateLimited(msg string) *APIError {
	return newErr(http.StatusTooManyRequests, CodeRateLimited, msg)
}
func Internal(msg string) *APIError { return newErr(http.StatusInternalServerError, CodeInternal, msg) }

// Validation returns a 422 carrying per-field messages.
func Validation(fields map[string]string) *APIError {
	return (&APIError{
		Status:  http.StatusUnprocessableEntity,
		Code:    CodeValidation,
		Message: "some fields need fixing",
	}).WithFields(fields)
}

// OnboardingIncomplete is returned when a user tries to use the app before
// clearing the follow-8 gate (PRD 6.1).
func OnboardingIncomplete(step string) *APIError {
	return &APIError{
		Status:  http.StatusForbidden,
		Code:    CodeOnboardingNeeded,
		Message: "finish onboarding first",
		Fields:  map[string]string{"step": step},
	}
}

// AgeRestricted gates Love Finder and Crush Jar for under-18 accounts (PRD 6.3,
// 10). Plain copy only — this is a safety surface.
func AgeRestricted(msg string) *APIError {
	return newErr(http.StatusForbidden, CodeAgeRestricted, msg)
}

// FeatureLocked covers campus-size gates, e.g. dating below N verified users.
func FeatureLocked(msg string) *APIError {
	return newErr(http.StatusForbidden, CodeFeatureLocked, msg)
}

// JSON writes v with the given status.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write response failed", "error", err)
	}
}

// NoContent writes a 204.
func NoContent(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) }

// Fail renders any error as the standard envelope, logging 5xx causes.
func Fail(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		apiErr = Internal("something went wrong on our side").WithCause(err)
	}

	if apiErr.Status >= 500 {
		slog.ErrorContext(r.Context(), "request failed",
			"code", apiErr.Code,
			"error", apiErr.Error(),
			"method", r.Method,
			"path", r.URL.Path,
			"request_id", RequestIDFromContext(r.Context()),
		)
	}

	JSON(w, apiErr.Status, map[string]any{"error": apiErr})
}

// Decode reads a JSON body into dst, rejecting unknown fields so typos in a
// client don't silently do nothing.
func Decode(r *http.Request, dst any) error {
	if ct := r.Header.Get("Content-Type"); ct != "" {
		if mt := strings.TrimSpace(strings.Split(ct, ";")[0]); mt != "application/json" {
			return BadRequest("expected Content-Type: application/json")
		}
	}

	r.Body = http.MaxBytesReader(nil, r.Body, MaxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var syntax *json.SyntaxError
		var typeErr *json.UnmarshalTypeError
		var maxErr *http.MaxBytesError
		switch {
		case errors.As(err, &syntax):
			return BadRequest(fmt.Sprintf("malformed JSON at byte %d", syntax.Offset))
		case errors.As(err, &typeErr):
			return Validation(map[string]string{typeErr.Field: fmt.Sprintf("expected %s", typeErr.Type)})
		case errors.As(err, &maxErr):
			return BadRequest("request body is too large")
		case errors.Is(err, io.EOF):
			return BadRequest("request body is empty")
		default:
			return BadRequest(strings.TrimPrefix(err.Error(), "json: "))
		}
	}

	// Exactly one JSON value per request.
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return BadRequest("request body must contain a single JSON object")
	}
	return nil
}

// Handler is a handler that may return an error, so handlers can `return err`
// instead of remembering to write a response and bail.
type Handler func(http.ResponseWriter, *http.Request) error

// ServeHTTP makes Handler an http.Handler.
func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if err := h(w, r); err != nil {
		Fail(w, r, err)
	}
}
