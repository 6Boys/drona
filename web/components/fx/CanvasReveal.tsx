"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   CanvasReveal — a dot matrix that floods in from nothing when a surface is
   hovered or focused, and drains back out when it isn't.

   Each dot carries its own delay, so the fill spreads unevenly like ink through
   paper rather than sweeping like a progress bar; a slow per-dot flicker keeps
   the field alive once it has settled. Drawn as one canvas because a few
   thousand animated elements is not a thing to ask the compositor for.
   -------------------------------------------------------------------------- */

interface Dot {
  x: number;
  y: number;
  colour: string;
  delay: number;
  alpha: number;
  phase: number;
}

export function CanvasReveal({
  active,
  colours = ["#6b2c63", "#b4674d"],
  dotSize = 3,
  gap = 4,
  speed = 1,
  className,
}: {
  active: boolean;
  colours?: string[];
  dotSize?: number;
  gap?: number;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  // Non-null while an rAF is actually scheduled; null while asleep. A second
  // effect below reads this to know whether toggling `active` needs to wake
  // the loop back up, or whether it's already running and will notice on its
  // own next frame.
  const frameRef = useRef<number | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);

  // Callers pass an array literal, so depend on its contents rather than its
  // identity — otherwise every parent render would re-seed the whole field.
  const colourKey = colours.join(",");

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = dotSize + gap;
    const palette = colourKey.split(",");

    let dots: Dot[] = [];
    let width = 0;
    let height = 0;
    let progress = 0;

    const seed = () => {
      const cols = Math.ceil(width / step);
      const rows = Math.ceil(height / step);
      dots = [];
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          dots.push({
            x: c * step,
            y: r * step,
            colour: palette[Math.floor(Math.random() * palette.length)] ?? "#6b2c63",
            delay: Math.random() * 0.55,
            alpha: 0.25 + Math.random() * 0.75,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    // Every mounted card that has ever been hovered once kept requesting a
    // frame forever after, even fully faded out and drawing nothing — a
    // canvas per profile card, all spinning rAF at 60fps for the rest of the
    // session. This sleeps once progress has actually settled at rest, and
    // only schedules another frame while there's real motion left to paint.
    const loop = (time: number) => {
      const target = activeRef.current ? 1 : 0;
      progress += (target - progress) * (reduced ? 1 : 0.07 * speed);

      ctx.clearRect(0, 0, width, height);
      if (progress >= 0.004) {
        for (const dot of dots) {
          // Each dot only starts once the wave has passed its own delay.
          const local = (progress - dot.delay) / (1 - dot.delay);
          if (local <= 0) continue;
          const flicker = reduced ? 1 : 0.72 + Math.sin(time * 0.0022 + dot.phase) * 0.28;
          ctx.globalAlpha = Math.min(local, 1) * dot.alpha * flicker;
          ctx.fillStyle = dot.colour;
          ctx.fillRect(dot.x, dot.y, dotSize, dotSize);
        }
        ctx.globalAlpha = 1;
      }

      const settled = Math.abs(target - progress) < 0.001;
      if (settled) {
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(loop);
    };

    wakeRef.current = () => {
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(loop);
    };

    resize();
    frameRef.current = requestAnimationFrame(loop);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      wakeRef.current = null;
      ro.disconnect();
    };
  }, [colourKey, dotSize, gap, speed]);

  // Hovering back onto a card that had already faded out and gone to sleep
  // needs something to restart its loop — the effect above only runs once.
  useEffect(() => {
    wakeRef.current?.();
  }, [active]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}

/**
 * The matrix wrapped in the thing we actually mount: a surface that reveals its
 * dot field on hover/focus, with a soft vignette so the grid never ends on a
 * hard edge.
 */
export function RevealSurface({
  active,
  colours,
  className,
  vignette = true,
  children,
  dotSize,
  gap,
}: {
  active: boolean;
  colours?: string[];
  className?: string;
  vignette?: boolean;
  children?: React.ReactNode;
  dotSize?: number;
  gap?: number;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <CanvasReveal active={active} colours={colours} dotSize={dotSize} gap={gap} />
      {vignette && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 18%, rgb(255 255 255 / 0.5) 78%, rgb(255 255 255 / 0.9) 100%)",
          }}
        />
      )}
      {children}
    </div>
  );
}
