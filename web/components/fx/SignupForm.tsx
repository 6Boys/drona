"use client";

import { useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { animate, motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Sign-in furniture.

   A field here is two boxes: an outer one that paints a radial highlight
   following the pointer, and the real input sitting 2px inside it. What you
   read as a border lighting up is the outer box showing through — no shadow,
   no extra element, and the highlight fades out the moment the pointer leaves.

   `BottomGradient` is the other half: a hairline under a button that draws
   itself in from the centre on hover. Both are decoration only — the field is a
   plain `<input>` and the button is a plain `<button>`.
   -------------------------------------------------------------------------- */

export function BottomGradient() {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-[var(--clay-500)] to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
}

export function FieldShell({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="mono-label">
          {label}
        </label>
        {hint}
      </div>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

interface GlowInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function GlowInput({ label, hint, error, className, id, ...props }: GlowInputProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  // The highlight's radius is what animates: it opens from nothing under the
  // pointer on enter and closes again on leave, so there is never a stale spot
  // of colour parked where the cursor used to be.
  const radius = useMotionValue(0);

  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${mx}px ${my}px, var(--accent), transparent 80%)`;

  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <motion.div
        ref={ref}
        onPointerMove={(e) => {
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          mx.set(e.clientX - rect.left);
          my.set(e.clientY - rect.top);
        }}
        onPointerEnter={() => animate(radius, 120, { duration: 0.35 })}
        onPointerLeave={() => animate(radius, 0, { duration: 0.35 })}
        style={{ background }}
        className="rounded-[calc(var(--r-md)+2px)] p-[2px]"
      >
        <input
          id={id}
          {...props}
          className={cn(
            "h-12 w-full rounded-[var(--r-md)] border border-border bg-surface px-4 text-[0.9375rem] text-text",
            "outline-none transition-colors placeholder:text-faint",
            "focus:border-accent",
            error && "border-danger",
            className,
          )}
        />
      </motion.div>
    </FieldShell>
  );
}

/** The submit button, with the hairline that draws itself in on hover. */
export function GradientSubmit({
  children,
  loading,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "group/btn relative block h-12 w-full cursor-pointer overflow-hidden rounded-[var(--r-md)]",
        "text-[0.9375rem] font-medium text-on-accent shadow-[var(--sh-card)]",
        "transition-transform duration-200 active:scale-[0.99]",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ background: "var(--grad-brand)" }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? "Just a sec…" : children}
      </span>
      <BottomGradient />
    </button>
  );
}
