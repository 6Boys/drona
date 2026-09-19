"use client";

import { useEffect, useRef, useState } from "react";
import { VoteBar } from "@/components/feed/VoteBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { SupportCard } from "@/components/ui/SupportCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { FlagIcon, SendIcon, XIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { afterhours } from "@/lib/afterhours-store";
import { timeAgo } from "@/lib/format";
import type { AnonReply, SupportCard as SupportCardData, VoteResult } from "@/lib/types";
import { ReportDialog } from "./ReportDialog";

const REPLY_LIMIT = 300;

function ReplyRow({ reply, onChange, onRemoved }: { reply: AnonReply; onChange: (next: AnonReply) => void; onRemoved: () => void }) {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await afterhours.deleteReply(reply.id);
      onRemoved();
    } catch (err) {
      toast(errorMessage(err, "could not remove that"), "error");
      setBusy(false);
    }
  };

  return (
    <li className="border-t border-border pt-3 first:border-0 first:pt-0">
      <div className="flex items-center gap-2 text-[0.6875rem]">
        <span className="mono-label text-accent-hi">Anon #{reply.anonNumber}</span>
        {reply.isOp && (
          <Badge tone="accent" mono>
            OP
          </Badge>
        )}
        {reply.viewerIsAuthor && !reply.isOp && (
          <Badge tone="outline" mono>
            you
          </Badge>
        )}
        <span className="text-faint">{timeAgo(reply.createdAt)}</span>
      </div>

      <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-text">{reply.body}</p>

      <div className="mt-1.5 flex items-center gap-2">
        <VoteBar
          path={`/v1/afterhours/replies/${reply.id}/vote`}
          score={reply.score}
          viewerVote={reply.viewerVote}
          size="sm"
          onChange={(result: VoteResult) => onChange({ ...reply, ...result })}
        />
        <div className="ml-auto">
          {reply.viewerIsAuthor ? (
            <button
              type="button"
              aria-label="Delete this reply"
              disabled={busy}
              onClick={remove}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XIcon size={13} />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Report this reply"
              onClick={() => setReporting(true)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <FlagIcon size={13} />
            </button>
          )}
        </div>
      </div>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="AFTERHOURS_REPLY"
        targetId={reply.id}
        onReported={onRemoved}
      />
    </li>
  );
}

/** The replies under one post, loaded when the thread is first opened —
 * most people scroll the feed without opening anything, so fetching every
 * thread up front would be a request per card for nothing. */
export function AnonThread({ postId, onCountChange }: { postId: string; onCountChange: (count: number) => void }) {
  const toast = useToast();
  const [replies, setReplies] = useState<AnonReply[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [support, setSupport] = useState<SupportCardData | null>(null);
  const countRef = useRef(onCountChange);
  countRef.current = onCountChange;

  useEffect(() => {
    let alive = true;
    afterhours
      .replies(postId)
      .then((res) => {
        if (!alive) return;
        setReplies(res.items);
        // The count on the card is from when the feed loaded; this is newer.
        countRef.current(res.items.length);
      })
      .catch((err) => {
        if (!alive) return;
        setReplies([]);
        toast(errorMessage(err, "could not load replies"), "error");
      });
    return () => {
      alive = false;
    };
  }, [postId, toast]);

  const update = (next: AnonReply[]) => {
    setReplies(next);
    countRef.current(next.length);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !replies) return;
    setSending(true);
    try {
      const res = await afterhours.reply(postId, body);
      update([...replies, res.reply]);
      setDraft("");
      if (res.supportCard) setSupport(res.supportCard);
    } catch (err) {
      toast(errorMessage(err, "that reply didn't send"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      {replies === null ? (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-[var(--r-md)]" />
          <Skeleton className="h-12 rounded-[var(--r-md)]" />
        </div>
      ) : replies.length === 0 ? (
        <p className="py-1 text-[0.8125rem] text-faint">No replies yet.</p>
      ) : (
        <ul className="space-y-3">
          {replies.map((reply) => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              onChange={(next) => update(replies.map((r) => (r.id === next.id ? next : r)))}
              onRemoved={() => update(replies.filter((r) => r.id !== reply.id))}
            />
          ))}
        </ul>
      )}

      {support && (
        <div className="mt-3">
          <SupportCard card={support} />
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Textarea
            className="min-h-[2.5rem]"
            rows={1}
            placeholder="Reply anonymously"
            aria-label="Reply anonymously"
            value={draft}
            maxLength={REPLY_LIMIT}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
        </div>
        <Button size="icon" aria-label="Send reply" loading={sending} disabled={!draft.trim() || replies === null} onClick={send}>
          {!sending && <SendIcon size={15} />}
        </Button>
      </div>
    </div>
  );
}
