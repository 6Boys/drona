"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CAMPUS_NAV, NIGHT_NAV, PRIMARY_NAV } from "./nav-items";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { SettingsIcon, XIcon } from "@/components/ui/Icons";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   The desktop Sidebar (Sidebar.tsx) is `lg:hidden`-gated, and MobileNav only
   has five slots — Spaces, Note Locker, Saved, Night Shift and Settings have
   no one-tap path below that breakpoint. This is the same nav, laid out as a
   full-height panel that slides in on demand instead of always occupying rail
   width, since a phone doesn't have the spare width a hovering rail does.
   -------------------------------------------------------------------------- */

function Row({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex h-11 items-center gap-3 rounded-[var(--r-md)] px-3 text-[0.875rem] transition-colors",
        active ? "bg-surface text-text shadow-[var(--sh-card)]" : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon size={18} className={active ? "text-accent-hi" : "text-faint"} />
      {label}
    </Link>
  );
}

export function MobileSidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useAuth();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 cursor-default bg-[rgb(22_21_15_/_0.3)] backdrop-blur-md"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="glass glass-strong relative flex h-dvh w-[17.5rem] max-w-[82vw] flex-col overflow-hidden border-y-0 border-l-0 pt-[env(safe-area-inset-top)]"
          >
            <div className="flex h-[3.75rem] shrink-0 items-center justify-between px-4">
              <Logo size={22} />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="cursor-pointer rounded-full p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-text"
              >
                <XIcon size={18} />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
              <div className="space-y-0.5">
                {PRIMARY_NAV.map((item) => (
                  <Row key={item.href} {...item} onNavigate={onClose} />
                ))}
              </div>
              <div className="space-y-0.5">
                <p className="mono-label px-3 pb-1">Night</p>
                {NIGHT_NAV.map((item) => (
                  <Row key={item.href} {...item} onNavigate={onClose} />
                ))}
              </div>
              <div className="space-y-0.5">
                <p className="mono-label px-3 pb-1">Campus</p>
                {CAMPUS_NAV.map((item) => (
                  <Row key={item.href} {...item} onNavigate={onClose} />
                ))}
              </div>
            </nav>

            {me && (
              <div className="flex shrink-0 items-center gap-3 border-t border-border px-3.5 py-3">
                <Link href="/me" onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={me.user} size={30} />
                  <span className="truncate text-[0.8125rem] font-medium text-text">{me.user.displayName}</span>
                </Link>
                <Link
                  href="/settings"
                  onClick={onClose}
                  aria-label="Settings"
                  className="shrink-0 rounded-[var(--r-sm)] p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <SettingsIcon size={16} />
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
