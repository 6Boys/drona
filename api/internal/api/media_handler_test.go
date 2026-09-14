package api

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/aniketrathour/dronasphere/api/internal/auth"
	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/media"
)

// handleUploadMedia touches only the media store and the config, never the
// database — so the real handler can be exercised end to end here, multipart
// parsing and all, without Postgres anywhere in sight.
func uploadServer(t *testing.T, publicBaseURL string) *Server {
	t.Helper()
	store, err := media.New(t.TempDir())
	require.NoError(t, err)
	return &Server{deps: Deps{
		Config: &config.Config{MediaPublicBaseURL: publicBaseURL},
		Media:  store,
	}}
}

func pngBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{B: 255, A: 255})
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return buf.Bytes()
}

// multipartBody builds a request body with one file field, named as given so
// tests can prove the handler insists on "file".
func multipartBody(t *testing.T, field, filename string, data []byte) (*bytes.Buffer, string) {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, err := w.CreateFormFile(field, filename)
	require.NoError(t, err)
	_, err = part.Write(data)
	require.NoError(t, err)
	require.NoError(t, w.Close())
	return &body, w.FormDataContentType()
}

func uploadRequest(t *testing.T, body *bytes.Buffer, contentType string, signedIn bool) *http.Request {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "http://drona.test/v1/media/upload", body)
	r.Header.Set("Content-Type", contentType)
	if signedIn {
		r = r.WithContext(auth.WithActor(r.Context(), auth.Actor{UserID: "usr-1", Handle: "meher"}))
	}
	return r
}

func TestHandleUploadMedia_SavesAPictureAndReturnsAnAbsoluteURL(t *testing.T) {
	s := uploadServer(t, "")
	body, contentType := multipartBody(t, "file", "selfie.png", pngBytes(t))

	w := httptest.NewRecorder()
	require.NoError(t, s.handleUploadMedia(w, uploadRequest(t, body, contentType, true)))

	require.Equal(t, http.StatusCreated, w.Code)

	var result media.Result
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Equal(t, "image/png", result.ContentType)
	assert.Positive(t, result.Size)
	// With no MEDIA_PUBLIC_BASE_URL set, the URL is rooted at the origin the
	// request arrived on, so it resolves from a browser as-is.
	assert.True(t, strings.HasPrefix(result.URL, "http://drona.test/media/"),
		"want an absolute URL on the request's own origin, got %q", result.URL)
}

func TestHandleUploadMedia_HonoursAConfiguredPublicBaseURL(t *testing.T) {
	s := uploadServer(t, "https://cdn.example")
	body, contentType := multipartBody(t, "file", "selfie.png", pngBytes(t))

	w := httptest.NewRecorder()
	require.NoError(t, s.handleUploadMedia(w, uploadRequest(t, body, contentType, true)))

	var result media.Result
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.True(t, strings.HasPrefix(result.URL, "https://cdn.example/media/"), "got %q", result.URL)
}

func TestHandleUploadMedia_RejectsVideoBytesWhateverTheFileIsCalled(t *testing.T) {
	s := uploadServer(t, "")
	// An MP4 container, named and declared as a PNG. The only thing that
	// decides here is the content.
	mp4 := []byte{0x00, 0x00, 0x00, 0x18, 'f', 't', 'y', 'p', 'm', 'p', '4', '2'}
	body, contentType := multipartBody(t, "file", "totally-a-picture.png", mp4)

	w := httptest.NewRecorder()
	err := s.handleUploadMedia(w, uploadRequest(t, body, contentType, true))

	var apiErr *httpx.APIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, httpx.CodeValidation, apiErr.Code)
	// The per-field message is where the specific reason lives; the top-level
	// message on a 422 is always the generic one.
	assert.Contains(t, apiErr.Fields["file"], "no video")
	assert.Contains(t, apiErr.Friendly, "no video files")
}

func TestHandleUploadMedia_RejectsOversizeBeforeItIsEverSaved(t *testing.T) {
	s := uploadServer(t, "")
	oversized := append(pngBytes(t), bytes.Repeat([]byte{0}, media.MaxBytes+1)...)
	body, contentType := multipartBody(t, "file", "huge.png", oversized)

	w := httptest.NewRecorder()
	err := s.handleUploadMedia(w, uploadRequest(t, body, contentType, true))

	var apiErr *httpx.APIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.Status)
	assert.Contains(t, apiErr.Friendly, "5 MB")
}

func TestHandleUploadMedia_RequiresTheFieldToBeCalledFile(t *testing.T) {
	s := uploadServer(t, "")
	body, contentType := multipartBody(t, "picture", "selfie.png", pngBytes(t))

	w := httptest.NewRecorder()
	err := s.handleUploadMedia(w, uploadRequest(t, body, contentType, true))

	var apiErr *httpx.APIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.Status)
}

func TestHandleUploadMedia_RefusesAnonymousUploads(t *testing.T) {
	s := uploadServer(t, "")
	body, contentType := multipartBody(t, "file", "selfie.png", pngBytes(t))

	w := httptest.NewRecorder()
	err := s.handleUploadMedia(w, uploadRequest(t, body, contentType, false))

	var apiErr *httpx.APIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, http.StatusUnauthorized, apiErr.Status,
		"disk is a finite resource on a self-hosted box — this is never anonymous")
}
