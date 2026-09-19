"use client";

import type { Sticker, StickerCount } from "@/lib/types";
import { cn } from "@/lib/cn";

const ALL: { sticker: Sticker; emoji: string }[] = [
  { sticker: "COOKIE", emoji: "🍪" },
  { sticker: "SPARKLE", emoji: "✨" },
  { sticker: "SOB", emoji: "😭" },
  { sticker: "FIRE", emoji: "🔥" },
  { sticker: "HEART_HANDS", emoji: "🫶" },
];

/** Zero-risk reactions (PRD 6.5) — deliberately separate from voting, so a
 * lurker can react without their name attaching to an opinion. */
export function StickerBar({
  stickers,
  onToggle,
  /** Hides empty buckets; the full row only appears on hover/focus. */
  compact,
}: {
  stickers: StickerCount[];
  onToggle?: (sticker: Sticker) => void;
  compact?: boolean;
}) {
  const byKey = new Map(stickers.map((s) => [s.sticker, s]));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {ALL.map(({ sticker, emoji }) => {
        const state = byKey.get(sticker);
        const count = state?.count ?? 0;
        const hidden = compact && count === 0;

        return (
          <button
            key={sticker}
            type="button"
            aria-label={`React ${emoji}`}
            aria-pressed={state?.reacted ?? false}
            onClick={() => onToggle?.(sticker)}
            disabled={!onToggle}
            className={cn(
              "flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs transition-colors",
              onToggle ? "cursor-pointer" : "cursor-default",
              state?.reacted
                ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-wash text-accent-hi"
                : "border-border text-muted hover:border-border-strong hover:text-text",
              hidden && "hidden group-hover/post:flex group-focus-within/post:flex",
            )}
          >
            <span aria-hidden className="text-[0.8125rem] leading-none">
              {emoji}
            </span>
            {count > 0 && <span className="tabnum font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
