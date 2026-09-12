"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/** Six single-character boxes that behave like one field: typing advances,
 * backspace retreats, and a pasted code fills the row. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setAt = (index: number, char: string) => {
    const chars = value.padEnd(length, " ").split("");
    chars[index] = char || " ";
    const next = chars.join("").replace(/\s+$/, "");
    onChange(next.trimEnd());
    if (char && index < length - 1) refs.current[index + 1]?.focus();
    const filled = next.replace(/\s/g, "");
    if (filled.length === length) onComplete?.(filled);
  };

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ""}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const char = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, char);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (!pasted) return;
            onChange(pasted);
            refs.current[Math.min(pasted.length, length - 1)]?.focus();
            if (pasted.length === length) onComplete?.(pasted);
          }}
          className={cn(
            "h-13 w-full rounded-[var(--r-md)] border bg-surface text-center font-mono text-lg text-text transition-colors",
            "focus:border-accent focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_30%,transparent)] focus:outline-none",
            invalid ? "border-danger" : "border-border hover:border-border-strong",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}
