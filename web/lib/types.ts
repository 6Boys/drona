// Mirrors api/internal/domain/domain.go and the service DTOs. Keep the two in
// step — this is the wire contract between the Go API and the web client.

export type OnboardingStep = "HANDLE" | "PROFILE" | "AVATAR" | "FOLLOWS" | "DONE";
export type UserRole = "STUDENT" | "SPACE_MOD" | "CAMPUS_ADMIN" | "SUPERADMIN";
export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type OwlRank = "SLEEPY_SPARROW" | "FLEDGLING" | "NIGHT_OWL" | "MOON_MOTH" | "COMET";
export type PostType = "TEXT" | "IMAGE" | "POLL" | "LINK" | "ASK";
export type ThreadType = "DM" | "DEN" | "SIGNAL" | "NEST";
export type MemberState = "REQUESTED" | "ACTIVE" | "LEFT" | "REMOVED";
export type MessageKind = "TEXT" | "IMAGE" | "VOICE" | "SYSTEM";
export type Sticker = "COOKIE" | "SPARKLE" | "SOB" | "FIRE" | "HEART_HANDS";
export type NoteKind = "NOTES" | "PYQ" | "LAB";

export interface Avatar {
  hat: string;
  eyes: string;
  colour: string;
  accessory: string;
}

export interface User {
  id: string;
  campusId: string;
  handle: string;
  displayName: string;
  bio?: string;
  avatar: Avatar;
  photoUrl?: string;
  batch?: string;
  branch?: string;
  year?: number;
  role: UserRole;
  status: UserStatus;
  isPrivate: boolean;
  onboardingStep: OnboardingStep;
  followerCount: number;
  followingCount: number;
  stardust: number;
  owlRank: OwlRank;
  owlRankLabel: string;
  loveFinderEnabled: boolean;
  photoVerified: boolean;
  /** ISO timestamp premium access runs until, or null — present on your own
   * account only (like email/isAdult below), never on anyone else's: whether
   * a stranger paid for premium isn't visible to other users. Checked against
   * "now" by the caller — this is a snapshot from the last fetch, not
   * something to treat as live. A redeemed code sets this far in the future
   * rather than needing its own separate "is this a redeem or a paid plan"
   * flag. */
  premiumUntil?: string | null;
  email?: string;
  isAdult?: boolean;
  lastSeenAt?: string;
  createdAt: string;
  viewerFollows: boolean;
  followsViewer: boolean;
  isBuddy: boolean;
}

export interface MeResponse {
  user: User;
  onboardingStep: OnboardingStep;
  followingCount: number;
  followsRemaining: number;
  loveFinderAvailable: boolean;
  loveFinderReason?: string;
  campusVerifiedUsers: number;
}

// ------------------------------------------------------------------- auth ----

export interface OtpRequestResult {
  email: string;
  existing: boolean;
  expiresIn: number;
  /** Only present when the API runs with MAILER=log outside production. */
  devCode?: string;
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  onboardingStep: OnboardingStep;
}

export interface AvatarOptions {
  hat: string[];
  eyes: string[];
  colour: string[];
  accessory: string[];
}

export interface SuggestionsResponse {
  items: User[];
  minFollows: number;
}

export interface FollowResult {
  following: boolean;
  followerCount: number;
  onboardingStep: OnboardingStep;
  followsRemaining: number;
  isBuddy: boolean;
}

// ------------------------------------------------------------------- nest ----

export interface Space {
  id: string;
  campusId?: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  isDefault: boolean;
  postCount?: number;
}

export interface StickerCount {
  sticker: Sticker;
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  options: PollOption[];
  totalVotes: number;
  /** Option id the viewer picked, or undefined if they haven't voted. */
  viewerChoice?: string;
  closesAt?: string;
}

export interface Post {
  id: string;
  space: Space;
  author: User;
  type: PostType;
  title?: string;
  body?: string;
  imageUrl?: string;
  linkUrl?: string;
  poll?: Poll;
  score: number;
  commentCount: number;
  isPinned: boolean;
  isLocked: boolean;
  isRemoved: boolean;
  viewerVote: number;
  viewerBookmarked: boolean;
  stickers: StickerCount[];
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  parentId?: string;
  author: User;
  body: string;
  depth: number;
  score: number;
  viewerVote: number;
  isRemoved: boolean;
  createdAt: string;
  children?: Comment[];
}

export interface VoteResult {
  score: number;
  viewerVote: number;
}

export interface ReactResult {
  added: boolean;
  stickers: StickerCount[];
}

export interface Helpline {
  name: string;
  number: string;
  description: string;
  hours: string;
}

/** Shown verbatim. Safety copy is never rewritten in the client (PRD 10). */
export interface SupportCard {
  title: string;
  body: string;
  helplines: Helpline[];
}

export interface OwlGrant {
  points: number;
  sessionPoints: number;
  weekPoints: number;
  reason: string;
  nightOpen: boolean;
  cozyMode: boolean;
  minutesToCurfew: number;
  owlRank: OwlRank;
  owlRankLabel: string;
}

export interface PostResult {
  post: Post;
  supportCard?: SupportCard;
  owlPoints?: OwlGrant;
}

export interface CommentResult {
  comment: Comment;
  supportCard?: SupportCard;
  owlPoints?: OwlGrant;
}

// ------------------------------------------------------------------ chats ----

export interface Thread {
  id: string;
  type: ThreadType;
  title?: string;
  icon?: string;
  members?: User[];
  memberCount: number;
  lastMessage?: Message;
  lastMessageAt?: string;
  unreadCount: number;
  viewerState: MemberState;
  muted: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  sender: User;
  kind: MessageKind;
  body?: string;
  mediaUrl?: string;
  replyToId?: string;
  clientId?: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  reactions?: StickerCount[];
}

export interface SendResult {
  message: Message;
  supportCard?: SupportCard;
  owlPoints?: OwlGrant;
}

// -------------------------------------------------------------- owl board ----

export interface OwlEntry {
  rank: number;
  user: User;
  points: number;
  owlRank: OwlRank;
  owlRankLabel: string;
  isViewer: boolean;
}

export interface OwlBoard {
  scope: string;
  weekKey: string;
  entries: OwlEntry[];
  viewerRank: number;
  viewerPoints: number;
  cozyMode: boolean;
  nightOpen: boolean;
  resetsAt: string;
}

export interface HeartbeatStatus {
  nightOpen: boolean;
  cozyMode: boolean;
  nightKey: string;
  opensAt: string;
  curfewAt: string;
  minutesToCurfew: number;
  sessionPoints: number;
  sessionActions: number;
  actionsToCount: number;
  weekPoints: number;
  rank: number;
  owlRank: OwlRank;
  owlRankLabel: string;
  /** The honest line the UI shows. After curfew it says go to bed. */
  message: string;
}

export interface CocoonResult {
  awarded: boolean;
  sleepHours: number;
  stardust: number;
  balance: number;
  message: string;
}

// ------------------------------------------------------------ note locker ----

export interface Note {
  id: string;
  uploader: User;
  subject: string;
  semester: number;
  branch?: string;
  kind: string;
  title: string;
  fileUrl: string;
  fileSize?: number;
  score: number;
  downloads: number;
  viewerVote: number;
  createdAt: string;
}

export interface UploadResult {
  noteId: string;
  stardust: number;
  balance: number;
}

// ----------------------------------------------------------------- shared ----

// ---------------------------------------------------------- notifications ----

export type NotificationType =
  | "FOLLOW"
  | "COMMENT"
  | "REPLY"
  | "VOTE"
  | "MENTION"
  | "MATCH"
  | "OWL"
  | "NOTE";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor?: User;
  title: string;
  body?: string;
  /** In-app route this notification points at. */
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unread: number;
}

export interface BookmarkResult {
  bookmarked: boolean;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface Items<T> {
  items: T[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    friendly?: string;
  };
}

// --------------------------------------------------------------- realtime ----

export type EventType =
  | "message.new"
  | "message.deleted"
  | "typing"
  | "read"
  | "thread.request"
  | "post.new"
  | "post.score"
  | "reaction"
  | "comment.new"
  | "follow"
  | "owl.points"
  | "owl.curfew"
  | "owl.cocoon"
  | "presence"
  | "error"
  | "pong";

export interface LiveEvent<T = unknown> {
  type: EventType;
  channel: string;
  at: string;
  payload?: T;
}

export interface TypingPayload {
  threadId: string;
  userId: string;
  handle: string;
  typing: boolean;
}

// -------------------------------------------------------------- love finder --
// These mirror api/internal/domain's Love Finder types exactly — the deck,
// swipes, likes and matches are all real rows in Postgres (swipes,
// matches, dating_profiles), not client state.

export interface DatingPrompt {
  question: string;
  answer: string;
}

/** The card someone writes for the deck, separate from their User profile. */
export interface DatingProfile {
  vibe: string;
  interests: string[];
  prompts: DatingPrompt[];
  /** 2–4 photos, most-recent-selected first. Empty on an account that opted
   * into Love Finder before this field existed — the card falls back to the
   * gradient identity rather than an empty gallery. */
  photos: string[];
}

/** A deck entry: a full user plus whatever they wrote on their card. The API
 * embeds one in the other, so a candidate is a User everywhere a User works. */
export type DatingCandidate = User & DatingProfile;

export type SwipeAction = "PASS" | "LIKE" | "TWINKLE";

/** What exactly was liked. Hinge's whole shape: you don't like a person, you
 * like the photo or one specific answer, and that is what they see first. */
export interface LikeTarget {
  kind: "PHOTO" | "PROMPT";
  /** Only set when kind is PROMPT: which of their answers, by position. */
  promptIndex?: number;
}

export interface DatingLike {
  id: string;
  candidate: DatingCandidate;
  action: SwipeAction;
  target: LikeTarget;
  /** The optional comment sent with the like. */
  note?: string;
  createdAt: string;
}

export interface DatingMatch {
  handle: string;
  candidate: DatingCandidate;
  /** The NEST thread this match opened — where "say hi" posts to. */
  threadId: string;
  createdAt: string;
  /** Absent once someone has spoken: a live match no longer wilts. */
  wiltsAt?: string;
  /** The first message in the thread, if there is one. */
  opener?: string;
}

/** GET /v1/dating/deck — the cards plus the state the deck's UI needs. */
export interface DeckResponse {
  items: DatingCandidate[];
  twinklesLeft: number;
}

/** POST /v1/dating/swipe */
export interface SwipeRequest {
  handle: string;
  action: SwipeAction;
  target?: LikeTarget;
  note?: string;
}

export interface SwipeResult {
  matched: boolean;
  match?: DatingMatch;
  twinklesLeft: number;
}
