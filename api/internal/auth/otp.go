package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"math/big"
	"strings"
)

// Errors from the OTP flow.
var (
	ErrOTPMismatch = errors.New("that code is not right")
	ErrOTPExpired  = errors.New("that code has expired")
	ErrOTPAttempts = errors.New("too many attempts on this code")
	ErrOTPConsumed = errors.New("that code has already been used")
)

// GenerateOTP returns a numeric code of the requested length, drawn from a
// cryptographic source. Numeric because it has to be typed on a phone.
func GenerateOTP(length int) (string, error) {
	if length < 4 || length > 10 {
		return "", fmt.Errorf("otp length must be 4..10, got %d", length)
	}
	var sb strings.Builder
	for range length {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", fmt.Errorf("read random digit: %w", err)
		}
		sb.WriteString(n.String())
	}
	return sb.String(), nil
}

// HashOTP hashes a code for storage. Codes are short-lived and attempt-capped,
// so a fast hash is the right trade — see ErrOTPAttempts.
func HashOTP(code string) string { return HashToken(normaliseOTP(code)) }

// CompareOTP checks a submitted code against a stored hash in constant time.
func CompareOTP(storedHash, submitted string) bool {
	got := HashOTP(submitted)
	return subtle.ConstantTimeCompare([]byte(storedHash), []byte(got)) == 1
}

// NormaliseEmail lowercases and trims an address so "A@x.com " and "a@x.com"
// cannot become two accounts (PRD 6.1: duplicate email is a hard block).
func NormaliseEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func normaliseOTP(code string) string {
	return strings.TrimSpace(strings.ReplaceAll(code, " ", ""))
}
