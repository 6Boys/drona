"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/Icons";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import type { VoteResult } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Up / score / down in one pill. Optimistic: the number moves on click and
 * rolls back if the server disagrees. */
export function VoteBar({
  path,
  score,
  viewerVote,
  onChange,
  size = "md",
}: {
  /** "/v1/posts/{id}/vote", "/v1/comments/{id}/vote" or "/v1/notes/{id}/vote". */
  path: string;
  score: number;
  viewerVote: number;
  onChange: (result: VoteResult) => void;
  size?: "sm" | "md";
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const cast = async (value: number) => {
    if (busy) return;
    const next = viewerVote === value ? 0 : value;
    const optimistic = { score: score - viewerVote + next, viewerVote: next };

    setBusy(true);
    onChange(optimistic);
    try {
      onChange(await api.post<VoteResult>(path, { value: next }));
    } catch (err) {
      onChange({ score, viewerVote });
      toast(errorMessage(err, "vote didn't land"), "error");
    } finally {
      setBusy(false);
    }
  };

  const iconSize = size === "sm" ? 13 : 15;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2",
        size === "sm" ? "h-6 px-0.5" : "h-7 px-1",
      )}
    >
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={viewerVote === 1}
        onClick={() => cast(1)}
        className={cn(
          "cursor-pointer rounded-full p-1 transition-colors",
          viewerVote === 1 ? "text-accent-hi" : "text-faint hover:text-text",
        )}
      >
        <ArrowUpIcon size={iconSize} />
      </button>
      <span
        className={cn(
          "tabnum min-w-[1.5ch] text-center font-medium",
          size === "sm" ? "text-[0.6875rem]" : "text-xs",
          viewerVote === 1 ? "text-accent-hi" : viewerVote === -1 ? "text-danger" : "text-muted",
        )}
      >
        {score}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={viewerVote === -1}
        onClick={() => cast(-1)}
        className={cn(
          "cursor-pointer rounded-full p-1 transition-colors",
          viewerVote === -1 ? "text-danger" : "text-faint hover:text-text",
        )}
      >
        <ArrowDownIcon size={iconSize} />
      </button>
    </div>
  );
}
