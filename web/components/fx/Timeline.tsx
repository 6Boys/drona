"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Timeline — sticky headings down the left, content on the right, and a rule
   between them that fills as the reader descends.

   The beam is measured, not guessed: the track's real pixel height is read
   after layout and re-read on resize, so the fill lines up with the last entry
   at any width instead of running out early on mobile.
   -------------------------------------------------------------------------- */

export interface TimelineEntry {
  label: string;
  title: ReactNode;
  body: ReactNode;
}

export function Timeline({
  entries,
  className,
}: {
  entries: TimelineEntry[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setHeight(node.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 15%", "end 60%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, height]);
  const fade = useTransform(scrollYProgress, [0, 0.08], [0, 1]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {entries.map((entry, i) => (
        <div key={i} className="flex justify-start gap-6 pt-10 md:gap-12 md:pt-16">
          <div className="sticky top-28 z-10 flex max-w-[13rem] flex-col items-start self-start md:w-[13rem]">
            <div className="glass glass-pill absolute -left-[0.6rem] flex size-9 items-center justify-center md:-left-[1.1rem]">
              <span className="size-2.5 rounded-full bg-accent" />
            </div>
            <div className="hidden pl-8 md:block">
              <p className="mono-label">{entry.label}</p>
              <h3 className="display mt-2 text-[1.75rem] text-text">{entry.title}</h3>
            </div>
          </div>

          <div className="w-full max-w-2xl pl-8 md:pl-0">
            <div className="md:hidden">
              <p className="mono-label">{entry.label}</p>
              <h3 className="display mt-1.5 mb-3 text-[1.5rem] text-text">{entry.title}</h3>
            </div>
            {entry.body}
          </div>
        </div>
      ))}

      {/* The track, and the beam that fills it. */}
      <div
        aria-hidden
        className="absolute top-0 left-[0.55rem] w-px md:left-[0.1rem]"
        style={{ height: height || undefined }}
      >
        <div className="h-full w-px bg-gradient-to-b from-transparent via-border-strong to-transparent" />
        <motion.div
          style={{ height: fill, opacity: fade }}
          className="absolute inset-x-0 top-0 w-px rounded-full bg-gradient-to-b from-accent via-accent-hi to-transparent"
        />
      </div>
    </div>
  );
}
