"use client";

import type { StickerCount, Sticker } from "@/lib/types";
import { cn } from "@/lib/cn";

const ALL_STICKERS: { sticker: Sticker; emoji: string }[] = [
  { sticker: "COOKIE", emoji: "🍪" },
  { sticker: "SPARKLE", emoji: "✨" },
  { sticker: "SOB", emoji: "😭" },
  { sticker: "FIRE", emoji: "🔥" },
  { sticker: "HEART_HANDS", emoji: "🫶" },
];

/** Zero-risk reactions (PRD 6.5) — deliberately separate from voting so a
 * lurker can react without their name attaching to an opinion. */
export function StickerBar({
  stickers,
  onToggle,
  compact,
}: {
  stickers: StickerCount[];
  onToggle?: (sticker: Sticker) => void;
  compact?: boolean;
}) {
  const byKey = new Map(stickers.map((s) => [s.sticker, s]));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ALL_STICKERS.map(({ sticker, emoji }) => {
        const state = byKey.get(sticker);
        const count = state?.count ?? 0;
        if (compact && count === 0) return null;
        return (
          <button
            key={sticker}
            type="button"
            onClick={() => onToggle?.(sticker)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
              state?.reacted
                ? "border-accent bg-accent-wash text-accent-strong"
                : "border-border text-text-muted hover:border-border-strong",
            )}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="font-semibold tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
