"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   ContainerScroll — a slab that starts tipped away from the reader and lies
   flat as they scroll, with a headline that lifts as it does.

   The whole effect is one scroll progress value driving rotateX, scale and the
   title's translate. Perspective lives on the outer element so the child
   rotates in the reader's space rather than in its own.
   -------------------------------------------------------------------------- */

export function ContainerScroll({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const rotate = useTransform(scrollYProgress, [0.05, 0.45], [22, 0]);
  const scale = useTransform(scrollYProgress, [0.05, 0.45], compact ? [0.82, 1] : [0.94, 1.02]);
  const lift = useTransform(scrollYProgress, [0.05, 0.45], [0, -60]);
  const shade = useTransform(scrollYProgress, [0.05, 0.45], [0.55, 0.1]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="sticky top-[12vh] flex flex-col items-center" style={{ perspective: "1000px" }}>
        <motion.div style={{ translateY: lift }} className="w-full max-w-5xl px-5 text-center">
          {title}
        </motion.div>

        <motion.div
          style={{ rotateX: rotate, scale }}
          className="squircle relative mt-8 w-full max-w-6xl origin-top border border-border bg-panel p-2 shadow-[var(--sh-pop)] md:p-3"
        >
          <div className="squircle relative h-full w-full overflow-hidden">{children}</div>
          {/* The slab is still catching light from above while it is tipped. */}
          <motion.div
            aria-hidden
            style={{ opacity: shade }}
            className="pointer-events-none absolute inset-0 rounded-[var(--r-2xl)]"
          >
            <div className="absolute inset-0 rounded-[var(--r-2xl)] bg-gradient-to-b from-white/60 via-transparent to-[rgb(22_21_15_/_0.25)]" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
