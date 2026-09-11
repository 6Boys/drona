import type { OwlRank } from "@/lib/types";
import { cn } from "@/lib/cn";

const RANK_STYLE: Record<OwlRank, { emoji: string; className: string }> = {
  SLEEPY_SPARROW: { emoji: "🐤", className: "bg-surface-2 text-text-muted" },
  FLEDGLING: { emoji: "🐦", className: "bg-mint-300/60 text-positive" },
  NIGHT_OWL: { emoji: "🦉", className: "bg-accent-wash text-accent-strong" },
  MOON_MOTH: { emoji: "🌙", className: "bg-[color:var(--indigo-300)]/30 text-[color:var(--indigo-700,--accent-strong)]" },
  COMET: { emoji: "☄️", className: "bg-currency-soft text-currency" },
};

export function OwlRankBadge({ rank, label, className }: { rank: OwlRank; label: string; className?: string }) {
  const style = RANK_STYLE[rank];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        style.className,
        className,
      )}
    >
      <span aria-hidden>{style.emoji}</span>
      {label}
    </span>
  );
}
