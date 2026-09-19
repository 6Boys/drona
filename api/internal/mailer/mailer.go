// Package mailer sends the one email this product actually needs: the OTP.
//
// MAILER=log prints the code to the server log, which is how you sign in
// locally without wiring up SMTP.
package mailer

import (
	"context"
	"fmt"
	"log/slog"
	"net/smtp"
	"strings"
)

// Mailer sends transactional mail.
type Mailer interface {
	SendOTP(ctx context.Context, to, code string, ttlMinutes int) error
}

// New picks an implementation from the MAILER setting.
func New(kind, host string, port int, user, password, from string, log *slog.Logger) Mailer {
	if strings.EqualFold(kind, "smtp") && host != "" {
		return &SMTPMailer{host: host, port: port, user: user, password: password, from: from, log: log}
	}
	return &LogMailer{log: log}
}

// LogMailer writes the code to the log. Development only — it refuses to hide
// that it is not really sending anything.
type LogMailer struct {
	log *slog.Logger
}

// SendOTP implements Mailer.
func (m *LogMailer) SendOTP(ctx context.Context, to, code string, ttlMinutes int) error {
	m.log.WarnContext(ctx, "MAILER=log — no email was sent, here is the code",
		"to", to, "otp", code, "expires_in_minutes", ttlMinutes)
	return nil
}

// SMTPMailer sends over SMTP with STARTTLS.
type SMTPMailer struct {
	host     string
	port     int
	user     string
	password string
	from     string
	log      *slog.Logger
}

// SendOTP implements Mailer.
func (m *SMTPMailer) SendOTP(ctx context.Context, to, code string, ttlMinutes int) error {
	subject := fmt.Sprintf("%s is your DronaSphere code", code)

	// Warm and second person, but the security line stays literal — PRD 8 says
	// consent and safety copy is never cute.
	body := fmt.Sprintf(`hi!

your DronaSphere code is:

    %s

it works for the next %d minutes.

If you did not request this code, someone entered your email address by
mistake. You can ignore this message; no account was created or changed.

— Dronu 🦉
`, code, ttlMinutes)

	msg := strings.Join([]string{
		"From: " + m.from,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		`Content-Type: text/plain; charset="utf-8"`,
		"",
		body,
	}, "\r\n")

	addr := fmt.Sprintf("%s:%d", m.host, m.port)
	auth := smtp.PlainAuth("", m.user, m.password, m.host)
	if err := smtp.SendMail(addr, auth, m.from, []string{to}, []byte(msg)); err != nil {
		return fmt.Errorf("send otp mail: %w", err)
	}
	m.log.InfoContext(ctx, "otp email sent", "to", to)
	return nil
}
