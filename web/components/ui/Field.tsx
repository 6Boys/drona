"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full bg-surface border border-border rounded-[var(--r-md)] px-3.5 py-2.5 text-sm " +
  "text-text placeholder:text-faint transition-colors " +
  "hover:border-border-strong focus:border-accent focus:outline-none " +
  "focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_30%,transparent)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

function Shell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
}

export function Input({ label, hint, error, prefix, className, id, ...props }: InputProps) {
  const auto = useId();
  const fieldId = id ?? auto;

  return (
    <Shell id={fieldId} label={label} hint={hint} error={error}>
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 text-sm text-faint">{prefix}</span>
        )}
        <input
          id={fieldId}
          className={cn(CONTROL, prefix && "pl-[1.85rem]", error && "border-danger", className)}
          aria-invalid={!!error}
          {...props}
        />
      </div>
    </Shell>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
}

export function Textarea({ label, hint, error, className, id, ...props }: TextareaProps) {
  const auto = useId();
  const fieldId = id ?? auto;

  return (
    <Shell id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        className={cn(CONTROL, "resize-none leading-relaxed", error && "border-danger", className)}
        aria-invalid={!!error}
        {...props}
      />
    </Shell>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...props
}: InputHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode; error?: string }) {
  const auto = useId();
  const fieldId = id ?? auto;

  return (
    <Shell id={fieldId} label={label} hint={hint} error={error}>
      <select id={fieldId} className={cn(CONTROL, "cursor-pointer appearance-none", className)} {...props}>
        {children}
      </select>
    </Shell>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start justify-between gap-6",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8125rem] text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-border-strong bg-surface-2",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white transition-[left] duration-200",
            checked ? "left-[1.2rem]" : "left-[0.15rem]",
          )}
        />
      </button>
    </label>
  );
}
