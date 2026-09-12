"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Glow — a pointer-tracked highlight that lights the hairline border and, if
   asked, washes the surface underneath it.

   It attaches to whatever element it is dropped inside (that element only needs
   `position: relative`), so any existing card becomes glow-aware by adding one
   child rather than by being rewritten into a new wrapper component.

   The border trick is two stacked backgrounds with `mask-composite: xor`: the
   gradient paints the full box, then the box's own padding area is punched out,
   leaving exactly the 1px rim lit.
   -------------------------------------------------------------------------- */

export function Glow({
  radius = 280,
  color = "var(--accent)",
  border = true,
  fill = true,
  opacity = 0.55,
  className,
}: {
  radius?: number;
  color?: string;
  border?: boolean;
  /** Also wash the surface, not just the rim. */
  fill?: boolean;
  opacity?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    const host = node?.parentElement;
    if (!node || !host) return;

    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    let raf = 0;
    const move = (event: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = host.getBoundingClientRect();
        node.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        node.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    };
    const enter = () => node.style.setProperty("--on", "1");
    const leave = () => node.style.setProperty("--on", "0");

    host.addEventListener("pointermove", move);
    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointerleave", leave);

    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
    };
  }, []);

  const spot = `radial-gradient(${radius}px circle at var(--mx, 50%) var(--my, 0px), ${color}, transparent 72%)`;

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0 rounded-[inherit]", className)}
      style={{ ["--on" as string]: "0" }}
    >
      {fill && (
        <div
          className="absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            background: spot,
            opacity: `calc(var(--on) * ${opacity * 0.22})`,
          }}
        />
      )}
      {border && (
        <div
          className="absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            padding: 1,
            background: spot,
            opacity: `calc(var(--on) * ${opacity})`,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            maskComposite: "exclude",
          }}
        />
      )}
    </div>
  );
}
