"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MOBILE_NAV } from "./nav-items";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   Instagram's bottom bar: shrinks to a small icon-only pill while you're
   scrolling into content, and comes back the moment you scroll toward
   earlier content again or just tap it. Built directly with framer-motion
   (already the animation library everywhere else in this app, e.g.
   SwipeDeck, Segmented's sliding pill) rather than pulled in from anywhere
   else — a bespoke third-party snippet here would mean either a second
   animation dependency or a lot of adaptation to fit this exact pill/glass
   styling, for an interaction that's genuinely only ~30 lines once it's
   using the same primitives the rest of the app already does.

   Direction, not absolute position, decides it: scrolling further down
   squeezes it (more screen for what you're reading), scrolling back up
   expands it, and it's always expanded near the top of any page regardless
   of which way you were just going.
   -------------------------------------------------------------------------- */

const COLLAPSE_AT_Y = 32;
const DIRECTION_THRESHOLD = 8;

export function MobileNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < COLLAPSE_AT_Y) setCollapsed(false);
      else if (delta > DIRECTION_THRESHOLD) setCollapsed(true);
      else if (delta < -DIRECTION_THRESHOLD) setCollapsed(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Primary"
      // Squeezed, a tap's only job is to bring it back — you can't tell which
      // icon you're about to hit while it's this small, so the first tap
      // never doubles as a navigation the way it would once expanded.
      onClickCapture={(e) => {
        if (collapsed) {
          e.preventDefault();
          e.stopPropagation();
          setCollapsed(false);
        }
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        className={cn(
          "glass glass-strong glass-pill flex items-center",
          collapsed ? "w-auto gap-4 px-4 py-2" : "w-full max-w-md p-1.5",
        )}
      >
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          // The one thing that's actually "on" — everything else here is
          // muted, so this is the only color a glow has to agree with.
          const glow = item.romance ? "var(--rose)" : "var(--accent-hi)";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "relative flex flex-col items-center rounded-full text-[0.625rem] font-medium transition-colors",
                collapsed ? "py-1" : "flex-1 gap-1 py-2",
                active ? (item.romance ? "text-rose" : "text-accent-hi") : "text-faint",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tabbar-active"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-surface shadow-[var(--sh-card)]"
                />
              )}
              <Icon
                size={collapsed ? 20 : 19}
                className="relative"
                style={
                  active
                    ? {
                        // The glow lives on the icon, not the chip behind it —
                        // a tight bright core plus a wider soft bloom is what
                        // reads as "lit up" rather than just "has a shadow."
                        filter: [
                          `drop-shadow(0 0 2px color-mix(in oklab, ${glow} 90%, white))`,
                          `drop-shadow(0 0 7px color-mix(in oklab, ${glow} 75%, transparent))`,
                          `drop-shadow(0 0 14px color-mix(in oklab, ${glow} 50%, transparent))`,
                        ].join(" "),
                      }
                    : undefined
                }
              />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="relative overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </motion.div>
    </nav>
  );
}
