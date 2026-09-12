"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { avatarBackground, avatarColours, initialsFor } from "@/components/ui/GradientAvatar";
import { CanvasReveal } from "@/components/fx/CanvasReveal";
import { HeartIcon, CheckIcon } from "@/components/ui/Icons";
import type { DatingCandidate, LikeTarget } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   A profile the way Hinge builds one: a picture, a name in serif, and then the
   person's own sentences in blocks you can like one at a time. No stat bars, no
   badges competing for the corner, no chrome around the words — hairlines and
   whitespace do the separating.

   The one liberty taken: nobody here uploads a photo, so the picture panel is
   their gradient. Resting on hover it blooms into a dot field in their own two
   colours, which gives the card something to do with a cursor without adding
   anything a reader has to parse.
   -------------------------------------------------------------------------- */

/** The circular like control that floats over a photo or a prompt. */
function LikeButton({
  label,
  onClick,
  className,
  liked,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  liked?: boolean;
}) {
  if (!onClick) return null;
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.88 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "glass glass-pill flex size-11 cursor-pointer items-center justify-center transition-colors duration-200",
        liked ? "text-accent" : "text-muted hover:text-accent",
        className,
      )}
    >
      <HeartIcon size={18} />
    </motion.button>
  );
}

function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("relative px-6", className)}>{children}</section>;
}

function Hairline() {
  return <div className="mx-6 h-px bg-border" aria-hidden />;
}

export function ProfileCard({
  candidate,
  interactive = false,
  onLike,
  likedTargets,
  className,
  scrollable = true,
}: {
  candidate: DatingCandidate;
  interactive?: boolean;
  onLike?: (target: LikeTarget) => void;
  /** Keys already liked: "photo" or "prompt:0". Shows state without re-fetching. */
  likedTargets?: Set<string>;
  className?: string;
  scrollable?: boolean;
}) {
  const [hot, setHot] = useState(false);
  const [first, ...rest] = candidate.prompts;
  const colours = avatarColours(candidate.avatar);
  const liked = (key: string) => likedTargets?.has(key) ?? false;

  return (
    <article
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      className={cn(
        "glass glass-strong no-scrollbar flex h-full w-full flex-col rounded-[var(--r-2xl)] select-none",
        scrollable ? "overflow-y-auto overscroll-contain" : "overflow-hidden",
        className,
      )}
    >
      {/* ---------------------------------------------------------- photo -- */}
      <div className="relative z-10 shrink-0 px-3 pt-3">
        <div
          className="relative flex h-[19rem] items-center justify-center overflow-hidden rounded-[var(--r-xl)]"
          style={{ background: avatarBackground(candidate.avatar) }}
        >
          <CanvasReveal active={hot} colours={colours} dotSize={2} gap={5} />

          {/* Light falling from above, then a floor shadow to seat the name. */}
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.34) 0%, transparent 46%, rgba(22,21,15,0.18) 100%)",
            }}
          />

          <span className="display relative text-[5.5rem] leading-none text-white/85">
            {initialsFor(candidate.displayName)}
          </span>

          {candidate.verified && (
            <span className="glass glass-pill absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] text-text">
              <CheckIcon size={11} className="text-positive" />
              Verified student
            </span>
          )}
        </div>

        {interactive && (
          <LikeButton
            label={`Like ${candidate.displayName}'s picture`}
            liked={liked("photo")}
            onClick={onLike && (() => onLike({ kind: "photo" }))}
            className="absolute right-6 -bottom-5 z-20"
          />
        )}
      </div>

      {/* ----------------------------------------------------------- name -- */}
      <Block className="relative z-10 pt-7 pb-5">
        <h2 className="display text-[2.5rem] text-text">{candidate.displayName}</h2>

        <p className="mt-2 text-[0.8125rem] text-muted">
          {candidate.branch} · Year {candidate.year} · {candidate.distanceNote}
        </p>

        {candidate.vibe && (
          <p className="serif mt-3 text-[1.0625rem] leading-snug text-muted">{candidate.vibe}</p>
        )}
      </Block>

      {/* -------------------------------------------------------- prompt 1 -- */}
      {first && (
        <>
          <Hairline />
          <Block className="relative z-10 py-6">
            <p className="mono-label">{first.question}</p>
            <p className="serif mt-3 text-[1.5rem] leading-[1.3] text-text">{first.answer}</p>
            {interactive && (
              <LikeButton
                label={`Like this answer from ${candidate.displayName}`}
                liked={liked("prompt:0")}
                onClick={onLike && (() => onLike({ kind: "prompt", index: 0 }))}
                className="absolute right-6 -bottom-5 z-20"
              />
            )}
          </Block>
        </>
      )}

      {/* ------------------------------------------------------- interests -- */}
      {candidate.interests.length > 0 && (
        <>
          <Hairline />
          <Block className="relative z-10 py-6">
            <p className="mono-label mb-3">Into</p>
            <div className="flex flex-wrap gap-2">
              {candidate.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-border bg-surface/60 px-3 py-1.5 text-[0.8125rem] text-muted"
                >
                  {interest}
                </span>
              ))}
            </div>
          </Block>
        </>
      )}

      {/* --------------------------------------------------- more prompts -- */}
      {rest.map((prompt, i) => (
        <div key={prompt.question} className="relative z-10">
          <Hairline />
          <Block className="relative py-6">
            <p className="mono-label">{prompt.question}</p>
            <p className="serif mt-3 text-[1.5rem] leading-[1.3] text-text">{prompt.answer}</p>
            {interactive && (
              <LikeButton
                label={`Like this answer from ${candidate.displayName}`}
                liked={liked(`prompt:${i + 1}`)}
                onClick={onLike && (() => onLike({ kind: "prompt", index: i + 1 }))}
                className="absolute right-6 -bottom-5 z-20"
              />
            )}
          </Block>
        </div>
      ))}

      <div className="h-7 shrink-0" />

      {/* A card that can't be scrolled still has more below the fold — fade the
          cut instead of guillotining a sentence in half. */}
      {!scrollable && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 rounded-b-[var(--r-2xl)]"
          style={{
            background: "linear-gradient(180deg, transparent 0%, var(--surface) 88%)",
          }}
        />
      )}
    </article>
  );
}

/** The same person at a glance: one gradient tile, the name, and one line of
 * their own words. Used anywhere a full card would be too much — the likes
 * grid, the matches list, a rail on the feed. */
export function ProfileTile({
  candidate,
  quote,
  footer,
  className,
  active,
}: {
  candidate: DatingCandidate;
  quote?: string;
  footer?: ReactNode;
  className?: string;
  active?: boolean;
}) {
  const [hot, setHot] = useState(false);
  const on = active ?? hot;

  return (
    <div
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ background: avatarBackground(candidate.avatar) }}
    >
      <CanvasReveal active={on} colours={avatarColours(candidate.avatar)} dotSize={2} gap={5} />

      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 38%, rgba(22,21,15,0.55) 100%)",
        }}
      />

      <div className="relative flex h-full flex-col justify-between p-4">
        <span className="display self-start text-[2.25rem] leading-none text-white/80">
          {initialsFor(candidate.displayName)}
        </span>

        <div>
          {quote && (
            <p className="serif line-clamp-2 text-[0.9375rem] leading-snug text-white/90">
              &ldquo;{quote}&rdquo;
            </p>
          )}
          <p className="mt-1.5 text-[0.9375rem] font-medium text-white">
            {candidate.displayName}
            <span className="ml-1.5 text-[0.75rem] font-normal text-white/70">
              {candidate.branch} · Year {candidate.year}
            </span>
          </p>
          {footer}
        </div>
      </div>
    </div>
  );
}
