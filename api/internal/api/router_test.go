package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMediaFileServer(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "abc123.png"), []byte("pretend-png"), 0o644))

	// A file the server must never hand out: one directory up from the media
	// root, which is what a traversal attempt would be reaching for.
	secret := filepath.Join(filepath.Dir(dir), "secret.txt")
	require.NoError(t, os.WriteFile(secret, []byte("not for the web"), 0o644))
	t.Cleanup(func() { _ = os.Remove(secret) })

	handler := mediaFileServer(dir)

	serve := func(target string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodGet, target, nil)
		w := httptest.NewRecorder()
		handler(w, r)
		return w
	}

	t.Run("serves an uploaded file", func(t *testing.T) {
		res := serve("/media/abc123.png")
		assert.Equal(t, http.StatusOK, res.Code)
		assert.Equal(t, "pretend-png", res.Body.String())
		assert.Equal(t, "public, max-age=31536000, immutable", res.Header().Get("Cache-Control"),
			"names are random and permanent, so the bytes behind one never change")
	})

	t.Run("404s a file that does not exist", func(t *testing.T) {
		assert.Equal(t, http.StatusNotFound, serve("/media/nope.png").Code)
	})

	t.Run("refuses the directory itself rather than listing it", func(t *testing.T) {
		assert.Equal(t, http.StatusNotFound, serve("/media/").Code)
	})

	t.Run("refuses anything with a path separator", func(t *testing.T) {
		// Both an escape attempt and a plain subdirectory read: the media root
		// is flat, so neither is ever a legitimate request.
		for _, target := range []string{
			"/media/../secret.txt",
			"/media/sub/file.png",
			"/media/..%2fsecret.txt",
		} {
			res := serve(target)
			assert.Equal(t, http.StatusNotFound, res.Code, "must not serve %q", target)
			assert.NotContains(t, res.Body.String(), "not for the web")
		}
	})
}
