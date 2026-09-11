"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/cn";

export interface DialogHandle {
  showModal: () => void;
  close: () => void;
}

interface DialogProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  /** Bare wraps the dialog content with no default card chrome — used by the
   * match-celebration screen, which draws its own full-bleed gradient. */
  bare?: boolean;
}

/** A native <dialog> gives us focus-trapping, Escape-to-close and light
 * dismiss for free (per the modern-web-guidance dialog patterns) — no
 * hand-rolled a11y needed. */
export const Dialog = forwardRef<DialogHandle, DialogProps>(function Dialog(
  { children, className, onClose, bare },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useImperativeHandle(ref, () => ({
    showModal: () => dialogRef.current?.showModal(),
    close: () => dialogRef.current?.close(),
  }));

  useEffect(() => {
    const el = dialogRef.current;
    if (!el || !onClose) return;
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      className={cn(
        "m-auto max-h-[90dvh] w-[min(30rem,92vw)] overflow-y-auto backdrop:bg-black/40 backdrop:backdrop-blur-sm",
        !bare && "surface-card p-6",
        bare && "bg-transparent p-0",
        className,
      )}
    >
      {children}
    </dialog>
  );
});
