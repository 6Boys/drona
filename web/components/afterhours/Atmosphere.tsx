"use client";

import { useId } from "react";
import { sigilFor } from "@/lib/afterhours-theme";
import { cn } from "@/lib/cn";

/** A small living flame — the page's mark. Colours come from the ambiance's
 * glow tokens, so it's a candle in Candle and a neon tube in Neon. */
export function Flame({ size = 18, className }: { size?: number; className?: string }) {
  // useId can contain characters that break url(#…) references.
  const id = `ahf${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      width={size}
      height={size * 1.3}
      viewBox="0 0 24 32"
      aria-hidden
      className={cn("ah-flame shrink-0", className)}
      style={{ filter: "drop-shadow(0 0 6px var(--ah-glow-a))" }}
    >
      <defs>
        <radialGradient id={`${id}o`} cx="50%" cy="78%" r="70%">
          <stop offset="0%" style={{ stopColor: "#fff7e0" }} />
          <stop offset="38%" style={{ stopColor: "var(--ah-glow-c)" }} />
          <stop offset="100%" style={{ stopColor: "var(--ah-glow-a)" }} />
        </radialGradient>
      </defs>
      <path
        d="M12 1.5c1.6 4.6 7.5 7.8 7.5 15.6a7.5 7.5 0 1 1-15 0c0-3.9 1.9-6.3 3.6-8.2.4 2.2 1.4 3.7 2.8 4.2C10.2 9 10.7 5.2 12 1.5z"
        fill={`url(#${id}o)`}
      />
      <path d="M12 16.5c1.2 1.9 3 3.1 3 5.4a3 3 0 1 1-6 0c0-1.9 1.4-3.3 3-5.4z" fill="#fff8e6" opacity="0.9" />
    </svg>
  );
}

/** The mask an Anon wears: a colour and a glyph derived from their number. */
export function Sigil({ anonNumber, size = 32 }: { anonNumber: string; size?: number }) {
  const s = sigilFor(anonNumber);
  return (
    <span
      aria-hidden
      className="ah-sigil relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from ${s.angle}deg, oklch(0.76 0.15 ${s.hueA}), oklch(0.52 0.2 ${s.hueB}), oklch(0.76 0.15 ${s.hueA}))`,
        boxShadow: `0 0 18px -5px oklch(0.72 0.18 ${s.hueA})`,
      }}
    >
      <span
        className="absolute inset-[2px] rounded-full"
        style={{ background: "radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.32), transparent 62%)" }}
      />
      <span className="relative leading-none" style={{ fontSize: size * 0.46, color: "rgb(255 255 255 / 0.92)", textShadow: "0 1px 3px rgb(0 0 0 / 0.4)" }}>
        {s.glyph}
      </span>
    </span>
  );
}

// Fixed positions (not random) so the sky doesn't reshuffle on every render.
const STARS: [number, number, number][] = [
  [8, 12, 3.1], [22, 6, 4.6], [37, 18, 3.8], [55, 9, 5.2], [71, 15, 3.4], [88, 7, 4.1],
  [14, 34, 5.6], [46, 30, 3.3], [63, 38, 4.8], [92, 29, 3.9], [5, 56, 4.4], [29, 61, 3.6],
  [78, 54, 5.1], [52, 72, 4.2], [18, 84, 3.7], [67, 86, 4.9], [86, 76, 3.5], [40, 92, 5.4],
];

/** The room itself: slow drifting light, a few stars, grain and a vignette.
 * Fixed behind everything, so the sidebar's glass picks it up too. */
export function AfterHoursBackdrop() {
  return (
    <div className="ah-backdrop" aria-hidden>
      <i
        className="ah-orb drift"
        style={{
          width: "80vmax",
          height: "80vmax",
          left: "-25vmax",
          top: "-35vmax",
          background: "radial-gradient(circle, color-mix(in oklab, var(--ah-glow-a) 42%, transparent) 0%, transparent 62%)",
          ["--drift-dur" as string]: "28s",
        }}
      />
      <i
        className="ah-orb drift"
        style={{
          width: "70vmax",
          height: "70vmax",
          right: "-30vmax",
          top: "5vmax",
          background: "radial-gradient(circle, color-mix(in oklab, var(--ah-glow-b) 36%, transparent) 0%, transparent 62%)",
          ["--drift-dur" as string]: "36s",
          animationDirection: "reverse",
        }}
      />
      <i
        className="ah-orb drift"
        style={{
          width: "90vmax",
          height: "60vmax",
          left: "10vmax",
          bottom: "-38vmax",
          background: "radial-gradient(ellipse, color-mix(in oklab, var(--ah-glow-c) 24%, transparent) 0%, transparent 65%)",
          ["--drift-dur" as string]: "44s",
        }}
      />
      {STARS.map(([x, y, dur], i) => (
        <i
          key={i}
          className="ah-star twinkle"
          style={{ left: `${x}%`, top: `${y}%`, ["--twinkle-dur" as string]: `${dur}s`, animationDelay: `${(i % 6) * 0.7}s` }}
        />
      ))}
      <div className="ah-grain" />
      <div className="ah-vignette" />
    </div>
  );
}
