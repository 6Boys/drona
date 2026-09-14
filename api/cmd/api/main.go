// Command api is the DronaSphere backend: REST plus a WebSocket gateway.
//
//	go run ./cmd/api            # reads .env from the repo root
//	./api -healthcheck          # container health probe, exits 0 when healthy
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/api"
	"github.com/aniketrathour/dronasphere/api/internal/auth"
	"github.com/aniketrathour/dronasphere/api/internal/cache"
	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/logx"
	"github.com/aniketrathour/dronasphere/api/internal/mailer"
	"github.com/aniketrathour/dronasphere/api/internal/media"
	"github.com/aniketrathour/dronasphere/api/internal/realtime"
	"github.com/aniketrathour/dronasphere/api/internal/service"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "probe the local server and exit")
	flag.Parse()

	if *healthcheck {
		os.Exit(probe())
	}

	if err := run(); err != nil {
		log.Fatalf("dronasphere-api: %v", err)
	}
}

func run() error {
	// Load .env from the repo root when present, so `go run ./cmd/api` works
	// without a wrapper. Real environments set real environment variables, and
	// those always win.
	loadDotEnv()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := logx.New(cfg.Env, cfg.LogLevel)
	logger.Info("starting", "env", cfg.Env, "port", cfg.Port)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// --- Postgres ---
	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := db.SchemaReady(ctx); err != nil {
		return err
	}
	logger.Info("postgres connected")

	// --- Redis (optional but strongly recommended) ---
	var redisClient *cache.Redis
	var limiter httpx.Limiter = httpx.NewMemoryLimiter()
	var bus realtime.Bus = realtime.NewMemoryBus()

	if cfg.RedisURL != "" {
		redisClient, err = cache.Open(ctx, cfg.RedisURL)
		if err != nil {
			// Degrade rather than refuse to boot: the app works without Redis,
			// it just cannot fan out across pods or keep a live leaderboard.
			logger.Warn("redis unavailable — running with in-process fanout and rate limits",
				"error", err)
		} else {
			defer redisClient.Close()
			limiter = redisClient
			bus = realtime.NewRedisBus(redisClient.Client(), logger)
			logger.Info("redis connected")
		}
	}

	// --- services ---
	//
	// Every service's clock is UTC, never the host's local time. pgx encodes a
	// bare TIMESTAMP column from a time.Time's wall-clock digits as given — it
	// does not convert to UTC first — so a Local-zoned "now" silently drifts by
	// the host's UTC offset the moment it is written to Postgres and later
	// compared against the database's own now(). Two store methods that persist
	// a computed expiry (StoreRefreshToken, CreateOTP) also call .UTC()
	// themselves as a second line of defence, but the ambient clock is UTC here
	// too so no future call site can reintroduce the bug by forgetting to.
	//
	// This does not affect the Owl Board's "local" night window (PRD 6.2): that
	// logic explicitly converts into cfg.NightLocation wherever it needs
	// wall-clock hours, which works correctly regardless of the incoming time's
	// own zone tag.
	utcNow := func() time.Time { return time.Now().UTC() }

	issuer := auth.NewTokenIssuer(cfg.JWTSecret, cfg.AccessTTL, cfg.RefreshTTL, utcNow)
	mail := mailer.New(cfg.Mailer, cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPFrom, logger)
	if strings.EqualFold(cfg.Mailer, "log") {
		logger.Warn("MAILER=log — OTP codes are printed to this log, not emailed")
	}

	authSvc := service.NewAuthService(cfg, db, issuer, mail, logger, utcNow)
	owlSvc := service.NewOwlService(cfg, db, redisClient, bus, logger, utcNow)
	userSvc := service.NewUserService(cfg, db, bus, logger, utcNow)
	feedSvc := service.NewFeedService(cfg, db, bus, owlSvc, logger, utcNow)
	chatSvc := service.NewChatService(cfg, db, redisClient, bus, owlSvc, logger, utcNow)
	noteSvc := service.NewNoteService(cfg, db, logger, utcNow)

	mediaStore, err := media.New(cfg.MediaDir)
	if err != nil {
		return err
	}
	logger.Info("media store ready", "dir", cfg.MediaDir, "max_bytes", media.MaxBytes)

	gateway := realtime.NewGateway(bus, chatSvc, realtime.NewHub(), logger, cfg.AllowedOrigins)

	server := api.NewServer(api.Deps{
		Config:  cfg,
		Log:     logger,
		Issuer:  issuer,
		Limiter: limiter,
		Auth:    authSvc,
		Users:   userSvc,
		Feed:    feedSvc,
		Chat:    chatSvc,
		Owl:     owlSvc,
		Notes:   noteSvc,
		Media:   mediaStore,
		Gateway: gateway,
		Health: func(r *http.Request) map[string]string {
			checks := map[string]string{"postgres": "ok"}
			pingCtx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()

			if err := db.Ping(pingCtx); err != nil {
				checks["postgres"] = "error: " + err.Error()
			}
			if redisClient != nil {
				checks["redis"] = "ok"
				if err := redisClient.Ping(pingCtx); err != nil {
					checks["redis"] = "error: " + err.Error()
				}
			} else {
				checks["redis"] = "not configured"
			}
			return checks
		},
	})

	// --- background jobs ---
	go snapshotLoop(ctx, db, owlSvc, logger)

	httpServer := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           server.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		// No WriteTimeout: a WebSocket lives far longer than any sane value, and
		// per-write deadlines in the gateway cover slow clients instead.
		IdleTimeout: 120 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return fmt.Errorf("http server: %w", err)
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	}

	// Give in-flight requests a moment; sockets are closed by the context.
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	logger.Info("stopped cleanly")
	return nil
}

// snapshotLoop copies the Redis Owl Board into Postgres periodically, so the
// weekly reset never destroys history (PRD 6.2).
func snapshotLoop(ctx context.Context, db *store.DB, owlSvc *service.OwlService, logger *slog.Logger) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			campusIDs, err := db.CampusIDs(ctx)
			if err != nil {
				logger.Warn("snapshot: could not list campuses", "error", err)
				continue
			}
			if err := owlSvc.SnapshotBoards(ctx, campusIDs); err != nil {
				logger.Warn("snapshot: failed", "error", err)
			}
		}
	}
}

// probe is the container health check: hit /healthz on the configured port.
func probe() int {
	loadDotEnv()

	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		fmt.Fprintf(os.Stderr, "healthcheck: %v\n", err)
		return 1
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "healthcheck: status %d\n", resp.StatusCode)
		return 1
	}
	return 0
}

// loadDotEnv reads KEY=VALUE lines from the nearest .env, walking up from the
// working directory. Existing environment variables are never overwritten.
func loadDotEnv() {
	dir, err := os.Getwd()
	if err != nil {
		return
	}

	for range 5 {
		path := filepath.Join(dir, ".env")
		if data, err := os.ReadFile(path); err == nil {
			applyEnv(string(data))
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
	}
}

func applyEnv(content string) {
	for line := range strings.SplitSeq(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		// Strip matched surrounding quotes.
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') ||
				(value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}
}
