import type { OwlRank } from "@/lib/types";
import { cn } from "@/lib/cn";

// Five tiers, read at a glance by the pip: the ramp gets hotter as the rank
// climbs, and the label always carries the meaning so the colour is never
// doing the work alone.
const RANKS: Record<OwlRank, { ramp: string; text: string; tier: number }> = {
  SLEEPY_SPARROW: { ramp: "linear-gradient(135deg,#64748b,#334155)", text: "text-muted", tier: 1 },
  FLEDGLING: { ramp: "linear-gradient(135deg,#10b981,#2dd4bf)", text: "text-positive", tier: 2 },
  NIGHT_OWL: { ramp: "linear-gradient(135deg,#8b5cf6,#6366f1)", text: "text-accent-hi", tier: 3 },
  MOON_MOTH: { ramp: "linear-gradient(135deg,#6366f1,#0ea5e9)", text: "text-[var(--sky-500)]", tier: 4 },
  COMET: { ramp: "linear-gradient(135deg,#f59e0b,#f43f5e)", text: "text-gold", tier: 5 },
};

export function OwlRankBadge({
  rank,
  label,
  className,
}: {
  rank: OwlRank;
  label: string;
  className?: string;
}) {
  const style = RANKS[rank] ?? RANKS.SLEEPY_SPARROW;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pr-2.5 pl-1.5 text-xs font-medium whitespace-nowrap",
        style.text,
        className,
      )}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: style.ramp }} />
      {label}
    </span>
  );
}
