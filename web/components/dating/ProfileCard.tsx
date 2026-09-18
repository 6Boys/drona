"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { avatarBackground, avatarColours, initialsFor } from "@/components/ui/GradientAvatar";
import { CanvasReveal } from "@/components/fx/CanvasReveal";
import { Badge } from "@/components/ui/Badge";
import { HeartIcon, CheckIcon, BookIcon, HomeIcon, SparkleIcon, LockIcon } from "@/components/ui/Icons";
import { ReportBlockMenu } from "./ReportBlockMenu";
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
        "flex size-11 cursor-pointer items-center justify-center rounded-full bg-surface shadow-[var(--sh-pop)] transition-colors duration-200",
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
  onRemove,
  likedTargets,
  className,
  scrollable = true,
  photoNav = true,
}: {
  candidate: DatingCandidate;
  interactive?: boolean;
  onLike?: (target: LikeTarget) => void;
  /** Called after a successful report or block — the caller should drop this
   * candidate from whatever list is showing it. */
  onRemove?: () => void;
  /** Keys already liked: "photo" or "prompt:0". Shows state without re-fetching. */
  likedTargets?: Set<string>;
  className?: string;
  scrollable?: boolean;
  /** Tap-to-page zones over the photo. Off when this card is the live drag
   * surface in SwipeDeck — a tap-zone's pointerdown has to stay out of
   * framer-motion's way there, or a swipe that happens to start over the
   * photo (most of the card) never begins. Nothing else drags this card, so
   * every other caller (the "Read all of it" dialog, the editor preview, a
   * plain profile view) can leave it on. */
  photoNav?: boolean;
}) {
  const [hot, setHot] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [first, ...rest] = candidate.prompts;
  const photos = candidate.photos ?? [];
  // Clamped, not just checked: a candidate swap can land photoIndex from the
  // previous person past the end of a shorter photos array for one render
  // before the reset effect below commits.
  const activePhotoIndex = Math.min(photoIndex, Math.max(photos.length - 1, 0));

  // A different candidate landing on the same mounted card (deck advancing to
  // the next person) must not keep showing photo 3 of someone who only has 2.
  useEffect(() => setPhotoIndex(0), [candidate.id]);
  const colours = avatarColours(candidate.avatar);
  const liked = (key: string) => likedTargets?.has(key) ?? false;

  return (
    <article
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      className={cn(
        "no-scrollbar flex h-full w-full flex-col rounded-[var(--r-2xl)] select-none",
        "border border-border bg-surface shadow-[var(--sh-pop)]",
        scrollable ? "overflow-y-auto overscroll-contain" : "overflow-hidden",
        className,
      )}
    >
      {/* ---------------------------------------------------------- photo -- */}
      <div className="relative z-10 shrink-0 basis-[max(11rem,44%)] px-3 pt-3">
        <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[var(--r-xl)]">
          {photos.length > 0 ? (
            <>
              <Image
                key={photos[activePhotoIndex]}
                // Non-null: activePhotoIndex is clamped into [0, photos.length)
                // above, and this branch only renders when photos.length > 0 —
                // TS just can't see across that from a computed index.
                src={photos[activePhotoIndex]!}
                alt={`${candidate.displayName}'s photo ${activePhotoIndex + 1} of ${photos.length}`}
                fill
                unoptimized
                className="object-cover"
              />

              {photos.length > 1 && (
                <>
                  {photoNav && (
                    <>
                      {/* Tap either half to page through — the same convention
                          Hinge and Tinder use, so there is nothing new to learn. */}
                      <button
                        type="button"
                        aria-label="Previous photo"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
                        }}
                        className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer"
                      />
                      <button
                        type="button"
                        aria-label="Next photo"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoIndex((i) => (i + 1) % photos.length);
                        }}
                        className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer"
                      />
                    </>
                  )}
                  <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
                    {photos.map((_, i) => (
                      <span
                        key={i}
                        aria-hidden
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          i === activePhotoIndex ? "bg-white" : "bg-white/35",
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
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
            </div>
          )}

          {candidate.photoVerified && (
            <span
              className={cn(
                "glass glass-pill absolute left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] text-text",
                photos.length > 1 ? "top-7" : "top-3",
              )}
            >
              <CheckIcon size={11} className="text-positive" />
              Verified student
            </span>
          )}

          {interactive && (
            <ReportBlockMenu
              candidate={candidate}
              onHandled={onRemove}
              className={cn("absolute z-10", photos.length > 1 ? "top-7 right-3" : "top-3 right-3")}
            />
          )}
        </div>

        {interactive && (
          <LikeButton
            label={`Like ${candidate.displayName}'s picture`}
            liked={liked("photo")}
            onClick={onLike && (() => onLike({ kind: "PHOTO" }))}
            className="absolute right-6 -bottom-5 z-20"
          />
        )}
      </div>

      {/* ----------------------------------------------------------- name -- */}
      <Block className="relative z-10 pt-7 pb-5">
        <h2 className="display text-[2.5rem] text-text">{candidate.displayName}</h2>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {candidate.branch && (
            <Badge tone="neutral">
              <BookIcon size={11} />
              {candidate.branch}
            </Badge>
          )}
          {candidate.year && <Badge tone="neutral">Year {candidate.year}</Badge>}
          <Badge tone="neutral">
            <HomeIcon size={11} />
            Same campus
          </Badge>
        </div>

        {candidate.vibe && (
          <div className="relative mt-4 rounded-[var(--r-md)] border border-[color-mix(in_oklab,var(--accent)_22%,transparent)] bg-accent-wash py-3 pr-4 pl-9">
            <SparkleIcon size={14} className="absolute top-3.5 left-3 text-accent-hi" />
            <p className="serif text-[1.0625rem] leading-snug text-text">{candidate.vibe}</p>
          </div>
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
                onClick={onLike && (() => onLike({ kind: "PROMPT", promptIndex: 0 }))}
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
                onClick={onLike && (() => onLike({ kind: "PROMPT", promptIndex: i + 1 }))}
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
  obscured,
}: {
  candidate: DatingCandidate;
  quote?: string;
  footer?: ReactNode;
  className?: string;
  active?: boolean;
  /** Premium-gated: what they said stays, who they are doesn't — no initials,
   * no name, no branch/year (each is identifying on a campus this size). */
  obscured?: boolean;
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

      {obscured && (
        <span aria-hidden className="absolute inset-0 backdrop-blur-md" />
      )}

      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 38%, rgba(22,21,15,0.55) 100%)",
        }}
      />

      <div className="relative flex h-full flex-col justify-between p-4">
        {obscured ? (
          <span className="flex size-9 items-center justify-center self-start rounded-full bg-black/30 text-white/80">
            <LockIcon size={16} />
          </span>
        ) : (
          <span className="display self-start text-[2.25rem] leading-none text-white/80">
            {initialsFor(candidate.displayName)}
          </span>
        )}

        <div>
          {quote && (
            <p className="serif line-clamp-2 text-[0.9375rem] leading-snug text-white/90">
              &ldquo;{quote}&rdquo;
            </p>
          )}
          <p className="mt-1.5 text-[0.9375rem] font-medium text-white">
            {obscured ? (
              "Someone on your campus"
            ) : (
              <>
                {candidate.displayName}
                <span className="ml-1.5 text-[0.75rem] font-normal text-white/70">
                  {candidate.branch} · Year {candidate.year}
                </span>
              </>
            )}
          </p>
          {footer}
        </div>
      </div>
    </div>
  );
}
