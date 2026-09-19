"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Cards that respond to where the pointer is.

   All four share one measurement: the pointer's position inside the card,
   normalised to -0.5…0.5 on each axis. What differs is what that number is
   wired to — rotation, parallax, a glare, or which edge an overlay enters from.
   Every one of them springs back to rest on leave, so a card is never left
   holding a pose.
   -------------------------------------------------------------------------- */

const SPRING = { stiffness: 220, damping: 22, mass: 0.6 } as const;

function usePointerBox() {
  const ref = useRef<HTMLDivElement | null>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const track = (e: React.PointerEvent<HTMLElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const rest = () => {
    px.set(0);
    py.set(0);
  };

  return { ref, px, py, track, rest };
}

/* ------------------------------------------------------------------ tilt -- */

/**
 * A card that leans toward the pointer. Children mounted in `TiltLayer` float
 * above the surface, which is what sells the depth — a flat card that merely
 * rotates just looks skewed.
 */
export function TiltCard({
  children,
  className,
  intensity = 12,
  glare = false,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  glare?: boolean;
}) {
  const { ref, px, py, track, rest } = usePointerBox();
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [intensity, -intensity]), SPRING);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-intensity, intensity]), SPRING);
  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const sheen = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgb(255 255 255 / 0.5), transparent 55%)`;

  return (
    <div ref={ref} style={{ perspective: 1200 }} className={cn("relative", className)}>
      <motion.div
        onPointerMove={track}
        onPointerLeave={rest}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative h-full w-full"
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden
            style={{ background: sheen }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 hover:opacity-100"
          />
        )}
      </motion.div>
    </div>
  );
}

/** Lifts its children off the card's surface. Only meaningful inside TiltCard. */
export function TiltLayer({
  children,
  z = 40,
  className,
}: {
  children: ReactNode;
  z?: number;
  className?: string;
}) {
  return (
    <div style={{ transform: `translateZ(${z}px)`, transformStyle: "preserve-3d" }} className={className}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- comet -- */

/**
 * The same lean, but lit: a hard specular streak tracks the pointer across the
 * surface like light off a held card, and the whole thing lifts slightly while
 * it is under the cursor.
 */
export function CometCard({
  children,
  className,
  intensity = 9,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const { ref, px, py, track, rest } = usePointerBox();
  const [hot, setHot] = useState(false);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [intensity, -intensity]), SPRING);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-intensity, intensity]), SPRING);
  const gx = useSpring(useTransform(px, [-0.5, 0.5], [0, 100]), SPRING);
  const gy = useSpring(useTransform(py, [-0.5, 0.5], [0, 100]), SPRING);
  const glare = useMotionTemplate`linear-gradient(${gx}deg, rgb(255 255 255 / 0) 30%, rgb(255 255 255 / 0.55) ${gy}%, rgb(255 255 255 / 0) 70%)`;

  return (
    <div ref={ref} style={{ perspective: 1100 }} className={cn("relative", className)}>
      <motion.div
        onPointerMove={track}
        onPointerEnter={() => setHot(true)}
        onPointerLeave={() => {
          setHot(false);
          rest();
        }}
        animate={{ scale: hot ? 1.015 : 1, y: hot ? -4 : 0 }}
        transition={SPRING}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative h-full w-full rounded-[inherit]"
      >
        {children}
        <motion.div
          aria-hidden
          style={{ backgroundImage: glare, opacity: hot ? 0.7 : 0 }}
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay transition-opacity duration-300"
        />
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- wobble -- */

/** Leans the card one way and its contents the other — cheap parallax depth. */
export function WobbleCard({
  children,
  className,
  containerClassName,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  const { ref, px, py, track, rest } = usePointerBox();
  const [hot, setHot] = useState(false);
  const tx = useSpring(useTransform(px, [-0.5, 0.5], [14, -14]), SPRING);
  const ty = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), SPRING);
  const ix = useSpring(useTransform(px, [-0.5, 0.5], [-8, 8]), SPRING);
  const iy = useSpring(useTransform(py, [-0.5, 0.5], [-6, 6]), SPRING);

  return (
    <div ref={ref} className={cn("relative", containerClassName)}>
      <motion.div
        onPointerMove={track}
        onPointerEnter={() => setHot(true)}
        onPointerLeave={() => {
          setHot(false);
          rest();
        }}
        style={{ x: tx, y: ty }}
        animate={{ scale: hot ? 1.012 : 1 }}
        transition={SPRING}
        className={cn("relative h-full w-full overflow-hidden", className)}
      >
        <motion.div style={{ x: ix, y: iy }} className="h-full w-full">
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------- direction aware -- */

type Edge = "top" | "right" | "bottom" | "left";

const OFFSET: Record<Edge, { x: number | string; y: number | string }> = {
  top: { x: 0, y: "-100%" },
  bottom: { x: 0, y: "100%" },
  left: { x: "-100%", y: 0 },
  right: { x: "100%", y: 0 },
};

/** Works out which edge the pointer crossed and slides the overlay in from it. */
export function DirectionAwareHover({
  children,
  overlay,
  className,
}: {
  children: ReactNode;
  overlay: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState<Edge | null>(null);

  const edgeFor = (e: React.PointerEvent<HTMLDivElement>): Edge => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return "top";
    // Compare the pointer's offset from each edge, corrected for aspect ratio,
    // and take whichever it is closest to.
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "bottom" : "top";
  };

  return (
    <div
      ref={ref}
      onPointerEnter={(e) => setEdge(edgeFor(e))}
      onPointerLeave={() => setEdge(null)}
      className={cn("relative overflow-hidden", className)}
    >
      {children}
      <AnimatePresence>
        {edge && (
          <motion.div
            initial={{ ...OFFSET[edge], opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ ...OFFSET[edge], opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {overlay}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
