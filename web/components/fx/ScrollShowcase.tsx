"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { GradientAvatar } from "@/components/ui/GradientAvatar";
import { HomeIcon, MessageIcon, MoonIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   ScrollShowcase — a phone pinned in place while three captions and three
   screens crossfade past it in step with scroll.

   One scrollYProgress value (measured across a tall wrapper) drives every
   caption's opacity/lift and every screen's opacity — same one-value-drives-
   many-styles shape as ContainerScroll, just fanned out over three steps
   instead of one. The wrapper's height (steps.length viewport-heights) is
   what gives scrolling through it enough runway to feel like three distinct
   beats rather than one blurred crossfade.
   -------------------------------------------------------------------------- */

export interface ShowcaseStep {
  eyebrow: string;
  title: ReactNode;
  body: string;
  screen: ReactNode;
}

function Caption({ step, progress, index, total }: { step: ShowcaseStep; progress: ReturnType<typeof useScroll>["scrollYProgress"]; index: number; total: number }) {
  // Each step owns an equal slice of [0,1]; it fades in over the first
  // quarter of its slice, holds, then fades out over the last quarter —
  // the hold is what makes a step read as "the current one" rather than a
  // pure crossfade blur between neighbours.
  const start = index / total;
  const end = (index + 1) / total;
  const quarter = (end - start) / 4;

  const opacity = useTransform(
    progress,
    [start, start + quarter, end - quarter, end],
    [0, 1, 1, 0],
  );
  const y = useTransform(progress, [start, start + quarter], [16, 0]);

  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0 flex flex-col justify-center">
      <p className="mono-label">{step.eyebrow}</p>
      <h3 className="display mt-3 text-[clamp(1.75rem,4vw,2.75rem)]">{step.title}</h3>
      <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-muted">{step.body}</p>
    </motion.div>
  );
}

function Screen({ step, progress, index, total }: { step: ShowcaseStep; progress: ReturnType<typeof useScroll>["scrollYProgress"]; index: number; total: number }) {
  const start = index / total;
  const end = (index + 1) / total;
  const quarter = (end - start) / 4;
  const opacity = useTransform(
    progress,
    [start, start + quarter, end - quarter, end],
    [0, 1, 1, 0],
  );
  const scale = useTransform(progress, [start, start + quarter], [0.96, 1]);

  return (
    <motion.div style={{ opacity, scale }} className="absolute inset-0">
      {step.screen}
    </motion.div>
  );
}

export function ScrollShowcase({ steps, className }: { steps: ShowcaseStep[]; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <div ref={ref} className={cn("relative", className)} style={{ height: `${steps.length * 100}vh` }}>
      {/* dvh, not vh: iOS Safari's collapsing address bar means 100vh is
          taller than what's actually on screen whenever the toolbar is
          expanded, so a pinned h-screen section runs off the bottom edge on
          a real phone even though it measures fine in a desktop viewport. */}
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 lg:grid-cols-[1fr_auto]">
          <div className="relative order-2 h-56 lg:order-1 lg:h-64">
            {steps.map((step, i) => (
              <Caption key={step.eyebrow} step={step} progress={scrollYProgress} index={i} total={steps.length} />
            ))}
          </div>

          <div className="order-1 flex justify-center lg:order-2">
            {/* A titanium-edge frame, not a flat outline: the outer shell is
                the metal (a touch of highlight along its own rounded corner),
                the inset ring is where glass meets metal, and the screen's
                corner radius is tightened to sit flush inside both rather
                than repeating the same radius at every layer. Volume and
                power keys are struck as thin slivers on the shell itself, and
                the Dynamic Island floats clear of the top edge instead of
                fusing into it the way a single bezel-colored pill used to. */}
            <div className="relative h-[35rem] w-[17rem] shrink-0 rounded-[3.1rem] bg-gradient-to-b from-[var(--ink-700)] to-[var(--ink-900)] p-[3px] shadow-[var(--sh-pop)]">
              <span className="pointer-events-none absolute -left-[1.5px] top-24 h-9 w-[3px] rounded-l-sm bg-[var(--ink-900)]" />
              <span className="pointer-events-none absolute -left-[1.5px] top-36 h-14 w-[3px] rounded-l-sm bg-[var(--ink-900)]" />
              <span className="pointer-events-none absolute -left-[1.5px] top-52 h-14 w-[3px] rounded-l-sm bg-[var(--ink-900)]" />
              <span className="pointer-events-none absolute -right-[1.5px] top-40 h-16 w-[3px] rounded-r-sm bg-[var(--ink-900)]" />

              <div className="relative h-full w-full overflow-hidden rounded-[2.85rem] bg-bg ring-1 ring-inset ring-white/15">
                <div className="absolute inset-x-0 top-2.5 z-10 flex justify-center">
                  <div className="h-[1.65rem] w-[6.75rem] rounded-full bg-[var(--ink-900)]" />
                </div>
                {steps.map((step, i) => (
                  <Screen key={step.eyebrow} step={step} progress={scrollYProgress} index={i} total={steps.length} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------- sample phone screens -- */
/* Hand-built, like AppPreview — a screen scaled to fit a phone frame, not a
   photo of one. */

export function FeedScreenPreview() {
  return (
    <div className="flex h-full flex-col bg-bg pt-9">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="text-[0.6875rem] font-medium text-text">The Nest</span>
        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-surface-2 text-faint">
          <HomeIcon size={11} />
        </span>
      </div>
      <div className="space-y-2 p-2.5">
        <article className="card p-2.5">
          <header className="flex items-center gap-1.5 text-[0.5625rem]">
            <GradientAvatar avatar={{ hat: "grad-cap", eyes: "sparkle", colour: "mint", accessory: "none" }} name="Rishab Jain" size={16} />
            <span className="font-medium text-text">Rishab</span>
            <span className="ml-auto rounded-full border border-border px-1.5 py-px text-faint">Placements</span>
          </header>
          <h4 className="mt-1.5 text-[0.6875rem] leading-snug font-medium text-text">
            Deloitte interview — 3 rounds, full questions inside
          </h4>
          <footer className="mt-2 flex items-center gap-1.5">
            <span className="rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[0.5625rem] text-muted">
              ▲ 47
            </span>
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.5625rem] text-muted">💬 12</span>
          </footer>
        </article>
        <article className="card p-2.5">
          <header className="flex items-center gap-1.5 text-[0.5625rem]">
            <GradientAvatar avatar={{ hat: "bandana", eyes: "sleepy", colour: "butter", accessory: "scarf" }} name="Kabir Sethi" size={16} />
            <span className="font-medium text-text">Kabir</span>
            <span className="ml-auto rounded-full border border-border px-1.5 py-px text-faint">Night Shift</span>
          </header>
          <h4 className="mt-1.5 text-[0.6875rem] leading-snug font-medium text-text">2:14 AM. who else is up</h4>
          <footer className="mt-2 flex items-center gap-1.5">
            <span className="rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[0.5625rem] text-muted">
              ▲ 64
            </span>
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.5625rem] text-muted">💬 8</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

export function ChatScreenPreview() {
  const bubbles = [
    { mine: false, text: "notice for the fest is up in three group chats already 💀" },
    { mine: true, text: "put it in the Den once, done" },
    { mine: false, text: "oh that's actually so much better" },
  ];
  return (
    <div className="flex h-full flex-col bg-bg pt-9">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <GradientAvatar avatar={{ hat: "none", eyes: "sparkle", colour: "peach", accessory: "none" }} name="CSE '26 Den" size={20} />
        <span className="text-[0.6875rem] font-medium text-text">CSE &apos;26 Den</span>
        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-surface-2 text-faint">
          <MessageIcon size={11} />
        </span>
      </div>
      <div className="flex-1 space-y-1.5 p-2.5">
        {bubbles.map((b, i) => (
          <div key={i} className={cn("flex", b.mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-[10px] px-2.5 py-1.5 text-[0.625rem] leading-snug",
                b.mine ? "bg-accent text-on-accent" : "border border-border bg-surface text-text",
              )}
            >
              {b.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwlScreenPreview() {
  const ranks = [
    { rank: 1, name: "Meher", pts: 940 },
    { rank: 2, name: "Aniket", pts: 812 },
    { rank: 3, name: "You", pts: 780, mine: true },
  ];
  return (
    <div className="flex h-full flex-col bg-bg pt-9">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="text-[0.6875rem] font-medium text-text">Night Shift</span>
        <span className="ml-auto rounded-full border border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-accent-wash px-1.5 py-0.5 text-[0.5625rem] text-accent-hi">
          <MoonIcon size={9} className="inline" /> curfew 03:00
        </span>
      </div>
      <div className="space-y-1.5 p-2.5">
        {ranks.map((r) => (
          <div
            key={r.rank}
            className={cn(
              "flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-[0.625rem]",
              r.mine ? "border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-accent-wash" : "border-border bg-surface",
            )}
          >
            <span className="tabnum w-3 shrink-0 text-faint">{r.rank}</span>
            <span className={cn("flex-1 font-medium", r.mine ? "text-accent-hi" : "text-text")}>{r.name}</span>
            <span className="tabnum text-faint">{r.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
