"use client";

import { useState } from "react";
import { LayoutGrid, type LayoutGridCard } from "@/components/fx/LayoutGrid";
import { ProfileCard, ProfileTile } from "./ProfileCard";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeartIcon, SparkleIcon, XIcon } from "@/components/ui/Icons";
import { Paywall } from "@/components/premium/Paywall";
import { timeAgo } from "@/lib/format";
import type { DatingLike, DatingMatch, DatingPrompt } from "@/lib/types";

/* -----------------------------------------------------------------------------
   Likes you — a mosaic where each tile is a person and what they reacted to.

   Tapping a tile promotes it to the middle of the grid and reveals the comment
   in full, with the two answers underneath it. Nothing is blurred and nothing
   is counted down: withholding who liked you in order to sell it back is the
   single most resented pattern in dating apps, and this one is free.
   -------------------------------------------------------------------------- */

/** What of *yours* they reacted to. The target indexes into the viewer's own
 * card, so it quotes their prompt — and stays vague rather than guessing when
 * the viewer hasn't written that answer yet. */
function targetLine(like: DatingLike, myPrompts: DatingPrompt[]): string {
  if (like.target.kind !== "PROMPT" || like.target.promptIndex === undefined) {
    return "liked your picture";
  }
  const mine = myPrompts[like.target.promptIndex];
  return mine ? `liked "${mine.question}"` : "liked one of your answers";
}

/** The sentence of theirs the viewer is being shown — either their comment, or
 * failing that the answer they wrote themselves. */
function quoteFor(like: DatingLike): string | undefined {
  if (like.note) return like.note;
  return like.candidate.prompts[0]?.answer;
}

export function LikesYouGrid({
  likes,
  myPrompts,
  unlocked,
  onAnswer,
}: {
  likes: DatingLike[];
  myPrompts: DatingPrompt[];
  /** Premium gate. Locked: every tile is obscured — a reaction with no name
   * or face behind it — and opening one leads to the paywall, not the match
   * panel. There is nothing partial about it; matching back requires
   * identity, which is the thing being sold. */
  unlocked: boolean;
  onAnswer: (like: DatingLike, accept: boolean) => void;
}) {
  const [preview, setPreview] = useState<DatingLike | null>(null);

  if (!likes.length) {
    return (
      <EmptyState
        title="No new likes"
        body="When someone likes your picture or one of your answers, they land here — with whatever they said about it."
      />
    );
  }

  const cards: LayoutGridCard[] = likes.map((like, i) => ({
    id: like.id,
    // The first tile anchors the mosaic — but only once there are enough
    // tiles for it to be a mosaic. A lone like blown up to 2x2 just looks
    // like a layout mistake.
    className: i === 0 && likes.length >= 3 ? "md:col-span-2 md:row-span-2" : undefined,
    thumbnail: (open: boolean) => (
      <ProfileTile
        candidate={like.candidate}
        active={open}
        obscured={!unlocked}
        /* Once the panel below is quoting the comment in full, the tile saying
           it too is just the same sentence twice. */
        quote={(i === 0 || likes.length < 3) && !open ? quoteFor(like) : undefined}
        footer={
          <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-white/75">
            {like.action === "SUPERLIKE" ? (
              <SparkleIcon size={11} className="text-gold" />
            ) : (
              <HeartIcon size={11} />
            )}
            {targetLine(like, myPrompts)} · {timeAgo(like.createdAt)}
          </p>
        }
      />
    ),
    content: !unlocked ? (
      <div className="glass glass-strong glass-panel p-5">
        <Paywall
          title="Unlock to match"
          body="See who this is and match back directly — no waiting for them to also like you."
        />
      </div>
    ) : (
      <div className="glass glass-strong glass-panel p-5">
        <p className="mono-label">
          {like.action === "SUPERLIKE" ? "superliked" : "liked"} · {targetLine(like, myPrompts)}
        </p>

        {like.note ? (
          <p className="serif mt-3 text-[1.375rem] leading-snug text-text">
            &ldquo;{like.note}&rdquo;
          </p>
        ) : (
          <p className="mt-3 text-[0.9375rem] text-muted">
            No comment — just the like. {like.candidate.displayName.split(" ")[0]} is leaving the
            first word to you.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            icon={<HeartIcon size={15} />}
            onClick={(e) => {
              e.stopPropagation();
              onAnswer(like, true);
            }}
          >
            Match back
          </Button>
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setPreview(like);
            }}
          >
            See full profile
          </Button>
          <Button
            variant="ghost"
            icon={<XIcon size={15} />}
            onClick={(e) => {
              e.stopPropagation();
              onAnswer(like, false);
            }}
          >
            Not for me
          </Button>
        </div>
      </div>
    ),
  }));

  return (
    <>
      <LayoutGrid cards={cards} />

      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview ? `${preview.candidate.displayName}'s profile` : ""}
        description="Everything they wrote, in their own words."
        width="sm"
        footer={
          preview && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  onAnswer(preview, false);
                  setPreview(null);
                }}
              >
                Not for me
              </Button>
              <Button
                icon={<HeartIcon size={15} />}
                onClick={() => {
                  onAnswer(preview, true);
                  setPreview(null);
                }}
              >
                Match back
              </Button>
            </>
          )
        }
      >
        {preview && <ProfileCard candidate={preview.candidate} className="border-none shadow-none" />}
      </Dialog>
    </>
  );
}
