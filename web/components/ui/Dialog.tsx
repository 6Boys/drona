"use client";

import { useEffect, type ReactNode } from "react";
import { XIcon } from "./Icons";
import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgb(22_21_15_/_0.3)] backdrop-blur-md"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "glass glass-strong pop relative flex max-h-[88dvh] w-full flex-col overflow-hidden",
          "rounded-t-[var(--r-xl)] sm:rounded-[var(--r-xl)]",
          width === "sm" && "sm:max-w-sm",
          width === "md" && "sm:max-w-lg",
          width === "lg" && "sm:max-w-2xl",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[0.9375rem] font-medium">{title}</h2>
            {description && <p className="mt-0.5 text-[0.8125rem] text-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 cursor-pointer rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <XIcon size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}
