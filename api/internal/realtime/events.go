// Package realtime is the live layer: a WebSocket gateway, a pub/sub bus, and
// the connection bookkeeping between them.
//
// PRD 12: WebSocket gateway with Redis pub/sub fanout. Redis is what lets two
// API pods serve two halves of the same conversation — a chat that only works
// when both people land on the same process is not a chat.
package realtime

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// EventType names a live event. The web client switches on these strings, so
// they are part of the API contract.
type EventType string

const (
	EventMessageNew     EventType = "message.new"
	EventMessageDeleted EventType = "message.deleted"
	EventTyping         EventType = "typing"
	EventRead           EventType = "read"
	EventThreadRequest  EventType = "thread.request"
	EventPostNew        EventType = "post.new"
	EventPostScore      EventType = "post.score"
	EventReaction       EventType = "reaction"
	EventCommentNew     EventType = "comment.new"
	EventFollow         EventType = "follow"
	EventOwlPoints      EventType = "owl.points"
	EventOwlCurfew      EventType = "owl.curfew"
	EventOwlCocoon      EventType = "owl.cocoon"
	EventPresence       EventType = "presence"
	// Both sides of a Love Finder match hear about it: the one who swiped
	// last sees it in the swipe response, the other needs telling (PRD 6.3).
	EventMatchNew EventType = "match.new"
	// Sent by the server in reply to a client frame it could not honour.
	EventError EventType = "error"
	// Keepalive, so an idle socket through a proxy is not reaped.
	EventPong EventType = "pong"
)

// Event is one message on the bus.
type Event struct {
	Type    EventType       `json:"type"`
	Channel string          `json:"channel"`
	At      time.Time       `json:"at"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// NewEvent builds an event, marshalling the payload.
func NewEvent(t EventType, channel string, payload any) (Event, error) {
	ev := Event{Type: t, Channel: channel, At: time.Now().UTC()}
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return Event{}, fmt.Errorf("encode %s payload: %w", t, err)
		}
		ev.Payload = raw
	}
	return ev, nil
}

// ---------------------------------------------------------------- channels ----

// Channel kinds. A channel name is <kind>:<id>, and the authorizer decides who
// may listen to which.
const (
	ChannelKindUser   = "user"
	ChannelKindThread = "thread"
	ChannelKindSpace  = "space"
	ChannelKindOwl    = "owl"
)

// UserChannel is a user's private channel: DMs, follows, owl updates, anything
// addressed to them personally.
func UserChannel(userID string) string { return ChannelKindUser + ":" + userID }

// ThreadChannel carries messages, typing and read receipts for one thread.
func ThreadChannel(threadID string) string { return ChannelKindThread + ":" + threadID }

// SpaceChannel carries new posts in a space, for live feed updates.
func SpaceChannel(spaceID string) string { return ChannelKindSpace + ":" + spaceID }

// OwlChannel carries leaderboard movement for a campus.
func OwlChannel(campusID string) string { return ChannelKindOwl + ":" + campusID }

// SplitChannel breaks a channel name into its kind and id.
func SplitChannel(channel string) (kind, id string, ok bool) {
	parts := strings.SplitN(channel, ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// ------------------------------------------------------------ client frames ---

// ClientFrame is what a browser sends up the socket. Deliberately tiny: the
// socket is for subscribing and for typing indicators. Everything that writes
// data goes through the REST API, which is where validation and rate limits live.
type ClientFrame struct {
	Type     string `json:"type"`
	Channel  string `json:"channel,omitempty"`
	ThreadID string `json:"threadId,omitempty"`
	// Typing is true on keypress, false on stop.
	Typing bool `json:"typing,omitempty"`
}

// Client frame types.
const (
	FrameSubscribe   = "subscribe"
	FrameUnsubscribe = "unsubscribe"
	FrameTyping      = "typing"
	FramePing        = "ping"
)

// TypingPayload is broadcast for a typing indicator.
type TypingPayload struct {
	ThreadID string `json:"threadId"`
	UserID   string `json:"userId"`
	Handle   string `json:"handle"`
	Typing   bool   `json:"typing"`
}

// PresencePayload reports an online dot, plus the little owl during the night
// window (PRD 6.6).
type PresencePayload struct {
	UserID string `json:"userId"`
	Online bool   `json:"online"`
	Night  bool   `json:"night"`
}

// ErrorPayload explains a refused client frame.
type ErrorPayload struct {
	Message string `json:"message"`
	Channel string `json:"channel,omitempty"`
}
