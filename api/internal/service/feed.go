package service

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/owl"
	"github.com/aniketrathour/dronasphere/api/internal/realtime"
	"github.com/aniketrathour/dronasphere/api/internal/safety"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

// hotEpoch anchors the time term of the ranking. It must match the constant in
// prisma/seed.ts, or seeded posts sort differently from real ones.
var hotEpoch = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

// hotGravity is how many seconds of age are worth one order of magnitude of
// score. 45000 ≈ 12.5 hours, which is the right tempo for a campus: a good
// morning post is still visible that evening and gone by tomorrow.
const hotGravity = 45000.0

// HotRank is the V1 feed ranking: upvotes with time decay (PRD 6.5). No ML,
// deliberately — at campus scale it would be a worse feed and a lot more work.
//
// It is a pure function of score and age so it can be recomputed anywhere and
// tested without a database.
func HotRank(score int, createdAt time.Time) float64 {
	order := math.Log10(math.Max(math.Abs(float64(score)), 1))

	sign := 0.0
	switch {
	case score > 0:
		sign = 1
	case score < 0:
		sign = -1
	}

	seconds := float64(createdAt.UTC().Unix() - hotEpoch.Unix())
	rank := order + sign*seconds/hotGravity

	// Round so Postgres, Go and the seed script all agree on the value.
	return math.Round(rank*1e7) / 1e7
}

// PointsRecorder lets the feed credit Owl Board points without knowing how the
// leaderboard works. OwlService implements it.
type PointsRecorder interface {
	// fingerprint is the raw X-Device-Fingerprint header, which the recorder
	// resolves to a device row itself.
	RecordAction(ctx context.Context, userID, fingerprint string, action owl.Action) (*OwlGrant, error)
}

// FeedService owns the Nest: spaces, posts, votes, stickers and comments.
type FeedService struct {
	cfg    *config.Config
	db     *store.DB
	bus    realtime.Bus
	points PointsRecorder
	log    *slog.Logger
	now    func() time.Time
}

// NewFeedService wires the service.
func NewFeedService(cfg *config.Config, db *store.DB, bus realtime.Bus, points PointsRecorder, log *slog.Logger, now func() time.Time) *FeedService {
	if now == nil {
		now = time.Now
	}
	return &FeedService{cfg: cfg, db: db, bus: bus, points: points, log: log, now: now}
}

// Spaces lists the campus's spaces.
func (s *FeedService) Spaces(ctx context.Context, campusID string) ([]domain.Space, error) {
	spaces, err := s.db.ListSpaces(ctx, campusID)
	if err != nil {
		return nil, httpx.Internal("could not load spaces").WithCause(err)
	}
	if spaces == nil {
		spaces = []domain.Space{}
	}
	return spaces, nil
}

// FeedQuery is a parsed feed request.
type FeedQuery struct {
	Scope     string // "campus" (default) or "global"
	Sort      string // "hot" (default) or "new"
	Source    string // "all" (default) or "following"
	SpaceSlug string
	Cursor    string
	Limit     int
}

// Feed returns a page of posts.
func (s *FeedService) Feed(ctx context.Context, viewerID, campusID string, q FeedQuery) (domain.Page[domain.Post], error) {
	var empty domain.Page[domain.Post]

	cursor, err := domain.DecodeCursor(q.Cursor)
	if err != nil {
		return empty, httpx.BadRequest("that page cursor is not valid")
	}

	params := store.FeedParams{
		ViewerID:      viewerID,
		CampusID:      campusID,
		Global:        q.Scope == "global",
		FollowingOnly: q.Source == "following",
		Sort:          normaliseSort(q.Sort),
		Cursor:        cursor,
		Limit:         q.Limit,
	}

	if q.SpaceSlug != "" {
		space, err := s.db.SpaceBySlug(ctx, campusID, q.SpaceSlug)
		if err != nil {
			return empty, notFoundOr(err, "no space with that name")
		}
		params.SpaceID = space.ID
	}

	posts, err := s.db.ListFeed(ctx, params)
	if err != nil {
		return empty, httpx.Internal("could not load the feed").WithCause(err)
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	items := make([]domain.Post, 0, len(posts))
	for _, p := range posts {
		items = append(items, *p)
	}

	return domain.NewPage(items, limit, func(p domain.Post) domain.Cursor {
		return domain.Cursor{Time: p.CreatedAt, Score: p.HotRank, ID: p.ID}
	}), nil
}

// CreatePostRequest is a new post.
type CreatePostRequest struct {
	SpaceSlug string          `json:"space"`
	Type      domain.PostType `json:"type"`
	Title     string          `json:"title"`
	Body      string          `json:"body"`
	ImageURL  string          `json:"imageUrl"`
	LinkURL   string          `json:"linkUrl"`
}

// PostResult is a created post plus anything the client must show alongside it.
type PostResult struct {
	Post domain.Post `json:"post"`
	// SupportCard is set when the text matched a crisis pattern. The post is
	// published either way (PRD 10) — silencing someone struggling is worse.
	SupportCard *safety.SupportCard `json:"supportCard,omitempty"`
	// OwlPoints reports what this action was worth on the Owl Board, if anything.
	OwlPoints *OwlGrant `json:"owlPoints,omitempty"`
}

// CreatePost validates and publishes a post.
func (s *FeedService) CreatePost(ctx context.Context, authorID, campusID, deviceID string, req CreatePostRequest) (*PostResult, error) {
	if req.Type == "" {
		req.Type = domain.PostText
	}
	if !domain.ValidPostType(req.Type) {
		return nil, httpx.Validation(map[string]string{"type": "must be TEXT, IMAGE, POLL, LINK or ASK"})
	}

	space, err := s.db.SpaceBySlug(ctx, campusID, req.SpaceSlug)
	if err != nil {
		return nil, notFoundOr(err, "no space with that name")
	}

	title := strings.TrimSpace(req.Title)
	body := strings.TrimSpace(req.Body)
	fields := map[string]string{}

	switch req.Type {
	case domain.PostText, domain.PostAsk:
		if title == "" && body == "" {
			fields["body"] = "say something first"
		}
	case domain.PostImage:
		if strings.TrimSpace(req.ImageURL) == "" {
			fields["imageUrl"] = "an image post needs an image"
		}
	case domain.PostLink:
		if !isHTTPURL(req.LinkURL) {
			fields["linkUrl"] = "must be an http(s) link"
		}
	case domain.PostPoll:
		if title == "" {
			fields["title"] = "a poll needs a question"
		}
	}
	if len(title) > 300 {
		fields["title"] = "300 characters max"
	}
	if len(body) > 10000 {
		fields["body"] = "10000 characters max"
	}
	if len(fields) > 0 {
		return nil, httpx.Validation(fields)
	}

	now := s.now()
	postID, err := s.db.CreatePost(ctx, store.CreatePostParams{
		SpaceID:  space.ID,
		AuthorID: authorID,
		Type:     req.Type,
		Title:    title,
		Body:     body,
		ImageURL: strings.TrimSpace(req.ImageURL),
		LinkURL:  strings.TrimSpace(req.LinkURL),
		HotRank:  HotRank(0, now),
	})
	if err != nil {
		return nil, httpx.Internal("could not publish your post").
			WithFriendly("oops, that didn't post — try again?").WithCause(err)
	}

	post, err := s.db.PostByID(ctx, authorID, postID)
	if err != nil {
		return nil, httpx.Internal("your post saved but could not be loaded").WithCause(err)
	}

	result := &PostResult{Post: *post}

	// Crisis routing runs on the text after the post is safely stored.
	if check := safety.Check(title + "\n" + body); check.Flagged {
		result.SupportCard = check.Card
		if err := s.db.FlagCrisis(ctx, authorID, "POST", postID, check.Pattern); err != nil {
			s.log.ErrorContext(ctx, "could not queue a crisis flag", "error", err, "post", postID)
		}
	}

	result.OwlPoints = s.credit(ctx, authorID, deviceID, owl.ActionPost)

	s.publish(ctx, realtime.SpaceChannel(space.ID), realtime.EventPostNew, post)
	return result, nil
}

// Post returns a single post.
func (s *FeedService) Post(ctx context.Context, viewerID, postID string) (domain.Post, error) {
	post, err := s.db.PostByID(ctx, viewerID, postID)
	if err != nil {
		return domain.Post{}, notFoundOr(err, "that post is gone")
	}
	if post.IsRemoved {
		return domain.Post{}, httpx.NotFound("that post was removed by a moderator")
	}
	return *post, nil
}

// VoteResult is the outcome of a vote.
type VoteResult struct {
	Score      int `json:"score"`
	ViewerVote int `json:"viewerVote"`
}

// Vote records an up, down or cleared vote on a post.
func (s *FeedService) Vote(ctx context.Context, userID, postID string, value int) (*VoteResult, error) {
	if value < -1 || value > 1 {
		return nil, httpx.BadRequest("vote must be -1, 0 or 1")
	}

	_, spaceID, locked, err := s.db.PostAuthor(ctx, postID)
	if err != nil {
		return nil, notFoundOr(err, "that post is gone")
	}
	if locked {
		return nil, httpx.Forbidden("this post is locked")
	}

	score, _, err := s.db.VotePost(ctx, userID, postID, value, HotRank)
	if err != nil {
		return nil, httpx.Internal("could not record your vote").WithCause(err)
	}

	s.publish(ctx, realtime.SpaceChannel(spaceID), realtime.EventPostScore, map[string]any{
		"postId": postID, "score": score,
	})
	return &VoteResult{Score: score, ViewerVote: value}, nil
}

// ReactResult is the outcome of a sticker tap.
type ReactResult struct {
	Added    bool                  `json:"added"`
	Stickers []domain.StickerCount `json:"stickers"`
}

// React toggles a sticker reaction. Stickers do not affect ranking — that is the
// entire point of them (PRD 6.5).
func (s *FeedService) React(ctx context.Context, userID, postID string, sticker domain.Sticker) (*ReactResult, error) {
	if !domain.ValidSticker(sticker) {
		return nil, httpx.Validation(map[string]string{"sticker": "not one of the available stickers"})
	}
	if _, _, _, err := s.db.PostAuthor(ctx, postID); err != nil {
		return nil, notFoundOr(err, "that post is gone")
	}

	added, err := s.db.ReactPost(ctx, userID, postID, sticker)
	if err != nil {
		return nil, httpx.Internal("could not add your reaction").WithCause(err)
	}

	post, err := s.db.PostByID(ctx, userID, postID)
	if err != nil {
		return nil, httpx.Internal("could not reload that post").WithCause(err)
	}

	s.publish(ctx, realtime.SpaceChannel(post.Space.ID), realtime.EventReaction, map[string]any{
		"postId": postID, "stickers": post.Stickers,
	})
	return &ReactResult{Added: added, Stickers: post.Stickers}, nil
}

// CommentRequest is a new comment.
type CommentRequest struct {
	Body     string  `json:"body"`
	ParentID *string `json:"parentId"`
}

// CommentResult is a created comment plus its side effects.
type CommentResult struct {
	Comment     domain.Comment      `json:"comment"`
	SupportCard *safety.SupportCard `json:"supportCard,omitempty"`
	OwlPoints   *OwlGrant           `json:"owlPoints,omitempty"`
}

// Comment adds a threaded reply.
func (s *FeedService) Comment(ctx context.Context, authorID, deviceID, postID string, req CommentRequest) (*CommentResult, error) {
	body := strings.TrimSpace(req.Body)
	if body == "" {
		return nil, httpx.Validation(map[string]string{"body": "say something first"})
	}
	if len(body) > 5000 {
		return nil, httpx.Validation(map[string]string{"body": "5000 characters max"})
	}

	_, spaceID, locked, err := s.db.PostAuthor(ctx, postID)
	if err != nil {
		return nil, notFoundOr(err, "that post is gone")
	}
	if locked {
		return nil, httpx.Forbidden("this post is locked").WithFriendly("this thread is closed 🔒")
	}

	commentID, err := s.db.CreateComment(ctx, postID, authorID, body, req.ParentID)
	if err != nil {
		if errors.Is(err, store.ErrConflict) || errors.Is(err, store.ErrNotFound) {
			return nil, httpx.BadRequest("that reply target does not exist")
		}
		return nil, httpx.Internal("could not post your comment").
			WithFriendly("oops, that didn't send — try again?").WithCause(err)
	}

	comments, err := s.db.ListComments(ctx, authorID, postID, 1000)
	if err != nil {
		return nil, httpx.Internal("your comment saved but could not be loaded").WithCause(err)
	}
	var created domain.Comment
	for _, c := range comments {
		if c.ID == commentID {
			created = c
			break
		}
	}

	result := &CommentResult{Comment: created}
	if check := safety.Check(body); check.Flagged {
		result.SupportCard = check.Card
		if err := s.db.FlagCrisis(ctx, authorID, "COMMENT", commentID, check.Pattern); err != nil {
			s.log.ErrorContext(ctx, "could not queue a crisis flag", "error", err, "comment", commentID)
		}
	}
	result.OwlPoints = s.credit(ctx, authorID, deviceID, owl.ActionComment)

	s.publish(ctx, realtime.SpaceChannel(spaceID), realtime.EventCommentNew, created)
	return result, nil
}

// Comments returns a post's comment tree.
func (s *FeedService) Comments(ctx context.Context, viewerID, postID string) ([]domain.Comment, error) {
	flat, err := s.db.ListComments(ctx, viewerID, postID, 1000)
	if err != nil {
		return nil, httpx.Internal("could not load comments").WithCause(err)
	}
	return BuildCommentTree(flat), nil
}

// BuildCommentTree turns a flat, depth-ordered list into a tree.
//
// Orphans — a reply whose parent was filtered out, e.g. because the viewer
// blocked its author — are promoted to the root rather than dropped, because
// losing a conversation is worse than losing its indentation.
func BuildCommentTree(flat []domain.Comment) []domain.Comment {
	type node struct {
		comment  domain.Comment
		children []*node
	}

	index := make(map[string]*node, len(flat))
	order := make([]*node, 0, len(flat))
	for _, c := range flat {
		c.Children = nil
		n := &node{comment: c}
		index[c.ID] = n
		order = append(order, n)
	}

	var roots []*node
	for _, n := range order {
		if n.comment.ParentID != nil {
			if parent, ok := index[*n.comment.ParentID]; ok && parent != n {
				parent.children = append(parent.children, n)
				continue
			}
		}
		roots = append(roots, n)
	}

	var materialise func(*node) domain.Comment
	materialise = func(n *node) domain.Comment {
		out := n.comment
		out.Children = nil
		for _, child := range n.children {
			out.Children = append(out.Children, materialise(child))
		}
		return out
	}

	out := make([]domain.Comment, 0, len(roots))
	for _, r := range roots {
		out = append(out, materialise(r))
	}
	return out
}

// VoteComment records a vote on a comment.
func (s *FeedService) VoteComment(ctx context.Context, userID, commentID string, value int) (*VoteResult, error) {
	if value < -1 || value > 1 {
		return nil, httpx.BadRequest("vote must be -1, 0 or 1")
	}
	score, err := s.db.VoteComment(ctx, userID, commentID, value)
	if err != nil {
		return nil, notFoundOr(err, "that comment is gone")
	}
	return &VoteResult{Score: score, ViewerVote: value}, nil
}

// RemovePost is the moderator remove action.
func (s *FeedService) RemovePost(ctx context.Context, moderatorID, postID, reason string, isAdmin bool) error {
	_, spaceID, _, err := s.db.PostAuthor(ctx, postID)
	if err != nil {
		return notFoundOr(err, "that post is gone")
	}
	if !isAdmin {
		isMod, err := s.db.IsSpaceModerator(ctx, spaceID, moderatorID)
		if err != nil {
			return httpx.Internal("could not check your permissions").WithCause(err)
		}
		if !isMod {
			return httpx.Forbidden("you are not a moderator of this space")
		}
	}
	if err := s.db.RemovePost(ctx, postID, reason); err != nil {
		return notFoundOr(err, "that post is gone")
	}
	return nil
}

// credit records Owl Board points for an action, swallowing errors: a
// leaderboard hiccup must never fail a post.
func (s *FeedService) credit(ctx context.Context, userID, deviceID string, action owl.Action) *OwlGrant {
	if s.points == nil {
		return nil
	}
	grant, err := s.points.RecordAction(ctx, userID, deviceID, action)
	if err != nil {
		s.log.WarnContext(ctx, "could not credit owl points", "error", err, "action", action)
		return nil
	}
	return grant
}

func (s *FeedService) publish(ctx context.Context, channel string, t realtime.EventType, payload any) {
	ev, err := realtime.NewEvent(t, channel, payload)
	if err != nil {
		return
	}
	if err := s.bus.Publish(ctx, ev); err != nil {
		s.log.WarnContext(ctx, "publish failed", "error", err, "type", t)
	}
}

func normaliseSort(sort string) string {
	if sort == "new" {
		return "new"
	}
	return "hot"
}

func isHTTPURL(raw string) bool {
	u := strings.TrimSpace(strings.ToLower(raw))
	return strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://")
}

// ------------------------------------------------------------- moderation -----

// validReportTargets guards the targetType column.
var validReportTargets = map[string]bool{
	"USER": true, "POST": true, "COMMENT": true, "MESSAGE": true, "WHISPER": true, "NOTE": true,
}

// validReportStatuses guards the resolution.
var validReportStatuses = map[string]bool{
	"OPEN": true, "IN_REVIEW": true, "ACTIONED": true, "DISMISSED": true,
}

// Report files a report. PRD 10: report and block are one tap from every
// surface, and the queue targets a 24h SLA.
func (s *FeedService) Report(ctx context.Context, reporterID, targetType, targetID, reason, details string) (string, error) {
	targetType = strings.ToUpper(strings.TrimSpace(targetType))
	fields := map[string]string{}

	if !validReportTargets[targetType] {
		fields["targetType"] = "must be USER, POST, COMMENT, MESSAGE, WHISPER or NOTE"
	}
	if strings.TrimSpace(targetID) == "" {
		fields["targetId"] = "required"
	}
	if r := strings.TrimSpace(reason); r == "" || len(r) > 100 {
		fields["reason"] = "1–100 characters"
	}
	if len(details) > 1000 {
		fields["details"] = "1000 characters max"
	}
	if len(fields) > 0 {
		return "", httpx.Validation(fields)
	}

	id, err := s.db.CreateReport(ctx, reporterID, targetType, strings.TrimSpace(targetID),
		strings.TrimSpace(reason), strings.TrimSpace(details))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return "", httpx.NotFound("that content is already gone")
		}
		return "", httpx.Internal("could not file that report").WithCause(err)
	}
	s.log.InfoContext(ctx, "report filed", "report", id, "target_type", targetType, "target", targetID)
	return id, nil
}

// OpenReports returns the moderation queue, oldest first.
func (s *FeedService) OpenReports(ctx context.Context, limit int) ([]store.ReportRow, error) {
	rows, err := s.db.ListOpenReports(ctx, limit)
	if err != nil {
		return nil, httpx.Internal("could not load the queue").WithCause(err)
	}
	if rows == nil {
		rows = []store.ReportRow{}
	}
	return rows, nil
}

// ResolveReport closes a report.
func (s *FeedService) ResolveReport(ctx context.Context, reportID, resolverID, status string) error {
	status = strings.ToUpper(strings.TrimSpace(status))
	if !validReportStatuses[status] {
		return httpx.Validation(map[string]string{"status": "must be OPEN, IN_REVIEW, ACTIONED or DISMISSED"})
	}
	if err := s.db.ResolveReport(ctx, reportID, resolverID, status); err != nil {
		return notFoundOr(err, "no report with that id")
	}
	return nil
}
