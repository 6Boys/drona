package media

import (
	"bytes"
	"encoding/hex"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func onePixelPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}

func onePixelJPEG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	var buf bytes.Buffer
	require.NoError(t, jpeg.Encode(&buf, img, nil))
	return buf.Bytes()
}

func onePixelGIF(t *testing.T) []byte {
	t.Helper()
	img := image.NewPaletted(image.Rect(0, 0, 1, 1), []color.Color{color.White, color.Black})
	var buf bytes.Buffer
	require.NoError(t, gif.Encode(&buf, img, nil))
	return buf.Bytes()
}

func TestSave_AcceptsEachAllowedImageType(t *testing.T) {
	store, err := New(t.TempDir())
	require.NoError(t, err)

	cases := map[string][]byte{
		"png":  onePixelPNG(t),
		"jpeg": onePixelJPEG(t),
		"gif":  onePixelGIF(t),
	}

	for name, data := range cases {
		t.Run(name, func(t *testing.T) {
			result, err := store.Save(bytes.NewReader(data))
			require.NoError(t, err)
			assert.True(t, strings.HasPrefix(result.URL, "/media/"), "url is rooted at /media/: %s", result.URL)
			assert.Equal(t, int64(len(data)), result.Size)

			// It actually landed on disk under the name the URL points at.
			saved := filepath.Join(store.Dir(), strings.TrimPrefix(result.URL, "/media/"))
			onDisk, err := os.ReadFile(saved)
			require.NoError(t, err)
			assert.Equal(t, data, onDisk)
		})
	}
}

func TestSave_RejectsAnythingThatIsNotAnImageOrGIF(t *testing.T) {
	store, err := New(t.TempDir())
	require.NoError(t, err)

	notImages := map[string][]byte{
		"plain text":               []byte("just some text, not a picture"),
		"mp4 signature":            {0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32},
		"webm signature":           {0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x02, 0x03},
		"pdf pretending to be jpg": []byte("%PDF-1.4\n%fake pdf content pretending to be an image\n"),
	}

	for name, data := range notImages {
		t.Run(name, func(t *testing.T) {
			_, err := store.Save(bytes.NewReader(data))
			require.ErrorIs(t, err, ErrUnsupportedType)
		})
	}
}

func TestSave_RejectsOversizeUploads(t *testing.T) {
	store, err := New(t.TempDir())
	require.NoError(t, err)

	// One real byte over the cap — big enough to prove the boundary is
	// "greater than", not "greater than or equal to".
	oversized := make([]byte, MaxBytes+1)
	_, err = store.Save(bytes.NewReader(oversized))
	require.ErrorIs(t, err, ErrTooLarge)
}

func TestSave_AcceptsExactlyMaxBytes(t *testing.T) {
	store, err := New(t.TempDir())
	require.NoError(t, err)

	// http.DetectContentType only inspects the leading signature bytes, so
	// padding a real GIF out to exactly the limit with trailing filler is
	// enough to exercise the boundary — no need for a structurally valid GIF
	// of that exact size.
	base := onePixelGIF(t)
	padding := MaxBytes - len(base)
	require.Positive(t, padding, "test fixture assumption: a 1px GIF is well under MaxBytes")

	padded := append(append([]byte{}, base...), bytes.Repeat([]byte{0}, padding)...)
	require.Len(t, padded, MaxBytes)

	result, err := store.Save(bytes.NewReader(padded))
	require.NoError(t, err)
	assert.Equal(t, int64(MaxBytes), result.Size)
}

func TestSave_RejectsEmptyUpload(t *testing.T) {
	store, err := New(t.TempDir())
	require.NoError(t, err)

	_, err = store.Save(bytes.NewReader(nil))
	require.Error(t, err)
}

func TestSave_NamesAreRandomAndNonPredictable(t *testing.T) {
	store, err := New(t.TempDir())
	require.NoError(t, err)
	data := onePixelPNG(t)

	first, err := store.Save(bytes.NewReader(data))
	require.NoError(t, err)
	second, err := store.Save(bytes.NewReader(data))
	require.NoError(t, err)

	assert.NotEqual(t, first.URL, second.URL, "two uploads of identical bytes still get distinct names")

	name := strings.TrimSuffix(strings.TrimPrefix(first.URL, "/media/"), ".png")
	raw, err := hex.DecodeString(name)
	require.NoError(t, err, "the name is hex, not a guessable counter or the original filename")
	assert.Len(t, raw, 16)
}

func TestBaseURLFromRequest(t *testing.T) {
	t.Run("plain request", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "http://example.test/whatever", nil)
		assert.Equal(t, "http://example.test", BaseURLFromRequest(r))
	})

	t.Run("behind a TLS-terminating reverse proxy", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "http://internal:8080/whatever", nil)
		r.Header.Set("X-Forwarded-Proto", "https")
		r.Header.Set("X-Forwarded-Host", "dronasphere.example")
		assert.Equal(t, "https://dronasphere.example", BaseURLFromRequest(r))
	})

	t.Run("multiple hops keeps only the first, client-facing value", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "http://internal:8080/whatever", nil)
		r.Header.Set("X-Forwarded-Proto", "https, http")
		assert.Equal(t, "https://internal:8080", BaseURLFromRequest(r))
	})
}
