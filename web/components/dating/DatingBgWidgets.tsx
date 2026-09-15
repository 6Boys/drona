"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { avatarBackground, initialsFor } from "@/components/ui/GradientAvatar";
import { Dialog } from "@/components/ui/Dialog";
import { ProfileCard } from "./ProfileCard";
import type { DatingCandidate } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   datingbg_widgets — a real, visible piece of the front card's own profile,
   not background decoration. Three photo tiles and up to two prompts from
   whoever is currently on top of the deck, laid out as ordinary page content
   below the deck (so it's never hidden behind the card, on a phone screen or
   anywhere else) and fully clickable — tap any piece and the whole profile
   pops up, the same ProfileCard the deck itself uses.

   Swapping to the next person is a crossfade keyed on candidate.id, so it
   reads as "this strip belongs to whoever you're looking at" rather than a
   static header.
   -------------------------------------------------------------------------- */

function Tile({
  onClick,
  rotate,
  className,
  children,
  label,
}: {
  onClick: () => void;
  rotate: number;
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      initial={{ rotate }}
      whileHover={{ rotate: 0, scale: 1.04, zIndex: 10 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={cn(
        "relative shrink-0 cursor-pointer overflow-hidden rounded-[var(--r-lg)] border border-border text-left shadow-[var(--sh-card)]",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export function DatingBgWidgets({ candidate }: { candidate?: DatingCandidate }) {
  const [open, setOpen] = useState(false);

  if (!candidate) return null;

  const prompts = candidate.prompts.slice(0, 2);
  const rotations = [-4, 3, -2, 5, -5];

  return (
    <>
      <div className="mt-8">
        <p className="mono-label mb-3 text-center">a closer look at {candidate.displayName.split(" ")[0]}</p>

        <AnimatePresence mode="wait">
          <motion.div
            key={candidate.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="no-scrollbar flex items-start justify-center gap-3 overflow-x-auto px-4 py-2"
          >
            {[0, 1, 2].map((i) => (
              <Tile
                key={`photo-${i}`}
                onClick={() => setOpen(true)}
                rotate={rotations[i]!}
                label={`Open ${candidate.displayName}'s profile`}
                className="h-24 w-24"
              >
                <div className="relative h-full w-full" style={{ background: avatarBackground(candidate.avatar) }}>
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 50%, rgba(22,21,15,0.3) 100%)",
                    }}
                  />
                  {i === 0 && (
                    <span className="display absolute inset-0 flex items-center justify-center text-[1.75rem] text-white/90">
                      {initialsFor(candidate.displayName)}
                    </span>
                  )}
                </div>
              </Tile>
            ))}

            {prompts.map((prompt, i) => (
              <Tile
                key={prompt.question}
                onClick={() => setOpen(true)}
                rotate={rotations[i + 3]!}
                label={`Open ${candidate.displayName}'s profile`}
                className="h-24 w-36 bg-surface p-3"
              >
                <p className="mono-label line-clamp-1 text-[0.5625rem]">{prompt.question}</p>
                <p className="serif mt-1.5 line-clamp-2 text-[0.8125rem] leading-snug text-text">
                  {prompt.answer}
                </p>
              </Tile>
            ))}
          </motion.div>
        </AnimatePresence>

        <p className="mt-2 text-center text-[0.6875rem] text-faint">tap any of these to open the full profile</p>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={candidate.displayName} width="sm">
        <div className="h-[65dvh] max-h-[32rem]">
          <ProfileCard candidate={candidate} />
        </div>
      </Dialog>
    </>
  );
}
