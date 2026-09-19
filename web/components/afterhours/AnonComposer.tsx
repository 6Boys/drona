"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { RefreshIcon, SendIcon } from "@/components/ui/Icons";
import { SupportCard } from "@/components/ui/SupportCard";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { afterhours, useAfterHoursIdentity } from "@/lib/afterhours-store";
import type { AnonPost, SupportCard as SupportCardData } from "@/lib/types";

const BODY_LIMIT = 500;

/** Posting box plus the identity it posts under — the number and the flush
 * control live right where you're about to use them, not buried in settings,
 * since deciding whether you want a fresh one is part of deciding to post. */
export function AnonComposer({ onPosted }: { onPosted: (post: AnonPost) => void }) {
  const { identity, flush } = useAfterHoursIdentity();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [support, setSupport] = useState<SupportCardData | null>(null);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const { post, supportCard } = await afterhours.createPost(trimmed);
      onPosted(post);
      setBody("");
      setSupport(supportCard ?? null);
    } catch (err) {
      toast(errorMessage(err, "that didn't post"), "error");
    } finally {
      setPosting(false);
    }
  };

  const doFlush = async () => {
    setFlushing(true);
    try {
      await flush();
      toast("New number assigned", "info");
    } catch (err) {
      toast(errorMessage(err, "could not get a new number"), "error");
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="mono-label">
          posting as <span className="text-accent-hi">Anon #{identity?.anonNumber ?? "----"}</span>
        </p>
        <button
          type="button"
          onClick={doFlush}
          disabled={flushing || !identity}
          className="flex cursor-pointer items-center gap-1 text-[0.75rem] text-faint transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshIcon size={12} className={flushing ? "animate-spin" : undefined} />
          New number
        </button>
      </div>

      <Textarea
        className="mt-3"
        rows={3}
        placeholder="Say it. Nobody here knows it's you unless you tell them."
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, BODY_LIMIT))}
        hint={`${body.length}/${BODY_LIMIT}`}
      />

      <div className="mt-2 flex justify-end">
        <Button size="sm" icon={<SendIcon size={14} />} loading={posting} disabled={!body.trim()} onClick={submit}>
          Post anonymously
        </Button>
      </div>

      {support && (
        <div className="mt-3">
          <SupportCard card={support} />
        </div>
      )}
    </div>
  );
}
