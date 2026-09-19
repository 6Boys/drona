// Package config loads every knob the API has from the environment.
//
// Nothing in this codebase hardcodes a connection string, a secret, or a
// product rule. If you need to change behaviour, change .env.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config is the fully resolved runtime configuration.
type Config struct {
	Env      string
	Port     int
	LogLevel string

	DatabaseURL string
	RedisURL    string

	JWTSecret      []byte
	AccessTTL      time.Duration
	RefreshTTL     time.Duration
	AllowedOrigins []string

	// Campus verification (PRD 6.1)
	CampusEmailDomains []string
	OTPTTL             time.Duration
	OTPLength          int
	OTPMaxAttempts     int
	OTPResendCooldown  time.Duration

	Mailer       string
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string

	// Product rules
	OnboardingMinFollows int       // 6.1 follow-8 gate
	NightWindowStart     TimeOfDay // 6.2 night window opens, in NightLocation
	NightCurfew          TimeOfDay // 6.2 hard curfew, points stop, in NightLocation
	// NightLocation is the timezone "22:00" and "03:00" are wall-clock hours in.
	// PRD 6.2 says the window is local time — this is what "local" means, and it
	// is a configured product decision, not whatever timezone happens to be set
	// on the host OS. Defaults to Asia/Kolkata: DronaSphere's beachhead campus
	// (Dronacharya College of Engineering) is in Gurugram.
	NightLocation        *time.Location
	OwlMinActions        int           // 6.2 anti-cheat: passive presence earns nothing
	OwlMaxPointsPerHour  int           // 6.2 anti-cheat: per-action rate cap
	CocoonMinSleep       time.Duration // 6.2 recovery bonus threshold
	CocoonStardust       int
	DatingUnlockMinUsers int           // 6.3 Love Finder stays locked below this
	MatchWilt            time.Duration // 6.3 a silent match wilts
	MatchNudge           time.Duration

	// Media: this instance's own disk-backed object storage (internal/media).
	// There is deliberately no env var for the size/type policy — see that
	// package's doc comment for why a homelab's storage budget is a constant a
	// deployer edits and rebuilds, not something an environment can loosen.
	MediaDir string
	// MediaPublicBaseURL overrides the origin uploaded files are linked with.
	// Leave unset to derive it from each request (internal/media.BaseURLFromRequest)
	// — the right default when the API is reachable at one hostname. Set it
	// when uploads must resolve to somewhere else, e.g. a CDN or a different
	// public path than the one a reverse proxy uses internally.
	MediaPublicBaseURL string
}

// TimeOfDay is a wall-clock time with no date, e.g. the 22:00 night boundary.
type TimeOfDay struct {
	Hour   int
	Minute int
}

// Minutes returns the offset from midnight, which makes window maths trivial.
func (t TimeOfDay) Minutes() int { return t.Hour*60 + t.Minute }

func (t TimeOfDay) String() string { return fmt.Sprintf("%02d:%02d", t.Hour, t.Minute) }

// ParseTimeOfDay accepts "HH:MM".
func ParseTimeOfDay(s string) (TimeOfDay, error) {
	parts := strings.Split(strings.TrimSpace(s), ":")
	if len(parts) != 2 {
		return TimeOfDay{}, fmt.Errorf("want HH:MM, got %q", s)
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil || h < 0 || h > 23 {
		return TimeOfDay{}, fmt.Errorf("bad hour in %q", s)
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil || m < 0 || m > 59 {
		return TimeOfDay{}, fmt.Errorf("bad minute in %q", s)
	}
	return TimeOfDay{Hour: h, Minute: m}, nil
}

// IsProduction reports whether we should behave conservatively (no dev shortcuts).
func (c *Config) IsProduction() bool { return c.Env == "production" }

// Load reads the environment and validates it. It never reaches out to the
// network, so it is safe to call in tests.
func Load() (*Config, error) {
	c := &Config{
		Env:      env("API_ENV", "development"),
		LogLevel: env("LOG_LEVEL", "info"),
		Mailer:   env("MAILER", "log"),

		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    env("REDIS_URL", "redis://localhost:6379/0"),

		SMTPHost:     os.Getenv("SMTP_HOST"),
		SMTPUser:     os.Getenv("SMTP_USER"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:     env("SMTP_FROM", "DronaSphere <hello@dronasphere.app>"),
	}

	var errs []error
	pick := func(err error) {
		if err != nil {
			errs = append(errs, err)
		}
	}

	var err error
	c.Port, err = envInt("API_PORT", 8080)
	pick(err)
	c.SMTPPort, err = envInt("SMTP_PORT", 587)
	pick(err)

	secret := os.Getenv("JWT_SECRET")
	c.JWTSecret = []byte(secret)

	c.AccessTTL, err = envDuration("JWT_ACCESS_TTL", 15*time.Minute)
	pick(err)
	c.RefreshTTL, err = envDuration("JWT_REFRESH_TTL", 720*time.Hour)
	pick(err)

	c.AllowedOrigins = envList("ALLOWED_ORIGINS", "http://localhost:3000")
	c.CampusEmailDomains = lowerAll(envList("CAMPUS_EMAIL_DOMAINS", ""))

	c.OTPTTL, err = envDuration("OTP_TTL", 10*time.Minute)
	pick(err)
	c.OTPLength, err = envInt("OTP_LENGTH", 6)
	pick(err)
	c.OTPMaxAttempts, err = envInt("OTP_MAX_ATTEMPTS", 5)
	pick(err)
	c.OTPResendCooldown, err = envDuration("OTP_RESEND_COOLDOWN", time.Minute)
	pick(err)

	c.OnboardingMinFollows, err = envInt("ONBOARDING_MIN_FOLLOWS", 8)
	pick(err)

	c.NightWindowStart, err = ParseTimeOfDay(env("NIGHT_WINDOW_START", "22:00"))
	pick(err)
	c.NightCurfew, err = ParseTimeOfDay(env("NIGHT_CURFEW", "03:00"))
	pick(err)
	if loc, err := time.LoadLocation(env("NIGHT_TIMEZONE", "Asia/Kolkata")); err != nil {
		pick(fmt.Errorf("NIGHT_TIMEZONE: %w", err))
	} else {
		c.NightLocation = loc
	}

	c.OwlMinActions, err = envInt("OWL_MIN_ACTIONS", 3)
	pick(err)
	c.OwlMaxPointsPerHour, err = envInt("OWL_MAX_POINTS_PER_HOUR", 120)
	pick(err)

	sleepHours, err := envFloat("COCOON_MIN_SLEEP_HOURS", 7)
	pick(err)
	c.CocoonMinSleep = time.Duration(sleepHours * float64(time.Hour))
	c.CocoonStardust, err = envInt("COCOON_STARDUST", 250)
	pick(err)

	c.DatingUnlockMinUsers, err = envInt("DATING_UNLOCK_MIN_USERS", 400)
	pick(err)
	wiltDays, err := envInt("MATCH_WILT_DAYS", 7)
	pick(err)
	c.MatchWilt = time.Duration(wiltDays) * 24 * time.Hour
	nudgeDays, err := envInt("MATCH_NUDGE_DAYS", 5)
	pick(err)
	c.MatchNudge = time.Duration(nudgeDays) * 24 * time.Hour

	c.MediaDir = env("MEDIA_DIR", "./data/media")
	c.MediaPublicBaseURL = strings.TrimRight(os.Getenv("MEDIA_PUBLIC_BASE_URL"), "/")

	// Hard requirements — refuse to boot half-configured.
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if len(c.JWTSecret) < 32 {
		errs = append(errs, errors.New("JWT_SECRET must be at least 32 bytes — run: openssl rand -base64 48"))
	}
	if c.IsProduction() && strings.Contains(secret, "dev-only") {
		errs = append(errs, errors.New("JWT_SECRET is still the development placeholder"))
	}
	if len(c.CampusEmailDomains) == 0 {
		errs = append(errs, errors.New("CAMPUS_EMAIL_DOMAINS is required — an unverified campus is not a campus"))
	}
	if c.NightWindowStart.Minutes() == c.NightCurfew.Minutes() {
		errs = append(errs, errors.New("NIGHT_WINDOW_START and NIGHT_CURFEW must differ"))
	}
	if c.NightLocation == nil {
		errs = append(errs, errors.New("NIGHT_TIMEZONE could not be resolved"))
	}
	if c.OTPLength < 4 || c.OTPLength > 10 {
		errs = append(errs, fmt.Errorf("OTP_LENGTH must be 4..10, got %d", c.OTPLength))
	}

	if len(errs) > 0 {
		return nil, fmt.Errorf("invalid configuration: %w", errors.Join(errs...))
	}
	return c, nil
}

// IsCampusEmail reports whether an address belongs to a verified institution,
// which is what separates a student from a stranger (PRD 6.1).
func (c *Config) IsCampusEmail(email string) bool {
	at := strings.LastIndex(email, "@")
	if at < 0 {
		return false
	}
	domain := strings.ToLower(strings.TrimSpace(email[at+1:]))
	for _, d := range c.CampusEmailDomains {
		if domain == d {
			return true
		}
	}
	return false
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def, fmt.Errorf("%s: %q is not an integer", key, raw)
	}
	return v, nil
}

func envFloat(key string, def float64) (float64, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def, nil
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return def, fmt.Errorf("%s: %q is not a number", key, raw)
	}
	return v, nil
}

func envDuration(key string, def time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def, nil
	}
	v, err := time.ParseDuration(raw)
	if err != nil {
		return def, fmt.Errorf("%s: %q is not a duration (try 15m, 720h)", key, raw)
	}
	return v, nil
}

func envList(key, def string) []string {
	raw := env(key, def)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func lowerAll(in []string) []string {
	out := make([]string, len(in))
	for i, s := range in {
		out[i] = strings.ToLower(s)
	}
	return out
}
