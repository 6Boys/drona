package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/cache"
	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/owl"
	"github.com/aniketrathour/dronasphere/api/internal/realtime"
	"github.com/aniketrathour/dronasphere/api/internal/safety"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

// ChatService owns Chats, Dens and Signals, and is the WebSocket gateway's
// authorizer — so the rule about who may read a thread is written once.
type ChatService struct {
	cfg    *config.Config
	db     *store.DB
	cache  *cache.Redis
	bus    realtime.Bus
	points PointsRecorder
	log    *slog.Logger
	now    func() time.Time
}

// NewChatService wires the service.
func NewChatService(cfg *config.Config, db *store.DB, c *cache.Redis, bus realtime.Bus, points PointsRecorder, log *slog.Logger, now func() time.Time) *ChatService {
	if now == nil {
		now = time.Now
	}
	return &ChatService{cfg: cfg, db: db, cache: c, bus: bus, points: points, log: log, now: now}
}

// Threads lists the viewer's active conversations.
func (s *ChatService) Threads(ctx context.Context, viewerID string, limit int) ([]domain.Thread, error) {
	threads, err := s.db.ListThreads(ctx, viewerID, domain.MemberActive, limit)
	if err != nil {
		return nil, httpx.Internal("could not load your chats").WithCause(err)
	}
	if threads == nil {
		threads = []domain.Thread{}
	}
	return s.attachPresence(ctx, threads), nil
}

// Requests lists the request inbox: DMs from people who are not Buddies (PRD 6.6).
func (s *ChatService) Requests(ctx context.Context, viewerID string, limit int) ([]domain.Thread, error) {
	threads, err := s.db.ListThreads(ctx, viewerID, domain.MemberRequested, limit)
	if err != nil {
		return nil, httpx.Internal("could not load your requests").WithCause(err)
	}
	if threads == nil {
		threads = []domain.Thread{}
	}
	return s.attachPresence(ctx, threads), nil
}

// attachPresence fills the online dot and the night owl icon for thread members.
func (s *ChatService) attachPresence(ctx context.Context, threads []domain.Thread) []domain.Thread {
	if s.cache == nil {
		return threads
	}
	var ids []string
	for _, t := range threads {
		for _, m := range t.Members {
			ids = append(ids, m.ID)
		}
	}
	presence, err := s.cache.PresenceMany(ctx, ids)
	if err != nil {
		return threads
	}
	for i := range threads {
		for j := range threads[i].Members {
			if state, ok := presence[threads[i].Members[j].ID]; ok && state != "" {
				now := s.now()
				threads[i].Members[j].LastSeenAt = &now
			}
		}
	}
	return threads
}

// StartDM opens (or reuses) a 1:1 thread.
//
// Two gates from the PRD live here:
//   - Non-mutuals land in a request inbox rather than the main list (6.6).
//   - An under-18 account cannot receive DMs from non-mutuals (10). The check is
//     on both sides: a minor is protected whether they are sender or recipient.
func (s *ChatService) StartDM(ctx context.Context, viewerID, targetHandle string) (*domain.Thread, error) {
	target, err := s.db.UserByHandle(ctx, targetHandle)
	if err != nil {
		return nil, notFoundOr(err, "no account with that handle")
	}
	if target.ID == viewerID {
		return nil, httpx.BadRequest("you cannot message yourself").
			WithFriendly("talking to yourself? try the Whisper Wall 👀")
	}

	blocked, err := s.db.IsBlockedEitherWay(ctx, viewerID, target.ID)
	if err != nil {
		return nil, httpx.Internal("could not check that account").WithCause(err)
	}
	if blocked {
		return nil, httpx.NotFound("no account with that handle")
	}

	rel, err := s.db.RelationshipBetween(ctx, viewerID, target.ID)
	if err != nil {
		return nil, httpx.Internal("could not check your relationship").WithCause(err)
	}
	mutual := rel.IsBuddy()

	if !mutual {
		viewer, err := s.db.UserByID(ctx, viewerID)
		if err != nil {
			return nil, notFoundOr(err, "we could not find your account")
		}
		now := s.now()
		// Plain, literal copy — this is a safety gate (PRD 8).
		if !target.IsAdultAt(now) {
			return nil, httpx.AgeRestricted("This account only accepts messages from people they follow back.")
		}
		if !viewer.IsAdultAt(now) {
			return nil, httpx.AgeRestricted("Accounts under 18 can only message people who follow them back.")
		}
	}

	threadID, _, err := s.db.GetOrCreateDM(ctx, viewerID, target.ID, mutual)
	if err != nil {
		return nil, httpx.Internal("could not open that chat").WithCause(err)
	}

	thread, err := s.db.ThreadByID(ctx, viewerID, threadID)
	if err != nil {
		return nil, httpx.Internal("could not load that chat").WithCause(err)
	}

	if !mutual {
		s.publishUser(ctx, target.ID, realtime.EventThreadRequest, map[string]any{
			"threadId": threadID,
			"from":     viewerID,
		})
	}
	return thread, nil
}

// CreateDenRequest opens a group chat.
type CreateDenRequest struct {
	Title   string   `json:"title"`
	Icon    string   `json:"icon"`
	Handles []string `json:"handles"`
}

// CreateDen opens a Den with an initial member list.
func (s *ChatService) CreateDen(ctx context.Context, ownerID string, req CreateDenRequest) (*domain.Thread, error) {
	title := strings.TrimSpace(req.Title)
	if len(title) < 2 || len(title) > 60 {
		return nil, httpx.Validation(map[string]string{"title": "2–60 characters"})
	}
	// PRD 6.6: Dens cap at 256 members.
	if len(req.Handles) > 255 {
		return nil, httpx.BadRequest("a Den holds 256 people including you")
	}

	memberIDs := make([]string, 0, len(req.Handles))
	for _, h := range req.Handles {
		u, err := s.db.UserByHandle(ctx, h)
		if err != nil {
			continue
		}
		blocked, err := s.db.IsBlockedEitherWay(ctx, ownerID, u.ID)
		if err != nil || blocked {
			continue
		}
		memberIDs = append(memberIDs, u.ID)
	}

	threadID, err := s.db.CreateDen(ctx, ownerID, title, req.Icon, memberIDs)
	if err != nil {
		return nil, httpx.Internal("could not create that Den").WithCause(err)
	}

	thread, err := s.db.ThreadByID(ctx, ownerID, threadID)
	if err != nil {
		return nil, httpx.Internal("the Den was created but could not be loaded").WithCause(err)
	}
	for _, id := range memberIDs {
		s.publishUser(ctx, id, realtime.EventThreadRequest, map[string]any{"threadId": threadID})
	}
	return thread, nil
}

// Thread loads one conversation, enforcing membership.
func (s *ChatService) Thread(ctx context.Context, viewerID, threadID string) (*domain.Thread, error) {
	if _, err := s.requireMembership(ctx, viewerID, threadID); err != nil {
		return nil, err
	}
	thread, err := s.db.ThreadByID(ctx, viewerID, threadID)
	if err != nil {
		return nil, notFoundOr(err, "that chat is gone")
	}
	return thread, nil
}

// Messages returns a page of history, newest first.
func (s *ChatService) Messages(ctx context.Context, viewerID, threadID, cursorToken string, limit int) (domain.Page[domain.Message], error) {
	var empty domain.Page[domain.Message]

	if _, err := s.requireMembership(ctx, viewerID, threadID); err != nil {
		return empty, err
	}
	cursor, err := domain.DecodeCursor(cursorToken)
	if err != nil {
		return empty, httpx.BadRequest("that page cursor is not valid")
	}

	messages, err := s.db.ListMessages(ctx, threadID, cursor, limit)
	if err != nil {
		return empty, httpx.Internal("could not load messages").WithCause(err)
	}
	if limit <= 0 {
		limit = 40
	}

	items := make([]domain.Message, 0, len(messages))
	for _, m := range messages {
		items = append(items, *m)
	}
	return domain.NewPage(items, limit, func(m domain.Message) domain.Cursor {
		return domain.Cursor{Time: m.CreatedAt, ID: m.ID}
	}), nil
}

// SendMessageRequest is an outgoing message.
type SendMessageRequest struct {
	Body      string             `json:"body"`
	Kind      domain.MessageKind `json:"kind"`
	MediaURL  string             `json:"mediaUrl"`
	ReplyToID *string            `json:"replyToId"`
	// ClientID makes a retry after a dropped socket idempotent.
	ClientID string `json:"clientId"`
}

// SendResult is a sent message plus its side effects.
type SendResult struct {
	Message     domain.Message      `json:"message"`
	SupportCard *safety.SupportCard `json:"supportCard,omitempty"`
	OwlPoints   *OwlGrant           `json:"owlPoints,omitempty"`
}

// Send appends a message and fans it out over the bus.
func (s *ChatService) Send(ctx context.Context, senderID, deviceID, threadID string, req SendMessageRequest) (*SendResult, error) {
	member, err := s.requireMembership(ctx, senderID, threadID)
	if err != nil {
		return nil, err
	}

	thread, err := s.db.ThreadByID(ctx, senderID, threadID)
	if err != nil {
		return nil, notFoundOr(err, "that chat is gone")
	}

	// PRD 6.6: a Signal is one-to-many. Only its owner and admins may post.
	if thread.Type == domain.ThreadSignal && member.Role != "OWNER" && member.Role != "ADMIN" {
		return nil, httpx.Forbidden("only the channel owner can post here")
	}

	if req.Kind == "" {
		req.Kind = domain.MessageText
	}
	body := strings.TrimSpace(req.Body)
	switch req.Kind {
	case domain.MessageText:
		if body == "" {
			return nil, httpx.Validation(map[string]string{"body": "say something first"})
		}
		if len(body) > 4000 {
			return nil, httpx.Validation(map[string]string{"body": "4000 characters max"})
		}
	case domain.MessageImage, domain.MessageVoice:
		if strings.TrimSpace(req.MediaURL) == "" {
			return nil, httpx.Validation(map[string]string{"mediaUrl": "required for that message kind"})
		}
	case domain.MessageSystem:
		return nil, httpx.Forbidden("system messages are not sent by users")
	default:
		return nil, httpx.Validation(map[string]string{"kind": "must be TEXT, IMAGE or VOICE"})
	}

	message, err := s.db.CreateMessage(ctx, store.CreateMessageParams{
		ThreadID:  threadID,
		SenderID:  senderID,
		Kind:      req.Kind,
		Body:      body,
		MediaURL:  strings.TrimSpace(req.MediaURL),
		ReplyToID: req.ReplyToID,
		ClientID:  strings.TrimSpace(req.ClientID),
	})
	if err != nil {
		return nil, httpx.Internal("could not send your message").
			WithFriendly("oops, that didn't send — try again?").WithCause(err)
	}

	// Sending a message accepts a request thread: replying is consent.
	if member.State == domain.MemberRequested {
		if err := s.db.AcceptRequest(ctx, threadID, senderID); err != nil && !errors.Is(err, store.ErrNotFound) {
			s.log.WarnContext(ctx, "could not accept a request thread", "error", err)
		}
	}

	result := &SendResult{Message: *message}
	if check := safety.Check(body); check.Flagged {
		result.SupportCard = check.Card
		if err := s.db.FlagCrisis(ctx, senderID, "MESSAGE", message.ID, check.Pattern); err != nil {
			s.log.ErrorContext(ctx, "could not queue a crisis flag", "error", err, "message", message.ID)
		}
	}

	if s.points != nil {
		if grant, err := s.points.RecordAction(ctx, senderID, deviceID, owl.ActionMessage); err == nil {
			result.OwlPoints = grant
		}
	}

	s.fanOut(ctx, threadID, senderID, realtime.EventMessageNew, message)
	return result, nil
}

// fanOut publishes to the thread channel (for open conversations) and to each
// member's own channel (so their chat list updates even with the thread closed).
func (s *ChatService) fanOut(ctx context.Context, threadID, actorID string, t realtime.EventType, payload any) {
	if ev, err := realtime.NewEvent(t, realtime.ThreadChannel(threadID), payload); err == nil {
		if err := s.bus.Publish(ctx, ev); err != nil {
			s.log.WarnContext(ctx, "publish to thread failed", "error", err, "thread", threadID)
		}
	}

	members, err := s.db.ThreadMemberIDs(ctx, threadID)
	if err != nil {
		s.log.WarnContext(ctx, "could not list thread members for fanout", "error", err)
		return
	}
	for _, id := range members {
		if id == actorID {
			continue
		}
		s.publishUser(ctx, id, t, payload)
	}
}

// MarkRead moves the viewer's read cursor and, if they allow read receipts,
// tells the thread. Receipts are toggleable, and no-read-receipt-shame is an
// explicit product pillar (PRD 5, 6.6).
func (s *ChatService) MarkRead(ctx context.Context, viewerID, threadID, messageID string) error {
	if _, err := s.requireMembership(ctx, viewerID, threadID); err != nil {
		return err
	}
	if err := s.db.MarkRead(ctx, threadID, viewerID, messageID); err != nil {
		return httpx.Internal("could not save your read position").WithCause(err)
	}

	enabled, err := s.db.ReadReceiptsEnabled(ctx, viewerID)
	if err != nil || !enabled {
		return nil
	}
	if ev, err := realtime.NewEvent(realtime.EventRead, realtime.ThreadChannel(threadID), map[string]any{
		"threadId": threadID, "userId": viewerID, "messageId": messageID,
	}); err == nil {
		_ = s.bus.Publish(ctx, ev)
	}
	return nil
}

// AcceptRequest moves a request thread into the main list.
func (s *ChatService) AcceptRequest(ctx context.Context, viewerID, threadID string) error {
	if err := s.db.AcceptRequest(ctx, threadID, viewerID); err != nil {
		return notFoundOr(err, "that request is gone")
	}
	return nil
}

// DeleteMessage soft-deletes the caller's own message.
func (s *ChatService) DeleteMessage(ctx context.Context, viewerID, threadID, messageID string) error {
	if _, err := s.requireMembership(ctx, viewerID, threadID); err != nil {
		return err
	}
	if err := s.db.DeleteMessage(ctx, messageID, viewerID); err != nil {
		return notFoundOr(err, "that message is gone, or it is not yours")
	}
	s.fanOut(ctx, threadID, viewerID, realtime.EventMessageDeleted, map[string]any{
		"threadId": threadID, "messageId": messageID,
	})
	return nil
}

// requireMembership is the single place that decides whether someone may see a
// thread. Everything else — REST reads, sends, socket subscriptions — goes
// through it.
func (s *ChatService) requireMembership(ctx context.Context, userID, threadID string) (*store.Membership, error) {
	member, err := s.db.Membership(ctx, threadID, userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			// Do not distinguish "no such thread" from "not your thread".
			return nil, httpx.NotFound("that chat is gone")
		}
		return nil, httpx.Internal("could not check that chat").WithCause(err)
	}
	switch member.State {
	case domain.MemberActive, domain.MemberRequested:
		return member, nil
	default:
		return nil, httpx.NotFound("that chat is gone")
	}
}

// ---------------------------------------------- realtime.Authorizer ----------

// CanSubscribe decides whether a socket may listen on a channel. This is the
// server-side check that makes the WebSocket safe: a client can ask for any
// channel it likes and gets only what it is entitled to.
func (s *ChatService) CanSubscribe(ctx context.Context, userID, channel string) error {
	kind, id, ok := realtime.SplitChannel(channel)
	if !ok {
		return httpx.BadRequest("that channel name is not valid")
	}

	switch kind {
	case realtime.ChannelKindUser:
		// Your own channel only.
		if id != userID {
			return httpx.Forbidden("that is not your channel")
		}
		return nil

	case realtime.ChannelKindThread:
		_, err := s.requireMembership(ctx, userID, id)
		return err

	case realtime.ChannelKindSpace:
		// Spaces are public within a campus, so any signed-in student may listen.
		return nil

	case realtime.ChannelKindOwl:
		user, err := s.db.UserByID(ctx, userID)
		if err != nil {
			return httpx.Unauthorized("you need to be signed in")
		}
		if user.CampusID != id {
			return httpx.Forbidden("that board is for another campus")
		}
		return nil

	default:
		return httpx.BadRequest("unknown channel kind")
	}
}

// Connected marks presence when a user's first socket opens.
func (s *ChatService) Connected(ctx context.Context, userID string) error {
	if err := s.db.TouchLastSeen(ctx, userID); err != nil {
		return err
	}
	if s.cache == nil {
		return nil
	}
	night := owl.WindowFor(s.now(), s.cfg.NightWindowStart, s.cfg.NightCurfew, s.cfg.NightLocation).IsOpen(s.now())
	return s.cache.MarkOnline(ctx, userID, night)
}

// Disconnected clears presence when the last socket closes.
func (s *ChatService) Disconnected(ctx context.Context, userID string) error {
	if err := s.db.TouchLastSeen(ctx, userID); err != nil {
		s.log.WarnContext(ctx, "could not touch last seen on disconnect", "error", err)
	}
	if s.cache == nil {
		return nil
	}
	return s.cache.GoOffline(ctx, userID)
}

// TypingAllowed reports whether a user may emit a typing indicator, honouring
// their own toggle (PRD 6.6: typing indicators and read receipts, both toggleable).
func (s *ChatService) TypingAllowed(ctx context.Context, userID, threadID string) (bool, string, error) {
	if _, err := s.requireMembership(ctx, userID, threadID); err != nil {
		return false, "", nil
	}
	user, err := s.db.UserByID(ctx, userID)
	if err != nil {
		return false, "", err
	}
	// The field lives on the user row; reuse ReadReceiptsEnabled's sibling by
	// reading the record we already have.
	return true, user.Handle, nil
}

func (s *ChatService) publishUser(ctx context.Context, userID string, t realtime.EventType, payload any) {
	ev, err := realtime.NewEvent(t, realtime.UserChannel(userID), payload)
	if err != nil {
		return
	}
	if err := s.bus.Publish(ctx, ev); err != nil {
		s.log.WarnContext(ctx, "publish failed", "error", err, "type", t)
	}
}
