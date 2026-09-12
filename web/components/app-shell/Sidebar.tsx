"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CAMPUS_NAV, NIGHT_NAV, PRIMARY_NAV, type NavItem } from "./nav-items";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Atmosphere } from "@/components/fx/Backdrops";
import { CoinIcon, MoonIcon, SearchIcon, SettingsIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { useAuth } from "@/lib/auth-context";
import { useNight } from "@/lib/night-context";
import { useApi } from "@/lib/use-api";
import { channelFor, useLive } from "@/lib/ws";
import type { Items, Thread } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   The rail is always there; the panel pops out over the page.

   Collapsed it is a 4.75rem strip of icons. Pointing at it slides a translucent
   panel out on top of the content — the page behind stays put and stays
   readable through the glass, so nothing reflows just because the pointer
   drifted left. Pinning it commits: the rail itself widens and the layout
   actually makes room.
   -------------------------------------------------------------------------- */

const RAIL = "4.75rem";
const PANEL = "16.5rem";
const PIN_KEY = "ds:sidebar-pinned";

const SPRING = { type: "spring", stiffness: 320, damping: 34, mass: 0.8 } as const;

function Label({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.16 }}
          className="min-w-0 flex-1 truncate whitespace-nowrap"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function NavLink({ item, badge, open }: { item: NavItem; badge?: number; open: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={open ? undefined : item.label}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-[var(--r-md)] px-[1.05rem] text-[0.8125rem] transition-colors",
        active ? "text-text" : "text-muted hover:text-text",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={SPRING}
          className="absolute inset-0 rounded-[var(--r-md)] border border-border bg-surface shadow-[var(--sh-card)]"
        />
      )}

      <Icon
        size={18}
        className={cn(
          "relative shrink-0 transition-colors",
          active ? (item.romance ? "text-rose" : "text-accent-hi") : "text-faint group-hover:text-muted",
          item.romance && !active && "group-hover:text-rose",
        )}
      />

      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        <Label show={open}>{item.label}</Label>
      </span>

      {badge ? (
        <span
          className={cn(
            "tabnum shrink-0 rounded-full bg-accent text-[0.6875rem] font-medium text-on-accent",
            open ? "relative px-1.5 py-px" : "absolute top-1.5 right-2.5 size-1.5 p-0 text-transparent",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function Section({
  label,
  items,
  badges,
  open,
}: {
  label?: string;
  items: NavItem[];
  badges?: Record<string, number>;
  open: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {label && (
        <div className="h-6 overflow-hidden px-[1.05rem] pt-3">
          <AnimatePresence initial={false}>
            {open && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mono-label whitespace-nowrap"
              >
                {label}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
      {items.map((item) => (
        <NavLink key={item.href} item={item} badge={badges?.[item.href]} open={open} />
      ))}
    </div>
  );
}

export function Sidebar() {
  const { me } = useAuth();
  const { status } = useNight();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    try {
      setPinned(window.localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* private mode — the rail just starts collapsed */
    }
  }, []);

  const togglePin = () => {
    setPinned((p) => {
      const next = !p;
      try {
        window.localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {
        /* nothing to do */
      }
      return next;
    });
  };

  const threads = useApi<Items<Thread>>("/v1/threads", { limit: 30 }, !!me);
  const refetchThreads = threads.refetch;

  const unread = useMemo(
    () => threads.data?.items.reduce((sum, t) => sum + t.unreadCount, 0) ?? 0,
    [threads.data],
  );

  const onLive = useCallback(() => refetchThreads(), [refetchThreads]);
  useLive(me ? [channelFor.user(me.user.id)] : [], onLive, !!me);

  const open = hovered || pinned;

  return (
    <motion.aside
      animate={{ width: pinned ? PANEL : RAIL }}
      transition={SPRING}
      style={{ width: RAIL }}
      className="sticky top-0 z-40 hidden h-dvh shrink-0 lg:block"
    >
      <motion.div
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        animate={{ width: open ? PANEL : RAIL }}
        transition={SPRING}
        style={{ width: RAIL }}
        className="glass absolute top-0 left-0 flex h-dvh flex-col overflow-hidden rounded-r-[var(--r-xl)] border-y-0 border-l-0"
      >
        <Atmosphere tone="brand" className="opacity-45" />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {/* ------------------------------------------------------- brand -- */}
          <div className="flex h-[3.75rem] items-center gap-3 px-[1.15rem]">
            <Link href="/feed" aria-label="DronaSphere home" className="shrink-0 text-text">
              <LogoMark size={24} />
            </Link>
            <Label show={open}>
              <Link href="/feed" className="text-[0.9375rem] tracking-[-0.01em] text-text">
                Drona<span className="text-muted">sphere</span>
              </Link>
            </Label>
            {open && (
              <button
                onClick={togglePin}
                aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                aria-pressed={pinned}
                className="shrink-0 cursor-pointer rounded-full p-1 text-faint transition-colors hover:bg-surface-2 hover:text-text"
              >
                <ChevronRightIcon
                  size={15}
                  className={cn("transition-transform duration-300", pinned && "rotate-180")}
                />
              </button>
            )}
          </div>

          {/* ------------------------------------------------------ search -- */}
          <Link
            href="/search"
            title={open ? undefined : "Search campus"}
            className="mx-3 mb-2 flex h-10 items-center gap-3 rounded-[var(--r-md)] border border-border bg-surface/70 px-[0.7rem] text-[0.8125rem] text-faint transition-colors hover:border-border-strong hover:text-muted"
          >
            <SearchIcon size={17} className="shrink-0" />
            <Label show={open}>Search campus</Label>
            {open && (
              <kbd className="shrink-0 rounded border border-border px-1 font-mono text-[0.625rem] text-faint">
                ⌘K
              </kbd>
            )}
          </Link>

          {/* --------------------------------------------------------- nav -- */}
          <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-3 no-scrollbar">
            <Section items={PRIMARY_NAV} badges={{ "/chats": unread }} open={open} />
            <Section label="Night" items={NIGHT_NAV} open={open} />
            <Section label="Campus" items={CAMPUS_NAV} open={open} />
          </nav>

          {/* ------------------------------------------------------- night -- */}
          {status && (
            <Link
              href="/owl-board"
              title={open ? undefined : "Owl Board"}
              className="mx-3 mb-2 flex items-center gap-3 rounded-[var(--r-md)] border border-border bg-surface/70 px-[0.7rem] py-2.5 transition-colors hover:border-border-strong"
            >
              <span className="relative shrink-0">
                <MoonIcon
                  size={17}
                  className={status.nightOpen && !status.cozyMode ? "text-accent-hi" : "text-faint"}
                />
                {status.nightOpen && !status.cozyMode && (
                  <span className="breathe absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent" />
                )}
              </span>
              <Label show={open}>
                <span className="block">
                  <span className="mono-label block">
                    {status.cozyMode ? "cozy mode" : status.nightOpen ? "night open" : "board closed"}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] text-muted">
                    <span className="tabnum font-medium text-text">{status.weekPoints}</span> pts
                    {status.rank > 0 && (
                      <>
                        {" · "}
                        <span className="tabnum font-medium text-text">#{status.rank}</span>
                      </>
                    )}
                  </span>
                </span>
              </Label>
            </Link>
          )}

          {/* --------------------------------------------------------- you -- */}
          {me && (
            <div className="flex items-center gap-3 border-t border-border px-[0.95rem] py-3">
              <Link href="/me" className="flex min-w-0 flex-1 items-center gap-3" title="Your profile">
                <Avatar user={me.user} size={30} presence={status?.nightOpen ? "night" : "online"} />
                <Label show={open}>
                  <span className="block min-w-0">
                    <span className="block truncate text-[0.8125rem] font-medium text-text">
                      {me.user.displayName}
                    </span>
                    <span className="flex items-center gap-1 text-[0.6875rem] text-gold">
                      <CoinIcon size={11} />
                      <span className="tabnum">{me.user.stardust.toLocaleString()}</span>
                    </span>
                  </span>
                </Label>
              </Link>
              {open && (
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="shrink-0 rounded-[var(--r-sm)] p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <SettingsIcon size={16} />
                </Link>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.aside>
  );
}

/** Kept for the loading shell — same footprint, none of the behaviour. */
export function SidebarGhost() {
  return (
    <div className="hidden h-dvh w-[4.75rem] shrink-0 lg:block">
      <div className="glass flex h-full items-start justify-center pt-[1.15rem]">
        <Logo showWordmark={false} size={24} />
      </div>
    </div>
  );
}
