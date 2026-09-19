"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  type MotionStyle,
  type PanInfo,
} from "framer-motion";
import { ProfileCard } from "./ProfileCard";
import { TempCandidateWidget } from "./TempCandidateWidget";
import { LikeNoteSheet } from "./LikeNoteSheet";
import { Dialog } from "@/components/ui/Dialog";
import { SparkleIcon, XIcon } from "@/components/ui/Icons";
import type { DatingCandidate, LikeTarget, SwipeAction } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   The deck.

   Dragging is the fast path — right to like the picture, left to pass — and
   the heart on any block is the considered one, which opens the comment
   sheet and lets you say what you're actually reacting to. Both end in the
   same commit, so the card flies away exactly once either way. SuperLike
   used to live on the up-swipe too; it's the action-row button only now, since
   spending a limited resource on a gesture most people reach for to read
   more, rather than to commit to anything, was the kind of accidental cost
   nobody asked for.

   A card holds more than fits on a phone, and a touch drag can't also be a
   scroll (see the note on the draggable card), so reading the rest is its own
   surface: tap the card, swipe it up, or tap "Read all of it" — all three
   open the same full profile in a dialog.
   -------------------------------------------------------------------------- */

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 650;
const STACK_DEPTH = 3;
const FLY_DISTANCE = 760;

type Direction = { x: number; y: number };

const DIRECTIONS: Record<SwipeAction, Direction> = {
  PASS: { x: -1, y: 0 },
  LIKE: { x: 1, y: 0 },
  SUPERLIKE: { x: 0, y: -1 },
};

export interface SwipeDecision {
  action: SwipeAction;
  candidate: DatingCandidate;
  /** What was liked. Absent on a pass. */
  target?: LikeTarget;
  note?: string;
}

/** A quiet verdict chip that fades in as you drag, instead of a stamp. */
function Verdict({
  label,
  className,
  style,
}: {
  label: string;
  className?: string;
  style?: MotionStyle;
}) {
  return (
    <motion.span
      style={style}
      className={cn(
        "glass glass-pill pointer-events-none absolute top-8 px-4 py-1.5 text-[0.8125rem] tracking-wide",
        className,
      )}
    >
      {label}
    </motion.span>
  );
}

function ActionButton({
  onClick,
  label,
  tone,
  size = "md",
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  tone: "pass" | "superlike" | "like";
  size?: "sm" | "md";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileHover={{ scale: disabled ? 1 : 1.07, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className={cn(
        "glass glass-pill glass-strong flex cursor-pointer items-center justify-center",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "md" ? "size-14" : "size-11",
        tone === "pass" && "text-muted hover:text-text",
        tone === "superlike" && "text-gold",
        tone === "like" && "text-accent",
      )}
    >
      {children}
    </motion.button>
  );
}

export function SwipeDeck({
  candidates,
  superlikesLeft,
  swipesLeft,
  onDecide,
  onSuperlikeBlocked,
  onSwipesBlocked,
  onRemove,
  emptyState,
}: {
  candidates: DatingCandidate[];
  superlikesLeft: number;
  /** null means unlimited (premium). */
  swipesLeft: number | null;
  onDecide: (decision: SwipeDecision) => void;
  onSuperlikeBlocked: () => void;
  onSwipesBlocked: () => void;
  /** Fires when a card is dropped for a reason that isn't a swipe — a report
   * or a block. The parent has to forget them too: dropping it only from the
   * local copy means the next `advance()` rebuilds `candidates` and hands the
   * blocked person straight back to the top of the deck. */
  onRemove?: (candidate: DatingCandidate) => void;
  emptyState: React.ReactNode;
}) {
  const [deck, setDeck] = useState(candidates);
  const [pending, setPending] = useState<LikeTarget | null>(null);
  const [reading, setReading] = useState(false);
  const busyRef = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-280, 280], [-9, 9]);
  const likeOpacity = useTransform(x, [30, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -30], [1, 0]);
  const readMoreOpacity = useTransform(y, [-150, -40], [1, 0]);

  const top = deck[0];

  // New candidates arriving (opt-in flipped, deck reset) replace the stack.
  useEffect(() => setDeck(candidates), [candidates]);

  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [top?.id, x, y]);

  const commit = useCallback(
    async (
      action: SwipeAction,
      velocity: Direction = { x: 0, y: 0 },
      detail?: { target?: LikeTarget; note?: string },
    ) => {
      if (!top || busyRef.current) return;

      if (swipesLeft !== null && swipesLeft <= 0) {
        onSwipesBlocked();
        return;
      }
      if (action === "SUPERLIKE" && superlikesLeft <= 0) {
        onSuperlikeBlocked();
        return;
      }

      busyRef.current = true;
      const dir = DIRECTIONS[action];
      const target = dir.x !== 0 ? x : y;

      await animate(target, (dir.x || dir.y) * FLY_DISTANCE, {
        type: "spring",
        stiffness: 240,
        damping: 24,
        velocity: dir.x !== 0 ? velocity.x : velocity.y,
      });

      onDecide({
        action,
        candidate: top,
        // A drag with no explicit target is a like on the picture, which is
        // what the gesture means.
        ...(action === "PASS" ? {} : { target: detail?.target ?? { kind: "PHOTO" as const } }),
        ...(detail?.note ? { note: detail.note } : {}),
      });

      setDeck((prev) => prev.slice(1));
      busyRef.current = false;
    },
    [top, superlikesLeft, swipesLeft, onDecide, onSuperlikeBlocked, onSwipesBlocked, x, y],
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (busyRef.current) return;
      const { offset, velocity } = info;

      if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
        void commit("LIKE", { x: velocity.x, y: 0 });
      } else if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
        void commit("PASS", { x: velocity.x, y: 0 });
      } else if (offset.y < -SWIPE_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) {
        // Used to spend a SuperLike here. Swiping up is the instinctive "show
        // me more" gesture — Tinder's own super-like aside, most people
        // reaching for it want to read further, not commit a limited
        // resource by accident. Opens the same reader "Read all of it" does;
        // the SuperLike action row button is the only way left to actually spend one, on
        // purpose, not as an accidental side effect of trying to scroll.
        // dragConstraints is a single point (0,0 on every side), so releasing
        // without a commit() already snaps the card back there on its own —
        // nothing else to do to keep it in the deck.
        setReading(true);
      }
    },
    [commit],
  );

  const behind = useMemo(() => deck.slice(1, STACK_DEPTH), [deck]);

  if (!top) return <>{emptyState}</>;

  return (
    <div className="flex flex-col items-center">
      {/* overflow-hidden: the fanned peek below rotates+translates the behind
          cards slightly past this box's own edges, and unlike TempCandidate
          Widget's own internal scroller, absolutely-positioned children with
          no overflow clamp on their containing block DO leak into the page's
          real scrollWidth — this is what was forcing a few extra pixels of
          horizontal scroll on the whole dating page. */}
      {/* 100dvh minus a reserved amount for everything else on this tab: the
          sticky header, the "Tonight you might meet" line, this box's own
          mt-8 gap, the action-button row, and the floating MobileNav (fixed,
          so it overlaps whatever document content ends up under it rather
          than pushing it up). Tuned against the actual rendered layout at
          375x812 (this app's narrowest realistic target) until the whole
          Discover tab — card, buttons, the "N cards left" line — fit inside
          one viewport with no page scroll at all, rather than guessed. */}
      <div className="relative h-[clamp(24rem,calc(100dvh-27rem),38rem)] w-full max-w-[25rem] overflow-hidden">
        {behind
          .slice()
          .reverse()
          .map((candidate, reverseIndex) => {
            const depth = behind.length - reverseIndex;
            // Peeking from alternating sides rather than dead-center behind
            // the top card — a fanned deck, not a stack of identical shadows.
            const side = depth % 2 === 0 ? 1 : -1;
            return (
              <div
                key={candidate.id}
                className="absolute inset-0 origin-bottom"
                style={{
                  transform: `translate(${side * depth * 7}px, ${depth * 12}px) rotate(${side * depth * 1.5}deg) scale(${1 - depth * 0.04})`,
                  zIndex: 10 - depth,
                  opacity: 1 - depth * 0.4,
                }}
                aria-hidden
              >
                <TempCandidateWidget candidate={candidate} />
              </div>
            );
          })}

        {/* framer-motion writes touch-action inline from the `drag` prop, and
            that inline style outranks any class here — an unconstrained drag
            means touch-action:none. That is deliberate: it is the only setting
            under which all three swipes survive on a touch screen. drag="x"
            (touch-action:pan-y) looked like it would buy native scrolling
            inside the card, but the WebView then claims the gesture and fires
            pointercancel about ten pixels into a horizontal drag, which kills
            like/pass outright — measured on-device, not assumed.

            The cost is that touch can't scroll ProfileCard's own overflow-y,
            and the card's content runs roughly twice its height, so the lower
            prompts are off-screen on a phone. "Read all of it" below is the way
            in: a wheel still scrolls the card on desktop (touch-action only
            governs touch), and the dialog scrolls anywhere because nothing is
            dragging it. */}
        <motion.div
          key={top.id}
          // z-10, not z-20: the behind-cards fan a few lines up tops out at
          // z-9 (`10 - depth`), so 10 is already enough to clear them. z-20
          // collided with TopBar's own z-20 (components/app-shell/TopBar.tsx)
          // — same value, and this card is later in the DOM, so on any page
          // that had scrolled even slightly (switching dating tabs doesn't
          // reset scroll position, so landing back on Discover already
          // scrolled was enough) the dragged card painted over the sticky
          // header instead of under it, blanking out the title and tabs.
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          style={{ x, y, rotate }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.9}
          onDragEnd={handleDragEnd}
          // A real drag moves the pointer well past what a browser will still
          // synthesize a click from, so this only ever fires for an actual
          // tap — like/pass/up-swipe all still go through handleDragEnd
          // above, untouched. LikeButton and ReportBlockMenu already stop
          // propagation on their own clicks, so tapping either of those still
          // does only what it says rather than also opening the reader.
          onClick={() => setReading(true)}
        >
          {/* scrollable={false}: a mouse wheel could scroll this, but touch
              can't (see the touch-action note above) — a card that only
              *some* input methods can scroll, sitting on a page that itself
              also scrolls, is two competing scroll surfaces for one screen.
              False makes it a fixed, fully-visible-or-cleanly-cut-off card on
              every input; "Read all of it" is the one and only way into the
              rest, on any device. */}
          <ProfileCard
            candidate={top}
            interactive
            photoNav={false}
            scrollable={false}
            onLike={(target) => setPending(target)}
            onRemove={() => {
              onRemove?.(top);
              setDeck((prev) => prev.slice(1));
            }}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setReading(true);
            }}
            className="glass glass-pill absolute bottom-3 left-1/2 z-30 -translate-x-1/2 cursor-pointer px-3.5 py-1.5 text-[0.75rem] text-text"
          >
            Read all of it
          </button>

          <Verdict label="Like" style={{ opacity: likeOpacity }} className="left-8 text-accent" />
          <Verdict label="Pass" style={{ opacity: nopeOpacity }} className="right-8 text-muted" />
          {/* Was "SuperLike" — an up-swipe no longer spends one, it opens the
              reader, same as tapping the card or the button below. */}
          <Verdict
            label="Read all of it"
            style={{ opacity: readMoreOpacity }}
            className="left-1/2 -translate-x-1/2 text-text"
          />
        </motion.div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-6">
        <ActionButton label="Pass" tone="pass" onClick={() => void commit("PASS")}>
          <XIcon size={22} />
        </ActionButton>
        <ActionButton
          // Never disabled: at 0 left there's something to do about it (buy
          // more, go premium) rather than nothing, and a disabled button
          // can't open that — commit() itself routes to onSuperlikeBlocked.
          label="Send a SuperLike"
          tone="superlike"
          size="sm"
          onClick={() => void commit("SUPERLIKE")}
        >
          <SparkleIcon size={17} className={superlikesLeft <= 0 ? "opacity-40" : undefined} />
        </ActionButton>
        <ActionButton label="Like" tone="like" onClick={() => void commit("LIKE")}>
          <HeartOutline />
        </ActionButton>
      </div>

      <p className="mono-label mt-5">
        {deck.length} {deck.length === 1 ? "card" : "cards"} left · drag, or tap a heart to say why
      </p>

      {/* Nothing is dragging this copy, so it keeps its own scrolling on every
          device — including the phone, where the card in the deck cannot. */}
      <Dialog open={reading} onClose={() => setReading(false)} title={top.displayName} width="sm">
        <div className="h-[65dvh] max-h-[32rem]">
          <ProfileCard
            candidate={top}
            interactive
            onLike={(target) => {
              setReading(false);
              setPending(target);
            }}
            onRemove={() => {
              setReading(false);
              onRemove?.(top);
              setDeck((prev) => prev.slice(1));
            }}
          />
        </div>
      </Dialog>

      <LikeNoteSheet
        candidate={pending ? top : null}
        target={pending}
        superlikesLeft={superlikesLeft}
        onClose={() => setPending(null)}
        onSend={(note, superlike) => {
          const target = pending ?? { kind: "PHOTO" as const };
          setPending(null);
          void commit(superlike ? "SUPERLIKE" : "LIKE", { x: 0, y: 0 }, { target, note });
        }}
      />
    </div>
  );
}

function HeartOutline() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 20s-7.2-4.4-9.2-8.6C1.2 8 2.9 4.8 6.3 4.4c2-.2 4 .9 5.7 2.7 1.7-1.8 3.6-2.9 5.7-2.7 3.4.4 5.1 3.6 3.5 7C19.2 15.6 12 20 12 20z" />
    </svg>
  );
}
