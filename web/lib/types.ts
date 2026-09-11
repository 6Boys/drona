// Mirrors api/internal/domain/domain.go. Keep the two in step — this is the
// wire contract between the Go API and the web client.

export type OnboardingStep = "HANDLE" | "PROFILE" | "AVATAR" | "FOLLOWS" | "DONE";
export type UserRole = "STUDENT" | "SPACE_MOD" | "CAMPUS_ADMIN" | "SUPERADMIN";
export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type OwlRank = "SLEEPY_SPARROW" | "FLEDGLING" | "NIGHT_OWL" | "MOON_MOTH" | "COMET";
export type PostType = "TEXT" | "IMAGE" | "POLL" | "LINK" | "ASK";
export type ThreadType = "DM" | "DEN" | "SIGNAL" | "NEST";
export type MemberState = "REQUESTED" | "ACTIVE" | "LEFT" | "REMOVED";
export type MessageKind = "TEXT" | "IMAGE" | "VOICE" | "SYSTEM";
export type Sticker = "COOKIE" | "SPARKLE" | "SOB" | "FIRE" | "HEART_HANDS";

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

export interface Post {
  id: string;
  space: Space;
  author: User;
  type: PostType;
  title?: string;
  body?: string;
  imageUrl?: string;
  linkUrl?: string;
  score: number;
  commentCount: number;
  isPinned: boolean;
  isLocked: boolean;
  isRemoved: boolean;
  viewerVote: number;
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

export interface Page<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    friendly?: string;
  };
}

// -------------------------------------------------------------- Love Finder --
// The swipe deck itself has no backend endpoint yet (see STATUS.md) — these
// shapes describe the UI-only mock data in lib/mock-dating.ts, kept in the
// same shape the real API will eventually return so wiring it up later is a
// drop-in swap rather than a rewrite.

export interface DatingPrompt {
  question: string;
  answer: string;
}

export interface DatingCandidate {
  id: string;
  handle: string;
  displayName: string;
  year: number;
  branch: string;
  batch: string;
  photoUrl: string;
  interests: string[];
  prompt: DatingPrompt;
  distanceNote: string; // "Same campus" — PRD 6.3 has no distance filter
}

export type SwipeAction = "PASS" | "LIKE" | "TWINKLE";
