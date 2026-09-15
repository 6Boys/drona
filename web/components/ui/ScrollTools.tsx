"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowUpIcon } from "./Icons";

/** A hairline reading-progress bar pinned under the top edge — for the one
 * long-scroll page in the app (the marketing landing page). The app's actual
 * screens (feed, chats, …) are short, paginated views where a progress bar
 * would have nothing meaningful to measure. */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 300, damping: 40, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed top-0 right-0 left-0 z-50 h-[2px] origin-left bg-accent"
    />
  );
}

/** Appears once the visitor has scrolled roughly one viewport down. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.75);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="glass glass-pill fixed right-5 bottom-5 z-40 flex size-11 cursor-pointer items-center justify-center text-text shadow-[var(--sh-pop)] transition-opacity hover:opacity-90 md:right-8 md:bottom-8"
    >
      <ArrowUpIcon size={18} />
    </button>
  );
}
