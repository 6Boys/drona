"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
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
    <div
      role="tablist"
      className={cn("glass glass-pill inline-flex items-center gap-0.5 p-1", className)}
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
            {option.count !== undefined && (
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
