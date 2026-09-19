import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Empty states carry an icon in a gradient-lit tile, a one-line title and a
 * sentence that says what to do next — never a dead grey box. */
export function EmptyState({
  title,
  body,
  action,
  icon: Icon,
  ramp = "var(--grad-brand)",
  compact,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
  ramp?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-6 text-center",
        compact ? "py-10" : "py-16",
        className,
      )}
    >
      {Icon && (
        <span className="relative flex size-12 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-[var(--r-md)] opacity-20"
            style={{ background: ramp }}
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-[var(--r-md)] border border-border-strong"
          />
          <Icon size={20} className="relative text-accent-hi" />
        </span>
      )}

      <div className="space-y-1.5">
        <h3 className="text-[0.9375rem] font-medium text-text">{title}</h3>
        {body && <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">{body}</p>}
      </div>

      {action}
    </div>
  );
}
