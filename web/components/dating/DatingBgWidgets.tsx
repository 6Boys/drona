"use client";

import { AnimatePresence, motion } from "framer-motion";
import { avatarBackground, initialsFor } from "@/components/ui/GradientAvatar";
import type { DatingCandidate } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   datingbg_widgets — what used to be a flat solid-colour page background
   behind the deck. Three photo tiles and two prompt notes from whoever is
   currently the front card, scattered across the page at a level behind
   every card in the stack — never blocking them, never asking to be read
   closely. The instant that front card is swiped, this crossfades to the
   next person's — it mirrors the deck, it doesn't lead it.

   Absolutely positioned within the dating page's own relative wrapper, not
   position: fixed to the viewport — fixed would measure from the browser
   edge and collide with the sidebar on desktop; absolute-inside-relative
   stays put just the same without knowing anything about the app shell
   around it.
   -------------------------------------------------------------------------- */

interface Placement {
  top: string;
  left?: string;
  right?: string;
  width: string;
  height: string;
  rotate: number;
}

const PHOTO_SPOTS: Placement[] = [
  { top: "4%", left: "-6%", width: "17rem", height: "21rem", rotate: -9 },
  { top: "54%", right: "-8%", width: "19rem", height: "23rem", rotate: 7 },
  { top: "68%", left: "2%", width: "13rem", height: "16rem", rotate: 5 },
];

const PROMPT_SPOTS: Placement[] = [
  { top: "16%", right: "1%", width: "15rem", height: "auto", rotate: 4 },
  { top: "78%", right: "16%", width: "14rem", height: "auto", rotate: -5 },
];

export function DatingBgWidgets({ candidate }: { candidate?: DatingCandidate }) {
  const prompts = candidate?.prompts.slice(0, 2) ?? [];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <AnimatePresence mode="wait">
        {candidate && (
          <motion.div
            key={candidate.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {PHOTO_SPOTS.map((spot, i) => (
              <div
                key={i}
                className="absolute overflow-hidden rounded-[var(--r-2xl)]"
                style={{
                  top: spot.top,
                  left: spot.left,
                  right: spot.right,
                  width: spot.width,
                  height: spot.height,
                  transform: `rotate(${spot.rotate}deg)`,
                  background: avatarBackground(candidate.avatar),
                  opacity: 0.22,
                  filter: "blur(2px)",
                }}
              >
                {i === 0 && (
                  <span className="display absolute inset-0 flex items-center justify-center text-[4rem] text-white/70">
                    {initialsFor(candidate.displayName)}
                  </span>
                )}
              </div>
            ))}

            {prompts.map((prompt, i) => {
              const spot = PROMPT_SPOTS[i];
              if (!spot) return null;
              return (
                <div
                  key={prompt.question}
                  className={cn("glass absolute rounded-[var(--r-lg)] p-4")}
                  style={{
                    top: spot.top,
                    left: spot.left,
                    right: spot.right,
                    width: spot.width,
                    transform: `rotate(${spot.rotate}deg)`,
                    opacity: 0.3,
                  }}
                >
                  <p className="mono-label text-[0.5625rem]">{prompt.question}</p>
                  <p className="serif mt-2 line-clamp-2 text-[0.9375rem] leading-snug text-text">
                    {prompt.answer}
                  </p>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
