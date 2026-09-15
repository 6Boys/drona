"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   LayoutGrid — a mosaic where clicking a tile promotes it to the middle of the
   grid and everything else blurs away behind glass.

   The promotion is a shared-element transition (`layoutId`), so the tile you
   clicked is literally the tile that grows: no cross-fade between two different
   elements, which is what makes the motion read as physical rather than as a
   modal appearing.
   -------------------------------------------------------------------------- */

export interface LayoutGridCard {
  id: string;
  /** Grid placement, e.g. "md:col-span-2 md:row-span-2". */
  className?: string;
  /** Always-visible face of the tile. Given the open state, so a face can drop
   * whatever the expanded panel is about to say and avoid repeating itself. */
  thumbnail: ReactNode | ((open: boolean) => ReactNode);
  /** Revealed underneath the tile once it is promoted. */
  content: ReactNode;
}

export function LayoutGrid({
  cards,
  className,
}: {
  cards: LayoutGridCard[];
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  // Escape closes; while a tile is open the page behind it shouldn't scroll.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <div
      className={cn(
        "relative grid auto-rows-[13rem] grid-cols-1 gap-3 md:grid-cols-3 md:auto-rows-[15rem]",
        className,
      )}
    >
      {cards.map((card) => {
        const open = selected === card.id;
        return (
          <div key={card.id} className={card.className}>
            {/* A div rather than a <button>: the promoted card holds its own
                controls, and a button inside a button is invalid markup that
                browsers resolve by dropping one of them. Keyboard semantics are
                supplied by hand instead. */}
            <motion.div
              role="button"
              tabIndex={0}
              layoutId={`tile-${card.id}`}
              onClick={() => setSelected(open ? null : card.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(open ? null : card.id);
                }
                if (e.key === "Escape" && open) setSelected(null);
              }}
              aria-expanded={open}
              className={cn(
                "squircle group cursor-pointer overflow-hidden border border-border bg-surface text-left",
                // Open, the card is a column: face on top, content beneath it.
                // Stacking the content over the face instead means a face that
                // puts anything at its own bottom edge — a title, a caption —
                // ends up underneath the panel's text, showing through it.
                open
                  ? "fixed inset-0 z-50 m-auto flex h-[min(32rem,82vh)] w-[min(46rem,92vw)] flex-col shadow-[var(--sh-pop)]"
                  : "relative block h-full w-full shadow-[var(--sh-card)] transition-shadow duration-300 hover:shadow-[var(--sh-pop)]",
              )}
            >
              <motion.div
                layoutId={`face-${card.id}`}
                className={open ? "relative min-h-0 flex-1 overflow-hidden" : "absolute inset-0"}
              >
                {typeof card.thumbnail === "function" ? card.thumbnail(open) : card.thumbnail}
              </motion.div>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3, delay: 0.08 }}
                    className="relative z-10 shrink-0 overflow-y-auto p-5"
                  >
                    {card.content}
                  </motion.div>
                )}
              </AnimatePresence>

              {open && (
                <span className="glass glass-pill absolute top-4 right-4 z-20 flex size-9 items-center justify-center text-text">
                  <XIcon size={16} />
                </span>
              )}
            </motion.div>
          </div>
        );
      })}

      <AnimatePresence>
        {selected && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-40 bg-[rgb(22_21_15_/_0.28)] backdrop-blur-md"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
