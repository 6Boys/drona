"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Shows a plain dot instead of the number whenever count > 0, and nothing
   * at all at zero — "something's new here," not "here's exactly how much."
   * Every other caller of this component keeps the numeric badge; this is
   * opt-in per option, not a global behavior change. */
  dot?: boolean;
}

/** A glass track with one lit pill that slides between options. The pill is a
 * shared element, so switching tabs reads as the selection moving rather than
 * as two backgrounds cross-fading. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();

  return (
    // auto-cols-fr rather than inline-flex: the lit pill is inset-0 of whichever
    // option is active, so flex sizing made it hug the label — "All" came out
    // visibly smaller than "Hot", and the pill changed width mid-slide when you
    // switched to "Following". Equal columns keep one pill size per group.
    <div
      role="tablist"
      className={cn(
        "glass glass-pill inline-grid grid-flow-col auto-cols-fr items-center gap-0.5 overflow-hidden p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative cursor-pointer rounded-full font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-[0.8125rem]",
              active ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segment-${id}`}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-full bg-surface shadow-[var(--sh-card)]"
              />
            )}
            <span className="relative">{option.label}</span>
            {option.dot
              ? (option.count ?? 0) > 0 && (
                  <span
                    aria-label={`${option.count} new`}
                    className={cn(
                      "relative ml-1.5 inline-block size-1.5 rounded-full align-middle",
                      active ? "bg-accent" : "bg-accent-hi",
                    )}
                  />
                )
              : option.count !== undefined && (
                  <span
                    className={cn(
                      "tabnum relative ml-1.5",
                      active && option.count > 0 ? "text-accent" : "text-faint",
                    )}
                  >
                    {option.count}
                  </span>
                )}
          </button>
        );
      })}
    </div>
  );
}
