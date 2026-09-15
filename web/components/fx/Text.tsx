"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Type that moves. Four variants, all driven by the same idea: the sentence
   holds still and exactly one word changes, so the reader's eye never has to
   re-find the line.
   -------------------------------------------------------------------------- */

function useRotation(length: number, interval: number, paused = false) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused || length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % length), interval);
    return () => clearInterval(id);
  }, [length, interval, paused]);
  return index;
}

/** Words swap in place, letter by letter, blurring as they leave. */
export function FlipWords({
  words,
  interval = 2600,
  className,
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const index = useRotation(words.length, interval);
  const word = words[index] ?? words[0] ?? "";

  return (
    <span className="relative inline-block align-bottom">
      <AnimatePresence mode="wait">
        <motion.span
          key={word}
          initial={{ opacity: 0, y: "-0.4em", filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "0.4em", filter: "blur(6px)", position: "absolute" }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className={cn("inline-block whitespace-nowrap", className)}
        >
          {word.split("").map((letter, i) => (
            <motion.span
              key={`${word}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.018, duration: 0.3 }}
              className="inline-block"
            >
              {letter === " " ? " " : letter}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * The word sits inside a tinted slab that resizes to fit it. Because the slab
 * is `layout`-animated, the box stretches and the line around it re-flows in
 * one continuous motion instead of snapping.
 */
export function ContainerTextFlip({
  words,
  interval = 2800,
  className,
  slabClassName,
}: {
  words: string[];
  interval?: number;
  className?: string;
  slabClassName?: string;
}) {
  const index = useRotation(words.length, interval);
  const id = useId();
  const word = words[index] ?? words[0] ?? "";

  return (
    <motion.span
      layout
      layoutId={`slab-${id}`}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className={cn(
        "relative inline-flex items-center overflow-hidden rounded-[var(--r-md)] px-3 py-1",
        "border border-border bg-surface shadow-[var(--sh-card)]",
        slabClassName,
      )}
    >
      {/* The whole word swaps as one unit — `mode="wait"` means the old one
          has left before the new one mounts. Per-letter AnimatePresence looks
          identical when it works, but on a word change every letter exits at
          once, and popLayout pulls those exiting letters out of the flow, so
          they stack up behind the incoming word. That reads as garbled text
          rather than a transition. Only the entrance is staggered now;
          leaving is a single motion. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          exit={{ opacity: 0, filter: "blur(8px)", y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn("inline-block whitespace-nowrap", className)}
        >
          {word.split("").map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, filter: "blur(8px)", y: 10 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.26 }}
              className="inline-block"
            >
              {letter === " " ? " " : letter}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

/**
 * Label and word trade places: the static half slides aside as the rotating
 * half resizes, so the whole phrase re-balances on every change.
 */
export function LayoutTextFlip({
  text,
  words,
  interval = 3000,
  className,
  wordClassName,
}: {
  text: string;
  words: string[];
  interval?: number;
  className?: string;
  wordClassName?: string;
}) {
  return (
    <motion.span layout className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <motion.span layout>{text}</motion.span>
      <ContainerTextFlip words={words} interval={interval} className={wordClassName} />
    </motion.span>
  );
}

/** Paragraph that assembles itself word by word the first time it is seen. */
export function TextGenerate({
  text,
  className,
  delay = 0,
  stagger = 0.035,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const seen = useInView(ref, { once: true, margin: "-12% 0px" });
  const words = text.split(" ");

  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ opacity: 0, filter: "blur(8px)", y: 6 }}
          animate={seen ? { opacity: 1, filter: "blur(0px)", y: 0 } : undefined}
          transition={{ duration: 0.5, delay: delay + i * stagger, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </p>
  );
}
