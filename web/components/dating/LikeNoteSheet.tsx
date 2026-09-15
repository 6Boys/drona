"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { avatarBackground, initialsFor } from "@/components/ui/GradientAvatar";
import { HeartIcon, SparkleIcon } from "@/components/ui/Icons";
import type { DatingCandidate, LikeTarget } from "@/lib/types";
import { cn } from "@/lib/cn";

const LIMIT = 220;

/* -----------------------------------------------------------------------------
   Liking a specific thing, and optionally saying why.

   The sheet always shows what is being liked, quoted back, because that is the
   whole point of the interaction: the other person receives "someone liked this
   sentence I wrote", not "someone liked you". The comment is optional and the
   field says so — pressuring people into writing something clever is how you
   get a deck full of nothing.
   -------------------------------------------------------------------------- */

export function LikeNoteSheet({
  candidate,
  target,
  twinklesLeft,
  onClose,
  onSend,
}: {
  candidate: DatingCandidate | null;
  target: LikeTarget | null;
  twinklesLeft: number;
  onClose: () => void;
  onSend: (note: string, twinkle: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [twinkle, setTwinkle] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const open = !!candidate && !!target;

  useEffect(() => {
    if (!open) return;
    setNote("");
    setTwinkle(false);
    const id = setTimeout(() => ref.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open, candidate?.handle]);

  if (!candidate || !target) return null;

  const prompt =
    target.kind === "PROMPT" && target.promptIndex !== undefined
      ? candidate.prompts[target.promptIndex]
      : undefined;
  const left = LIMIT - note.length;

  const send = () => {
    onSend(note, twinkle && twinklesLeft > 0);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Send ${candidate.displayName} a like`}
      description="They see the comment before they see anything else."
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} icon={twinkle ? <SparkleIcon size={15} /> : <HeartIcon size={15} />}>
            {twinkle ? "Send with a Twinkle" : note.trim() ? "Send comment" : "Send like"}
          </Button>
        </>
      }
    >
      {/* ------------------------------------------------ what's being liked -- */}
      <div className="card overflow-hidden">
        {target.kind === "PHOTO" ? (
          <div
            className="flex h-28 items-center justify-center"
            style={{ background: avatarBackground(candidate.avatar) }}
          >
            <span className="display text-[3rem] leading-none text-white/85">
              {initialsFor(candidate.displayName)}
            </span>
          </div>
        ) : (
          <div className="p-4">
            <p className="mono-label">{prompt?.question}</p>
            <p className="serif mt-2 text-[1.125rem] leading-snug text-text">{prompt?.answer}</p>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- the note -- */}
      <label className="mt-4 block">
        <span className="mono-label">add a comment — optional</span>
        <textarea
          ref={ref}
          value={note}
          maxLength={LIMIT}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder={
            target.kind === "PHOTO"
              ? "Say something that isn't 'hey'."
              : "Answer them back, argue with them, or say nothing at all."
          }
          className="mt-2 w-full resize-none rounded-[var(--r-md)] border border-border bg-surface px-3.5 py-3 text-[0.9375rem] leading-relaxed text-text outline-none transition-colors placeholder:text-faint focus:border-accent"
        />
      </label>

      <div className="mt-1.5 flex items-center justify-between text-[0.6875rem] text-faint">
        <span>⌘↵ to send</span>
        <span className={cn("tabnum", left < 30 && "text-warning")}>{left}</span>
      </div>

      {/* --------------------------------------------------------- twinkle -- */}
      <button
        type="button"
        onClick={() => twinklesLeft > 0 && setTwinkle((t) => !t)}
        disabled={twinklesLeft <= 0}
        aria-pressed={twinkle}
        className={cn(
          "mt-4 flex w-full cursor-pointer items-center gap-3 rounded-[var(--r-md)] border px-3.5 py-3 text-left transition-colors",
          twinkle ? "border-gold bg-[color-mix(in_oklab,var(--gold)_10%,transparent)]" : "border-border bg-surface",
          twinklesLeft <= 0 && "cursor-not-allowed opacity-55",
        )}
      >
        <SparkleIcon size={16} className={twinkle ? "text-gold" : "text-faint"} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] font-medium text-text">Send it as a Twinkle</span>
          <span className="block text-[0.75rem] text-muted">
            {twinklesLeft > 0
              ? "Goes to the top of their list. One a day."
              : "You've used today's. It comes back tomorrow."}
          </span>
        </span>
        <span
          className={cn(
            "size-4 shrink-0 rounded-full border transition-colors",
            twinkle ? "border-gold bg-gold" : "border-border-strong",
          )}
        />
      </button>
    </Dialog>
  );
}
