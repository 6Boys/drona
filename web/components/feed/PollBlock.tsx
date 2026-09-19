"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import type { Poll } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Results stay hidden until you vote — seeing the tally first changes how
 * people answer, which is the whole reason a poll exists. */
export function PollBlock({
  postId,
  poll,
  onChange,
}: {
  postId: string;
  poll: Poll;
  onChange: (next: Poll) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const voted = !!poll.viewerChoice;

  const vote = async (optionId: string) => {
    if (busy) return;
    setBusy(optionId);
    try {
      onChange(await api.post<Poll>(`/v1/posts/${postId}/poll`, { optionId }));
    } catch (err) {
      toast(errorMessage(err, "vote didn't land"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3 space-y-1.5">
      {poll.options.map((option) => {
        const share = poll.totalVotes > 0 ? option.votes / poll.totalVotes : 0;
        const chosen = poll.viewerChoice === option.id;

        return (
          <button
            key={option.id}
            type="button"
            disabled={voted || !!busy}
            onClick={() => vote(option.id)}
            className={cn(
              "relative w-full overflow-hidden rounded-[var(--r-md)] border px-3 py-2 text-left transition-colors",
              chosen ? "border-accent" : "border-border",
              voted ? "cursor-default" : "cursor-pointer hover:border-border-strong",
            )}
          >
            {voted && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.round(share * 100)}%`,
                  background: chosen ? "var(--grad-brand)" : "var(--surface-2)",
                  opacity: chosen ? 0.28 : 1,
                }}
              />
            )}

            <span className="relative flex items-center gap-2">
              <span className="flex-1 text-[0.8125rem] text-text">{option.label}</span>
              {chosen && <CheckIcon size={14} className="text-accent-hi" />}
              {voted && (
                <span className="tabnum text-xs font-medium text-muted">{Math.round(share * 100)}%</span>
              )}
            </span>
          </button>
        );
      })}

      <p className="pt-0.5 text-[0.6875rem] text-faint">
        {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        {!voted && " · pick one to see results"}
      </p>
    </div>
  );
}
