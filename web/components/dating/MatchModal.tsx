"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GradientAvatar } from "@/components/ui/GradientAvatar";
import { Atmosphere } from "@/components/fx/Backdrops";
import { Button } from "@/components/ui/Button";
import { SendIcon } from "@/components/ui/Icons";
import type { Avatar as AvatarShape, DatingCandidate } from "@/lib/types";

/* -----------------------------------------------------------------------------
   The match moment.

   It gets one beat of ceremony — two discs meeting on glass — and then
   immediately turns into a place to type, because the gap between "it's a
   match" and the first message is where matches go to die. No confetti: the
   event is the reward.
   -------------------------------------------------------------------------- */

export function MatchModal({
  candidate,
  viewerAvatar,
  viewerName,
  onClose,
  onSend,
}: {
  candidate: DatingCandidate | null;
  viewerAvatar: AvatarShape;
  viewerName: string;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!candidate) return;
    setDraft("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = setTimeout(() => ref.current?.focus(), 420);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      clearTimeout(focus);
    };
  }, [candidate, onClose]);

  const first = candidate?.displayName.split(" ")[0] ?? "";

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
  };

  return (
    <AnimatePresence>
      {candidate && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[rgb(22_21_15_/_0.34)] backdrop-blur-lg"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="It's a match"
            className="glass glass-strong relative w-full max-w-sm overflow-hidden rounded-[var(--r-2xl)] p-7 text-center"
            initial={{ scale: 0.9, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <Atmosphere tone="love" className="opacity-60" />

            <div className="relative z-10">
              <motion.p
                className="mono-label"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                mutual
              </motion.p>

              <motion.h2
                className="display mt-2 text-[2.25rem] text-text"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                You and {first}.
              </motion.h2>

              <div className="mt-7 flex items-center justify-center">
                <motion.div
                  initial={{ x: 34, rotate: 10, opacity: 0 }}
                  animate={{ x: 12, rotate: -5, opacity: 1 }}
                  transition={{ delay: 0.22, type: "spring", stiffness: 200, damping: 17 }}
                  className="rounded-full ring-4 ring-[var(--surface)]"
                >
                  <GradientAvatar avatar={viewerAvatar} name={viewerName} size={80} />
                </motion.div>
                <motion.div
                  initial={{ x: -34, rotate: -10, opacity: 0 }}
                  animate={{ x: -12, rotate: 5, opacity: 1 }}
                  transition={{ delay: 0.22, type: "spring", stiffness: 200, damping: 17 }}
                  className="-ml-4 rounded-full ring-4 ring-[var(--surface)]"
                >
                  <GradientAvatar avatar={candidate.avatar} name={candidate.displayName} size={80} />
                </motion.div>
              </div>

              <motion.p
                className="mt-6 text-[0.875rem] leading-relaxed text-muted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.36 }}
              >
                You both liked something. It stays open for a week — after that it wilts, whoever
                was going to speak first.
              </motion.p>

              <motion.div
                className="mt-5 space-y-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 }}
              >
                <div className="flex gap-2">
                  <input
                    ref={ref}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={`Say something to ${first}`}
                    aria-label={`Message ${candidate.displayName}`}
                    className="min-w-0 flex-1 rounded-[var(--r-md)] border border-border bg-surface px-3.5 text-[0.875rem] text-text outline-none transition-colors placeholder:text-faint focus:border-accent"
                  />
                  <Button onClick={send} disabled={!draft.trim()} aria-label="Send">
                    <SendIcon size={16} />
                  </Button>
                </div>
                <button
                  onClick={onClose}
                  className="w-full cursor-pointer py-1.5 text-[0.8125rem] text-muted transition-colors hover:text-text"
                >
                  Later — keep going
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
