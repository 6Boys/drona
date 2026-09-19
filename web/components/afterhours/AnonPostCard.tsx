"use client";

import { useEffect, useState } from "react";
import { VoteBar } from "@/components/feed/VoteBar";
import { FlagIcon, MessageIcon, TimerIcon, XIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { afterhours } from "@/lib/afterhours-store";
import { MOODS } from "@/lib/afterhours-theme";
import { timeAgo, expiresIn } from "@/lib/format";
import type { AnonPost, VoteResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import { AnonThread } from "./AnonThread";
import { Flame, Sigil } from "./Atmosphere";
import { ReactionBar } from "./ReactionBar";
import { ReportDialog } from "./ReportDialog";

const LIFESPAN_MS = 24 * 3600_000;
const iconButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50";

export function AnonPostCard({
  post,
  onChange,
  onRemoved,
  featured = false,
  fresh = false,
}: {
  post: AnonPost;
  onChange: (next: AnonPost) => void;
  onRemoved: () => void;
  /** Tonight's top post: bigger type, a lit edge. */
  featured?: boolean;
  /** Just released by this viewer — arrives lit. */
  fresh?: boolean;
}) {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Your own secret isn't a secret from you.
  const [revealed, setRevealed] = useState(post.viewerIsAuthor);
  // A countdown only means something if it actually counts down — re-render
  // once a minute so the fuse shortens and "23h left" eventually becomes
  // "expired" without a manual refresh.
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const msLeft = new Date(post.expiresAt).getTime() - Date.now();
  const expired = msLeft <= 0;
  useEffect(() => {
    if (expired) onRemoved();
    // Only re-check when the tick fires or the post itself changes — not on
    // every render, or this would fire during the render that reports it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const deletePost = async () => {
    setBusy(true);
    try {
      await afterhours.deletePost(post.id);
      onRemoved();
    } catch (err) {
      toast(errorMessage(err, "could not remove that"), "error");
      setBusy(false);
    }
  };

  if (expired) return null;

  const mood = MOODS[post.mood];
  const veiled = post.mood === "secret" && !revealed;
  const burningOut = msLeft < 2 * 3600_000;

  return (
    <article data-mood={post.mood} className={cn("ah-card px-4 pb-4 pt-4 sm:px-5", featured && "ah-featured", fresh && "ah-ignite")}>
      {featured && (
        <p className="mb-3 flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-[0.12em] uppercase" style={{ color: "color-mix(in oklab, var(--mood) 70%, white)" }}>
          <Flame size={10} />
          Tonight&apos;s top {mood.label.toLowerCase()}
        </p>
      )}

      <header className="flex items-center gap-2.5">
        <Sigil anonNumber={post.anonNumber} size={featured ? 34 : 30} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[0.8125rem] font-medium text-text">
            #{post.anonNumber}
            {post.viewerIsAuthor && <span className="ml-1.5 font-normal text-faint">· you</span>}
          </p>
          <p className="text-[0.6875rem] text-faint">{timeAgo(post.createdAt)}</p>
        </div>
        <span className="ah-mood-tag ml-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.6875rem]">
          <span aria-hidden>{mood.emoji}</span>
          {mood.label}
        </span>
      </header>

      <div className="relative mt-3">
        <p
          aria-hidden={veiled}
          className={cn("ah-quote whitespace-pre-wrap", featured && "text-[1.6rem] leading-[1.28] sm:text-[1.85rem]", veiled && "ah-secret-veil")}
        >
          {post.body}
        </p>
        {veiled && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="absolute inset-0 flex cursor-pointer items-center justify-center"
            aria-label="Reveal this secret"
          >
            <span className="glass glass-pill flex items-center gap-2 px-4 py-2 text-[0.8125rem] font-medium text-text">
              <span aria-hidden>🔒</span> Tap to reveal
            </span>
          </button>
        )}
      </div>

      <div className="mt-4">
        <ReactionBar post={post} onChange={onChange} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <VoteBar
          path={`/v1/afterhours/posts/${post.id}/vote`}
          score={post.score}
          viewerVote={post.viewerVote}
          size="sm"
          onChange={(result: VoteResult) => onChange({ ...post, ...result })}
        />

        <button
          type="button"
          aria-expanded={threadOpen}
          aria-label={threadOpen ? "Hide replies" : `Show replies (${post.replyCount})`}
          onClick={() => setThreadOpen((o) => !o)}
          className={cn(
            "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[0.75rem] transition-colors",
            threadOpen
              ? "border-[color-mix(in_oklab,var(--mood)_45%,transparent)] bg-[color-mix(in_oklab,var(--mood)_14%,transparent)] text-text"
              : "border-border text-muted hover:border-border-strong hover:text-text",
          )}
        >
          <MessageIcon size={13} />
          {post.replyCount}
        </button>

        <span
          className={cn("ml-auto flex items-center gap-1 text-[0.6875rem]", burningOut ? "font-medium" : "text-faint")}
          style={burningOut ? { color: "color-mix(in oklab, var(--mood) 75%, white)" } : undefined}
        >
          <TimerIcon size={11} />
          {burningOut ? `burning out · ${expiresIn(post.expiresAt)}` : expiresIn(post.expiresAt)}
        </span>

        {post.viewerIsAuthor ? (
          <button type="button" aria-label="Delete this post" disabled={busy} onClick={deletePost} className={iconButton}>
            <XIcon size={14} />
          </button>
        ) : (
          <button type="button" aria-label="Report this post" onClick={() => setReporting(true)} className={iconButton}>
            <FlagIcon size={14} />
          </button>
        )}
      </div>

      {threadOpen && <AnonThread postId={post.id} onCountChange={(replyCount) => onChange({ ...post, replyCount })} />}

      <div className="ah-fuse" aria-hidden>
        <span style={{ width: `${Math.max(0, Math.min(1, msLeft / LIFESPAN_MS)) * 100}%` }} />
      </div>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="AFTERHOURS_POST"
        targetId={post.id}
        onReported={onRemoved}
      />
    </article>
  );
}
