import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Backdrops — the layer that lives *behind* glass.
   Glass only reads as glass when something coloured and out of focus is moving
   behind it. These are all pure CSS so they can render on the server and cost
   nothing at runtime.
   -------------------------------------------------------------------------- */

type Tone = "brand" | "love" | "night" | "calm" | "gold";

interface Blob {
  /** percentage box: left, top, width, height */
  l: number;
  t: number;
  w: number;
  h: number;
  c: string;
  /** seconds — desynchronised so the field never pulses in unison */
  d: number;
  o?: number;
}

const FIELDS: Record<Tone, Blob[]> = {
  brand: [
    { l: -8, t: -14, w: 46, h: 44, c: "var(--plum-400)", d: 26 },
    { l: 52, t: -22, w: 52, h: 52, c: "var(--clay-500)", d: 32, o: 0.32 },
    { l: 18, t: 46, w: 58, h: 46, c: "var(--plum-200)", d: 38, o: 0.45 },
  ],
  love: [
    { l: -12, t: -10, w: 48, h: 46, c: "var(--rose-400)", d: 24 },
    { l: 46, t: -18, w: 54, h: 50, c: "var(--clay-500)", d: 30, o: 0.34 },
    { l: 8, t: 52, w: 62, h: 48, c: "var(--plum-400)", d: 36, o: 0.3 },
  ],
  night: [
    { l: -6, t: -18, w: 50, h: 50, c: "#6b6392", d: 28 },
    { l: 54, t: 8, w: 46, h: 46, c: "#3b3660", d: 34, o: 0.5 },
    { l: 22, t: 58, w: 56, h: 42, c: "var(--plum-400)", d: 40, o: 0.28 },
  ],
  calm: [
    { l: -10, t: -12, w: 44, h: 44, c: "var(--sage-600)", d: 30, o: 0.26 },
    { l: 58, t: -6, w: 48, h: 48, c: "var(--paper-300)", d: 36, o: 0.6 },
    { l: 24, t: 54, w: 52, h: 44, c: "var(--plum-200)", d: 42, o: 0.34 },
  ],
  gold: [
    { l: -8, t: -16, w: 46, h: 46, c: "var(--amber-600)", d: 27, o: 0.26 },
    { l: 56, t: 2, w: 46, h: 48, c: "var(--clay-500)", d: 33, o: 0.3 },
    { l: 16, t: 56, w: 56, h: 44, c: "var(--paper-300)", d: 39, o: 0.5 },
  ],
};

/** Slow, out-of-focus colour. One per screen region — stacking them muddies. */
export function Atmosphere({
  tone = "brand",
  className,
  still = false,
}: {
  tone?: Tone;
  className?: string;
  still?: boolean;
}) {
  return (
    <div className={cn("atmosphere", className)} aria-hidden>
      {FIELDS[tone].map((b, i) => (
        <i
          key={i}
          className={still ? undefined : "drift"}
          style={{
            left: `${b.l}%`,
            top: `${b.t}%`,
            width: `${b.w}%`,
            height: `${b.h}%`,
            background: b.c,
            opacity: b.o ?? 0.4,
            ["--drift-dur" as string]: `${b.d}s`,
            animationDelay: `${i * -6}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Graph-paper rule, faded out at the edges. */
export function GridBackdrop({
  className,
  size = 48,
  fade = true,
}: {
  className?: string;
  size?: number;
  fade?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn("bg-grid pointer-events-none absolute inset-0", fade && "mask-radial", className)}
      style={{ ["--grid-size" as string]: `${size}px` }}
    />
  );
}

/** Halftone dots. Reads quieter than the grid — good under dense content. */
export function DotBackdrop({
  className,
  size = 20,
  fade = true,
}: {
  className?: string;
  size?: number;
  fade?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn("bg-dots pointer-events-none absolute inset-0", fade && "mask-radial", className)}
      style={{ ["--dot-size" as string]: `${size}px` }}
    />
  );
}

/** A single wide cone of light, anchored top-left by default. */
export function Spotlight({
  className,
  tone = "var(--plum-400)",
}: {
  className?: string;
  tone?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute -top-40 left-0 h-[45rem] w-[45rem]", className)}
      style={{
        background: `radial-gradient(closest-side, ${tone}, transparent 72%)`,
        opacity: 0.22,
        filter: "blur(20px)",
      }}
    />
  );
}
