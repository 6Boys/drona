"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "./Atmosphere";

const SEEN_KEY = "drona.afterhours.intro";

function shouldShow() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return !window.sessionStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

/** The lights going down, once per session: walking in should feel like
 * walking into somewhere else. Tap anywhere to skip it. */
export function AfterHoursIntro() {
  const [show, setShow] = useState(shouldShow);

  useEffect(() => {
    if (!show) return;
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // No storage: it'll just play again next visit.
    }
    const t = window.setTimeout(() => setShow(false), 1900);
    return () => window.clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="ah-intro"
          role="presentation"
          onClick={() => setShow(false)}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="fixed inset-0 z-[90] flex cursor-pointer flex-col items-center justify-center bg-bg"
          style={{ background: "radial-gradient(ellipse 60% 45% at 50% 48%, color-mix(in oklab, var(--ah-glow-a) 16%, var(--bg)) 0%, var(--bg) 70%)" }}
        >
          <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: "easeOut" }}>
            <Flame size={40} />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="display mt-5 text-[3rem] italic text-text sm:text-[4rem]"
          >
            AfterHours
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mono-label mt-3"
          >
            what&apos;s said here, burns here
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
