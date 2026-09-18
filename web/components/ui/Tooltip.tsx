"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A short label that shows on hover, and on tap for anything without a
 * mouse — hover alone would make the trigger's whole reason for existing
 * invisible on a phone, which is most of where this app runs. Tapping
 * outside (or the trigger again) closes it; tapping a different tooltip's
 * trigger doesn't require closing this one first. */
export function Tooltip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="inline-flex cursor-help"
      >
        {children}
      </span>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 w-max max-w-52 -translate-x-1/2 rounded-[var(--r-sm)] border border-border bg-surface px-2.5 py-1.5 text-center text-[0.6875rem] leading-snug text-text shadow-[var(--sh-card)] transition-opacity duration-100",
          open ? "opacity-100" : "opacity-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}
