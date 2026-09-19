"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlusIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { channelFor, useLive } from "@/lib/ws";
import { timeAgo } from "@/lib/format";
import type { Items, Thread, User } from "@/lib/types";
import { threadLabel, threadPartner } from "./thread-utils";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";

function NewChatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const results = useApi<Items<User>>("/v1/search/users", { q: query, limit: 8 }, open && query.length > 1);

  const start = async (handle: string) => {
    setBusy(true);
    try {
      const thread = await api.post<Thread>("/v1/threads/dm", { handle });
      onClose();
      router.push(`/chats/${thread.id}`);
    } catch (err) {
      toast(errorMessage(err, "could not open that chat"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New chat"
      description="Buddies go straight to your inbox. Everyone else lands in requests."
    >
      <div className="space-y-3">
        <Input
          autoFocus
          label="Find someone"
          placeholder="Search by name or handle"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <ul className="space-y-1">
          {(results.data?.items ?? []).map((user) => (
            <li key={user.id}>
              <button
                disabled={busy}
                onClick={() => start(user.handle)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--r-md)] border border-border px-3 py-2 text-left transition-colors hover:border-accent"
              >
                <Avatar user={user} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-text">
                    {user.displayName}
                  </span>
                  <span className="block truncate text-xs text-faint">@{user.handle}</span>
                </span>
                {user.isBuddy && (
                  <Badge tone="accent" mono>
                    buddy
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>

        {query.length > 1 && !results.loading && !results.data?.items.length && (
          <p className="py-4 text-center text-sm text-faint">Nobody by that name.</p>
        )}
      </div>
    </Dialog>
  );
}

export function ThreadList({ activeId, className }: { activeId?: string; className?: string }) {
  const { me } = useAuth();
  const [tab, setTab] = useState<"inbox" | "requests">("inbox");
  const [composing, setComposing] = useState(false);

  const inbox = useApi<Items<Thread>>("/v1/threads", { limit: 40 });
  const requests = useApi<Items<Thread>>("/v1/threads/requests", { limit: 40 });

  const refetchInbox = inbox.refetch;
  const onLive = useCallback(() => refetchInbox(), [refetchInbox]);
  useLive(me ? [channelFor.user(me.user.id)] : [], onLive, !!me);

  const active = tab === "inbox" ? inbox : requests;
  const threads = useMemo(() => active.data?.items ?? [], [active.data]);
  const requestCount = requests.data?.items.length ?? 0;

  return (
    <div className={cn("flex min-h-0 flex-col border-border", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "inbox", label: "Inbox" },
            { value: "requests", label: "Requests", count: requestCount || undefined },
          ]}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label="New chat"
          className="ml-auto"
          onClick={() => setComposing(true)}
        >
          <PlusIcon size={16} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {active.loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !threads.length ? (
          <EmptyState
            compact
            title={tab === "inbox" ? "No conversations yet" : "No requests"}
            body={
              tab === "inbox"
                ? "Start a DM, or join a Den from a space."
                : "Messages from people you don't follow back land here first."
            }
          />
        ) : (
          <ul className="space-y-0.5 p-2">
            {threads.map((thread) => {
              const partner = threadPartner(thread, me?.user.id ?? "");
              return (
                <li key={thread.id}>
                  <Link
                    href={`/chats/${thread.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 transition-colors",
                      activeId === thread.id
                        ? "border border-border bg-surface shadow-[var(--sh-card)]"
                        : "border border-transparent hover:border-border hover:bg-surface",
                    )}
                  >
                    {partner ? (
                      <Avatar user={partner} size={38} />
                    ) : (
                      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-base">
                        {thread.icon || (thread.type === "SIGNAL" ? "📣" : "👥")}
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-text">
                          {threadLabel(thread, me?.user.id ?? "")}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] text-faint">
                          {timeAgo(thread.lastMessageAt ?? thread.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-muted">
                          {thread.lastMessage?.body || "No messages yet"}
                        </span>
                        {thread.unreadCount > 0 && (
                          <span className="tabnum shrink-0 rounded-full bg-accent px-1.5 text-[0.625rem] font-medium text-on-accent">
                            {thread.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NewChatDialog open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}
