import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "accent" | "positive" | "currency" | "neutral" | "flame";

const toneClasses: Record<Tone, string> = {
  accent: "bg-accent-wash text-accent-strong",
  positive: "bg-positive-soft text-positive",
  currency: "bg-currency-soft text-currency",
  neutral: "bg-surface-2 text-text-muted",
  flame: "text-white",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      style={tone === "flame" ? { background: "var(--flame-grad, var(--accent))" } : undefined}
    >
      {children}
    </span>
  );
}
