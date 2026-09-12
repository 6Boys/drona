"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   GeminiBeams — five ribbons that draw themselves across the section as the
   reader scrolls through it.

   Each path is the same curve at a different amplitude, and each gets its own
   slightly offset scroll range, so they arrive in sequence rather than as one
   thick band. `pathLength` is the only thing animating, which the browser can
   do on the compositor.
   -------------------------------------------------------------------------- */

const PATHS = [
  "M0 663C145 663 145 641 290 641C435 641 435 694 580 694C725 694 725 611 870 611C1015 611 1015 668 1160 668C1305 668 1305 631 1440 631",
  "M0 587C145 587 145 578 290 578C435 578 435 621 580 621C725 621 725 548 870 548C1015 548 1015 595 1160 595C1305 595 1305 568 1440 568",
  "M0 514C145 514 145 516 290 516C435 516 435 549 580 549C725 549 725 486 870 486C1015 486 1015 523 1160 523C1305 523 1305 506 1440 506",
  "M0 441C145 441 145 453 290 453C435 453 435 476 580 476C725 476 725 423 870 423C1015 423 1015 450 1160 450C1305 450 1305 443 1440 443",
  "M0 368C145 368 145 391 290 391C435 391 435 404 580 404C725 404 725 361 870 361C1015 361 1015 378 1160 378C1305 378 1305 381 1440 381",
];

const COLOURS = ["var(--plum-700)", "var(--plum-400)", "var(--clay-500)", "var(--rose-400)", "var(--amber-600)"];

export function GeminiBeams({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const eased = useSpring(scrollYProgress, { stiffness: 90, damping: 26, restDelta: 0.001 });

  return (
    // `isolate` so the beams can sit at a negative layer: behind the content
    // they run under, but still in front of the section's own background.
    <div ref={ref} className={cn("relative isolate", className)}>
      {children}
      <svg
        viewBox="0 0 1440 890"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 w-full"
        preserveAspectRatio="none"
      >
        {PATHS.map((d, i) => (
          <Beam key={i} d={d} colour={COLOURS[i] ?? "var(--plum-400)"} progress={eased} index={i} />
        ))}
      </svg>
    </div>
  );
}

function Beam({
  d,
  colour,
  progress,
  index,
}: {
  d: string;
  colour: string;
  progress: ReturnType<typeof useSpring>;
  index: number;
}) {
  // Stagger the ranges so the ribbons arrive one after another.
  const start = index * 0.05;
  const length = useTransform(progress, [start, start + 0.55], [0, 1]);
  const glow = useTransform(progress, [start, start + 0.2], [0, 0.35]);

  return (
    <>
      <motion.path
        d={d}
        stroke={colour}
        strokeWidth={12}
        strokeLinecap="round"
        fill="none"
        style={{ pathLength: length, opacity: glow }}
        filter="blur(8px)"
      />
      <motion.path
        d={d}
        stroke={colour}
        strokeWidth={1.75}
        strokeLinecap="round"
        fill="none"
        style={{ pathLength: length }}
        opacity={0.85}
      />
    </>
  );
}
