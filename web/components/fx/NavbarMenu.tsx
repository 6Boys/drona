"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   NavbarMenu — a floating glass bar whose items can open a panel on hover.

   The hovered pill is a single shared element (`layoutId`) that slides between
   items, so moving along the bar reads as one object tracking the pointer
   rather than several fading in and out. The bar itself condenses once the page
   has scrolled, the way a desktop menu bar tightens when a window goes under it.
   -------------------------------------------------------------------------- */

export interface NavMenuItem {
  label: string;
  href: string;
  panel?: ReactNode;
}

export function NavbarMenu({
  items,
  brand,
  actions,
  className,
}: {
  items: NavMenuItem[];
  brand?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={cn("pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center", className)}>
      <motion.div
        animate={{ marginTop: scrolled ? 10 : 18, scale: scrolled ? 0.985 : 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
        onMouseLeave={() => setOpen(null)}
        className={cn(
          "glass glass-pill pointer-events-auto relative flex max-w-[min(64rem,calc(100vw-1.5rem))] items-center gap-1 px-2 py-2",
          scrolled && "glass-strong",
        )}
      >
        {brand && <div className="px-3">{brand}</div>}

        <nav className="hidden items-center md:flex">
          {items.map((item) => (
            <div key={item.href} className="relative" onMouseEnter={() => setOpen(item.label)}>
              <a
                href={item.href}
                className="relative z-10 block rounded-full px-3.5 py-1.5 text-[0.8125rem] text-muted transition-colors hover:text-text"
              >
                {open === item.label && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-full bg-surface-2"
                  />
                )}
                {item.label}
              </a>

              <AnimatePresence>
                {open === item.label && item.panel && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="glass glass-panel glass-strong absolute top-[calc(100%+0.75rem)] left-1/2 w-[22rem] -translate-x-1/2 p-4"
                  >
                    {item.panel}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        {actions && <div className="ml-auto flex items-center gap-2 pl-2">{actions}</div>}
      </motion.div>
    </div>
  );
}
