import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "positive" | "warning" | "danger" | "gold" | "rose" | "outline";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-transparent",
  accent: "bg-accent-wash text-accent-hi border-[color-mix(in_oklab,var(--accent)_30%,transparent)]",
  positive: "bg-[color-mix(in_oklab,var(--positive)_14%,var(--surface))] text-positive border-transparent",
  warning: "bg-[color-mix(in_oklab,var(--warning)_14%,var(--surface))] text-warning border-transparent",
  danger: "bg-[color-mix(in_oklab,var(--danger)_14%,var(--surface))] text-danger border-transparent",
  gold: "bg-[color-mix(in_oklab,var(--gold)_14%,var(--surface))] text-gold border-transparent",
  rose: "bg-[color-mix(in_oklab,var(--rose)_14%,var(--surface))] text-rose border-transparent",
  outline: "bg-transparent text-muted border-border",
};

export function Badge({
  children,
  tone = "neutral",
  mono,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  /** Uppercase mono micro-label, for machine-ish metadata. */
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        mono && "font-mono text-[0.65rem] tracking-[0.07em] uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
