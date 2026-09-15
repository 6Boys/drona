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
   spread down the page as a zigzag: a photo tile on one side, a prompt on
   the other, repeating. Not a tidy inline strip and not faded background
   art either — each piece is fully opaque and tappable, and tapping any of
   them pops up the same ProfileCard the deck itself uses.

   Deliberately ordinary document flow, not absolute positioning: this app
   already shipped one horizontal-scroll bug from a transform-rotated stack
   that had nowhere to clip to (see SwipeDeck's overflow-hidden fix, same
   commit as this file) — a zigzag built from margin/alignment instead of
   translate+rotate can't reproduce that, on any screen width, on the deck
   page or in the Android WebView wrapping it.
   -------------------------------------------------------------------------- */

type Side = "left" | "right";

function ZigzagRow({
  side,
  rotate,
  onClick,
  label,
  children,
}: {
  side: Side;
  rotate: number;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex", side === "left" ? "justify-start" : "justify-end")}>
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={label}
        // No x-offset entrance: a translateX on a still-mounting element
        // extends the page's scrollable-overflow area for the fraction of a
        // second it's in flight — even though the transform never moves the
        // element's actual layout box, browsers count the painted position
        // toward scrollWidth. That's exactly the kind of transient
        // horizontal-scroll glitch this file exists to not reintroduce (see
        // SwipeDeck's overflow-hidden fix in this same commit).
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, rotate }}
        whileHover={{ rotate: 0, scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className={cn(
          "w-[min(78%,20rem)] cursor-pointer overflow-hidden rounded-[var(--r-lg)]",
          "border border-border text-left shadow-[var(--sh-card)]",
          side === "left" ? "ml-1" : "mr-1",
        )}
      >
        {children}
      </motion.button>
    </div>
  );
}

export function DatingBgWidgets({ candidate }: { candidate?: DatingCandidate }) {
  const [open, setOpen] = useState(false);

  if (!candidate) return null;

  const prompts = candidate.prompts.slice(0, 2);
  const label = `Open ${candidate.displayName}'s profile`;

  // Photo, prompt, photo, prompt, photo — interleaved in that content order,
  // then the side alternates strictly by position (not by content type), so
  // it's a true zigzag: left, right, left, right, left, never two in a row
  // on the same side.
  const content: { kind: "photo" | "prompt"; prompt?: (typeof prompts)[number] }[] = [{ kind: "photo" }];
  if (prompts[0]) content.push({ kind: "prompt", prompt: prompts[0] });
  content.push({ kind: "photo" });
  if (prompts[1]) content.push({ kind: "prompt", prompt: prompts[1] });
  content.push({ kind: "photo" });

  const steps = content.map((c, i) => ({ ...c, side: (i % 2 === 0 ? "left" : "right") as Side }));

  return (
    <div className="mt-10 overflow-hidden">
      <p className="mono-label mb-4 text-center">a closer look at {candidate.displayName.split(" ")[0]}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={candidate.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {steps.map((step, i) =>
            step.kind === "photo" ? (
              <ZigzagRow key={`photo-${i}`} side={step.side} rotate={step.side === "left" ? -3 : 3} onClick={() => setOpen(true)} label={label}>
                <div className="relative h-28" style={{ background: avatarBackground(candidate.avatar) }}>
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 50%, rgba(22,21,15,0.3) 100%)",
                    }}
                  />
                  <span className="display absolute inset-0 flex items-center justify-center text-[2.25rem] text-white/90">
                    {initialsFor(candidate.displayName)}
                  </span>
                </div>
              </ZigzagRow>
            ) : (
              <ZigzagRow
                key={step.prompt!.question}
                side={step.side}
                rotate={step.side === "left" ? -2 : 2}
                onClick={() => setOpen(true)}
                label={label}
              >
                <div className="bg-surface p-4">
                  <p className="mono-label line-clamp-1">{step.prompt!.question}</p>
                  <p className="serif mt-2 line-clamp-2 text-[0.9375rem] leading-snug text-text">
                    {step.prompt!.answer}
                  </p>
                </div>
              </ZigzagRow>
            ),
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-4 text-center text-[0.6875rem] text-faint">tap any of these to open the full profile</p>

      <Dialog open={open} onClose={() => setOpen(false)} title={candidate.displayName} width="sm">
        <div className="h-[65dvh] max-h-[32rem]">
          <ProfileCard candidate={candidate} />
        </div>
      </Dialog>
    </div>
  );
}
