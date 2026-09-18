import { LogoMark } from "@/components/ui/Logo";
import { GradientAvatar } from "@/components/ui/GradientAvatar";
import {
  BookIcon,
  CompassIcon,
  HeartIcon,
  HomeIcon,
  MessageIcon,
  MoonIcon,
} from "@/components/ui/Icons";
import type { Avatar } from "@/lib/types";

// A hand-built replica of the running app rather than a screenshot: it stays in
// step with the design tokens, renders crisply at any density, and costs no
// image weight. Static on purpose — nothing here is interactive.

const NAV = [
  { label: "Nest", icon: HomeIcon, active: true },
  { label: "Spaces", icon: CompassIcon },
  { label: "Chats", icon: MessageIcon, badge: "3" },
];

const NIGHT = [{ label: "Night Shift", icon: MoonIcon }];

const CAMPUS = [
  { label: "Note Locker", icon: BookIcon },
  { label: "Love Finder", icon: HeartIcon },
];

const POSTS: {
  author: string;
  handle: string;
  avatar: Avatar;
  space: string;
  title: string;
  body: string;
  score: number;
  comments: number;
  stickers: string[];
}[] = [
  {
    author: "Rishab Jain",
    handle: "rishab",
    avatar: { hat: "grad-cap", eyes: "sparkle", colour: "mint", accessory: "none" },
    space: "Placements",
    title: "Wrote my Deloitte interview experience — 3 rounds, full questions inside",
    body: "Round 1 was aptitude + 2 coding. Round 2 tech: DBMS normalisation, one SQL join, projects grilled hard. Ask me anything below, I'll answer till midnight.",
    score: 47,
    comments: 12,
    stickers: ["▲ 47", "12 replies"],
  },
  {
    author: "Kabir Sethi",
    handle: "kabir",
    avatar: { hat: "bandana", eyes: "sleepy", colour: "butter", accessory: "scarf" },
    space: "Night Shift",
    title: "2:14 AM. workshop assignment. who else is up",
    body: "third coffee. the lathe drawing is fighting back.",
    score: 64,
    comments: 8,
    stickers: ["▲ 64", "8 replies"],
  },
];

const LOG = [
  ["02:03", "owl", "night window open · curfew 03:00"],
  ["02:04", "post", "@kabir posted in #night-shift"],
  ["02:07", "post", "@zoya replied in #note-locker"],
  ["02:11", "owl", "+8 points · comment in #cse-sem3"],
  ["02:26", "owl", "rank 47 → 41 on campus"],
  ["02:58", "owl", "curfew in 2 minutes"],
  ["03:00", "cozy", "curfew reached · points stopped"],
];

function Rail() {
  return (
    <div className="hidden w-[10.5rem] shrink-0 flex-col border-r border-border bg-panel py-3 md:flex">
      <div className="flex items-center gap-1.5 px-3 pb-4">
        <LogoMark size={18} />
        <span className="text-[0.6875rem] font-semibold text-text">DronaSphere</span>
      </div>

      <div className="space-y-0.5 px-2">
        {NAV.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 rounded-[6px] px-2 py-1 text-[0.625rem] ${
              item.active ? "bg-surface-2 text-text" : "text-muted"
            }`}
          >
            <item.icon size={12} className={item.active ? "text-accent-hi" : "text-faint"} />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="rounded-full bg-accent px-1 text-[0.5rem] text-on-accent">{item.badge}</span>
            )}
          </div>
        ))}
      </div>

      <p className="mono-label px-3 pt-3 pb-1 text-[0.5rem]">night</p>
      <div className="space-y-0.5 px-2">
        {NIGHT.map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-[6px] px-2 py-1 text-[0.625rem] text-muted">
            <item.icon size={12} className="text-faint" />
            {item.label}
          </div>
        ))}
      </div>

      <p className="mono-label px-3 pt-3 pb-1 text-[0.5rem]">campus</p>
      <div className="space-y-0.5 px-2">
        {CAMPUS.map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-[6px] px-2 py-1 text-[0.625rem] text-muted">
            <item.icon size={12} className="text-faint" />
            {item.label}
          </div>
        ))}
      </div>

      <div className="mt-auto mx-2 rounded-[8px] border border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-accent-wash px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <MoonIcon size={10} className="text-accent-hi" />
          <span className="mono-label text-[0.5rem]">night open</span>
        </div>
        <p className="mt-1 text-[0.625rem] text-muted">
          <span className="tabnum font-medium text-text">412</span> pts · <span className="tabnum font-medium text-text">#41</span>
        </p>
      </div>
    </div>
  );
}

export function AppPreview() {
  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-border bg-bg shadow-[var(--sh-pop)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-panel px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </div>
        <div className="mx-auto flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 font-mono text-[0.5625rem] text-faint">
          dronasphere.app/feed
        </div>
      </div>

      <div className="flex h-[24rem] text-left sm:h-[27rem]">
        <Rail />

        {/* feed */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-[0.6875rem] font-medium text-text">The Nest</span>
            <span className="mono-label text-[0.5rem]">412 verified students</span>
            <span className="ml-auto rounded-[6px] bg-accent px-2 py-0.5 text-[0.5625rem] text-on-accent">
              New post
            </span>
          </div>

          <div className="space-y-2 p-2.5">
            {POSTS.map((post) => (
              <article key={post.handle} className="card p-2.5">
                <header className="flex items-center gap-1.5 text-[0.5625rem]">
                  <GradientAvatar avatar={post.avatar} name={post.author} size={16} />
                  <span className="font-medium text-text">{post.author}</span>
                  <span className="text-faint">@{post.handle}</span>
                  <span className="ml-auto rounded-full border border-border px-1.5 py-px text-faint">
                    {post.space}
                  </span>
                </header>

                <h3 className="mt-1.5 text-[0.6875rem] leading-snug font-medium text-text">{post.title}</h3>
                <p className="mt-0.5 line-clamp-2 text-[0.625rem] leading-snug text-muted">{post.body}</p>

                <footer className="mt-2 flex items-center gap-1.5">
                  <span className="flex items-center gap-1 rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[0.5625rem] text-muted">
                    ▲ <span className="tabnum">{post.score}</span> ▼
                  </span>
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.5625rem] text-muted">
                    💬 {post.comments}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {post.stickers.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-border px-1.5 py-0.5 text-[0.5625rem] text-muted"
                      >
                        {s}
                      </span>
                    ))}
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </div>

        {/* activity log */}
        <div className="hidden w-[13rem] shrink-0 flex-col border-l border-border bg-panel lg:flex">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="size-1.5 rounded-full bg-accent breathe" />
            <span className="mono-label text-[0.5rem]">owl session · live</span>
          </div>

          <ul className="flex-1 space-y-1.5 overflow-hidden p-2.5 font-mono text-[0.5625rem] leading-relaxed">
            {LOG.map(([time, kind, text]) => (
              <li key={time} className="flex gap-1.5">
                <span className="shrink-0 text-faint">{time}</span>
                <span
                  className={`shrink-0 ${
                    kind === "owl" ? "text-accent-hi" : kind === "cozy" ? "text-gold" : "text-muted"
                  }`}
                >
                  {kind}
                </span>
                <span className="min-w-0 text-muted">{text}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-border p-2.5">
            <p className="mono-label text-[0.5rem]">cocoon bonus</p>
            <p className="mt-1 text-[0.625rem] text-muted">
              7h offline claimed · <span className="text-gold">+250 Sparks</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
