// Package logx sets up structured logging. JSON in production so it is
// greppable in a log aggregator, human-readable text in development.
package logx

import (
	"log/slog"
	"os"
	"strings"
)

// New returns a logger for the given environment and level.
func New(env, level string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: parseLevel(level)}

	var h slog.Handler
	if env == "production" || env == "staging" {
		h = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		h = slog.NewTextHandler(os.Stdout, opts)
	}
	return slog.New(h).With("service", "dronasphere-api")
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
