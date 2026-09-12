"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { avatarBackground, avatarColours, initialsFor } from "@/components/ui/GradientAvatar";
import { CanvasReveal } from "@/components/fx/CanvasReveal";
import { Atmosphere } from "@/components/fx/Backdrops";
import { Glow } from "@/components/fx/Glow";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon, HeartIcon } from "@/components/ui/Icons";
import { deckFor, pendingLikes, useDating } from "@/lib/dating-store";
import { useAuth } from "@/lib/auth-context";
import type { DatingCandidate } from "@/lib/types";

/* -----------------------------------------------------------------------------
   The Nest's doorway into Love Finder.

   It sits at the top of the feed because a dating surface nobody can find is a
   dating surface nobody uses, and it changes shape rather than repeating
   itself: an invitation while you're out of the deck, a count of who liked you
   once you're in, and a quiet line when there's nothing new. It never nags and
   it never fakes a number.
   -------------------------------------------------------------------------- */

function FaceStack({ people }: { people: DatingCandidate[] }) {
  const [hot, setHot] = useState(false);

  return (
    <div
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      className="flex shrink-0 -space-x-5"
      aria-hidden
    >
      {people.map((person, i) => (
        <motion.span
          key={person.id}
          initial={{ opacity: 0, y: 10, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: (i - 1) * 5 }}
          whileHover={{ y: -6, rotate: 0, zIndex: 10 }}
          transition={{ type: "spring", stiffness: 260, damping: 22, delay: i * 0.06 }}
          className="relative size-16 overflow-hidden rounded-[var(--r-md)] ring-2 ring-[var(--surface)] sm:size-20"
          style={{ background: avatarBackground(person.avatar) }}
        >
          <CanvasReveal active={hot} colours={avatarColours(person.avatar)} dotSize={2} gap={4} />
          <span className="display absolute inset-0 flex items-center justify-center text-[1.5rem] text-white/85">
            {initialsFor(person.displayName)}
          </span>
        </motion.span>
      ))}
    </div>
  );
}

export function LoveFinderInvite() {
  const { me } = useAuth();
  const state = useDating();

  if (!me || !me.loveFinderAvailable) return null;

  const likes = pendingLikes(state);
  const deck = deckFor(state, me.user.handle);
  const inDeck = me.user.loveFinderEnabled;

  const faces = (likes.length ? likes.map((l) => l.candidate) : deck).slice(0, 3);
  if (!faces.length && inDeck && !likes.length) return null;

  const headline = !inDeck
    ? "Love Finder is open on your campus"
    : likes.length
      ? `${likes.length} ${likes.length === 1 ? "person" : "people"} liked you`
      : `${deck.length} new ${deck.length === 1 ? "card" : "cards"} in the deck`;

  const body = !inDeck
    ? "Opt in and your card joins the deck. Same campus, verified students only, and you can take it back out whenever you like."
    : likes.length
      ? "They liked something specific — a picture, or one answer you wrote. Nothing is blurred and nothing costs anything."
      : "Same campus, verified, and nobody is told you looked.";

  return (
    <div className="glass glass-panel relative mb-4 overflow-hidden" data-theme="dating">
      <Atmosphere tone="love" className="opacity-55" />
      <Glow color="var(--rose-400)" />

      <div className="relative z-10 flex flex-wrap items-center gap-6 p-5">
        <div className="min-w-[15rem] flex-1">
          <p className="mono-label flex items-center gap-1.5">
            <HeartIcon size={11} className="text-accent" />
            love finder
          </p>
          <h2 className="display mt-2 text-[1.625rem] text-text">{headline}</h2>
          <p className="mt-2 max-w-md text-[0.8125rem] leading-relaxed text-muted">{body}</p>

          <ButtonLink
            href="/dating"
            size="sm"
            className="mt-4"
            icon={<ArrowRightIcon size={14} />}
          >
            {inDeck ? (likes.length ? "See who" : "Open the deck") : "Put me in the deck"}
          </ButtonLink>
        </div>

        {faces.length > 0 && (
          <Link href="/dating" aria-label="Open Love Finder" className="ml-auto">
            <FaceStack people={faces} />
          </Link>
        )}
      </div>
    </div>
  );
}
