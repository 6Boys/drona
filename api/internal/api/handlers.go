package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/aniketrathour/dronasphere/api/internal/auth"
	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/media"
	"github.com/aniketrathour/dronasphere/api/internal/service"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

// deviceHeader carries a client-generated device fingerprint. It backs the Owl
// Board's one-account-per-device-per-night rule and ban-evasion detection
// (PRD 6.2, 10). It is not a secret and is never trusted for authentication.
const deviceHeader = "X-Device-Fingerprint"

func device(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get(deviceHeader))
}

// ------------------------------------------------------------------- auth ------

type otpRequestBody struct {
	Email string `json:"email"`
}

func (s *Server) handleRequestOTP(w http.ResponseWriter, r *http.Request) error {
	var body otpRequestBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Auth.RequestOTP(r.Context(), body.Email)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

type otpVerifyBody struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

// sessionResponse is what the client stores after a successful sign-in.
type sessionResponse struct {
	AccessToken  string      `json:"accessToken"`
	RefreshToken string      `json:"refreshToken"`
	ExpiresIn    int         `json:"expiresIn"`
	User         domain.User `json:"user"`
	// Where to send the user next. The client never has to work this out.
	OnboardingStep domain.OnboardingStep `json:"onboardingStep"`
}

func (s *Server) handleVerifyOTP(w http.ResponseWriter, r *http.Request) error {
	var body otpVerifyBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}

	session, err := s.deps.Auth.VerifyOTP(r.Context(), service.VerifyParams{
		Email:             body.Email,
		Code:              body.Code,
		UserAgent:         r.UserAgent(),
		IP:                httpx.ClientIP(r),
		DeviceFingerprint: device(r),
		Platform:          "web",
	})
	if err != nil {
		return err
	}

	httpx.JSON(w, http.StatusOK, sessionResponse{
		AccessToken:    session.AccessToken,
		RefreshToken:   session.RefreshToken,
		ExpiresIn:      session.ExpiresIn,
		User:           service.Public(session.User, true, selfRelationship(), time.Now()),
		OnboardingStep: session.User.OnboardingStep,
	})
	return nil
}

type refreshBody struct {
	RefreshToken string `json:"refreshToken"`
}

func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) error {
	var body refreshBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	session, err := s.deps.Auth.Refresh(r.Context(), body.RefreshToken, r.UserAgent(), httpx.ClientIP(r))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, sessionResponse{
		AccessToken:    session.AccessToken,
		RefreshToken:   session.RefreshToken,
		ExpiresIn:      session.ExpiresIn,
		User:           service.Public(session.User, true, selfRelationship(), time.Now()),
		OnboardingStep: session.User.OnboardingStep,
	})
	return nil
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) error {
	var body refreshBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	if err := s.deps.Auth.Logout(r.Context(), body.RefreshToken); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (s *Server) handleLogoutAll(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	if err := s.deps.Auth.LogoutEverywhere(r.Context(), actor.UserID); err != nil {
		return err
	}
	if gw := s.deps.Gateway; gw != nil {
		gw.Hub().CloseUser(actor.UserID)
	}
	httpx.NoContent(w)
	return nil
}

// ------------------------------------------------------------------ media -----

// mediaUploadMaxRequestBytes bounds the whole multipart request, not just the
// file field inside it: headroom over media.MaxBytes for the multipart
// boundary/part headers, generous enough that it never rejects a real upload
// but tight enough that a client can't use this endpoint to stream an
// unbounded body at the server before media.Store ever gets to sniff it.
const mediaUploadMaxRequestBytes = media.MaxBytes + 64<<10

// handleUploadMedia is this instance's own object storage: a picture in, a URL
// out. It is deliberately the only way anything in the product acquires an
// imageUrl/photoUrl — see internal/media for the size and type policy, which
// this handler enforces at the transport level (body size) before internal/
// media.Store enforces it again on the decoded bytes.
func (s *Server) handleUploadMedia(w http.ResponseWriter, r *http.Request) error {
	if _, err := auth.MustActor(r.Context()); err != nil {
		return err
	}

	r.Body = http.MaxBytesReader(w, r.Body, mediaUploadMaxRequestBytes)
	if err := r.ParseMultipartForm(mediaUploadMaxRequestBytes); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return httpx.BadRequest("that file is larger than 5 MB").
				WithFriendly("that's a bit big — 5 MB max, and no video, just images or a GIF")
		}
		return httpx.BadRequest("could not read that upload: " + err.Error())
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	file, _, err := r.FormFile("file")
	if err != nil {
		return httpx.BadRequest(`send the file as multipart/form-data under the field name "file"`)
	}
	defer file.Close()

	result, err := s.deps.Media.Save(file)
	if err != nil {
		switch {
		case errors.Is(err, media.ErrTooLarge):
			return httpx.BadRequest(err.Error()).
				WithFriendly("that's a bit big — 5 MB max, and no video, just images or a GIF")
		case errors.Is(err, media.ErrUnsupportedType):
			return httpx.Validation(map[string]string{"file": err.Error()}).
				WithFriendly("only pictures and GIFs — no video files")
		default:
			return httpx.Internal("could not save that file").WithCause(err)
		}
	}

	base := s.deps.Config.MediaPublicBaseURL
	if base == "" {
		base = media.BaseURLFromRequest(r)
	}
	result.URL = base + result.URL

	httpx.JSON(w, http.StatusCreated, result)
	return nil
}

// ------------------------------------------------------------------- me --------

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	me, err := s.deps.Users.Me(r.Context(), actor.UserID)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, me)
	return nil
}

func (s *Server) handleUpdateProfile(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body service.UpdateProfileRequest
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	me, err := s.deps.Users.UpdateProfile(r.Context(), actor.UserID, body)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, me)
	return nil
}

func (s *Server) handleUpdateAvatar(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var avatar domain.Avatar
	if err := httpx.Decode(r, &avatar); err != nil {
		return err
	}
	me, err := s.deps.Users.UpdateAvatar(r.Context(), actor.UserID, avatar)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, me)
	return nil
}

type loveFinderBody struct {
	Enabled bool `json:"enabled"`
}

func (s *Server) handleSetLoveFinder(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body loveFinderBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	if err := s.deps.Users.SetLoveFinderEnabled(r.Context(), actor.UserID, body.Enabled); err != nil {
		return err
	}
	me, err := s.deps.Users.Me(r.Context(), actor.UserID)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, me)
	return nil
}

type verifyPhotoBody struct {
	PhotoURL string `json:"photoUrl"`
}

func (s *Server) handleVerifyPhoto(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body verifyPhotoBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	me, err := s.deps.Users.VerifyPhoto(r.Context(), actor.UserID, body.PhotoURL)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, me)
	return nil
}

// --------------------------------------------------------------- onboarding ----

func (s *Server) handleSuggestions(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	users, err := s.deps.Users.Suggestions(r.Context(), actor.UserID, actor.CampusID, intQuery(r, "limit", 12))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"items":      users,
		"minFollows": s.deps.Config.OnboardingMinFollows,
	})
	return nil
}

type followManyBody struct {
	Handles []string `json:"handles"`
}

func (s *Server) handleFollowMany(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body followManyBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Users.FollowMany(r.Context(), actor.UserID, body.Handles)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

// ------------------------------------------------------------------ people -----

func (s *Server) handleProfile(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	user, err := s.deps.Users.Profile(r.Context(), actor.UserID, chi.URLParam(r, "handle"))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, user)
	return nil
}

func (s *Server) handleFollow(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	out, err := s.deps.Users.Follow(r.Context(), actor.UserID, chi.URLParam(r, "handle"))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

func (s *Server) handleUnfollow(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	out, err := s.deps.Users.Unfollow(r.Context(), actor.UserID, chi.URLParam(r, "handle"))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

func (s *Server) handleFollowers(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	users, err := s.deps.Users.Followers(r.Context(), actor.UserID, chi.URLParam(r, "handle"), intQuery(r, "limit", 30))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": users})
	return nil
}

func (s *Server) handleFollowing(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	users, err := s.deps.Users.Following(r.Context(), actor.UserID, chi.URLParam(r, "handle"), intQuery(r, "limit", 30))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": users})
	return nil
}

func (s *Server) handleBlock(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	if err := s.deps.Users.Block(r.Context(), actor.UserID, chi.URLParam(r, "handle")); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (s *Server) handleUnblock(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	if err := s.deps.Users.Unblock(r.Context(), actor.UserID, chi.URLParam(r, "handle")); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (s *Server) handleSearchUsers(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	users, err := s.deps.Users.Search(r.Context(), actor.UserID, actor.CampusID,
		r.URL.Query().Get("q"), intQuery(r, "limit", 20))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": users})
	return nil
}

// -------------------------------------------------------------------- nest -----

func (s *Server) handleSpaces(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	spaces, err := s.deps.Feed.Spaces(r.Context(), actor.CampusID)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": spaces})
	return nil
}

func (s *Server) handleFeed(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	q := r.URL.Query()
	page, err := s.deps.Feed.Feed(r.Context(), actor.UserID, actor.CampusID, service.FeedQuery{
		Scope:     q.Get("scope"),
		Sort:      q.Get("sort"),
		Source:    q.Get("source"),
		SpaceSlug: q.Get("space"),
		Cursor:    q.Get("cursor"),
		Limit:     intQuery(r, "limit", 20),
	})
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, page)
	return nil
}

func (s *Server) handleCreatePost(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body service.CreatePostRequest
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Feed.CreatePost(r.Context(), actor.UserID, actor.CampusID, device(r), body)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusCreated, out)
	return nil
}

func (s *Server) handlePost(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	post, err := s.deps.Feed.Post(r.Context(), actor.UserID, chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, post)
	return nil
}

type voteBody struct {
	Value int `json:"value"`
}

func (s *Server) handleVote(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body voteBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Feed.Vote(r.Context(), actor.UserID, chi.URLParam(r, "id"), body.Value)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

type reactBody struct {
	Sticker domain.Sticker `json:"sticker"`
}

func (s *Server) handleReact(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body reactBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Feed.React(r.Context(), actor.UserID, chi.URLParam(r, "id"), body.Sticker)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

func (s *Server) handleComments(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	comments, err := s.deps.Feed.Comments(r.Context(), actor.UserID, chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": comments})
	return nil
}

func (s *Server) handleCreateComment(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body service.CommentRequest
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Feed.Comment(r.Context(), actor.UserID, device(r), chi.URLParam(r, "id"), body)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusCreated, out)
	return nil
}

func (s *Server) handleVoteComment(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body voteBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Feed.VoteComment(r.Context(), actor.UserID, chi.URLParam(r, "id"), body.Value)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

// ------------------------------------------------------------------- chats -----

func (s *Server) handleThreads(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	threads, err := s.deps.Chat.Threads(r.Context(), actor.UserID, intQuery(r, "limit", 30))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": threads})
	return nil
}

func (s *Server) handleThreadRequests(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	threads, err := s.deps.Chat.Requests(r.Context(), actor.UserID, intQuery(r, "limit", 30))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": threads})
	return nil
}

type startDMBody struct {
	Handle string `json:"handle"`
}

func (s *Server) handleStartDM(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body startDMBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	thread, err := s.deps.Chat.StartDM(r.Context(), actor.UserID, body.Handle)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, thread)
	return nil
}

func (s *Server) handleCreateDen(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body service.CreateDenRequest
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	thread, err := s.deps.Chat.CreateDen(r.Context(), actor.UserID, body)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusCreated, thread)
	return nil
}

func (s *Server) handleThread(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	thread, err := s.deps.Chat.Thread(r.Context(), actor.UserID, chi.URLParam(r, "id"))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, thread)
	return nil
}

func (s *Server) handleMessages(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	page, err := s.deps.Chat.Messages(r.Context(), actor.UserID, chi.URLParam(r, "id"),
		r.URL.Query().Get("cursor"), intQuery(r, "limit", 40))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, page)
	return nil
}

func (s *Server) handleSendMessage(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body service.SendMessageRequest
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Chat.Send(r.Context(), actor.UserID, device(r), chi.URLParam(r, "id"), body)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusCreated, out)
	return nil
}

type markReadBody struct {
	MessageID string `json:"messageId"`
}

func (s *Server) handleMarkRead(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body markReadBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	if err := s.deps.Chat.MarkRead(r.Context(), actor.UserID, chi.URLParam(r, "id"), body.MessageID); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (s *Server) handleAcceptRequest(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	if err := s.deps.Chat.AcceptRequest(r.Context(), actor.UserID, chi.URLParam(r, "id")); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (s *Server) handleDeleteMessage(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	if err := s.deps.Chat.DeleteMessage(r.Context(), actor.UserID,
		chi.URLParam(r, "id"), chi.URLParam(r, "messageId")); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

// --------------------------------------------------------------- owl board -----

func (s *Server) handleHeartbeat(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	status, err := s.deps.Owl.Heartbeat(r.Context(), actor.UserID, actor.CampusID, device(r))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, status)
	return nil
}

func (s *Server) handleBoard(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "campus"
	}
	board, err := s.deps.Owl.Board(r.Context(), actor.UserID, actor.CampusID, scope, intQuery(r, "limit", 50))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, board)
	return nil
}

func (s *Server) handleCocoon(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	out, err := s.deps.Owl.ClaimCocoon(r.Context(), actor.UserID)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

type burrowBody struct {
	Minutes int `json:"minutes"`
}

func (s *Server) handleBurrow(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body burrowBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Owl.BurrowMinutes(r.Context(), actor.UserID, device(r), body.Minutes)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

// ------------------------------------------------------------- note locker -----

func (s *Server) handleNotes(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	q := r.URL.Query()
	page, err := s.deps.Notes.List(r.Context(), actor.UserID, service.NoteQuery{
		Subject:  q.Get("subject"),
		Semester: intQuery(r, "semester", 0),
		Kind:     q.Get("kind"),
		Sort:     q.Get("sort"),
		Cursor:   q.Get("cursor"),
		Limit:    intQuery(r, "limit", 20),
	})
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, page)
	return nil
}

func (s *Server) handleNoteSubjects(w http.ResponseWriter, r *http.Request) error {
	subjects, err := s.deps.Notes.Subjects(r.Context())
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": subjects})
	return nil
}

func (s *Server) handleUploadNote(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body service.UploadRequest
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Notes.Upload(r.Context(), actor.UserID, body)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusCreated, out)
	return nil
}

func (s *Server) handleVoteNote(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body voteBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	out, err := s.deps.Notes.Vote(r.Context(), actor.UserID, chi.URLParam(r, "id"), body.Value)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

func (s *Server) handleDownloadNote(w http.ResponseWriter, r *http.Request) error {
	if err := s.deps.Notes.RecordDownload(r.Context(), chi.URLParam(r, "id")); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

// ------------------------------------------------------------------- socket ----

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) error {
	if s.deps.Gateway == nil {
		return httpx.Internal("the live gateway is not configured")
	}
	return s.deps.Gateway.Handle(w, r)
}

// --------------------------------------------------------------- moderation ----

type reportBody struct {
	TargetType string `json:"targetType"`
	TargetID   string `json:"targetId"`
	Reason     string `json:"reason"`
	Details    string `json:"details"`
}

func (s *Server) handleReport(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body reportBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	id, err := s.deps.Feed.Report(r.Context(), actor.UserID, body.TargetType, body.TargetID, body.Reason, body.Details)
	if err != nil {
		return err
	}
	// Plain acknowledgement: reporting is a safety flow, not a cute moment.
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"reportId": id,
		"message":  "Thanks. A moderator will review this within 24 hours.",
	})
	return nil
}

func (s *Server) handleListReports(w http.ResponseWriter, r *http.Request) error {
	reports, err := s.deps.Feed.OpenReports(r.Context(), intQuery(r, "limit", 50))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": reports})
	return nil
}

type resolveBody struct {
	Status string `json:"status"`
}

func (s *Server) handleResolveReport(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	var body resolveBody
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	if err := s.deps.Feed.ResolveReport(r.Context(), chi.URLParam(r, "id"), actor.UserID, body.Status); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (s *Server) handleRemovePost(w http.ResponseWriter, r *http.Request) error {
	actor, err := auth.MustActor(r.Context())
	if err != nil {
		return err
	}
	reason := r.URL.Query().Get("reason")
	isAdmin := actor.Role == domain.RoleCampusAdmin || actor.Role == domain.RoleSuperadmin
	if err := s.deps.Feed.RemovePost(r.Context(), actor.UserID, chi.URLParam(r, "id"), reason, isAdmin); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

// ------------------------------------------------------------------ helpers ----

// selfRelationship is the relationship a user has to themselves: none of the
// follow flags apply, and Public() reads `self` from its own argument.
func selfRelationship() store.Relationship { return store.Relationship{} }

func intQuery(r *http.Request, key string, def int) int {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return v
}
