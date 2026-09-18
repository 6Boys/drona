// DronaSphere mock API — framework-agnostic core.
//
// This is the same dependency-free stand-in for the Go service described in
// tools/mock-api/server.mjs, split so it can run two ways from one source of
// truth:
//
//   1. As a standalone Node HTTP(+WebSocket) server for local dev — started
//      by tools/mock-api/server.mjs, which imports `dispatch` and
//      `handleUpgrade` from here and wires them into node:http.
//   2. As Next.js Route Handlers (app/v1/[...slug]/route.js) for a plain
//      Vercel deploy — those handlers adapt a Web-standard Request into the
//      same `dispatch(req, res)` shape and return a Response from the result.
//      No separate backend host or CORS config needed: the API ships inside
//      the same deployment as the frontend, at the same origin.
//
// Realtime (`/v1/ws`) only exists in the standalone server — Vercel's
// serverless functions cannot hold a persistent socket upgrade open. Every
// other route works identically in both. `lib/ws.ts` already degrades to
// "no live updates" without crashing when the socket can't connect, so this
// costs nothing but the live badges when deployed to Vercel as-is.
//
// State lives in memory and dies with the process either way: this is NOT the
// product's real backend, and each cold serverless invocation isn't even
// guaranteed to share memory with the last one. It exists so the frontend can
// be built, demoed and reviewed without Postgres, Redis or Docker.
//
// Any 6-digit code verifies. Sign in as any seeded handle's email
// (e.g. aniket@dronacharya.info) or a new address to walk onboarding.

import { createHash } from "node:crypto";

const PORT = Number(process.env.MOCK_API_PORT ?? 8080);
const CAMPUS_ID = "campus-dce";
const MIN_FOLLOWS = 8;

const now = () => new Date();
const iso = (d = now()) => d.toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const id = (prefix, n) => `${prefix}-${String(n).padStart(4, "0")}`;

// ---------------------------------------------------------------- seed ------

const PEOPLE = [
  ["dronu", "Dronu", "CSE", 2, "2024-28", "COMET", "CAMPUS_ADMIN", "your resident owl. i live here 🦉", { hat: "beanie", eyes: "sparkle", colour: "ube", accessory: "scarf" }],
  ["aniket", "Aniket Rathour", "CSE", 3, "2023-27", "MOON_MOTH", "SUPERADMIN", "building this thing. say hi.", { hat: "headphones", eyes: "sparkle", colour: "mint", accessory: "glasses" }],
  ["meher", "Meher Kaur", "ECE", 2, "2024-28", "NIGHT_OWL", "STUDENT", "ece // sings in the stairwell", { hat: "flower", eyes: "wink", colour: "peach", accessory: "none" }],
  ["rishab", "Rishab Jain", "CSE", 4, "2022-26", "MOON_MOTH", "SPACE_MOD", "placements gyaan, ask me anything", { hat: "grad-cap", eyes: "sparkle", colour: "mint", accessory: "none" }],
  ["tanya", "Tanya Bose", "IT", 2, "2024-28", "FLEDGLING", "STUDENT", "sem 3 survivor 🫠", { hat: "none", eyes: "wide", colour: "butter", accessory: "earbuds" }],
  ["kabir", "Kabir Sethi", "ME", 3, "2023-27", "NIGHT_OWL", "STUDENT", "workshop till 2am", { hat: "bandana", eyes: "sleepy", colour: "butter", accessory: "scarf" }],
  ["ira", "Ira Menon", "CSE", 3, "2023-27", "SLEEPY_SPARROW", "STUDENT", "8 hours of sleep gang. cocoon bonus enjoyer", { hat: "beanie", eyes: "closed", colour: "ube", accessory: "bowtie" }],
  ["devansh", "Devansh Rao", "ECE", 4, "2022-26", "NIGHT_OWL", "STUDENT", "robotics club", { hat: "grad-cap", eyes: "sparkle", colour: "cocoa", accessory: "earbuds" }],
  ["zoya", "Zoya Ahmed", "CSE", 2, "2024-28", "FLEDGLING", "STUDENT", "notes hoarder, will share", { hat: "headphones", eyes: "wide", colour: "mint", accessory: "glasses" }],
  ["arnav", "Arnav Gupta", "IT", 3, "2023-27", "SLEEPY_SPARROW", "STUDENT", "lurker. do not perceive me", { hat: "none", eyes: "sleepy", colour: "cream", accessory: "none" }],
  ["codingclub", "Coding Club DCE", "CSE", 3, "2023-27", "NIGHT_OWL", "SPACE_MOD", "official coding club 💻 weekly contests", { hat: "grad-cap", eyes: "sparkle", colour: "ube", accessory: "bowtie" }],
  ["lostfound", "Lost & Found DCE", "CSE", 2, "2024-28", "SLEEPY_SPARROW", "SPACE_MOD", "lost your id card again? post here.", { hat: "none", eyes: "wide", colour: "peach", accessory: "none" }],
];

const RANK_LABELS = {
  SLEEPY_SPARROW: "Starter",
  FLEDGLING: "Fledgling",
  NIGHT_OWL: "Night Owl",
  MOON_MOTH: "Moon Moth",
  COMET: "Comet",
};

const users = new Map();
PEOPLE.forEach(([handle, displayName, branch, year, batch, owlRank, role, bio, avatar], i) => {
  const uid = id("usr", i + 1);
  users.set(uid, {
    id: uid,
    campusId: CAMPUS_ID,
    handle,
    displayName,
    bio,
    avatar,
    batch,
    branch,
    year,
    role,
    status: "ACTIVE",
    isPrivate: false,
    onboardingStep: "DONE",
    stardust: 400 + i * 137,
    owlRank,
    owlRankLabel: RANK_LABELS[owlRank],
    loveFinderEnabled: i % 3 === 0,
    photoVerified: i % 4 === 0,
    email: `${handle}@dronacharya.info`,
    createdAt: hoursAgo(2000 - i * 40),
    weekPoints: [980, 860, 790, 640, 610, 520, 40, 480, 300, 120, 410, 90][i] ?? 100,
  });
});

const byHandle = (handle) => [...users.values()].find((u) => u.handle === handle.toLowerCase());

// follows: Set of "follower>target"
const follows = new Set();
// blocks: Set of "blocker>blocked"
const blocks = new Set();
const uid = (n) => id("usr", n);
[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((n) => {
  follows.add(`${uid(1)}>${uid(n)}`);
  follows.add(`${uid(n)}>${uid(1)}`);
  if (n % 2 === 0) follows.add(`${uid(2)}>${uid(n)}`);
  if (n % 3 === 0) follows.add(`${uid(n)}>${uid(2)}`);
});

const SPACES = [
  ["placements", "Placements", "💼", "CTCs, interview experiences, off-campus links. No fake offers.", true],
  ["hostel-food", "Hostel Food", "🍜", "Today's mess menu, reviewed brutally.", true],
  ["cse-sem3", "CSE Sem 3", "📚", "DSA, DBMS, COA. Doubts welcome, no gatekeeping.", true],
  ["memes", "Memes", "😹", "The only space with no rules except don't punch down.", true],
  ["lost-found", "Lost & Found", "🔍", "ID cards, water bottles, dignity.", true],
  ["clubs", "Clubs", "🎪", "Auditions, events, practice sessions.", false],
  ["night-shift", "Night Shift", "🌙", "For the 2 AM crowd. Say what you're working on.", true],
].map(([slug, name, icon, description, isDefault], i) => ({
  id: id("spc", i + 1),
  campusId: CAMPUS_ID,
  slug,
  name,
  icon,
  description,
  isDefault,
}));

const spaceBySlug = (slug) => SPACES.find((s) => s.slug === slug);

const STICKERS = ["COOKIE", "SPARKLE", "SOB", "FIRE", "HEART_HANDS"];
const EMOJI = { COOKIE: "🍪", SPARKLE: "✨", SOB: "😭", FIRE: "🔥", HEART_HANDS: "🫶" };

let postSeq = 0;
const posts = new Map();
const comments = new Map(); // postId -> Comment[]

function makePost({ space, author, type, title, body, score, hours, linkUrl, poll, commentBodies = [] }) {
  const pid = id("pst", ++postSeq);
  posts.set(pid, {
    id: pid,
    space: spaceBySlug(space),
    authorId: author,
    type,
    title,
    body,
    linkUrl,
    poll: poll
      ? {
          options: poll.map((o, i) => ({ id: `opt-${i + 1}`, label: o.label, seed: o.seed })),
          ballots: new Map(),
        }
      : undefined,
    score,
    isPinned: false,
    isLocked: false,
    isRemoved: false,
    votes: new Map(),
    reactions: new Map(STICKERS.map((s) => [s, new Set()])),
    createdAt: hoursAgo(hours),
  });

  // A couple of seeded reactions so the sticker bar isn't empty on first load.
  const seeded = [["FIRE", 14], ["HEART_HANDS", 6], ["SOB", 21], ["COOKIE", 9]];
  seeded.forEach(([sticker, count], i) => {
    if ((postSeq + i) % 3 === 0) {
      const set = posts.get(pid).reactions.get(sticker);
      for (let n = 0; n < count; n++) set.add(`ghost-${n}`);
    }
  });

  comments.set(
    pid,
    commentBodies.map((text, i) => ({
      id: id(`cmt${postSeq}`, i + 1),
      postId: pid,
      author: uid(((postSeq + i) % 11) + 2),
      body: text,
      depth: 0,
      score: 3 + i * 2,
      votes: new Map(),
      isRemoved: false,
      createdAt: hoursAgo(hours - 1),
      children: [],
    })),
  );
}

[
  { space: "placements", author: uid(4), type: "TEXT", score: 47, hours: 5, title: "Wrote my Deloitte interview experience — 3 rounds, full questions inside", body: "Round 1 was aptitude + 2 coding (both easy DSA — sliding window, one string thing).\nRound 2 was tech: DBMS normalisation, one SQL join query, projects grilled hard. Know your own resume.\nRound 3 HR: relocation, bond, why Deloitte. 25 mins.\nAsk me anything below, I'll answer till midnight.", commentBodies: ["did they ask DP?", "how many got shortlisted from our branch?", "bro thank you, saving this"] },
  { space: "hostel-food", author: uid(5), type: "TEXT", score: 88, hours: 2, title: "mess gave us paneer today and I need everyone to know", body: "actual paneer. cubes and everything. i am emotional", commentBodies: ["it was rubber but i'll allow it", "the rajma yesterday was a war crime though"] },
  { space: "cse-sem3", author: uid(9), type: "ASK", score: 31, hours: 8, title: "Can someone explain why we normalise to 3NF but stop there?", body: "Sir said BCNF exists but 3NF is 'enough in practice' and moved on. Enough for what?? Exam is Tuesday.", commentBodies: ["3NF keeps dependency preservation, BCNF can lose it. that's the actual answer", "for the exam: just know the definitions + one example each"] },
  { space: "night-shift", author: uid(6), type: "TEXT", score: 64, hours: 26, title: "2:14 AM. workshop assignment. who else is up", body: "third coffee. the lathe drawing is fighting back.", commentBodies: ["up. debugging a segfault that only happens on tuesdays", "logging off at 3, curfew hits and dronu starts yawning at me"] },
  { space: "memes", author: uid(3), type: "TEXT", score: 156, hours: 12, title: "the library at 8:59 AM vs 9:01 AM", body: "you know exactly what I mean", commentBodies: ["accurate and i hate it"] },
  { space: "lost-found", author: uid(12), type: "TEXT", score: 22, hours: 3, title: "FOUND: blue water bottle, CSE block stairs, has a bhagavad gita sticker", body: "It's with the guard at gate 2. Come get it before it becomes mine.", commentBodies: ["MINE. omw"] },
  { space: "clubs", author: uid(11), type: "TEXT", score: 41, hours: 20, title: "Weekly contest Sat 7 PM — 4 problems, beginners bracket separate", body: "Two brackets so first-years aren't fighting final-years. Top 3 in each get Sparks + a frame.", commentBodies: ["is it rated 🤡", "beginner bracket is such a good idea actually"] },
  { space: "placements", author: uid(8), type: "LINK", score: 73, hours: 30, title: "Off-campus drive: Zoho hiring 2026 batch, apply by Friday", body: "", linkUrl: "https://careers.zohocorp.com", commentBodies: ["applied, thanks", "does anyone know if they take ECE"] },
  { space: "cse-sem3", author: uid(5), type: "POLL", score: 19, hours: 6, title: "COA mid-sem: how cooked are we", body: "Be honest. The pipelining unit alone.", poll: [
    { label: "Fully prepared, bring it on", seed: 4 },
    { label: "Halfway there", seed: 17 },
    { label: "Started yesterday", seed: 31 },
    { label: "Cooked beyond recovery", seed: 58 },
  ], commentBodies: [] },
  { space: "night-shift", author: uid(7), type: "TEXT", score: 203, hours: 40, title: "PSA from someone who tried to top the Owl Board for a week", body: "I did. I also got sick and missed two labs. The Cocoon Bonus is worth more than a whole night of grinding and I wish someone had just told me that on day one, so: told you.", commentBodies: ["needed this", "cocoon gang 🛏️", "the app literally tells you to sleep and we ignore it"] },
].forEach(makePost);

const NOTES = [
  ["DBMS", 3, "PYQ", "DBMS mid-sem 2025 (with solutions)", 41, 9, 210],
  ["DBMS", 3, "NOTES", "Normalisation — 1NF to BCNF, one page", 67, 9, 388],
  ["Data Structures", 3, "PYQ", "DSA end-sem 2024 + 2025", 88, 5, 512],
  ["COA", 3, "NOTES", "Pipelining hazards, actually readable", 34, 3, 141],
  ["Discrete Maths", 3, "PYQ", "DM end-sem 2023-2025 bundle", 52, 10, 233],
  ["Signals & Systems", 4, "NOTES", "Fourier cheat sheet", 29, 8, 96],
  ["Thermodynamics", 3, "LAB", "Lab manual + readings template", 18, 6, 58],
  ["OS", 5, "PYQ", "OS mid-sem 2025, all sections", 44, 4, 173],
].map(([subject, semester, kind, title, score, uploader, downloads], i) => ({
  id: id("nte", i + 1),
  uploaderId: uid(uploader),
  subject,
  semester,
  kind,
  title,
  branch: "CSE",
  fileUrl: "https://example.com/notes.pdf",
  fileSize: 240_000 + i * 40_000,
  score,
  downloads,
  votes: new Map(),
  createdAt: hoursAgo(40 + i * 11),
}));

let threadSeq = 0;
const threads = new Map();
const messages = new Map(); // threadId -> Message[]

function makeThread({ type, title, icon, memberIds, createdBy, msgs }) {
  const tid = id("thr", ++threadSeq);
  threads.set(tid, {
    id: tid,
    type,
    title,
    icon,
    memberIds,
    createdById: createdBy,
    createdAt: hoursAgo(80),
    reads: new Map(),
    requested: new Set(),
  });
  messages.set(
    tid,
    msgs.map(([senderN, body, hours], i) => ({
      id: id(`msg${threadSeq}`, i + 1),
      threadId: tid,
      senderId: uid(senderN),
      kind: "TEXT",
      body,
      createdAt: hoursAgo(hours),
    })),
  );
}

makeThread({
  type: "DM",
  memberIds: [uid(2), uid(3)],
  createdBy: uid(3),
  msgs: [
    [3, "are you up rn 👀", 3],
    [2, "unfortunately", 2.9],
    [3, "the dbms slides are wrong on slide 14 btw", 2.8],
    [2, "…they are. sending a correction to the group", 2.7],
  ],
});

makeThread({
  type: "DEN",
  title: "CSE Sem 3 — the good one",
  icon: "📚",
  memberIds: [uid(2), uid(5), uid(9), uid(3), uid(10)],
  createdBy: uid(9),
  msgs: [
    [9, "uploaded the normalisation notes to the locker", 2.2],
    [5, "you are carrying this entire semester", 2.1],
    [10, "🙏", 2.05],
  ],
});

makeThread({
  type: "SIGNAL",
  title: "Coding Club DCE",
  icon: "💻",
  memberIds: [uid(11), uid(2), uid(5), uid(9)],
  createdBy: uid(11),
  msgs: [[11, "Contest Saturday 7 PM. Beginners bracket is separate this time.", 20]],
});

// Per-user bookmark sets and notification inboxes.
const bookmarks = new Map(); // userId -> Set<postId>
const notifications = new Map(); // userId -> Notification[]

let notificationSeq = 0;

function notify(userId, { type, actorId, title, body, href }) {
  if (!userId) return;
  const list = notifications.get(userId) ?? [];
  list.unshift({
    id: id("ntf", ++notificationSeq),
    type,
    actorId,
    title,
    body,
    href,
    read: false,
    createdAt: iso(),
  });
  notifications.set(userId, list.slice(0, 60));
}

function publicNotification(n, viewerId) {
  return {
    id: n.id,
    type: n.type,
    actor: n.actorId ? publicUser(users.get(n.actorId), viewerId) : undefined,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.read,
    createdAt: n.createdAt,
  };
}

// A starter inbox for every seeded account, so notifications aren't empty on
// first sign-in. Real events append on top of these.
for (const user of users.values()) {
  if (user.onboardingStep !== "DONE") continue;
  notify(user.id, {
    type: "OWL",
    title: "You moved up 6 places on the Owl Board",
    body: "Campus rank is recalculated every night at the curfew.",
    href: "/owl-board",
  });
  notify(user.id, {
    type: "NOTE",
    actorId: uid(9),
    title: "Zoya Ahmed uploaded notes for DBMS",
    body: "Normalisation — 1NF to BCNF, one page",
    href: "/notes",
  });
  notify(user.id, {
    type: "COMMENT",
    actorId: uid(4),
    title: "Rishab Jain replied in #placements",
    body: "did they ask DP?",
    href: "/posts/pst-0001",
  });
}

// ------------------------------------------------------------- sessions -----

const sessions = new Map(); // token -> userId
let guestSeq = 0;

function tokenFor(userId) {
  const token = `mock.${userId}.${Math.random().toString(36).slice(2, 10)}`;
  sessions.set(token, userId);
  return token;
}

// --------------------------------------------------------------- shaping ----

function relationship(viewerId, user) {
  const viewerFollows = follows.has(`${viewerId}>${user.id}`);
  const followsViewer = follows.has(`${user.id}>${viewerId}`);
  return { viewerFollows, followsViewer, isBuddy: viewerFollows && followsViewer };
}

function publicUser(user, viewerId, self = false) {
  const rel = relationship(viewerId, user);
  return {
    id: user.id,
    campusId: user.campusId,
    handle: user.handle,
    displayName: user.displayName,
    bio: user.bio,
    avatar: user.avatar,
    batch: user.batch,
    branch: user.branch,
    year: user.year,
    role: user.role,
    status: user.status,
    isPrivate: user.isPrivate,
    onboardingStep: user.onboardingStep,
    followerCount: [...follows].filter((f) => f.endsWith(`>${user.id}`)).length,
    followingCount: [...follows].filter((f) => f.startsWith(`${user.id}>`)).length,
    stardust: user.stardust,
    owlRank: user.owlRank,
    owlRankLabel: user.owlRankLabel,
    loveFinderEnabled: user.loveFinderEnabled,
    photoVerified: user.photoVerified,
    ...(self ? { email: user.email, isAdult: true } : {}),
    createdAt: user.createdAt,
    ...rel,
  };
}

function meResponse(user) {
  const followingCount = [...follows].filter((f) => f.startsWith(`${user.id}>`)).length;
  const verified = users.size;
  return {
    user: publicUser(user, user.id, true),
    onboardingStep: user.onboardingStep,
    followingCount,
    followsRemaining: Math.max(0, MIN_FOLLOWS - followingCount),
    // PRD 6.3 gates this behind 400 verified campus users + photo verification.
    // The mock's campus never gets near that, so it's left open here — the
    // frontend gate itself (and the real API's rule) are unchanged.
    loveFinderAvailable: true,
    campusVerifiedUsers: verified,
  };
}

function stickerCounts(post, viewerId) {
  return STICKERS.map((sticker) => ({
    sticker,
    emoji: EMOJI[sticker],
    count: post.reactions.get(sticker).size,
    reacted: post.reactions.get(sticker).has(viewerId),
  }));
}

function publicPost(post, viewerId) {
  return {
    id: post.id,
    space: post.space,
    author: publicUser(users.get(post.authorId), viewerId),
    type: post.type,
    title: post.title,
    body: post.body,
    imageUrl: post.imageUrl,
    linkUrl: post.linkUrl,
    poll: publicPoll(post, viewerId),
    score: post.score + [...post.votes.values()].reduce((a, b) => a + b, 0),
    commentCount: (comments.get(post.id) ?? []).reduce((n, c) => n + 1 + (c.children?.length ?? 0), 0),
    isPinned: post.isPinned,
    isLocked: post.isLocked,
    isRemoved: post.isRemoved,
    viewerVote: post.votes.get(viewerId) ?? 0,
    viewerBookmarked: bookmarks.get(viewerId)?.has(post.id) ?? false,
    stickers: stickerCounts(post, viewerId),
    createdAt: post.createdAt,
  };
}

// Poll counts are derived from the per-user ballot map, so a viewer switching
// their answer can never double-count.
function publicPoll(post, viewerId) {
  if (!post.poll) return undefined;
  const ballots = [...post.poll.ballots.values()];
  return {
    options: post.poll.options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: o.seed + ballots.filter((choice) => choice === o.id).length,
    })),
    totalVotes:
      post.poll.options.reduce((n, o) => n + o.seed, 0) + post.poll.ballots.size,
    viewerChoice: post.poll.ballots.get(viewerId),
  };
}

function publicComment(comment, viewerId) {
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    author: publicUser(users.get(comment.author) ?? users.get(uid(1)), viewerId),
    body: comment.body,
    depth: comment.depth,
    score: comment.score + [...comment.votes.values()].reduce((a, b) => a + b, 0),
    viewerVote: comment.votes.get(viewerId) ?? 0,
    isRemoved: comment.isRemoved,
    createdAt: comment.createdAt,
    children: (comment.children ?? []).map((c) => publicComment(c, viewerId)),
  };
}

function publicMessage(message, viewerId) {
  return {
    id: message.id,
    threadId: message.threadId,
    sender: publicUser(users.get(message.senderId), viewerId),
    kind: message.kind,
    body: message.body,
    clientId: message.clientId,
    createdAt: message.createdAt,
  };
}

function publicThread(thread, viewerId) {
  const list = messages.get(thread.id) ?? [];
  const last = list.at(-1);
  const readAt = thread.reads.get(viewerId) ?? 0;
  return {
    id: thread.id,
    type: thread.type,
    title: thread.title,
    icon: thread.icon,
    members: thread.memberIds.map((m) => publicUser(users.get(m), viewerId)),
    memberCount: thread.memberIds.length,
    lastMessage: last ? publicMessage(last, viewerId) : undefined,
    lastMessageAt: last?.createdAt,
    unreadCount: list.filter((m) => m.senderId !== viewerId && new Date(m.createdAt).getTime() > readAt).length,
    viewerState: thread.requested.has(viewerId) ? "REQUESTED" : "ACTIVE",
    muted: false,
    createdAt: thread.createdAt,
  };
}

function publicNote(note, viewerId) {
  return {
    id: note.id,
    uploader: publicUser(users.get(note.uploaderId), viewerId),
    subject: note.subject,
    semester: note.semester,
    branch: note.branch,
    kind: note.kind,
    title: note.title,
    fileUrl: note.fileUrl,
    fileSize: note.fileSize,
    score: note.score + [...note.votes.values()].reduce((a, b) => a + b, 0),
    downloads: note.downloads,
    viewerVote: note.votes.get(viewerId) ?? 0,
    createdAt: note.createdAt,
  };
}

// ------------------------------------------------------------------ owl -----

const NIGHT_START = 22;
const CURFEW = 3;

function nightState() {
  const hour = now().getHours();
  const nightOpen = hour >= NIGHT_START || hour < CURFEW;
  const cozy = hour >= CURFEW && hour < 6;
  let minutesToCurfew = 0;
  if (nightOpen) {
    const curfew = new Date();
    curfew.setHours(CURFEW, 0, 0, 0);
    if (hour >= NIGHT_START) curfew.setDate(curfew.getDate() + 1);
    minutesToCurfew = Math.max(0, Math.round((curfew.getTime() - Date.now()) / 60_000));
  }
  return { nightOpen, cozy, minutesToCurfew };
}

function heartbeat(user) {
  const { nightOpen, cozy, minutesToCurfew } = nightState();
  const ranked = [...users.values()].sort((a, b) => b.weekPoints - a.weekPoints);
  const rank = ranked.findIndex((u) => u.id === user.id) + 1;
  return {
    nightOpen,
    cozyMode: cozy,
    nightKey: iso().slice(0, 10),
    opensAt: iso(),
    curfewAt: iso(),
    minutesToCurfew,
    sessionPoints: user.sessionPoints ?? 0,
    sessionActions: user.sessionActions ?? 0,
    actionsToCount: Math.max(0, 3 - (user.sessionActions ?? 0)),
    weekPoints: user.weekPoints,
    rank,
    owlRank: user.owlRank,
    owlRankLabel: user.owlRankLabel,
    message: cozy
      ? "Closed at 3:00 AM. Points resume tomorrow night."
      : nightOpen
        ? "Open now. 3:00 AM is the hard stop."
        : "Opens at 10:00 PM.",
  };
}

/** Which night a moment belongs to. Anything before the 3 AM curfew still
 * counts toward the night that started the previous evening, so a 1 AM post
 * lands on the same bar as the 11 PM one before it. */
function nightKey(at = new Date()) {
  const d = new Date(at);
  if (d.getHours() < 3) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function grant(user, points, reason) {
  const { nightOpen, cozy, minutesToCurfew } = nightState();
  const earned = nightOpen && !cozy ? points : 0;
  user.weekPoints += earned;
  user.sessionPoints = (user.sessionPoints ?? 0) + earned;
  user.sessionActions = (user.sessionActions ?? 0) + 1;
  // Real per-night ledger, so /v1/owl/history can report what was actually
  // earned instead of inventing a plausible-looking week.
  user.nightPoints = user.nightPoints ?? {};
  const key = nightKey();
  user.nightPoints[key] = (user.nightPoints[key] ?? 0) + earned;
  return {
    points: earned,
    sessionPoints: user.sessionPoints,
    weekPoints: user.weekPoints,
    reason,
    nightOpen,
    cozyMode: cozy,
    minutesToCurfew,
    owlRank: user.owlRank,
    owlRankLabel: user.owlRankLabel,
  };
}

const SUPPORT_CARD = {
  title: "Support is available",
  body: "If you are struggling, talking to someone helps. These lines are free and confidential.",
  helplines: [
    { name: "Tele-MANAS", number: "14416", description: "Government of India mental health support line. Free, available in multiple languages.", hours: "24 hours" },
    { name: "iCall", number: "9152987821", description: "Counselling by trained mental health professionals, run by TISS.", hours: "Monday to Saturday, 10am to 8pm" },
  ],
};

const CRISIS = /\b(kill myself|end it all|suicide|self harm|want to die)\b/i;

// --------------------------------------------------------------- routing ----

function send(res, status, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const fail = (res, status, code, message, friendly) =>
  send(res, status, { error: { code, message, friendly } });

// --------------------------------------------------------------- media -----
// Mirrors api/internal/media's policy exactly (5 MiB, image/gif only, real
// bytes sniffed rather than trusting a declared Content-Type) but skips real
// disk storage: this module also runs as a Vercel Route Handler, where the
// filesystem is read-only and not shared across invocations anyway. A data:
// URL is a complete, self-contained answer for a demo — it renders in an
// <img> immediately and needs nowhere to persist to — it's just not a
// permanent link, which is exactly the trade-off "this is a mock" implies.
const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

const MEDIA_SIGNATURES = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF87a / GIF89a share this prefix
];

function sniffImageType(buf) {
  for (const { mime, bytes } of MEDIA_SIGNATURES) {
    if (buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b)) return mime;
  }
  // WEBP: "RIFF"....'WEBP' — the size field in bytes 4-7 varies, so check the
  // two fixed anchors either side of it rather than one contiguous prefix.
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

// A single-file multipart/form-data body is: a boundary line, a small block
// of part headers, a blank line, the raw file bytes, then the closing
// boundary. Good enough for exactly what the upload form sends — one "file"
// field — without pulling in a parsing library for it.
function parseMultipartFile(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) return null;

  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(marker);
  while (cursor !== -1) {
    const next = buffer.indexOf(marker, cursor + marker.length);
    if (next === -1) break;
    parts.push(buffer.subarray(cursor + marker.length, next));
    cursor = next;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString("utf8");
    if (!/name="file"/i.test(headers)) continue;

    // Strip the leading \r\n after the boundary marker and the trailing \r\n
    // before the next boundary.
    let data = part.subarray(headerEnd + 4);
    if (data.subarray(-2).equals(Buffer.from("\r\n"))) data = data.subarray(0, -2);
    return data;
  }
  return null;
}

function page(items, limit, cursorRaw) {
  const start = cursorRaw ? Number(Buffer.from(cursorRaw, "base64url").toString()) || 0 : 0;
  const slice = items.slice(start, start + limit);
  const nextStart = start + limit;
  const hasMore = nextStart < items.length;
  return {
    items: slice,
    hasMore,
    nextCursor: hasMore ? Buffer.from(String(nextStart)).toString("base64url") : undefined,
  };
}

const ROUTES = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const regex = new RegExp(
    "^" +
      pattern.replace(/:[a-zA-Z]+/g, (m) => {
        keys.push(m.slice(1));
        return "([^/]+)";
      }) +
      "$",
  );
  ROUTES.push({ method, regex, keys, handler });
};

// --- auth -------------------------------------------------------------------

route("POST", "/v1/auth/otp/request", (ctx) => {
  const email = String(ctx.body.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) return fail(ctx.res, 422, "VALIDATION", "that email doesn't look right");
  const existing = [...users.values()].some((u) => u.email === email);
  send(ctx.res, 200, { email, existing, expiresIn: 600, devCode: "123456" });
});

// Testing shortcut: any email whose local part contains "admin" (admin@gmail.com,
// testadmin@gmail.com, admin+1@dronacharya.info, ...) walks in fully onboarded
// instead of through handle/profile/avatar/follows. Dev-only — real accounts
// always go through the real flow.
const isTestAdminEmail = (email) => (email.split("@")[0] ?? "").includes("admin");

function uniqueHandle(base) {
  const root = base.replace(/[^a-z0-9]/g, "") || "admin";
  if (!byHandle(root)) return root;
  let n = 2;
  while (byHandle(`${root}${n}`)) n += 1;
  return `${root}${n}`;
}

/** Fills in everything onboarding would have collected and marks the account
 * DONE, so a test admin account lands straight in the app on first sign-in. */
function skipOnboarding(user) {
  if (user.onboardingStep === "DONE") return;

  user.handle = uniqueHandle(user.handle || user.email.split("@")[0] || "admin");
  user.displayName = user.displayName || "Admin";
  user.bio = user.bio || "testing account — onboarding skipped";
  user.batch = user.batch || "2024-28";
  user.branch = user.branch || "CSE";
  user.year = user.year || 2;
  user.role = "CAMPUS_ADMIN";
  user.isPrivate = false;
  user.photoVerified = true;
  user.loveFinderEnabled = true;
  user.onboardingStep = "DONE";

  // Auto-follow enough seeded students that the feed and rails aren't empty.
  const targets = [...users.values()].filter((u) => u.id !== user.id && u.onboardingStep === "DONE");
  for (const target of targets.slice(0, MIN_FOLLOWS)) {
    follows.add(`${user.id}>${target.id}`);
  }
}

route("POST", "/v1/auth/otp/verify", (ctx) => {
  const email = String(ctx.body.email ?? "").trim().toLowerCase();
  const code = String(ctx.body.code ?? "");
  if (!/^\d{6}$/.test(code)) return fail(ctx.res, 401, "BAD_CODE", "that code did not work");

  let user = [...users.values()].find((u) => u.email === email);
  if (!user) {
    const newId = id("usr", 100 + ++guestSeq);
    user = {
      id: newId,
      campusId: CAMPUS_ID,
      handle: "",
      displayName: email.split("@")[0],
      bio: "",
      avatar: { hat: "none", eyes: "sparkle", colour: "ube", accessory: "none" },
      role: "STUDENT",
      status: "ACTIVE",
      isPrivate: false,
      onboardingStep: "HANDLE",
      stardust: 0,
      owlRank: "SLEEPY_SPARROW",
      owlRankLabel: "Starter",
      loveFinderEnabled: false,
      photoVerified: false,
      email,
      createdAt: iso(),
      weekPoints: 0,
    };
    users.set(newId, user);
  }

  if (isTestAdminEmail(email)) skipOnboarding(user);

  send(ctx.res, 200, {
    accessToken: tokenFor(user.id),
    refreshToken: tokenFor(user.id),
    expiresIn: 900,
    user: publicUser(user, user.id, true),
    onboardingStep: user.onboardingStep,
  });
});

route("POST", "/v1/auth/refresh", (ctx) => {
  const userId = sessions.get(ctx.body.refreshToken);
  if (!userId) return fail(ctx.res, 401, "UNAUTHORIZED", "session expired");
  const user = users.get(userId);
  send(ctx.res, 200, {
    accessToken: tokenFor(userId),
    refreshToken: tokenFor(userId),
    expiresIn: 900,
    user: publicUser(user, userId, true),
    onboardingStep: user.onboardingStep,
  });
});

route("POST", "/v1/auth/logout", (ctx) => {
  sessions.delete(ctx.body.refreshToken);
  send(ctx.res, 204);
});

route("POST", "/v1/auth/logout-all", (ctx) => {
  for (const [token, userId] of sessions) if (userId === ctx.user.id) sessions.delete(token);
  send(ctx.res, 204);
});

// --- me ---------------------------------------------------------------------

route("GET", "/v1/me", (ctx) => send(ctx.res, 200, meResponse(ctx.user)));

route("PATCH", "/v1/me", (ctx) => {
  const u = ctx.user;
  const b = ctx.body;

  if (b.handle !== undefined) {
    const handle = String(b.handle).toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      return fail(ctx.res, 422, "VALIDATION", "3–20 characters, lowercase letters, numbers and underscores only");
    }
    if (byHandle(handle) && byHandle(handle).id !== u.id) {
      return fail(ctx.res, 409, "CONFLICT", "that handle is taken", "That one is taken — try another.");
    }
    u.handle = handle;
  }
  if (b.displayName !== undefined) u.displayName = String(b.displayName).trim();
  if (b.bio !== undefined) u.bio = String(b.bio).trim();
  if (b.branch !== undefined) u.branch = b.branch;
  if (b.batch !== undefined) u.batch = b.batch;
  if (b.year !== undefined) u.year = Number(b.year);
  if (b.isPrivate !== undefined) u.isPrivate = !!b.isPrivate;
  if (b.dob !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.dob))) {
    return fail(ctx.res, 422, "VALIDATION", "use YYYY-MM-DD");
  }

  if (u.onboardingStep === "HANDLE" && u.handle) u.onboardingStep = "PROFILE";
  else if (u.onboardingStep === "PROFILE" && b.dob) u.onboardingStep = "AVATAR";

  send(ctx.res, 200, meResponse(u));
});

route("PUT", "/v1/me/avatar", (ctx) => {
  ctx.user.avatar = {
    hat: ctx.body.hat ?? "none",
    eyes: ctx.body.eyes ?? "sparkle",
    colour: ctx.body.colour ?? "ube",
    accessory: ctx.body.accessory ?? "none",
  };
  if (ctx.user.onboardingStep === "AVATAR") ctx.user.onboardingStep = "FOLLOWS";
  send(ctx.res, 200, meResponse(ctx.user));
});

route("POST", "/v1/me/love-finder", (ctx) => {
  ctx.user.loveFinderEnabled = !!ctx.body.enabled;
  send(ctx.res, 200, meResponse(ctx.user));
});

// Mirrors the real API's photo-verification gate (see api/internal/domain's
// CanUseDating) — self-attested here too, not reviewed, same as there.
route("POST", "/v1/me/verify-photo", (ctx) => {
  const photoUrl = String(ctx.body.photoUrl ?? "").trim();
  if (!photoUrl) return fail(ctx.res, 422, "VALIDATION", "photoUrl is required");
  ctx.user.photoUrl = photoUrl;
  ctx.user.photoVerified = true;
  send(ctx.res, 200, meResponse(ctx.user));
});

// See the "media" helpers above (sniffImageType, parseMultipartFile) for what
// this mirrors from api/internal/media, and why it returns a data: URL
// instead of writing to disk.
// --------------------------------------------------------- love finder -----
// Mirrors api/internal/service/dating.go closely enough that the web client
// cannot tell which backend it is talking to: same routes, same shapes, same
// rules about what matches and what a swipe costs. In memory, like the rest
// of this file — it dies with the process.

const datingProfiles = new Map(); // userId -> {vibe, interests, prompts}
const swipes = new Map(); // `${actorId}>${targetId}` -> {action, target, note, at}
const datingMatches = []; // {id, a, b, threadId, createdAt, wiltsAt}

const DAILY_TWINKLES = 1;
const MATCH_WILT_DAYS = 7;

const profileFor = (userId) =>
  datingProfiles.get(userId) ?? { vibe: "", interests: [], prompts: [] };

const candidateOf = (user, viewerId) => ({ ...publicUser(user, viewerId), ...profileFor(user.id) });

const twinklesUsedToday = (userId) => {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  let used = 0;
  for (const [key, swipe] of swipes) {
    if (!key.startsWith(`${userId}>`)) continue;
    if (swipe.action === "TWINKLE" && new Date(swipe.at) >= midnight) used += 1;
  }
  return used;
};

const twinklesLeft = (userId) => Math.max(0, DAILY_TWINKLES - twinklesUsedToday(userId));

// Cards for the seeded students, so the demo deck reads like the real thing
// rather than a row of blank gradients. Written the way second-years write.
const DEMO_CARDS = {
  meher: {
    vibe: "sings in the stairwell, unbothered",
    interests: ["stairwell singing", "thrifting", "bad horror films"],
    prompts: [
      {
        question: "The way to win me over is",
        answer: "argue with me about a song for forty minutes and then send it to me anyway.",
      },
      {
        question: "A shower thought I recently had",
        answer: "the ECE building echoes like a concert hall and I will not be taking questions.",
      },
    ],
  },
  zoya: {
    vibe: "note hoarder, chronically caffeinated",
    interests: ["note hoarding", "kdramas", "chai at 3am"],
    prompts: [
      {
        question: "Two truths and a lie",
        answer: "I have every PYQ since 2019. I've never been to the canteen. I own four identical hoodies.",
      },
      { question: "I'll fall for you if", answer: "you actually return the notes you borrow." },
    ],
  },
  kabir: {
    vibe: "workshop till 2am, chai after",
    interests: ["cycling", "filter coffee", "repair café"],
    prompts: [
      {
        question: "My most useless skill",
        answer: "I can identify any lathe by sound. This has helped me zero times socially.",
      },
      {
        question: "First date, my choice",
        answer: "the canteen at 11pm when it's empty and the chai guy knows both our orders.",
      },
    ],
  },
  ira: {
    vibe: "eight hours of sleep, non-negotiable",
    interests: ["crosswords", "long walks", "gym at 6am"],
    prompts: [
      {
        question: "An unpopular opinion I hold",
        answer: "the Owl Board is a trap and the Cocoon Bonus is the only correct strategy.",
      },
    ],
  },
  devansh: {
    vibe: "robotics club, roof access",
    interests: ["film photography", "biryani rankings", "robotics club"],
    prompts: [
      {
        question: "Best campus discovery",
        answer: "the roof of the ECE block at 6am. don't tell the guard I told you.",
      },
    ],
  },
};

/** Seeded so the demo has a deck to swipe and likes to answer on first load. */
function seedDatingDemo() {
  const viewer = byHandle("aniket");
  if (!viewer) return;

  for (const [handle, card] of Object.entries(DEMO_CARDS)) {
    const person = byHandle(handle);
    if (!person) continue;
    // Everyone with a card is in the deck: opted in and photo-verified, the
    // two things the real API filters candidates on.
    person.loveFinderEnabled = true;
    person.photoVerified = true;
    datingProfiles.set(person.id, card);
  }

  for (const handle of ["meher", "zoya"]) {
    const admirer = byHandle(handle);
    if (!admirer) continue;
    swipes.set(`${admirer.id}>${viewer.id}`, {
      action: handle === "meher" ? "TWINKLE" : "LIKE",
      target: { kind: "PROMPT", promptIndex: 0 },
      note: handle === "meher" ? "the ranked list better be defensible." : "",
      at: hoursAgo(handle === "meher" ? 6 : 30),
    });
  }
}
seedDatingDemo();

route("GET", "/v1/dating/profile", (ctx) => send(ctx.res, 200, profileFor(ctx.user.id)));

route("PUT", "/v1/dating/profile", (ctx) => {
  const profile = {
    vibe: String(ctx.body.vibe ?? "").trim().slice(0, 60),
    interests: (ctx.body.interests ?? []).slice(0, 6).map((i) => String(i).trim()).filter(Boolean),
    prompts: (ctx.body.prompts ?? [])
      .slice(0, 3)
      .map((p) => ({ question: String(p.question ?? "").trim(), answer: String(p.answer ?? "").trim() }))
      .filter((p) => p.question && p.answer),
  };
  datingProfiles.set(ctx.user.id, profile);
  send(ctx.res, 200, profile);
});

route("GET", "/v1/dating/deck", (ctx) => {
  const items = [...users.values()]
    .filter(
      (u) =>
        u.id !== ctx.user.id &&
        u.campusId === ctx.user.campusId &&
        u.onboardingStep === "DONE" &&
        u.loveFinderEnabled &&
        u.photoVerified &&
        // Same rule the real deck applies: nothing written, not in the deck.
        (profileFor(u.id).prompts ?? []).length > 0 &&
        !swipes.has(`${ctx.user.id}>${u.id}`) &&
        // A block hides the deck card in both directions — without this,
        // blocking someone from the deck only removed them until the next
        // reload handed them straight back.
        !blocks.has(`${ctx.user.id}>${u.id}`) &&
        !blocks.has(`${u.id}>${ctx.user.id}`),
    )
    .slice(0, Number(ctx.query.limit ?? 20))
    .map((u) => candidateOf(u, ctx.user.id));

  send(ctx.res, 200, { items, twinklesLeft: twinklesLeft(ctx.user.id) });
});

route("POST", "/v1/dating/swipe", (ctx) => {
  const action = String(ctx.body.action ?? "");
  if (!["PASS", "LIKE", "TWINKLE"].includes(action)) {
    return fail(ctx.res, 422, "VALIDATION", "must be PASS, LIKE or TWINKLE");
  }
  const target = byHandle(String(ctx.body.handle ?? ""));
  if (!target) return fail(ctx.res, 404, "NOT_FOUND", "no account with that handle");
  if (target.id === ctx.user.id) return fail(ctx.res, 400, "BAD_REQUEST", "you cannot swipe on yourself");

  const key = `${ctx.user.id}>${target.id}`;
  if (swipes.has(key)) {
    return fail(ctx.res, 409, "CONFLICT", "you already decided on this person", "you've already seen this one");
  }
  if (action === "TWINKLE" && twinklesLeft(ctx.user.id) <= 0) {
    return fail(ctx.res, 429, "RATE_LIMITED", "no Twinkles left today", "that's today's Twinkle spent ✨");
  }

  swipes.set(key, {
    action,
    target: action === "PASS" ? null : (ctx.body.target ?? { kind: "PHOTO" }),
    note: action === "PASS" ? "" : String(ctx.body.note ?? "").trim(),
    at: iso(),
  });

  const reverse = swipes.get(`${target.id}>${ctx.user.id}`);
  const mutual = action !== "PASS" && reverse && reverse.action !== "PASS";

  let match;
  const alreadyMatched = datingMatches.some(
    (m) =>
      (m.a === ctx.user.id && m.b === target.id) || (m.b === ctx.user.id && m.a === target.id),
  );
  if (mutual && !alreadyMatched) {
    // A match opens a NEST thread — same shape every other thread here has,
    // so it lists, reads and sends through the existing chat routes.
    const tid = id("thr", ++threadSeq);
    const thread = {
      id: tid,
      type: "NEST",
      memberIds: [ctx.user.id, target.id],
      createdById: ctx.user.id,
      createdAt: iso(),
      reads: new Map(),
      requested: new Set(),
    };
    threads.set(tid, thread);
    messages.set(tid, []);

    match = {
      id: id("mat", datingMatches.length + 1),
      a: ctx.user.id,
      b: target.id,
      threadId: tid,
      createdAt: iso(),
      wiltsAt: new Date(Date.now() + MATCH_WILT_DAYS * 86400_000).toISOString(),
    };
    datingMatches.push(match);
  }

  send(ctx.res, 200, {
    matched: !!match,
    twinklesLeft: twinklesLeft(ctx.user.id),
    ...(match
      ? {
          match: {
            handle: target.handle,
            candidate: candidateOf(target, ctx.user.id),
            threadId: match.threadId,
            createdAt: match.createdAt,
            wiltsAt: match.wiltsAt,
          },
        }
      : {}),
  });
});

route("GET", "/v1/dating/likes", (ctx) => {
  const items = [];
  for (const [key, swipe] of swipes) {
    const [actorId, targetId] = key.split(">");
    if (targetId !== ctx.user.id) continue;
    if (swipe.action === "PASS") continue;
    if (swipes.has(`${ctx.user.id}>${actorId}`)) continue; // already answered
    const actor = users.get(actorId);
    if (!actor) continue;
    items.push({
      id: key,
      candidate: candidateOf(actor, ctx.user.id),
      action: swipe.action,
      target: swipe.target ?? { kind: "PHOTO" },
      note: swipe.note || undefined,
      createdAt: swipe.at,
    });
  }
  items.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  send(ctx.res, 200, { items });
});

route("GET", "/v1/dating/matches", (ctx) => {
  const now = Date.now();
  const items = datingMatches
    .filter((m) => m.a === ctx.user.id || m.b === ctx.user.id)
    .map((m) => {
      const otherId = m.a === ctx.user.id ? m.b : m.a;
      const other = users.get(otherId);
      if (!other) return null;
      const said = messages.get(m.threadId) ?? [];
      const opener = said.length ? said[0].body : undefined;
      if (!said.length && new Date(m.wiltsAt).getTime() < now) return null; // wilted
      return {
        handle: other.handle,
        candidate: candidateOf(other, ctx.user.id),
        threadId: m.threadId,
        createdAt: m.createdAt,
        ...(said.length ? {} : { wiltsAt: m.wiltsAt }),
        ...(opener ? { opener } : {}),
      };
    })
    .filter(Boolean);
  send(ctx.res, 200, { items });
});

route("DELETE", "/v1/dating/matches/:handle", (ctx) => {
  const other = byHandle(ctx.params.handle);
  if (!other) return fail(ctx.res, 404, "NOT_FOUND", "no account with that handle");
  const i = datingMatches.findIndex(
    (m) =>
      (m.a === ctx.user.id && m.b === other.id) || (m.b === ctx.user.id && m.a === other.id),
  );
  if (i === -1) return fail(ctx.res, 404, "NOT_FOUND", "you are not matched with them");
  datingMatches.splice(i, 1);
  send(ctx.res, 204);
});

route("POST", "/v1/media/upload", (ctx) => {
  const raw = ctx.body.__multipart;
  const contentType = ctx.body.__contentType ?? "";
  if (!Buffer.isBuffer(raw)) {
    return fail(ctx.res, 400, "BAD_REQUEST", 'send the file as multipart/form-data under the field name "file"');
  }

  const data = parseMultipartFile(raw, contentType);
  if (!data || data.length === 0) {
    return fail(ctx.res, 400, "BAD_REQUEST", 'send the file as multipart/form-data under the field name "file"');
  }
  if (data.length > MEDIA_MAX_BYTES) {
    return fail(
      ctx.res,
      400,
      "BAD_REQUEST",
      `file is larger than ${MEDIA_MAX_BYTES} bytes`,
      "that's a bit big — 5 MB max, and no video, just images or a GIF",
    );
  }

  const mime = sniffImageType(data);
  if (!mime) {
    return fail(
      ctx.res,
      422,
      "VALIDATION",
      "only JPEG, PNG, WEBP or GIF images are accepted — no video",
      "only pictures and GIFs — no video files",
    );
  }

  send(ctx.res, 201, {
    url: `data:${mime};base64,${data.toString("base64")}`,
    size: data.length,
    contentType: mime,
  });
});

route("GET", "/v1/avatar/options", (ctx) =>
  send(ctx.res, 200, {
    hat: ["none", "beanie", "grad-cap", "flower", "headphones", "bandana"],
    eyes: ["sparkle", "sleepy", "wink", "wide", "closed"],
    colour: ["ube", "peach", "mint", "butter", "cocoa", "cream"],
    accessory: ["none", "scarf", "glasses", "earbuds", "bowtie"],
  }),
);

// --- onboarding & graph -----------------------------------------------------

route("GET", "/v1/onboarding/suggestions", (ctx) => {
  const items = [...users.values()]
    .filter((u) => u.id !== ctx.user.id && u.onboardingStep === "DONE" && !follows.has(`${ctx.user.id}>${u.id}`))
    .slice(0, Number(ctx.query.limit ?? 12))
    .map((u) => publicUser(u, ctx.user.id));
  send(ctx.res, 200, { items, minFollows: MIN_FOLLOWS });
});

function followResult(ctx, target, following) {
  const followingCount = [...follows].filter((f) => f.startsWith(`${ctx.user.id}>`)).length;
  if (ctx.user.onboardingStep === "FOLLOWS" && followingCount >= MIN_FOLLOWS) {
    ctx.user.onboardingStep = "DONE";
  }
  return {
    following,
    followerCount: [...follows].filter((f) => f.endsWith(`>${target.id}`)).length,
    onboardingStep: ctx.user.onboardingStep,
    followsRemaining: Math.max(0, MIN_FOLLOWS - followingCount),
    isBuddy: following && follows.has(`${target.id}>${ctx.user.id}`),
  };
}

route("POST", "/v1/onboarding/follow-all", (ctx) => {
  const handles = ctx.body.handles ?? [];
  if (!handles.length) return fail(ctx.res, 400, "BAD_REQUEST", "no accounts to follow");
  let last = ctx.user;
  for (const handle of handles) {
    const target = byHandle(handle);
    if (target) {
      follows.add(`${ctx.user.id}>${target.id}`);
      last = target;
    }
  }
  send(ctx.res, 200, followResult(ctx, last, true));
});

route("POST", "/v1/users/:handle/follow", (ctx) => {
  const target = byHandle(ctx.params.handle);
  if (!target) return fail(ctx.res, 404, "NOT_FOUND", "no account with that handle");
  follows.add(`${ctx.user.id}>${target.id}`);
  notify(target.id, {
    type: "FOLLOW",
    actorId: ctx.user.id,
    title: `${ctx.user.displayName} followed you`,
    body: follows.has(`${target.id}>${ctx.user.id}`) ? "You're buddies now — DMs are open." : undefined,
    href: `/profile/${ctx.user.handle}`,
  });
  send(ctx.res, 200, followResult(ctx, target, true));
});

route("DELETE", "/v1/users/:handle/follow", (ctx) => {
  const target = byHandle(ctx.params.handle);
  if (!target) return fail(ctx.res, 404, "NOT_FOUND", "no account with that handle");
  follows.delete(`${ctx.user.id}>${target.id}`);
  send(ctx.res, 200, followResult(ctx, target, false));
});

route("POST", "/v1/users/:handle/block", (ctx) => {
  const target = byHandle(ctx.params.handle);
  if (!target) return fail(ctx.res, 404, "NOT_FOUND", "no account with that handle");
  blocks.add(`${ctx.user.id}>${target.id}`);
  follows.delete(`${ctx.user.id}>${target.id}`);
  follows.delete(`${target.id}>${ctx.user.id}`);
  send(ctx.res, 204);
});

route("DELETE", "/v1/users/:handle/block", (ctx) => {
  const target = byHandle(ctx.params.handle);
  if (!target) return fail(ctx.res, 404, "NOT_FOUND", "no account with that handle");
  blocks.delete(`${ctx.user.id}>${target.id}`);
  send(ctx.res, 204);
});

route("GET", "/v1/users/:handle", (ctx) => {
  const target = byHandle(ctx.params.handle);
  if (!target) return fail(ctx.res, 404, "NOT_FOUND", "no account with that handle");
  send(ctx.res, 200, publicUser(target, ctx.user.id, target.id === ctx.user.id));
});

route("GET", "/v1/users/:handle/followers", (ctx) => {
  const target = byHandle(ctx.params.handle);
  const items = [...follows]
    .filter((f) => f.endsWith(`>${target.id}`))
    .map((f) => users.get(f.split(">")[0]))
    .filter(Boolean)
    .map((u) => publicUser(u, ctx.user.id));
  send(ctx.res, 200, { items });
});

route("GET", "/v1/users/:handle/following", (ctx) => {
  const target = byHandle(ctx.params.handle);
  const items = [...follows]
    .filter((f) => f.startsWith(`${target.id}>`))
    .map((f) => users.get(f.split(">")[1]))
    .filter(Boolean)
    .map((u) => publicUser(u, ctx.user.id));
  send(ctx.res, 200, { items });
});

route("GET", "/v1/search/users", (ctx) => {
  const q = String(ctx.query.q ?? "").toLowerCase();
  const items = [...users.values()]
    .filter((u) => u.onboardingStep === "DONE" && (u.handle.includes(q) || u.displayName.toLowerCase().includes(q)))
    .slice(0, Number(ctx.query.limit ?? 20))
    .map((u) => publicUser(u, ctx.user.id));
  send(ctx.res, 200, { items });
});

// --- nest -------------------------------------------------------------------

route("GET", "/v1/spaces", (ctx) => send(ctx.res, 200, { items: SPACES }));

route("GET", "/v1/feed", (ctx) => {
  let list = [...posts.values()];
  if (ctx.query.space) list = list.filter((p) => p.space.slug === ctx.query.space);
  if (ctx.query.source === "following") {
    list = list.filter((p) => follows.has(`${ctx.user.id}>${p.authorId}`) || p.authorId === ctx.user.id);
  }
  list.sort((a, b) =>
    ctx.query.sort === "new"
      ? new Date(b.createdAt) - new Date(a.createdAt)
      : b.score / Math.pow((Date.now() - new Date(b.createdAt)) / 3600_000 + 2, 1.5) -
        a.score / Math.pow((Date.now() - new Date(a.createdAt)) / 3600_000 + 2, 1.5),
  );
  send(ctx.res, 200, page(list.map((p) => publicPost(p, ctx.user.id)), Number(ctx.query.limit ?? 20), ctx.query.cursor));
});

route("POST", "/v1/posts", (ctx) => {
  const space = spaceBySlug(ctx.body.space) ?? SPACES[0];
  const title = String(ctx.body.title ?? "").trim();
  if (title.length < 3) return fail(ctx.res, 422, "VALIDATION", "give it a title of at least 3 characters");

  const pid = id("pst", ++postSeq);
  const post = {
    id: pid,
    space,
    authorId: ctx.user.id,
    type: ctx.body.type ?? "TEXT",
    title,
    body: ctx.body.body ?? "",
    linkUrl: ctx.body.linkUrl,
    imageUrl: ctx.body.imageUrl,
    poll: Array.isArray(ctx.body.pollOptions) && ctx.body.pollOptions.length >= 2
      ? {
          options: ctx.body.pollOptions
            .map((label, i) => ({ id: `opt-${i + 1}`, label: String(label).trim(), seed: 0 }))
            .filter((o) => o.label),
          ballots: new Map(),
        }
      : undefined,
    score: 1,
    isPinned: false,
    isLocked: false,
    isRemoved: false,
    votes: new Map([[ctx.user.id, 0]]),
    reactions: new Map(STICKERS.map((s) => [s, new Set()])),
    createdAt: iso(),
  };
  posts.set(pid, post);
  comments.set(pid, []);

  send(ctx.res, 201, {
    post: publicPost(post, ctx.user.id),
    supportCard: CRISIS.test(`${title} ${ctx.body.body ?? ""}`) ? SUPPORT_CARD : undefined,
    owlPoints: grant(ctx.user, 12, "post in #" + space.slug),
  });
});

route("GET", "/v1/posts/:id", (ctx) => {
  const post = posts.get(ctx.params.id);
  if (!post) return fail(ctx.res, 404, "NOT_FOUND", "that post is gone", "Nothing lives at this address.");
  send(ctx.res, 200, publicPost(post, ctx.user.id));
});

route("POST", "/v1/posts/:id/vote", (ctx) => {
  const post = posts.get(ctx.params.id);
  if (!post) return fail(ctx.res, 404, "NOT_FOUND", "that post is gone");
  post.votes.set(ctx.user.id, Number(ctx.body.value ?? 0));
  const shaped = publicPost(post, ctx.user.id);
  send(ctx.res, 200, { score: shaped.score, viewerVote: shaped.viewerVote });
});

route("POST", "/v1/posts/:id/react", (ctx) => {
  const post = posts.get(ctx.params.id);
  if (!post) return fail(ctx.res, 404, "NOT_FOUND", "that post is gone");
  const set = post.reactions.get(ctx.body.sticker);
  if (!set) return fail(ctx.res, 422, "VALIDATION", "not one of the available stickers");
  const added = !set.has(ctx.user.id);
  if (added) set.add(ctx.user.id);
  else set.delete(ctx.user.id);
  send(ctx.res, 200, { added, stickers: stickerCounts(post, ctx.user.id) });
});

route("GET", "/v1/posts/:id/comments", (ctx) => {
  const list = comments.get(ctx.params.id) ?? [];
  send(ctx.res, 200, { items: list.map((c) => publicComment(c, ctx.user.id)) });
});

route("POST", "/v1/posts/:id/comments", (ctx) => {
  const list = comments.get(ctx.params.id);
  if (!list) return fail(ctx.res, 404, "NOT_FOUND", "that post is gone");
  const body = String(ctx.body.body ?? "").trim();
  if (body.length < 2) return fail(ctx.res, 422, "VALIDATION", "say a little more than that");

  const comment = {
    id: id("cmt", Date.now() % 100000),
    postId: ctx.params.id,
    parentId: ctx.body.parentId ?? undefined,
    author: ctx.user.id,
    body,
    depth: ctx.body.parentId ? 1 : 0,
    score: 1,
    votes: new Map(),
    isRemoved: false,
    createdAt: iso(),
    children: [],
  };

  if (ctx.body.parentId) {
    const parent = list.find((c) => c.id === ctx.body.parentId);
    if (parent) parent.children.push(comment);
    else list.push(comment);
  } else {
    list.push(comment);
  }

  const postAuthor = posts.get(ctx.params.id)?.authorId;
  if (postAuthor && postAuthor !== ctx.user.id) {
    notify(postAuthor, {
      type: ctx.body.parentId ? "REPLY" : "COMMENT",
      actorId: ctx.user.id,
      title: `${ctx.user.displayName} commented on your post`,
      body: body.slice(0, 90),
      href: `/posts/${ctx.params.id}`,
    });
  }

  send(ctx.res, 201, {
    comment: publicComment(comment, ctx.user.id),
    supportCard: CRISIS.test(body) ? SUPPORT_CARD : undefined,
    owlPoints: grant(ctx.user, 5, "comment"),
  });
});

route("POST", "/v1/comments/:id/vote", (ctx) => {
  for (const list of comments.values()) {
    const found = list.find((c) => c.id === ctx.params.id) ?? list.flatMap((c) => c.children).find((c) => c.id === ctx.params.id);
    if (found) {
      found.votes.set(ctx.user.id, Number(ctx.body.value ?? 0));
      const shaped = publicComment(found, ctx.user.id);
      return send(ctx.res, 200, { score: shaped.score, viewerVote: shaped.viewerVote });
    }
  }
  fail(ctx.res, 404, "NOT_FOUND", "that comment is gone");
});

// --- chats ------------------------------------------------------------------

const visibleThreads = (userId) => [...threads.values()].filter((t) => t.memberIds.includes(userId));

route("GET", "/v1/threads", (ctx) => {
  const items = visibleThreads(ctx.user.id)
    .filter((t) => !t.requested.has(ctx.user.id))
    .map((t) => publicThread(t, ctx.user.id))
    .sort((a, b) => new Date(b.lastMessageAt ?? 0) - new Date(a.lastMessageAt ?? 0));
  send(ctx.res, 200, { items });
});

route("GET", "/v1/threads/requests", (ctx) => {
  const items = visibleThreads(ctx.user.id)
    .filter((t) => t.requested.has(ctx.user.id))
    .map((t) => publicThread(t, ctx.user.id));
  send(ctx.res, 200, { items });
});

route("POST", "/v1/threads/dm", (ctx) => {
  const target = byHandle(ctx.body.handle);
  if (!target) return fail(ctx.res, 404, "NOT_FOUND", "no account with that handle");

  let thread = [...threads.values()].find(
    (t) => t.type === "DM" && t.memberIds.length === 2 && t.memberIds.includes(ctx.user.id) && t.memberIds.includes(target.id),
  );
  if (!thread) {
    const tid = id("thr", ++threadSeq);
    thread = {
      id: tid,
      type: "DM",
      memberIds: [ctx.user.id, target.id],
      createdById: ctx.user.id,
      createdAt: iso(),
      reads: new Map(),
      requested: new Set(),
    };
    threads.set(tid, thread);
    messages.set(tid, []);
  }
  send(ctx.res, 200, publicThread(thread, ctx.user.id));
});

route("GET", "/v1/threads/:id", (ctx) => {
  const thread = threads.get(ctx.params.id);
  if (!thread) return fail(ctx.res, 404, "NOT_FOUND", "that chat is gone");
  send(ctx.res, 200, publicThread(thread, ctx.user.id));
});

route("GET", "/v1/threads/:id/messages", (ctx) => {
  const list = [...(messages.get(ctx.params.id) ?? [])].reverse(); // newest first
  send(ctx.res, 200, page(list.map((m) => publicMessage(m, ctx.user.id)), Number(ctx.query.limit ?? 40), ctx.query.cursor));
});

route("POST", "/v1/threads/:id/messages", (ctx) => {
  const list = messages.get(ctx.params.id);
  if (!list) return fail(ctx.res, 404, "NOT_FOUND", "that chat is gone");
  const body = String(ctx.body.body ?? "").trim();
  if (!body) return fail(ctx.res, 422, "VALIDATION", "nothing to send");

  const message = {
    id: id("msg", Date.now() % 100000),
    threadId: ctx.params.id,
    senderId: ctx.user.id,
    kind: "TEXT",
    body,
    clientId: ctx.body.clientId,
    createdAt: iso(),
  };
  list.push(message);

  broadcast(`thread:${ctx.params.id}`, "message.new", publicMessage(message, ctx.user.id));
  for (const memberId of threads.get(ctx.params.id)?.memberIds ?? []) {
    if (memberId !== ctx.user.id) broadcast(`user:${memberId}`, "message.new", publicMessage(message, memberId));
  }

  send(ctx.res, 201, {
    message: publicMessage(message, ctx.user.id),
    supportCard: CRISIS.test(body) ? SUPPORT_CARD : undefined,
    owlPoints: grant(ctx.user, 2, "message"),
  });
});

route("POST", "/v1/threads/:id/read", (ctx) => {
  threads.get(ctx.params.id)?.reads.set(ctx.user.id, Date.now());
  send(ctx.res, 204);
});

route("POST", "/v1/threads/:id/accept", (ctx) => {
  threads.get(ctx.params.id)?.requested.delete(ctx.user.id);
  send(ctx.res, 204);
});

// --- owl board --------------------------------------------------------------

route("POST", "/v1/owl/heartbeat", (ctx) => send(ctx.res, 200, heartbeat(ctx.user)));

route("GET", "/v1/owl/board", (ctx) => {
  const scope = ctx.query.scope ?? "campus";
  let pool = [...users.values()].filter((u) => u.onboardingStep === "DONE");
  if (scope === "batch") pool = pool.filter((u) => u.batch === ctx.user.batch);
  if (scope === "buddies") {
    pool = pool.filter(
      (u) => u.id === ctx.user.id || (follows.has(`${ctx.user.id}>${u.id}`) && follows.has(`${u.id}>${ctx.user.id}`)),
    );
  }

  const ranked = pool.sort((a, b) => b.weekPoints - a.weekPoints);
  const entries = ranked.slice(0, Number(ctx.query.limit ?? 50)).map((u, i) => ({
    rank: i + 1,
    user: publicUser(u, ctx.user.id),
    points: u.weekPoints,
    owlRank: u.owlRank,
    owlRankLabel: u.owlRankLabel,
    isViewer: u.id === ctx.user.id,
  }));

  const { nightOpen, cozy } = nightState();
  send(ctx.res, 200, {
    scope,
    weekKey: `${now().getFullYear()}-W${String(Math.ceil(now().getDate() / 7) + 36).padStart(2, "0")}`,
    entries,
    viewerRank: ranked.findIndex((u) => u.id === ctx.user.id) + 1,
    viewerPoints: ctx.user.weekPoints,
    cozyMode: cozy,
    nightOpen,
    resetsAt: iso(),
  });
});

route("GET", "/v1/owl/history", (ctx) => {
  // Seven nights ending tonight, read straight off the ledger `grant()` writes.
  // A night nobody earned anything on is a zero — an empty week should look
  // empty rather than be filled in with invented numbers.
  const ledger = ctx.user.nightPoints ?? {};
  const tonight = nightKey();
  const items = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i));
    const key = day.toISOString().slice(0, 10);
    return {
      date: key,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      points: ledger[key] ?? 0,
      isTonight: key === tonight,
    };
  });

  send(ctx.res, 200, { items, best: Math.max(0, ...items.map((i) => i.points)) });
});

route("POST", "/v1/owl/cocoon", (ctx) => {
  const awarded = !ctx.user.cocoonClaimed;
  if (awarded) {
    ctx.user.cocoonClaimed = true;
    ctx.user.stardust += 250;
  }
  send(ctx.res, 200, {
    awarded,
    sleepHours: awarded ? 7.4 : 2.1,
    stardust: awarded ? 250 : 0,
    balance: ctx.user.stardust,
    message: awarded
      ? "7h 24m offline. +250 Sparks — more than a full night of grinding is worth, by design."
      : "You've claimed today's Cocoon Bonus already. Come back after another proper rest.",
  });
});

route("POST", "/v1/owl/burrow", (ctx) => {
  const minutes = Math.max(0, Math.min(180, Number(ctx.body.minutes ?? 0)));
  send(ctx.res, 200, grant(ctx.user, Math.round(minutes / 5), `${minutes} min burrow`));
});

// --- note locker ------------------------------------------------------------

route("GET", "/v1/notes", (ctx) => {
  let list = [...NOTES];
  if (ctx.query.kind) list = list.filter((n) => n.kind === ctx.query.kind);
  if (ctx.query.subject) list = list.filter((n) => n.subject === ctx.query.subject);
  if (ctx.query.semester) list = list.filter((n) => String(n.semester) === String(ctx.query.semester));
  list.sort((a, b) => (ctx.query.sort === "new" ? new Date(b.createdAt) - new Date(a.createdAt) : b.score - a.score));
  send(ctx.res, 200, page(list.map((n) => publicNote(n, ctx.user.id)), Number(ctx.query.limit ?? 20), ctx.query.cursor));
});

route("GET", "/v1/notes/subjects", (ctx) =>
  send(ctx.res, 200, { items: [...new Set(NOTES.map((n) => n.subject))].sort() }),
);

route("POST", "/v1/notes", (ctx) => {
  const note = {
    id: id("nte", NOTES.length + 1),
    uploaderId: ctx.user.id,
    subject: ctx.body.subject,
    semester: Number(ctx.body.semester),
    kind: ctx.body.kind,
    title: ctx.body.title,
    branch: ctx.body.branch,
    fileUrl: ctx.body.fileUrl,
    fileSize: ctx.body.fileSize ?? 0,
    score: 1,
    downloads: 0,
    votes: new Map(),
    createdAt: iso(),
  };
  NOTES.unshift(note);
  ctx.user.stardust += 40;
  send(ctx.res, 201, { noteId: note.id, stardust: 40, balance: ctx.user.stardust });
});

route("POST", "/v1/notes/:id/vote", (ctx) => {
  const note = NOTES.find((n) => n.id === ctx.params.id);
  if (!note) return fail(ctx.res, 404, "NOT_FOUND", "that file is gone");
  note.votes.set(ctx.user.id, Number(ctx.body.value ?? 0));
  const shaped = publicNote(note, ctx.user.id);
  send(ctx.res, 200, { score: shaped.score, viewerVote: shaped.viewerVote });
});

route("POST", "/v1/notes/:id/download", (ctx) => {
  const note = NOTES.find((n) => n.id === ctx.params.id);
  if (note) note.downloads += 1;
  send(ctx.res, 204);
});

route("POST", "/v1/reports", (ctx) =>
  send(ctx.res, 201, {
    reportId: id("rpt", Date.now() % 10000),
    message: "Thanks. A moderator will review this within 24 hours.",
  }),
);

route("GET", "/v1/safety/support", (ctx) => send(ctx.res, 200, SUPPORT_CARD));

// --- notifications ----------------------------------------------------------

route("GET", "/v1/notifications", (ctx) => {
  const list = notifications.get(ctx.user.id) ?? [];
  send(ctx.res, 200, {
    items: list.slice(0, Number(ctx.query.limit ?? 30)).map((n) => publicNotification(n, ctx.user.id)),
    unread: list.filter((n) => !n.read).length,
  });
});

route("POST", "/v1/notifications/read", (ctx) => {
  for (const n of notifications.get(ctx.user.id) ?? []) n.read = true;
  send(ctx.res, 204);
});

// --- bookmarks --------------------------------------------------------------

route("POST", "/v1/posts/:id/bookmark", (ctx) => {
  const post = posts.get(ctx.params.id);
  if (!post) return fail(ctx.res, 404, "NOT_FOUND", "that post is gone");

  const set = bookmarks.get(ctx.user.id) ?? new Set();
  const bookmarked = !set.has(post.id);
  if (bookmarked) set.add(post.id);
  else set.delete(post.id);
  bookmarks.set(ctx.user.id, set);

  send(ctx.res, 200, { bookmarked });
});

route("GET", "/v1/bookmarks", (ctx) => {
  const saved = bookmarks.get(ctx.user.id) ?? new Set();
  const list = [...posts.values()]
    .filter((p) => saved.has(p.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  send(ctx.res, 200, page(list.map((p) => publicPost(p, ctx.user.id)), Number(ctx.query.limit ?? 20), ctx.query.cursor));
});

// --- polls ------------------------------------------------------------------

route("POST", "/v1/posts/:id/poll", (ctx) => {
  const post = posts.get(ctx.params.id);
  if (!post?.poll) return fail(ctx.res, 404, "NOT_FOUND", "that poll is gone");
  const option = post.poll.options.find((o) => o.id === ctx.body.optionId);
  if (!option) return fail(ctx.res, 422, "VALIDATION", "that isn't one of the options");

  post.poll.ballots.set(ctx.user.id, option.id);
  send(ctx.res, 200, publicPoll(post, ctx.user.id));
});

// ------------------------------------------------------------ websocket -----
// A minimal raw RFC 6455 implementation — no `ws` package, to keep this tool
// dependency-free. Handles exactly what lib/ws.ts's client sends: subscribe,
// unsubscribe, typing, and text-frame JSON in general. Good enough to demo
// live chat delivery and typing indicators across two open tabs.

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const channelSubs = new Map(); // channel -> Set<socket>

function broadcast(channel, type, payload) {
  const subs = channelSubs.get(channel);
  if (!subs) return;
  for (const socket of subs) sendFrame(socket, { type, channel, at: iso(), payload });
}

function encodeFrame(payload) {
  const data = Buffer.from(JSON.stringify(payload));
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function sendFrame(socket, payload) {
  if (socket.destroyed) return;
  try {
    socket.write(encodeFrame(payload));
  } catch {
    // socket went away between the liveness check and the write; the close
    // handler will clean up its channel subscriptions shortly.
  }
}

// Decodes as many complete client frames as `buf` holds; leftover bytes (a
// frame split across TCP packets) are returned for the caller to prepend to
// the next chunk.
function decodeFrames(buf, onMessage, onClose) {
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const first = buf[offset];
    const second = buf[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let payloadLen = second & 0x7f;
    let cursor = offset + 2;

    if (payloadLen === 126) {
      if (cursor + 2 > buf.length) break;
      payloadLen = buf.readUInt16BE(cursor);
      cursor += 2;
    } else if (payloadLen === 127) {
      if (cursor + 8 > buf.length) break;
      payloadLen = Number(buf.readBigUInt64BE(cursor));
      cursor += 8;
    }

    let maskKey;
    if (masked) {
      if (cursor + 4 > buf.length) break;
      maskKey = buf.subarray(cursor, cursor + 4);
      cursor += 4;
    }
    if (cursor + payloadLen > buf.length) break;

    const raw = buf.subarray(cursor, cursor + payloadLen);
    const payload = Buffer.alloc(payloadLen);
    if (masked) {
      for (let i = 0; i < payloadLen; i++) payload[i] = raw[i] ^ maskKey[i % 4];
    } else {
      raw.copy(payload);
    }

    if (opcode === 0x8) onClose();
    else if (opcode === 0x1) onMessage(payload.toString("utf8"));

    offset = cursor + payloadLen;
  }
  return buf.subarray(offset);
}

function handleUpgrade(req, socket) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname !== "/v1/ws") {
    socket.destroy();
    return;
  }

  const token = url.searchParams.get("token") ?? "";
  const userId = sessions.get(token);
  if (!userId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const acceptKey = createHash("sha1")
    .update(req.headers["sec-websocket-key"] + WS_GUID)
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`,
  );

  socket.subscribed = new Set();
  let buffered = Buffer.alloc(0);

  const cleanup = () => {
    for (const channel of socket.subscribed) channelSubs.get(channel)?.delete(socket);
  };

  socket.on("data", (chunk) => {
    buffered = decodeFrames(
      Buffer.concat([buffered, chunk]),
      (text) => {
        let frame;
        try {
          frame = JSON.parse(text);
        } catch {
          return;
        }

        if (frame.type === "subscribe" && frame.channel) {
          socket.subscribed.add(frame.channel);
          if (!channelSubs.has(frame.channel)) channelSubs.set(frame.channel, new Set());
          channelSubs.get(frame.channel).add(socket);
        } else if (frame.type === "unsubscribe" && frame.channel) {
          socket.subscribed.delete(frame.channel);
          channelSubs.get(frame.channel)?.delete(socket);
        } else if (frame.type === "typing" && frame.threadId) {
          const sender = users.get(userId);
          broadcast(`thread:${frame.threadId}`, "typing", {
            threadId: frame.threadId,
            userId,
            handle: sender?.handle ?? "",
            typing: !!frame.typing,
          });
        }
      },
      cleanup,
    );
  });

  socket.on("close", cleanup);
  socket.on("error", cleanup);
}

// ---------------------------------------------------------------- server ----

const PUBLIC = new Set([
  "POST /v1/auth/otp/request",
  "POST /v1/auth/otp/verify",
  "POST /v1/auth/refresh",
  "POST /v1/auth/logout",
  "GET /v1/avatar/options",
  "GET /v1/safety/support",
]);

// ------------------------------------------------------------- dispatch -----
// The routing/auth/body-parsing logic every transport shares. `req` needs
// `.method`, `.url` (path + query, resolved against any base), `.headers`
// (plain lowercase-keyed object) and to be async-iterable over its body
// chunks; `res` needs `.setHeader`, `.writeHead`, `.end` and `.headersSent` —
// exactly what Node's http gives you for free, and what the Next.js route
// adapter fakes in a few lines.
export async function dispatch(req, res) {
  res.setHeader("access-control-allow-origin", req.headers.origin ?? "*");
  res.setHeader("access-control-allow-headers", "authorization,content-type,x-device-fingerprint");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("access-control-allow-credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (path === "/healthz") return send(res, 200, { status: "ok" });

  let body = {};
  if (req.method !== "GET" && req.method !== "DELETE") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBuffer = Buffer.concat(chunks);
    const contentType = req.headers["content-type"] ?? "";

    // multipart/form-data (the media upload route) is binary and is never
    // JSON — hand the route handler the raw bytes instead of trying, and
    // failing, to JSON.parse a file's contents.
    if (contentType.startsWith("multipart/form-data")) {
      body = { __multipart: rawBuffer, __contentType: contentType };
    } else {
      const raw = rawBuffer.toString();
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          return fail(res, 400, "BAD_JSON", "that request body is not valid JSON");
        }
      }
    }
  }

  const match = ROUTES.find((r) => r.method === req.method && r.regex.test(path));
  if (!match) return fail(res, 404, "NOT_FOUND", "no route here", "Nothing lives at this address.");

  const key = `${req.method} ${path}`;
  let user = null;
  if (!PUBLIC.has(key)) {
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const userId = sessions.get(token);
    user = userId ? users.get(userId) : null;
    if (!user) return fail(res, 401, "UNAUTHORIZED", "sign in to continue");
  }

  const values = match.regex.exec(path).slice(1);
  const params = Object.fromEntries(match.keys.map((k, i) => [k, decodeURIComponent(values[i])]));

  try {
    await match.handler({ req, res, body, params, query: Object.fromEntries(url.searchParams), user });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) fail(res, 500, "INTERNAL", "something broke on our side");
  }
}

export { PORT, sessions, users, handleUpgrade };
