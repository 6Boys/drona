package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// validEnv is the minimum that boots. Tests copy it and break one thing.
func validEnv() map[string]string {
	return map[string]string{
		"DATABASE_URL":         "postgresql://drona:pw@localhost:5432/dronasphere?schema=public",
		"JWT_SECRET":           "a-secret-that-is-at-least-thirty-two-bytes-long",
		"CAMPUS_EMAIL_DOMAINS": "dronacharya.info,gcet.ac.in",
	}
}

func setEnv(t *testing.T, env map[string]string) {
	t.Helper()
	// Clear everything the loader reads, so a developer's own shell cannot
	// change the result of a test run.
	for _, key := range []string{
		"API_ENV", "API_PORT", "LOG_LEVEL", "DATABASE_URL", "REDIS_URL", "JWT_SECRET",
		"JWT_ACCESS_TTL", "JWT_REFRESH_TTL", "ALLOWED_ORIGINS", "CAMPUS_EMAIL_DOMAINS",
		"OTP_TTL", "OTP_LENGTH", "OTP_MAX_ATTEMPTS", "OTP_RESEND_COOLDOWN", "MAILER",
		"SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM",
		"ONBOARDING_MIN_FOLLOWS", "NIGHT_WINDOW_START", "NIGHT_CURFEW", "OWL_MIN_ACTIONS",
		"OWL_MAX_POINTS_PER_HOUR", "COCOON_MIN_SLEEP_HOURS", "COCOON_STARDUST",
		"DATING_UNLOCK_MIN_USERS", "MATCH_WILT_DAYS", "MATCH_NUDGE_DAYS",
	} {
		t.Setenv(key, "")
	}
	for k, v := range env {
		t.Setenv(k, v)
	}
}

func TestLoad_DefaultsAreTheProductRulesFromThePRD(t *testing.T) {
	setEnv(t, validEnv())

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, 8080, cfg.Port)
	assert.Equal(t, "development", cfg.Env)
	assert.Equal(t, 15*time.Minute, cfg.AccessTTL)
	assert.Equal(t, 720*time.Hour, cfg.RefreshTTL)

	assert.Equal(t, 8, cfg.OnboardingMinFollows, "the follow-8 gate")
	assert.Equal(t, TimeOfDay{Hour: 22}, cfg.NightWindowStart)
	assert.Equal(t, TimeOfDay{Hour: 3}, cfg.NightCurfew, "the hard curfew")
	assert.Equal(t, 3, cfg.OwlMinActions)
	assert.Equal(t, 120, cfg.OwlMaxPointsPerHour)
	assert.Equal(t, 7*time.Hour, cfg.CocoonMinSleep)
	assert.Equal(t, 250, cfg.CocoonStardust)
	assert.Equal(t, 400, cfg.DatingUnlockMinUsers, "dating stays locked below 400 verified users")
	assert.Equal(t, 7*24*time.Hour, cfg.MatchWilt)
	assert.Equal(t, 5*24*time.Hour, cfg.MatchNudge)
}

func TestLoad_RefusesToBootHalfConfigured(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(map[string]string)
		wantMsg string
	}{
		{
			name:    "no database",
			mutate:  func(e map[string]string) { delete(e, "DATABASE_URL") },
			wantMsg: "DATABASE_URL is required",
		},
		{
			name:    "short secret",
			mutate:  func(e map[string]string) { e["JWT_SECRET"] = "too-short" },
			wantMsg: "JWT_SECRET must be at least 32 bytes",
		},
		{
			name:    "no campus domains — an unverified campus is not a campus",
			mutate:  func(e map[string]string) { delete(e, "CAMPUS_EMAIL_DOMAINS") },
			wantMsg: "CAMPUS_EMAIL_DOMAINS is required",
		},
		{
			name: "the dev placeholder secret in production",
			mutate: func(e map[string]string) {
				e["API_ENV"] = "production"
				e["JWT_SECRET"] = "dev-only-change-me-2f8a1c6b9e4d7a3f5c8b1e6d9a4f7c2b5e8d1a6f"
			},
			wantMsg: "still the development placeholder",
		},
		{
			name:    "night window equal to the curfew",
			mutate:  func(e map[string]string) { e["NIGHT_WINDOW_START"] = "03:00" },
			wantMsg: "must differ",
		},
		{
			name:    "an OTP too short to be secure",
			mutate:  func(e map[string]string) { e["OTP_LENGTH"] = "2" },
			wantMsg: "OTP_LENGTH must be 4..10",
		},
		{
			name:    "a nonsense duration",
			mutate:  func(e map[string]string) { e["JWT_ACCESS_TTL"] = "fifteen minutes" },
			wantMsg: "is not a duration",
		},
		{
			name:    "a nonsense port",
			mutate:  func(e map[string]string) { e["API_PORT"] = "http" },
			wantMsg: "is not an integer",
		},
		{
			name:    "a malformed night window",
			mutate:  func(e map[string]string) { e["NIGHT_CURFEW"] = "3am" },
			wantMsg: "want HH:MM",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			env := validEnv()
			tc.mutate(env)
			setEnv(t, env)

			_, err := Load()
			require.Error(t, err, "this configuration should not boot")
			assert.Contains(t, err.Error(), tc.wantMsg)
		})
	}
}

func TestLoad_ReportsEveryProblemAtOnce(t *testing.T) {
	// A developer fixing one variable at a time, one restart at a time, is a
	// bad afternoon. Collect the errors.
	env := validEnv()
	delete(env, "DATABASE_URL")
	env["JWT_SECRET"] = "nope"
	env["OTP_LENGTH"] = "99"
	setEnv(t, env)

	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "DATABASE_URL")
	assert.Contains(t, err.Error(), "JWT_SECRET")
	assert.Contains(t, err.Error(), "OTP_LENGTH")
}

func TestIsCampusEmail(t *testing.T) {
	setEnv(t, validEnv())
	cfg, err := Load()
	require.NoError(t, err)

	tests := []struct {
		email string
		want  bool
	}{
		{"meher@dronacharya.info", true},
		{"MEHER@DRONACHARYA.INFO", true},
		{"someone@gcet.ac.in", true},
		{"student@Gcet.Ac.In", true},
		{"meher@gmail.com", false},
		{"meher@notdronacharya.info", false},
		{"meher@dronacharya.info.evil.com", false},
		{"dronacharya.info", false},
		{"", false},
		{"no-at-sign", false},
		// A subdomain is a different institution as far as we are concerned.
		{"meher@cse.dronacharya.info", false},
	}

	for _, tc := range tests {
		t.Run(tc.email, func(t *testing.T) {
			assert.Equal(t, tc.want, cfg.IsCampusEmail(tc.email))
		})
	}
}

func TestParseTimeOfDay(t *testing.T) {
	tests := []struct {
		in      string
		want    TimeOfDay
		wantErr bool
	}{
		{in: "22:00", want: TimeOfDay{Hour: 22}},
		{in: "03:00", want: TimeOfDay{Hour: 3}},
		{in: "00:00", want: TimeOfDay{}},
		{in: "23:59", want: TimeOfDay{Hour: 23, Minute: 59}},
		{in: " 22:30 ", want: TimeOfDay{Hour: 22, Minute: 30}},
		{in: "24:00", wantErr: true},
		{in: "22:60", wantErr: true},
		{in: "-1:00", wantErr: true},
		{in: "22", wantErr: true},
		{in: "22:00:00", wantErr: true},
		{in: "", wantErr: true},
		{in: "ten:pm", wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			got, err := ParseTimeOfDay(tc.in)
			if tc.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestTimeOfDay_Minutes(t *testing.T) {
	assert.Equal(t, 1320, TimeOfDay{Hour: 22}.Minutes())
	assert.Equal(t, 180, TimeOfDay{Hour: 3}.Minutes())
	assert.Equal(t, 0, TimeOfDay{}.Minutes())
	assert.Equal(t, "22:00", TimeOfDay{Hour: 22}.String())
	assert.Equal(t, "03:05", TimeOfDay{Hour: 3, Minute: 5}.String())
}

func TestIsProduction(t *testing.T) {
	setEnv(t, validEnv())
	cfg, err := Load()
	require.NoError(t, err)
	assert.False(t, cfg.IsProduction())

	env := validEnv()
	env["API_ENV"] = "production"
	env["JWT_SECRET"] = "a-real-production-secret-of-sufficient-length"
	setEnv(t, env)
	cfg, err = Load()
	require.NoError(t, err)
	assert.True(t, cfg.IsProduction())
}
