"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RefreshIcon } from "@/components/ui/Icons";
import { SupportCard } from "@/components/ui/SupportCard";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { afterhours, useAfterHoursIdentity } from "@/lib/afterhours-store";
import { MOODS } from "@/lib/afterhours-theme";
import type { AnonMood, AnonPost, SupportCard as SupportCardData } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Flame, Sigil } from "./Atmosphere";
import { MoodPickerChips } from "./MoodChips";

const BODY_LIMIT = 500;

function CharRing({ used }: { used: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const frac = Math.min(used / BODY_LIMIT, 1);
  const near = used > BODY_LIMIT - 50;
  return (
    <span className="flex items-center gap-1.5">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="-rotate-90">
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke={near ? "var(--danger)" : "var(--mood)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      {near && <span className="tabnum text-[0.6875rem] text-danger">{BODY_LIMIT - used}</span>}
    </span>
  );
}

/** The booth: who you're posting as, what kind of thing you're saying, and
 * the saying of it. The number and its reset live right here, not in
 * settings — deciding whether you want a fresh mask is part of deciding to post. */
export function AnonComposer({ onPosted }: { onPosted: (post: AnonPost) => void }) {
  const { identity, flush } = useAfterHoursIdentity();
  const toast = useToast();
  const [mood, setMood] = useState<AnonMood>("confession");
  const [body, setBody] = useState("");
  const [focused, setFocused] = useState(false);
  const [posting, setPosting] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [support, setSupport] = useState<SupportCardData | null>(null);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const { post, supportCard } = await afterhours.createPost(trimmed, mood);
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
      toast("New mask on. Nobody can link it to your old one.", "info");
    } catch (err) {
      toast(errorMessage(err, "could not get a new mask"), "error");
    } finally {
      setFlushing(false);
    }
  };

  return (
    <section
      data-mood={mood}
      className="ah-card p-4 sm:p-5"
      style={{
        transition: "border-color 0.25s ease, box-shadow 0.35s ease",
        ...(focused && {
          borderColor: "color-mix(in oklab, var(--mood) 45%, var(--border))",
          boxShadow: "0 0 0 1px color-mix(in oklab, var(--mood) 25%, transparent), 0 20px 50px -28px var(--mood)",
        }),
      }}
    >
      <div className="flex items-center gap-3">
        {identity ? <Sigil anonNumber={identity.anonNumber} size={36} /> : <span className="size-9 rounded-full bg-surface-2" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">#{identity?.anonNumber ?? "····"}</p>
          <p className="text-[0.6875rem] text-faint">your mask for tonight</p>
        </div>
        <button
          type="button"
          onClick={doFlush}
          disabled={flushing || !identity}
          className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[0.75rem] text-muted transition-colors hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshIcon size={12} className={flushing ? "animate-spin" : undefined} />
          New mask
        </button>
      </div>

      <div className="mt-4">
        <MoodPickerChips value={mood} onChange={setMood} />
      </div>

      <textarea
        aria-label="Write your post"
        rows={3}
        value={body}
        maxLength={BODY_LIMIT}
        placeholder={MOODS[mood].prompt}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => setBody(e.target.value)}
        className="ah-quote mt-3 min-h-[6rem] w-full resize-none bg-transparent outline-none placeholder:text-faint placeholder:italic"
      />

      {MOODS[mood].hint && (
        <p className="mt-1 flex items-center gap-1.5 text-[0.75rem] text-muted">
          <span aria-hidden>{MOODS[mood].emoji}</span>
          {MOODS[mood].hint}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
        <CharRing used={body.length} />
        <span className={cn("text-[0.75rem] text-faint", body.length > 0 && "hidden sm:inline")}>Burns out in 24 hours</span>
        <Button
          size="sm"
          className="ml-auto"
          icon={<Flame size={11} />}
          loading={posting}
          disabled={!body.trim()}
          onClick={submit}
        >
          Release
        </Button>
      </div>

      {support && (
        <div className="mt-4">
          <SupportCard card={support} />
        </div>
      )}
    </section>
  );
}
