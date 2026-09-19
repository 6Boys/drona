"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon } from "@/components/ui/Icons";
import { AMBIANCE_ORDER, AMBIANCES, type Ambiance } from "@/lib/afterhours-theme";
import { cn } from "@/lib/cn";

export function AmbiancePicker({ value, onChange }: { value: Ambiance; onChange: (next: Ambiance) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={`Ambiance: ${AMBIANCES[value].name}. Change`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-border transition-colors hover:border-border-strong"
      >
        <span className="size-5 rounded-full shadow-[0_0_12px_-2px_var(--ah-glow-a)]" style={{ background: AMBIANCES[value].swatch }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Choose an ambiance"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            // Solid, not glass: it opens from inside the header, which has its
            // own backdrop blur — a blur nested in a blur can't see the page
            // behind it, so a glass menu here showed the content through it.
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-[var(--r-lg)] border border-border-strong bg-panel p-1.5 shadow-[var(--sh-pop)]"
          >
            <p className="mono-label px-2.5 pb-1.5 pt-1">Set the mood</p>
            {AMBIANCE_ORDER.map((key) => {
              const a = AMBIANCES[key];
              const active = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-[var(--r-md)] px-2.5 py-2 text-left transition-colors",
                    active ? "bg-accent-wash" : "hover:bg-surface-2",
                  )}
                >
                  <span className="size-8 shrink-0 rounded-full ring-1 ring-white/10" style={{ background: a.swatch }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text">{a.name}</span>
                    <span className="block truncate text-[0.75rem] text-muted">{a.tagline}</span>
                  </span>
                  {active && <CheckIcon size={15} className="text-accent-hi" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
