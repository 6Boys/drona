import { cn } from "@/lib/cn";

/**
 * The mark: an open ring with a single dot at its centre. The ring is the
 * campus, the dot is you — one circle, one point inside it. It carries no
 * fill, so it sits on paper without weighing it down and inverts cleanly on
 * dark panels.
 */
export function LogoMark({
  size = 26,
  className,
  strokeWidth = 1.25,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  size = 24,
  className,
  showWordmark = true,
}: {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-text", className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="text-[0.9375rem] tracking-[-0.01em] text-text">
          Drona<span className="text-muted">sphere</span>
        </span>
      )}
    </span>
  );
}
