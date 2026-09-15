"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckIcon, XIcon } from "./Icons";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error";

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<{ toast: (message: string, tone?: Tone) => void } | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Tone = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              // w-full on mobile: the container is already correctly bounded
              // (inset-x-3, ~351px safe on a 375px screen), but max-w-sm
              // alone (384px) ignores that and can push a longer message
              // past the viewport edge. sm: reverts to the original
              // auto-width-up-to-384px for the right-aligned desktop layout.
              "glass glass-strong pop pointer-events-auto flex w-full items-start gap-2.5 rounded-[var(--r-md)] px-3.5 py-2.5 text-sm text-text sm:w-auto sm:max-w-sm",
              t.tone === "error" &&
                "border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--danger)_12%,var(--surface))]",
              t.tone === "success" &&
                "border-[color-mix(in_oklab,var(--positive)_35%,transparent)] bg-[color-mix(in_oklab,var(--positive)_10%,var(--surface))]",
            )}
          >
            {t.tone === "success" && <CheckIcon size={16} className="mt-0.5 shrink-0 text-positive" />}
            {t.tone === "error" && <XIcon size={16} className="mt-0.5 shrink-0 text-danger" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
