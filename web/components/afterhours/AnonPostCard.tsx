"use client";

import { useEffect, useState } from "react";
import { VoteBar } from "@/components/feed/VoteBar";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { FlagIcon, TimerIcon, XIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { afterhours } from "@/lib/afterhours-store";
import { timeAgo, expiresIn } from "@/lib/format";
import type { AnonPost, VoteResult } from "@/lib/types";
import { cn } from "@/lib/cn";

const REASONS = ["Harassment or hate speech", "Threat or doxxing", "Explicit content", "Spam", "Something else"];

export function AnonPostCard({ post, onChange, onRemoved }: { post: AnonPost; onChange: (next: AnonPost) => void; onRemoved: () => void }) {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
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

  const submitReport = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api.post("/v1/reports", { targetType: "AFTERHOURS_POST", targetId: post.id, reason });
      toast("Reported. A moderator will review this within 24 hours.", "success");
      setReporting(false);
      setReason("");
    } catch (err) {
      toast(errorMessage(err, "could not file that report"), "error");
    } finally {
      setBusy(false);
    }
  };

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
        <span className="mono-label text-accent-hi">Anon #{post.anonNumber}</span>
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

      <Dialog
        open={reporting}
        onClose={() => setReporting(false)}
        title="Report this post"
        description="Seen by a moderator. The number attached to it doesn't tell them who that is any more than it tells you — reports are handled the same as anywhere else in the app."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReporting(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!reason} loading={busy} onClick={submitReport}>
              Submit report
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "block w-full cursor-pointer rounded-[var(--r-md)] border px-3 py-2.5 text-left text-sm transition-colors",
                reason === r
                  ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-wash text-accent-hi"
                  : "border-border text-text hover:border-border-strong",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </Dialog>
    </article>
  );
}
