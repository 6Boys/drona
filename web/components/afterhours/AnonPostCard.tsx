"use client";

import { useEffect, useState } from "react";
import { VoteBar } from "@/components/feed/VoteBar";
import { FlagIcon, MessageIcon, TimerIcon, XIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { afterhours } from "@/lib/afterhours-store";
import { timeAgo, expiresIn } from "@/lib/format";
import type { AnonPost, VoteResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import { AnonThread } from "./AnonThread";
import { ReportDialog } from "./ReportDialog";

export function AnonPostCard({ post, onChange, onRemoved }: { post: AnonPost; onChange: (next: AnonPost) => void; onRemoved: () => void }) {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // A countdown only means something if it actually counts down — re-render
  // once a minute so "23h left" eventually becomes "expired" without a
  // manual refresh, the same way a post that lived past its time would.
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const expired = new Date(post.expiresAt).getTime() <= Date.now();
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

  return (
    <article className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label text-accent-hi">
          Anon #{post.anonNumber}
          {post.viewerIsAuthor && <span className="ml-1.5 text-faint">· you</span>}
        </span>
        <span className="flex items-center gap-2 text-[0.6875rem] text-faint">
          <span>{timeAgo(post.createdAt)}</span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            <TimerIcon size={11} />
            {expiresIn(post.expiresAt)}
          </span>
        </span>
      </div>

      <p className="mt-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-text">{post.body}</p>

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
            "flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[0.75rem] transition-colors",
            threadOpen
              ? "border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-accent-wash text-accent-hi"
              : "border-border text-muted hover:border-border-strong hover:text-text",
          )}
        >
          <MessageIcon size={13} />
          {post.replyCount}
        </button>

        <div className="ml-auto flex items-center gap-1">
          {post.viewerIsAuthor ? (
            <button
              type="button"
              aria-label="Delete this post"
              disabled={busy}
              onClick={deletePost}
              className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-danger",
                busy && "cursor-not-allowed opacity-50",
              )}
            >
              <XIcon size={14} />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Report this post"
              onClick={() => setReporting(true)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <FlagIcon size={14} />
            </button>
          )}
        </div>
      </div>

      {threadOpen && (
        <AnonThread postId={post.id} onCountChange={(replyCount) => onChange({ ...post, replyCount })} />
      )}

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
