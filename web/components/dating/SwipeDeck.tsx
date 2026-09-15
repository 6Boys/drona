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
import { LikeNoteSheet } from "./LikeNoteSheet";
import { SparkleIcon, XIcon } from "@/components/ui/Icons";
import type { DatingCandidate, LikeTarget, SwipeAction } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   The deck.

   Two ways through it, on purpose. Dragging is the fast path — right to like
   the picture, left to pass, up to spend the Twinkle — and the heart on any
   block is the considered one, which opens the comment sheet and lets you say
   what you're actually reacting to. Both end in the same commit, so the card
   flies away exactly once either way.
   -------------------------------------------------------------------------- */

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 650;
const STACK_DEPTH = 3;
const FLY_DISTANCE = 760;

type Direction = { x: number; y: number };

const DIRECTIONS: Record<SwipeAction, Direction> = {
  PASS: { x: -1, y: 0 },
  LIKE: { x: 1, y: 0 },
  TWINKLE: { x: 0, y: -1 },
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
  tone: "pass" | "twinkle" | "like";
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
        tone === "twinkle" && "text-gold",
        tone === "like" && "text-accent",
      )}
    >
      {children}
    </motion.button>
  );
}

export function SwipeDeck({
  candidates,
  twinklesLeft,
  onDecide,
  onTwinkleBlocked,
  emptyState,
}: {
  candidates: DatingCandidate[];
  twinklesLeft: number;
  onDecide: (decision: SwipeDecision) => void;
  onTwinkleBlocked: () => void;
  emptyState: React.ReactNode;
}) {
  const [deck, setDeck] = useState(candidates);
  const [pending, setPending] = useState<LikeTarget | null>(null);
  const busyRef = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-280, 280], [-9, 9]);
  const likeOpacity = useTransform(x, [30, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -30], [1, 0]);
  const twinkleOpacity = useTransform(y, [-150, -40], [1, 0]);

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

      if (action === "TWINKLE" && twinklesLeft <= 0) {
        onTwinkleBlocked();
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
    [top, twinklesLeft, onDecide, onTwinkleBlocked, x, y],
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
        void commit("TWINKLE", { x: 0, y: velocity.y });
      }
    },
    [commit],
  );

  const behind = useMemo(() => deck.slice(1, STACK_DEPTH), [deck]);

  if (!top) return <>{emptyState}</>;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[clamp(24rem,calc(100dvh-22rem),38rem)] w-full max-w-[25rem]">
        {behind
          .slice()
          .reverse()
          .map((candidate, reverseIndex) => {
            const depth = behind.length - reverseIndex;
            return (
              <div
                key={candidate.id}
                className="absolute inset-0 origin-bottom"
                style={{
                  transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.03})`,
                  zIndex: 10 - depth,
                  opacity: 1 - depth * 0.4,
                }}
                aria-hidden
              >
                <ProfileCard candidate={candidate} scrollable={false} />
              </div>
            );
          })}

        <motion.div
          key={top.id}
          className="absolute inset-0 z-20 cursor-grab touch-pan-y active:cursor-grabbing"
          style={{ x, y, rotate }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.9}
          onDragEnd={handleDragEnd}
        >
          <ProfileCard
            candidate={top}
            interactive
            onLike={(target) => setPending(target)}
            onRemove={() => setDeck((prev) => prev.slice(1))}
          />

          <Verdict label="Like" style={{ opacity: likeOpacity }} className="left-8 text-accent" />
          <Verdict label="Pass" style={{ opacity: nopeOpacity }} className="right-8 text-muted" />
          <Verdict
            label="Twinkle"
            style={{ opacity: twinkleOpacity }}
            className="left-1/2 -translate-x-1/2 text-gold"
          />
        </motion.div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-6">
        <ActionButton label="Pass" tone="pass" onClick={() => void commit("PASS")}>
          <XIcon size={22} />
        </ActionButton>
        <ActionButton
          label="Send a Twinkle"
          tone="twinkle"
          size="sm"
          disabled={twinklesLeft <= 0}
          onClick={() => void commit("TWINKLE")}
        >
          <SparkleIcon size={17} />
        </ActionButton>
        <ActionButton label="Like" tone="like" onClick={() => void commit("LIKE")}>
          <HeartOutline />
        </ActionButton>
      </div>

      <p className="mono-label mt-5">
        {deck.length} {deck.length === 1 ? "card" : "cards"} left · drag, or tap a heart to say why
      </p>

      <LikeNoteSheet
        candidate={pending ? top : null}
        target={pending}
        twinklesLeft={twinklesLeft}
        onClose={() => setPending(null)}
        onSend={(note, twinkle) => {
          const target = pending ?? { kind: "PHOTO" as const };
          setPending(null);
          void commit(twinkle ? "TWINKLE" : "LIKE", { x: 0, y: 0 }, { target, note });
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
