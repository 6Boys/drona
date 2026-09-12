"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MOBILE_NAV } from "./nav-items";
import { cn } from "@/lib/cn";

/** A floating glass tab bar. It sits above the page rather than being welded to
 * the bottom edge, so content stays visible behind it and the safe-area inset
 * on a notched phone is breathing room instead of a dead strip. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Primary"
    >
      <div className="glass glass-strong glass-pill flex w-full max-w-md items-center p-1.5">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-[0.625rem] font-medium transition-colors",
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
              <Icon size={19} className="relative" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
