"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SupportCard } from "@/components/ui/SupportCard";
import { ChevronLeftIcon, SendIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage, randomId } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePaged } from "@/lib/use-paged";
import { useAuth } from "@/lib/auth-context";
import { channelFor, sendTyping, useLive } from "@/lib/ws";
import { clockTime, dayStamp } from "@/lib/format";
import type { LiveEvent, Message, SendResult, SupportCard as SupportCardData, Thread, TypingPayload } from "@/lib/types";
import { threadLabel, threadPartner, threadSubtitle } from "./thread-utils";
import { cn } from "@/lib/cn";

function Bubble({
  message,
  mine,
  grouped,
}: {
  message: Message;
  mine: boolean;
  grouped: boolean;
}) {
  if (message.kind === "SYSTEM") {
    return (
      <li className="my-2 text-center">
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.6875rem] text-faint">{message.body}</span>
      </li>
    );
  }

  return (
    <li className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row", grouped ? "mt-0.5" : "mt-3")}>
      <span className="w-7 shrink-0">
        {!mine && !grouped && <Avatar user={message.sender} size={28} />}
      </span>

      <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
        {!grouped && !mine && (
          <span className="mb-0.5 px-1 text-[0.6875rem] text-faint">{message.sender.displayName}</span>
        )}
        <div
          className={cn(
            "rounded-[var(--r-md)] px-3 py-2 text-sm whitespace-pre-wrap",
            mine
              ? "bg-accent text-on-accent"
              : "border border-border bg-surface text-text",
            message.deletedAt && "italic opacity-60",
          )}
        >
          {message.deletedAt ? "Message deleted" : message.body}
        </div>
        <span className="mt-0.5 px-1 text-[0.625rem] text-faint">{clockTime(message.createdAt)}</span>
      </div>
    </li>
  );
}

export function Conversation({ threadId }: { threadId: string }) {
  const { me } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const viewerId = me?.user.id ?? "";

  const thread = useApi<Thread>(`/v1/threads/${threadId}`);
  const paged = usePaged<Message>(`/v1/threads/${threadId}/messages`, { limit: 40 });

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typingBy, setTypingBy] = useState<string | null>(null);
  const [support, setSupport] = useState<SupportCardData | null>(null);
  const [declining, setDeclining] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingSentAt = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The API returns newest-first (keyset cursor walks backwards); the UI reads
  // oldest-at-top, so flip it for display rather than for storage.
  const messages = useMemo(() => [...paged.items].reverse(), [paged.items]);

  const setItems = paged.setItems;

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (event.channel !== channelFor.thread(threadId)) return;

      if (event.type === "message.new") {
        const incoming = event.payload as Message;
        setItems((prev) =>
          // The socket echoes our own sends back; clientId is what makes that
          // idempotent rather than a duplicate bubble.
          prev.some((m) => m.id === incoming.id || (incoming.clientId && m.clientId === incoming.clientId))
            ? prev.map((m) => (incoming.clientId && m.clientId === incoming.clientId ? incoming : m))
            : [incoming, ...prev],
        );
      }

      if (event.type === "message.deleted") {
        const { id } = event.payload as { id: string };
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m)));
      }

      if (event.type === "typing") {
        const payload = event.payload as TypingPayload;
        if (payload.userId === viewerId) return;
        // One timer, replaced on every keystroke they send. Left uncleared,
        // the previous event's timer would blank "…is typing" four seconds
        // after they started, while they were still typing.
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = null;
        setTypingBy(payload.typing ? payload.handle : null);
        if (payload.typing) {
          typingTimer.current = setTimeout(() => setTypingBy(null), 4000);
        }
      }
    },
    [threadId, setItems, viewerId],
  );

  useLive([channelFor.thread(threadId)], onEvent);

  const newestId = messages.at(-1)?.id;

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  // Keyed on the newest message, not on the count: "load earlier" prepends a
  // page of history, which grows the count too, and scrolling to the bottom
  // there threw the reader back to the newest message — the opposite of what
  // they just asked for.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  // Mark read whenever the newest message changes while this thread is open.
  useEffect(() => {
    if (!newestId) return;
    api.post(`/v1/threads/${threadId}/read`, { messageId: newestId }).catch(() => {});
  }, [threadId, newestId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;

    // crypto.randomUUID() throws outside a secure context (plain http://,
    // which a homelab reached over Tailscale/LAN usually is) — see lib/api.ts.
    const clientId = randomId();
    const optimistic: Message = {
      id: `pending-${clientId}`,
      threadId,
      sender: me!.user,
      kind: "TEXT",
      body,
      clientId,
      createdAt: new Date().toISOString(),
    };

    setDraft("");
    setSending(true);
    setItems((prev) => [optimistic, ...prev]);

    try {
      const result = await api.post<SendResult>(`/v1/threads/${threadId}/messages`, {
        body,
        kind: "TEXT",
        clientId,
      });
      setItems((prev) => prev.map((m) => (m.clientId === clientId ? result.message : m)));
      if (result.supportCard) setSupport(result.supportCard);
      if (result.owlPoints?.points) {
        toast(`+${result.owlPoints.points} night points`, "success");
      }
    } catch (err) {
      setItems((prev) => prev.filter((m) => m.clientId !== clientId));
      setDraft(body);
      toast(errorMessage(err, "message didn't send"), "error");
    } finally {
      setSending(false);
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (now - typingSentAt.current > 2500) {
      typingSentAt.current = now;
      sendTyping(threadId, true);
    }
  };

  const partner = thread.data ? threadPartner(thread.data, viewerId) : undefined;
  const isRequest = thread.data?.viewerState === "REQUESTED";
  // Sent one message on a one-directional follow and it's still undecided —
  // pending is true for both sides of that; isRequest above already claims
  // the recipient's case, so whatever's left here is the sender's. Only true
  // once they've actually used their one message — before that, a fresh
  // pending thread still needs its composer, not a "waiting" banner with
  // nothing sent yet.
  const isPendingSender = !!thread.data?.pending && !isRequest && messages.some((m) => m.sender.id === viewerId);
  const isSignal = thread.data?.type === "SIGNAL";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-bg/85 px-3 py-2.5 backdrop-blur">
        <Link
          href="/chats"
          aria-label="Back to chats"
          className="rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text lg:hidden"
        >
          <ChevronLeftIcon size={18} />
        </Link>

        {thread.data ? (
          <>
            {partner ? (
              <Avatar user={partner} size={34} />
            ) : (
              <span className="flex size-[34px] items-center justify-center rounded-full border border-border bg-surface-2">
                {thread.data.icon || (isSignal ? "📣" : "👥")}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-medium text-text">
                {threadLabel(thread.data, viewerId)}
              </p>
              <p className="truncate text-[0.6875rem] text-faint">
                {typingBy ? `@${typingBy} is typing…` : threadSubtitle(thread.data, viewerId)}
              </p>
            </div>
            {isSignal && (
              <Badge tone="accent" mono>
                signal
              </Badge>
            )}
          </>
        ) : (
          <Skeleton className="h-8 w-40" />
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {paged.loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-2/3" />
            ))}
          </div>
        ) : !messages.length ? (
          <EmptyState title="No messages yet" body="Say something. Worst case, they leave you on read." />
        ) : (
          <>
            {paged.hasMore && (
              <div className="flex justify-center pb-3">
                <Button size="sm" variant="ghost" loading={paged.loadingMore} onClick={paged.loadMore}>
                  Load earlier messages
                </Button>
              </div>
            )}

            <ul>
              {messages.map((message, i) => {
                const previous = messages[i - 1];
                const sameDay = dayStamp(previous?.createdAt) === dayStamp(message.createdAt);
                const grouped =
                  !!previous &&
                  sameDay &&
                  previous.sender.id === message.sender.id &&
                  message.kind !== "SYSTEM" &&
                  new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60_000;

                return (
                  <div key={message.id}>
                    {!sameDay && (
                      <li className="my-3 flex items-center gap-3">
                        <span className="h-px flex-1 bg-border" />
                        <span className="mono-label">{dayStamp(message.createdAt)}</span>
                        <span className="h-px flex-1 bg-border" />
                      </li>
                    )}
                    <Bubble message={message} mine={message.sender.id === viewerId} grouped={grouped} />
                  </div>
                );
              })}
            </ul>
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {support && (
        <div className="border-t border-border p-3">
          <SupportCard card={support} />
        </div>
      )}

      {isRequest ? (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-3 py-3">
          <p className="text-xs text-muted">
            This is a message request. Accepting lets them message you directly.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              loading={declining}
              onClick={async () => {
                setDeclining(true);
                try {
                  await api.post(`/v1/threads/${threadId}/decline`);
                  router.push("/chats");
                } catch (err) {
                  toast(errorMessage(err, "could not decline"), "error");
                  setDeclining(false);
                }
              }}
            >
              Decline
            </Button>
            <Button
              size="sm"
              disabled={declining}
              onClick={async () => {
                try {
                  await api.post(`/v1/threads/${threadId}/accept`);
                  thread.refetch();
                } catch (err) {
                  toast(errorMessage(err, "could not accept"), "error");
                }
              }}
            >
              Accept
            </Button>
          </div>
        </div>
      ) : isPendingSender ? (
        <div className="border-t border-border bg-surface px-3 py-3">
          <p className="text-xs text-muted">
            You've sent your one message. It's in their requests — you can send more once they accept.
          </p>
        </div>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-border bg-panel px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message"
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-[var(--r-md)] border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <Button type="submit" size="icon" aria-label="Send" loading={sending} disabled={!draft.trim()}>
            {!sending && <SendIcon size={16} />}
          </Button>
        </form>
      )}
    </div>
  );
}
