"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  BellIcon,
  BookIcon,
  HeartIcon,
  MessageIcon,
  MoonIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { channelFor, useLive } from "@/lib/ws";
import { timeAgo } from "@/lib/format";
import type { AppNotification, NotificationFeed, NotificationType } from "@/lib/types";
import { cn } from "@/lib/cn";

const TYPE_ICON: Record<NotificationType, typeof BellIcon> = {
  FOLLOW: UsersIcon,
  COMMENT: MessageIcon,
  REPLY: MessageIcon,
  VOTE: BellIcon,
  MENTION: MessageIcon,
  MATCH: HeartIcon,
  OWL: MoonIcon,
  NOTE: BookIcon,
};

const TYPE_RAMP: Record<NotificationType, string> = {
  FOLLOW: "var(--grad-brand)",
  COMMENT: "var(--grad-brand)",
  REPLY: "var(--grad-brand)",
  VOTE: "var(--grad-brand)",
  MENTION: "var(--grad-brand)",
  MATCH: "var(--grad-love)",
  OWL: "var(--grad-night)",
  NOTE: "var(--grad-notes)",
};

function Row({ item, onNavigate }: { item: AppNotification; onNavigate: () => void }) {
  const Icon = TYPE_ICON[item.type] ?? BellIcon;

  const inner = (
    <>
      {item.actor ? (
        <Avatar user={item.actor} size={32} />
      ) : (
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: TYPE_RAMP[item.type] ?? "var(--grad-brand)" }}
        >
          <Icon size={15} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] leading-snug text-text">{item.title}</span>
        {item.body && <span className="mt-0.5 block truncate text-xs text-muted">{item.body}</span>}
        <span className="mt-0.5 block text-[0.6875rem] text-faint">{timeAgo(item.createdAt)}</span>
      </span>

      {!item.read && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
    </>
  );

  const className = cn(
    "flex w-full items-start gap-3 border-b border-border px-3.5 py-3 text-left transition-colors last:border-0",
    item.read ? "hover:bg-surface" : "bg-accent-wash/40 hover:bg-accent-wash",
  );

  return item.href ? (
    <Link href={item.href} onClick={onNavigate} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

export function NotificationBell() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const feed = useApi<NotificationFeed>("/v1/notifications", { limit: 30 }, !!me);
  const refetch = feed.refetch;

  // New activity on the user channel means the inbox is stale.
  const onLive = useCallback(() => refetch(), [refetch]);
  useLive(me ? [channelFor.user(me.user.id)] : [], onLive, !!me);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = feed.data?.unread ?? 0;

  const markRead = async () => {
    if (!unread) return;
    feed.set((prev) =>
      prev ? { unread: 0, items: prev.items.map((i) => ({ ...i, read: true })) } : prev,
    );
    await api.post("/v1/notifications/read").catch(() => refetch());
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void markRead();
        }}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-[var(--r-sm)] text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <BellIcon size={18} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold text-on-accent">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="pop absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--r-lg)] border border-border-strong bg-panel shadow-[var(--sh-pop)]">
          <header className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <span className="mono-label">notifications</span>
            {feed.data && feed.data.items.length > 0 && (
              <span className="text-[0.6875rem] text-faint">{feed.data.items.length} recent</span>
            )}
          </header>

          <div className="max-h-[26rem] overflow-y-auto">
            {feed.loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : !feed.data?.items.length ? (
              <EmptyState
                compact
                icon={BellIcon}
                title="Nothing new"
                body="Follows, replies and Night Shift changes land here."
              />
            ) : (
              feed.data.items.map((item) => (
                <Row key={item.id} item={item} onNavigate={() => setOpen(false)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
