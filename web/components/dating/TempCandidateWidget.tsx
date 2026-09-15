"use client";

import { useEffect, useRef, useState } from "react";
import { avatarBackground, initialsFor } from "@/components/ui/GradientAvatar";
import type { DatingCandidate } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   TempCandidateWidget — the light stand-in for whoever is next in the deck.

   The full ProfileCard is a lot of markup (CanvasReveal canvas, up to three
   prompt blocks, an interests row) to render two or three times just to peek
   out from behind the card someone is actually looking at. This is the
   opposite: one photo panel plus at most two of their prompts, in a single
   three-panel strip. It sits behind the draggable top card and is never
   itself interactive — a real device routes every touch to the card on top —
   so the "scroll" through its panels is autoplayed rather than dragged, a
   small bit of life in the part of the deck nobody's looking at yet.

   It disappears the instant its candidate stops being "next": SwipeDeck only
   ever renders one of these per member of `deck.slice(1, STACK_DEPTH)`, so
   the moment the card above it flies away, this unmounts and the real,
   interactive ProfileCard takes its place.
   -------------------------------------------------------------------------- */

const AUTO_ADVANCE_MS = 2800;

export function TempCandidateWidget({
  candidate,
  className,
}: {
  candidate: DatingCandidate;
  className?: string;
}) {
  const panels = candidate.prompts.slice(0, 2);
  const panelCount = 1 + panels.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (panelCount <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % panelCount;
        const track = trackRef.current;
        if (track) {
          track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
        }
        return next;
      });
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(id);
  }, [panelCount, candidate.id]);

  return (
    <article
      aria-hidden
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[var(--r-2xl)] border border-border bg-surface shadow-[var(--sh-pop)]",
        className,
      )}
    >
      <div ref={trackRef} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-hidden">
        {/* ------------------------------------------------------- photo -- */}
        <div
          className="relative h-full w-full shrink-0 snap-center"
          style={{ background: avatarBackground(candidate.avatar) }}
        >
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.32) 0%, transparent 44%, rgba(22,21,15,0.4) 100%)",
            }}
          />
          <span className="display absolute inset-0 flex items-center justify-center text-[4.5rem] leading-none text-white/85">
            {initialsFor(candidate.displayName)}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-[1.125rem] font-medium text-white">{candidate.displayName}</p>
            <p className="mt-0.5 text-[0.75rem] text-white/75">
              {[candidate.branch, candidate.year ? `Year ${candidate.year}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        {/* --------------------------------------------- up to 2 prompts -- */}
        {panels.map((prompt, i) => (
          <div
            key={prompt.question}
            className={cn(
              "flex h-full w-full shrink-0 snap-center flex-col justify-center bg-surface px-7",
              i === panels.length - 1 && "pr-9",
            )}
          >
            <p className="mono-label">{prompt.question}</p>
            <p className="serif mt-3 text-[1.375rem] leading-[1.3] text-text">{prompt.answer}</p>
          </div>
        ))}
      </div>

      {panelCount > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-1.5 pb-4">
          {Array.from({ length: panelCount }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === active ? "w-4 bg-accent" : "w-1.5 bg-border-strong",
              )}
            />
          ))}
        </div>
      )}
    </article>
  );
}
