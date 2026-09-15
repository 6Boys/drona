// Package domain holds the types that cross package boundaries: the entities
// the API returns and the small value types (cursors, night keys, owl ranks)
// that the services agree on.
//
// These mirror prisma/schema.prisma. When you change the schema, change these.
package domain

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ---------------------------------------------------------------- enums ------

type UserStatus string

const (
	StatusPendingVerification UserStatus = "PENDING_VERIFICATION"
	StatusActive              UserStatus = "ACTIVE"
	StatusSuspended           UserStatus = "SUSPENDED"
	StatusDeactivated         UserStatus = "DEACTIVATED"
)

type UserRole string

const (
	RoleStudent     UserRole = "STUDENT"
	RoleSpaceMod    UserRole = "SPACE_MOD"
	RoleCampusAdmin UserRole = "CAMPUS_ADMIN"
	RoleSuperadmin  UserRole = "SUPERADMIN"
)

// OnboardingStep tracks how far a new account got. PRD 6.1: a user cannot
// reach home with zero follows.
type OnboardingStep string

const (
	StepHandle  OnboardingStep = "HANDLE"
	StepProfile OnboardingStep = "PROFILE"
	StepAvatar  OnboardingStep = "AVATAR"
	StepFollows OnboardingStep = "FOLLOWS"
	StepDone    OnboardingStep = "DONE"
)

type PostType string

const (
	PostText  PostType = "TEXT"
	PostImage PostType = "IMAGE"
	PostPoll  PostType = "POLL"
	PostLink  PostType = "LINK"
	PostAsk   PostType = "ASK"
)

// ValidPostType guards the type column.
func ValidPostType(t PostType) bool {
	switch t {
	case PostText, PostImage, PostPoll, PostLink, PostAsk:
		return true
	}
	return false
}

type ThreadType string

const (
	ThreadDM     ThreadType = "DM"
	ThreadDen    ThreadType = "DEN"
	ThreadSignal ThreadType = "SIGNAL"
	ThreadNest   ThreadType = "NEST"
)

type MemberState string

const (
	MemberRequested MemberState = "REQUESTED"
	MemberActive    MemberState = "ACTIVE"
	MemberLeft      MemberState = "LEFT"
	MemberRemoved   MemberState = "REMOVED"
)

type MessageKind string

const (
	MessageText   MessageKind = "TEXT"
	MessageImage  MessageKind = "IMAGE"
	MessageVoice  MessageKind = "VOICE"
	MessageSystem MessageKind = "SYSTEM"
)

// Sticker is a zero-risk reaction (PRD 6.5). Stickers never affect ranking.
type Sticker string

const (
	StickerCookie     Sticker = "COOKIE"
	StickerSparkle    Sticker = "SPARKLE"
	StickerSob        Sticker = "SOB"
	StickerFire       Sticker = "FIRE"
	StickerHeartHands Sticker = "HEART_HANDS"
)

// Emoji renders a sticker for clients that want the raw glyph.
func (s Sticker) Emoji() string {
	switch s {
	case StickerCookie:
		return "🍪"
	case StickerSparkle:
		return "✨"
	case StickerSob:
		return "😭"
	case StickerFire:
		return "🔥"
	case StickerHeartHands:
		return "🫶"
	}
	return ""
}

// ValidSticker guards the sticker column.
func ValidSticker(s Sticker) bool { return s.Emoji() != "" }

// OwlRank is the night-presence ladder (PRD 6.2).
type OwlRank string

const (
	RankSleepySparrow OwlRank = "SLEEPY_SPARROW"
	RankFledgling     OwlRank = "FLEDGLING"
	RankNightOwl      OwlRank = "NIGHT_OWL"
	RankMoonMoth      OwlRank = "MOON_MOTH"
	RankComet         OwlRank = "COMET"
)

// RankForPoints maps a weekly total onto the ladder.
func RankForPoints(points int) OwlRank {
	switch {
	case points >= 900:
		return RankComet
	case points >= 500:
		return RankMoonMoth
	case points >= 250:
		return RankNightOwl
	case points >= 80:
		return RankFledgling
	default:
		return RankSleepySparrow
	}
}

// Label renders a rank for the UI.
func (r OwlRank) Label() string {
	switch r {
	case RankSleepySparrow:
		return "Sleepy Sparrow"
	case RankFledgling:
		return "Fledgling"
	case RankNightOwl:
		return "Night Owl"
	case RankMoonMoth:
		return "Moon Moth"
	case RankComet:
		return "Comet"
	}
	return string(r)
}

// StardustReason keeps the ledger auditable.
type StardustReason string

const (
	StardustOwlNight      StardustReason = "OWL_NIGHT"
	StardustCocoonBonus   StardustReason = "COCOON_BONUS"
	StardustNoteUpload    StardustReason = "NOTE_UPLOAD"
	StardustNoteUpvote    StardustReason = "NOTE_UPVOTE"
	StardustBurrowSession StardustReason = "BURROW_SESSION"
	StardustSpend         StardustReason = "SPEND"
	StardustAdminGrant    StardustReason = "ADMIN_GRANT"
)

// --------------------------------------------------------------- entities ----

// Avatar is the Dronu-style character built before a photo is ever requested
// (PRD 6.1 — this removes the "I don't have a good photo" drop-off).
type Avatar struct {
	Hat       string `json:"hat"`
	Eyes      string `json:"eyes"`
	Colour    string `json:"colour"`
	Accessory string `json:"accessory"`
}

// User is a verified student. DOB is deliberately absent from the JSON: it is
// stored for the 18+ gate and never displayed (PRD 10).
type User struct {
	ID          string     `json:"id"`
	CampusID    string     `json:"campusId"`
	Handle      string     `json:"handle"`
	DisplayName string     `json:"displayName"`
	Bio         string     `json:"bio,omitempty"`
	Avatar      Avatar     `json:"avatar"`
	PhotoURL    string     `json:"photoUrl,omitempty"`
	Batch       string     `json:"batch,omitempty"`
	Branch      string     `json:"branch,omitempty"`
	Year        int        `json:"year,omitempty"`
	Role        UserRole   `json:"role"`
	Status      UserStatus `json:"status"`

	IsPrivate      bool           `json:"isPrivate"`
	OnboardingStep OnboardingStep `json:"onboardingStep"`

	FollowerCount  int     `json:"followerCount"`
	FollowingCount int     `json:"followingCount"`
	Stardust       int     `json:"stardust"`
	OwlRank        OwlRank `json:"owlRank"`
	OwlRankLabel   string  `json:"owlRankLabel"`

	LoveFinderEnabled bool `json:"loveFinderEnabled"`
	PhotoVerified     bool `json:"photoVerified"`

	// Set only when the viewer is looking at their own record.
	Email string `json:"email,omitempty"`
	// Whether the account is 18+. The date itself never leaves the server.
	IsAdult *bool `json:"isAdult,omitempty"`

	LastSeenAt *time.Time `json:"lastSeenAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`

	// Relationship to the viewer, filled by the API where relevant.
	ViewerFollows bool `json:"viewerFollows"`
	FollowsViewer bool `json:"followsViewer"`
	IsBuddy       bool `json:"isBuddy"`
}

// Private is the internal record, with the fields that never go over the wire.
type UserPrivate struct {
	User
	DOB               *time.Time
	EmailVerifiedAt   *time.Time
	PhotoVerifiedAt   *time.Time
	DeviceFingerprint string
}

// IsAdultAt reports whether the user is 18+ at the given moment. A missing DOB
// is treated as not adult — the gate fails closed (PRD 6.3, "non-negotiable").
func (u *UserPrivate) IsAdultAt(now time.Time) bool {
	if u.DOB == nil {
		return false
	}
	eighteenth := u.DOB.AddDate(18, 0, 0)
	return !now.Before(eighteenth)
}

// CanUseDating combines every gate on the Love Finder surface.
func (u *UserPrivate) CanUseDating(now time.Time) error {
	if u.Status != StatusActive {
		return errors.New("account is not active")
	}
	if !u.IsAdultAt(now) {
		return errors.New("Love Finder is only available to users aged 18 and over")
	}
	if u.PhotoVerifiedAt == nil {
		return errors.New("photo verification is required before you can enter the deck")
	}
	return nil
}

// Space is a subreddit-equivalent.
type Space struct {
	ID          string  `json:"id"`
	CampusID    *string `json:"campusId,omitempty"`
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Icon        string  `json:"icon,omitempty"`
	IsDefault   bool    `json:"isDefault"`
	PostCount   int     `json:"postCount,omitempty"`
}

// StickerCount is one bucket of the reaction bar.
type StickerCount struct {
	Sticker Sticker `json:"sticker"`
	Emoji   string  `json:"emoji"`
	Count   int     `json:"count"`
	Reacted bool    `json:"reacted"`
}

// Post is a Nest entry. Reddit's structure, Instagram's identity: the author
// handle is always attached (PRD 6.5).
type Post struct {
	ID       string   `json:"id"`
	Space    Space    `json:"space"`
	Author   User     `json:"author"`
	Type     PostType `json:"type"`
	Title    string   `json:"title,omitempty"`
	Body     string   `json:"body,omitempty"`
	ImageURL string   `json:"imageUrl,omitempty"`
	LinkURL  string   `json:"linkUrl,omitempty"`

	Score        int     `json:"score"`
	CommentCount int     `json:"commentCount"`
	HotRank      float64 `json:"-"`

	IsPinned  bool `json:"isPinned"`
	IsLocked  bool `json:"isLocked"`
	IsRemoved bool `json:"isRemoved"`

	// -1, 0 or +1 for the viewer.
	ViewerVote int            `json:"viewerVote"`
	Stickers   []StickerCount `json:"stickers"`

	CreatedAt time.Time `json:"createdAt"`
}

// Comment is a threaded reply.
type Comment struct {
	ID         string    `json:"id"`
	PostID     string    `json:"postId"`
	ParentID   *string   `json:"parentId,omitempty"`
	Author     User      `json:"author"`
	Body       string    `json:"body"`
	Depth      int       `json:"depth"`
	Score      int       `json:"score"`
	ViewerVote int       `json:"viewerVote"`
	IsRemoved  bool      `json:"isRemoved"`
	CreatedAt  time.Time `json:"createdAt"`
	Children   []Comment `json:"children,omitempty"`
}

// Thread is a DM, Den, Signal or a Nest opened by a match.
type Thread struct {
	ID          string     `json:"id"`
	Type        ThreadType `json:"type"`
	Title       string     `json:"title,omitempty"`
	Icon        string     `json:"icon,omitempty"`
	Members     []User     `json:"members,omitempty"`
	MemberCount int        `json:"memberCount"`

	LastMessage   *Message   `json:"lastMessage,omitempty"`
	LastMessageAt *time.Time `json:"lastMessageAt,omitempty"`
	UnreadCount   int        `json:"unreadCount"`
	// REQUESTED threads live in the request inbox, not the main list (PRD 6.6).
	ViewerState MemberState `json:"viewerState"`
	Muted       bool        `json:"muted"`
	CreatedAt   time.Time   `json:"createdAt"`
}

// Message is append-only. Edits and deletes are recorded, never destructive.
type Message struct {
	ID        string         `json:"id"`
	ThreadID  string         `json:"threadId"`
	Sender    User           `json:"sender"`
	Kind      MessageKind    `json:"kind"`
	Body      string         `json:"body,omitempty"`
	MediaURL  string         `json:"mediaUrl,omitempty"`
	ReplyToID *string        `json:"replyToId,omitempty"`
	ClientID  string         `json:"clientId,omitempty"`
	EditedAt  *time.Time     `json:"editedAt,omitempty"`
	DeletedAt *time.Time     `json:"deletedAt,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
	Reactions []StickerCount `json:"reactions,omitempty"`
}

// OwlEntry is one row of the leaderboard.
type OwlEntry struct {
	Rank         int     `json:"rank"`
	User         User    `json:"user"`
	Points       int     `json:"points"`
	OwlRank      OwlRank `json:"owlRank"`
	OwlRankLabel string  `json:"owlRankLabel"`
	IsViewer     bool    `json:"isViewer"`
}

// OwlBoard is a scoped, weekly-reset leaderboard.
type OwlBoard struct {
	Scope        string     `json:"scope"`
	WeekKey      string     `json:"weekKey"`
	Entries      []OwlEntry `json:"entries"`
	ViewerRank   int        `json:"viewerRank"`
	ViewerPoints int        `json:"viewerPoints"`
	// True after the 3 AM curfew: points have stopped, the app dims, Dronu
	// yawns (PRD 6.2).
	CozyMode  bool      `json:"cozyMode"`
	NightOpen bool      `json:"nightOpen"`
	ResetsAt  time.Time `json:"resetsAt"`
}

// Note is a Note Locker item (PRD 7.4).
type Note struct {
	ID         string    `json:"id"`
	Uploader   User      `json:"uploader"`
	Subject    string    `json:"subject"`
	Semester   int       `json:"semester"`
	Branch     string    `json:"branch,omitempty"`
	Kind       string    `json:"kind"`
	Title      string    `json:"title"`
	FileURL    string    `json:"fileUrl"`
	FileSize   int       `json:"fileSize,omitempty"`
	Score      int       `json:"score"`
	Downloads  int       `json:"downloads"`
	ViewerVote int       `json:"viewerVote"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ---------------------------------------------------------------- cursors ----

// Cursor is an opaque keyset position. PRD 12: cursor pagination, no offsets —
// offsets skip and duplicate rows in a feed that is actively being written to.
type Cursor struct {
	// Sort value at the boundary: a timestamp for time ordering, a float for hot.
	Time  time.Time
	Score float64
	ID    string
}

// Encode renders a cursor as a URL-safe token.
func (c Cursor) Encode() string {
	raw := fmt.Sprintf("%d|%s|%s", c.Time.UTC().UnixMicro(), formatFloat(c.Score), c.ID)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

// DecodeCursor parses a token produced by Encode. An empty token is the start
// of the list, not an error.
func DecodeCursor(token string) (*Cursor, error) {
	if strings.TrimSpace(token) == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("cursor is not valid base64: %w", err)
	}
	parts := strings.SplitN(string(raw), "|", 3)
	if len(parts) != 3 {
		return nil, errors.New("cursor has the wrong shape")
	}
	micros, err := parseInt64(parts[0])
	if err != nil {
		return nil, fmt.Errorf("cursor timestamp: %w", err)
	}
	score, err := parseFloat(parts[1])
	if err != nil {
		return nil, fmt.Errorf("cursor score: %w", err)
	}
	if parts[2] == "" {
		return nil, errors.New("cursor is missing its id")
	}
	return &Cursor{Time: time.UnixMicro(micros).UTC(), Score: score, ID: parts[2]}, nil
}

// Page is the standard list envelope.
type Page[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"nextCursor,omitempty"`
	HasMore    bool   `json:"hasMore"`
}

// NewPage trims an over-fetched slice down to limit and derives the cursor.
func NewPage[T any](items []T, limit int, cursorOf func(T) Cursor) Page[T] {
	page := Page[T]{Items: items}
	if len(items) > limit {
		page.Items = items[:limit]
		page.HasMore = true
		last := page.Items[len(page.Items)-1]
		page.NextCursor = cursorOf(last).Encode()
	}
	if page.Items == nil {
		page.Items = []T{}
	}
	return page
}

// ------------------------------------------------------------- love finder ---
// PRD 6.3. A Swipe records one decision; a mutual LIKE/TWINKLE in both
// directions between the same pair becomes a Match, which opens a NEST thread.

type SwipeAction string

const (
	SwipePass    SwipeAction = "PASS"
	SwipeLike    SwipeAction = "LIKE"
	SwipeTwinkle SwipeAction = "TWINKLE"
)

// ValidSwipeAction guards the action column.
func ValidSwipeAction(a SwipeAction) bool {
	switch a {
	case SwipePass, SwipeLike, SwipeTwinkle:
		return true
	}
	return false
}

// SwipeTargetKind is what a LIKE/TWINKLE was actually about — Hinge's
// signature move: you like the picture or one specific answer, never just
// "the person." Unset (both nil) on PASS.
type SwipeTargetKind string

const (
	TargetPhoto  SwipeTargetKind = "PHOTO"
	TargetPrompt SwipeTargetKind = "PROMPT"
)

// SwipeTarget names the thing a like was attached to.
type SwipeTarget struct {
	Kind SwipeTargetKind `json:"kind"`
	// Only set when Kind is TargetPrompt: which of the target's
	// DatingProfile.Prompts, by position.
	PromptIndex *int `json:"promptIndex,omitempty"`
}

// DatingPrompt is one Hinge-style stacked Q&A block.
type DatingPrompt struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// DatingProfile is the Love Finder card's own content — separate from User
// because it is optional, dating-specific, and nobody outside the deck ever
// sees it.
type DatingProfile struct {
	Vibe      string         `json:"vibe"`
	Interests []string       `json:"interests"`
	Prompts   []DatingPrompt `json:"prompts"`
}

// DatingCandidate is one deck entry, or the other side of a like or match: a
// user plus whatever they've written on their Love Finder card. A candidate
// with no DatingProfile saved yet still has a (zero-value, empty) one — the
// deck never has to special-case "hasn't filled it in."
type DatingCandidate struct {
	User
	DatingProfile
}

// DatingLike is one incoming swipe, as shown in "likes you" — deliberately
// carrying what was liked and what was said about it, not just who liked you.
type DatingLike struct {
	ID        string          `json:"id"`
	Candidate DatingCandidate `json:"candidate"`
	Action    SwipeAction     `json:"action"`
	Target    SwipeTarget     `json:"target"`
	Note      string          `json:"note,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
}

// DatingMatch is a mutual like: two people, the NEST thread it opened, and
// the wilt clock ticking until someone speaks (PRD 6.3).
type DatingMatch struct {
	// Handle identifies the *other* person — the API is always answering "my
	// matches," so there is no ambiguity about which side is the viewer.
	Handle    string          `json:"handle"`
	Candidate DatingCandidate `json:"candidate"`
	ThreadID  string          `json:"threadId"`
	CreatedAt time.Time       `json:"createdAt"`
	// Nil once the thread has a message — a spoken-to match does not wilt.
	WiltsAt *time.Time `json:"wiltsAt,omitempty"`
	// The first message in the thread, if any — lets the client show "you
	// said hi" without a second round trip.
	Opener string `json:"opener,omitempty"`
}
