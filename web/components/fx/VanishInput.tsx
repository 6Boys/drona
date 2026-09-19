"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SearchIcon, ArrowRightIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   VanishInput — a search field whose placeholder cycles while it is empty, and
   whose text dissolves into drifting particles when you submit it.

   The dissolve is done by rasterising the typed string to an offscreen canvas,
   reading back every opaque pixel, and animating those pixels outward. It reads
   as the text itself coming apart rather than as an animation played over it.

   Everything visual is decoration over a real `<input>`: typing, selection,
   autofill, IME and screen readers all behave normally, and the particle pass
   is skipped entirely under `prefers-reduced-motion`.
   -------------------------------------------------------------------------- */

interface Particle {
  x: number;
  y: number;
  r: number;
  colour: string;
  vx: number;
  vy: number;
}

export function VanishInput({
  placeholders,
  value,
  onChange,
  onSubmit,
  className,
  autoFocus,
  ariaLabel = "Search",
}: {
  placeholders: string[];
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [vanishing, setVanishing] = useState(false);
  const [slot, setSlot] = useState(0);

  // Rotate the placeholder only while the field is empty — a moving hint
  // underneath text someone is typing is just noise.
  useEffect(() => {
    if (value || placeholders.length < 2) return;
    const id = setInterval(() => setSlot((s) => (s + 1) % placeholders.length), 3000);
    return () => clearInterval(id);
  }, [value, placeholders.length]);

  const dissolve = useCallback(() => {
    const input = inputRef.current;
    const canvas = canvasRef.current;
    if (!input || !canvas) return false;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    const rect = input.getBoundingClientRect();
    const style = getComputedStyle(input);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.textBaseline = "middle";
    ctx.fillText(input.value, parseFloat(style.paddingLeft) || 0, rect.height / 2);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const particles: Particle[] = [];

    // Sample every other device pixel: half the particles, no visible loss.
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const i = (y * canvas.width + x) * 4;
        const alpha = image[i + 3] ?? 0;
        if (alpha < 24) continue;
        particles.push({
          x: x / dpr,
          y: y / dpr,
          r: 1,
          colour: `rgba(${image[i]},${image[i + 1]},${image[i + 2]},${(alpha / 255).toFixed(2)})`,
          vx: 0.6 + Math.random() * 2.2,
          vy: (Math.random() - 0.5) * 1.1,
        });
      }
    }

    if (!particles.length) return false;

    let alive = particles;
    const tick = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      alive = alive.filter((p) => p.r > 0.05 && p.x < rect.width + 40);
      for (const p of alive) {
        ctx.globalAlpha = Math.min(p.r, 1);
        ctx.fillStyle = p.colour;
        ctx.fillRect(p.x, p.y, 1.4, 1.4);
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.012;
        p.r -= 0.022;
      }
      ctx.globalAlpha = 1;

      if (alive.length) {
        requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
        setVanishing(false);
      }
    };

    setVanishing(true);
    requestAnimationFrame(tick);
    return true;
  }, []);

  const submit = useCallback(() => {
    const current = value.trim();
    if (!current) return;
    onSubmit?.(current);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) dissolve();
    onChange("");
  }, [value, onSubmit, onChange, dissolve]);

  const placeholder = placeholders[slot] ?? placeholders[0] ?? "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "glass glass-pill relative flex h-14 w-full items-center overflow-hidden transition-shadow duration-300",
        "focus-within:shadow-[var(--sh-pop)]",
        className,
      )}
    >
      <span className="relative z-10 pl-5 text-faint">
        <SearchIcon size={17} />
      </span>

      <div className="relative z-10 min-w-0 flex-1">
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => !vanishing && onChange(e.target.value)}
          className={cn(
            "h-14 w-full border-none bg-transparent px-4 text-[0.9375rem] text-text outline-none",
            vanishing && "text-transparent caret-transparent",
          )}
        />

        <canvas
          ref={canvasRef}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full",
            vanishing ? "opacity-100" : "opacity-0",
          )}
        />

        {!value && (
          <div className="pointer-events-none absolute inset-0 flex items-center px-4">
            <AnimatePresence mode="wait">
              <motion.span
                key={placeholder}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="truncate text-[0.9375rem] text-faint"
              >
                {placeholder}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </div>

      <button
        type="submit"
        aria-label="Search"
        disabled={!value.trim()}
        className={cn(
          "relative z-10 mr-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full",
          "bg-accent text-on-accent transition-all duration-200 hover:bg-accent-hi",
          "disabled:cursor-default disabled:bg-surface-2 disabled:text-faint",
        )}
      >
        <ArrowRightIcon size={16} />
      </button>
    </form>
  );
}
