// Package media is DronaSphere's own object storage: a disk-backed store for
// post pictures and verification photos, built for a self-hosted deployment
// with no S3-compatible bucket sitting behind it.
//
// The policy is deliberately narrow and is not configurable via the
// environment: images and GIFs only, capped by MaxBytes (5 MiB by default),
// nothing else — no video, no arbitrary documents. That is a homelab-capacity
// decision (PRD-adjacent, set by whoever runs this instance), not a per-client
// preference, so it is a Go constant a deployer edits and rebuilds, not a knob
// a misconfigured environment variable could loosen by accident.
package media

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// MaxBytes is the hard ceiling on any single upload. Kept well under what a
// small homelab box can absorb without the disk or the request pipeline
// noticing: a feed with dozens of these in flight should not be able to stall
// a machine that is also running Postgres and Redis.
const MaxBytes = 5 * 1024 * 1024 // 5 MiB

// allowed maps a sniffed MIME type to the file extension it is written with.
// http.DetectContentType (net/http, backed by net/http/internal/ascii + the
// same table as net/http.sniff) is what decides the type here — never the
// client's declared Content-Type and never the filename extension, both of
// which are just labels a request is free to lie about.
var allowed = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif", // includes animated GIF — there is no separate signature for it
}

// ErrTooLarge is returned when the upload exceeds MaxBytes.
var ErrTooLarge = fmt.Errorf("file is larger than %d bytes", MaxBytes)

// ErrUnsupportedType is returned for anything that isn't a plain image or a
// GIF — explicitly including every video format, no matter how small.
var ErrUnsupportedType = errors.New("only JPEG, PNG, WEBP or GIF images are accepted — no video")

// Result describes a saved file.
type Result struct {
	URL         string `json:"url"`
	Size        int64  `json:"size"`
	ContentType string `json:"contentType"`
}

// Store saves uploads under Dir and hands back a URL rooted at PublicBaseURL
// (or, if that's empty, one the caller resolves against the request that
// served it — see BaseURLFromRequest).
type Store struct {
	dir string
}

// New prepares the upload directory, creating it if this is a first boot.
func New(dir string) (*Store, error) {
	if dir == "" {
		return nil, errors.New("media: directory is required")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("media: create directory: %w", err)
	}
	return &Store{dir: dir}, nil
}

// Dir exposes the storage root, e.g. for the static file server in router.go.
func (s *Store) Dir() string { return s.dir }

// Save validates and writes one file, returning the URL path it will be
// served at (rooted at "/media/", joined onto a base URL by the caller).
//
// It reads at most MaxBytes+1 from r — the "+1" is what lets a body that is
// exactly one byte too large be told so, rather than silently truncated —
// so callers do not need to pre-limit the reader themselves, though the HTTP
// layer still should (defence in depth against a client that lies about
// Content-Length).
func (s *Store) Save(r io.Reader) (Result, error) {
	limited := io.LimitReader(r, MaxBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return Result{}, fmt.Errorf("media: read upload: %w", err)
	}
	if int64(len(data)) > MaxBytes {
		return Result{}, ErrTooLarge
	}
	if len(data) == 0 {
		return Result{}, errors.New("media: empty file")
	}

	// Sniff on the real bytes. A .png that is actually an mp4 with a renamed
	// extension is caught here, not trusted because the client said "image/png".
	sniffed := http.DetectContentType(data)
	ext, ok := allowed[sniffed]
	if !ok {
		return Result{}, ErrUnsupportedType
	}

	name, err := randomName(ext)
	if err != nil {
		return Result{}, err
	}

	path := filepath.Join(s.dir, name)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return Result{}, fmt.Errorf("media: write file: %w", err)
	}

	return Result{
		URL:         "/media/" + name,
		Size:        int64(len(data)),
		ContentType: sniffed,
	}, nil
}

// randomName is a content-addressed-looking but simply random filename: 16
// bytes of entropy, hex-encoded, so two uploads can never collide and nothing
// about the name leaks who uploaded it or when.
func randomName(ext string) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("media: generate name: %w", err)
	}
	return hex.EncodeToString(buf) + ext, nil
}

// BaseURLFromRequest resolves the origin uploaded files should be linked with
// when no MEDIA_PUBLIC_BASE_URL is configured: the scheme and host the
// request actually arrived on, honouring one reverse-proxy hop the same way
// httpx.ClientIP does for the caller's address.
func BaseURLFromRequest(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = strings.ToLower(strings.TrimSpace(strings.SplitN(proto, ",", 2)[0]))
	}

	host := r.Host
	if fwd := r.Header.Get("X-Forwarded-Host"); fwd != "" {
		host = strings.TrimSpace(strings.SplitN(fwd, ",", 2)[0])
	}

	return scheme + "://" + host
}
