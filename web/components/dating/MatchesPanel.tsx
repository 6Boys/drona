"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { avatarBackground, avatarColours, initialsFor } from "@/components/ui/GradientAvatar";
import { CanvasReveal } from "@/components/fx/CanvasReveal";
import { Glow } from "@/components/fx/Glow";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SendIcon, MessageIcon } from "@/components/ui/Icons";
import { hoursLeft } from "@/lib/dating-store";
import { timeAgo } from "@/lib/format";
import type { DatingMatch } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Matches, with the clock visible.

   A match that nobody speaks to expires, and the card says how long is left
   rather than quietly deleting itself later. The first message is written right
   here — bouncing someone to a separate inbox to type "hey" is where most
   matches die.
   -------------------------------------------------------------------------- */

function Countdown({ match }: { match: DatingMatch }) {
  const hours = hoursLeft(match);
  // The server drops wiltsAt the moment a thread has a message: a match
  // somebody spoke to does not wilt, so there is no clock left to show.
  if (hours === null) {
    return <span className="text-positive">Live — someone opened it</span>;
  }
  if (hours <= 24) {
    return <span className="text-warning">Wilts in {hours}h unless someone speaks</span>;
  }
  return <span>Wilts in {Math.round(hours / 24)} days unless someone speaks</span>;
}

function MatchRow({
  match,
  onSayHi,
  onUnmatch,
}: {
  match: DatingMatch;
  onSayHi: (text: string) => void;
  onUnmatch: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [hot, setHot] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { candidate } = match;

  const send = () => {
    if (!draft.trim()) return;
    onSayHi(draft);
    setDraft("");
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      className="glass glass-panel relative overflow-hidden"
    >
      <Glow color="var(--accent)" />

      <div className="relative z-10 flex gap-4 p-4">
        <Link
          href={`/profile/${candidate.handle}`}
          className="relative size-20 shrink-0 overflow-hidden rounded-[var(--r-lg)]"
          style={{ background: avatarBackground(candidate.avatar) }}
        >
          <CanvasReveal active={hot} colours={avatarColours(candidate.avatar)} dotSize={2} gap={4} />
          <span className="display absolute inset-0 flex items-center justify-center text-[1.75rem] text-white/85">
            {initialsFor(candidate.displayName)}
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/profile/${candidate.handle}`} className="text-[1.0625rem] font-medium text-text">
              {candidate.displayName}
            </Link>
            <span className="text-[0.75rem] text-faint">
              {[candidate.branch, candidate.year ? `Year ${candidate.year}` : null]
                .filter(Boolean)
                .join(" · ")}{" "}
              · matched {timeAgo(match.createdAt)}
            </span>
          </div>

          <p className="mt-0.5 text-[0.75rem]">
            <Countdown match={match} />
          </p>

          {match.opener ? (
            <p className="serif mt-3 rounded-[var(--r-md)] border border-border bg-surface/70 px-3.5 py-2.5 text-[0.9375rem] leading-snug text-text">
              {match.opener}
            </p>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={`Say something to ${candidate.displayName.split(" ")[0]}`}
                aria-label={`Message ${candidate.displayName}`}
                className="min-w-0 flex-1 rounded-[var(--r-md)] border border-border bg-surface px-3.5 py-2 text-[0.875rem] text-text outline-none transition-colors placeholder:text-faint focus:border-accent"
              />
              <Button size="sm" onClick={send} disabled={!draft.trim()} aria-label="Send">
                <SendIcon size={15} />
              </Button>
            </div>
          )}

          <div className="mt-3 flex items-center gap-4 text-[0.75rem]">
            <Link
              href={match.threadId ? `/chats/${match.threadId}` : "/chats"}
              className="flex items-center gap-1.5 text-muted transition-colors hover:text-text"
            >
              <MessageIcon size={13} />
              Open the chat
            </Link>
            <button
              onClick={() => setConfirming(true)}
              className="cursor-pointer text-faint transition-colors hover:text-danger"
            >
              Unmatch
            </button>
          </div>
        </div>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Unmatch ${candidate.displayName}?`}
        description="This closes the chat for both of you and can't be undone. They won't be notified."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                onUnmatch();
              }}
            >
              Unmatch
            </Button>
          </>
        }
      />
    </motion.article>
  );
}

export function MatchesPanel({
  matches,
  onSayHi,
  onUnmatch,
  className,
}: {
  matches: DatingMatch[];
  onSayHi: (match: DatingMatch, text: string) => void;
  onUnmatch: (handle: string) => void;
  className?: string;
}) {
  if (!matches.length) {
    return (
      <EmptyState
        title="Nothing mutual yet"
        body="A match happens when you like someone who already liked you, or they like you back. It stays here for a week — after that it wilts and you both get the space back."
      />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <AnimatePresence initial={false}>
        {matches.map((match) => (
          <MatchRow
            key={match.handle}
            match={match}
            onSayHi={(text) => onSayHi(match, text)}
            onUnmatch={() => onUnmatch(match.handle)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
