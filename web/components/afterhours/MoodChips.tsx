"use client";

import { MOOD_ORDER, MOODS } from "@/lib/afterhours-theme";
import type { AnonMood } from "@/lib/types";
import { cn } from "@/lib/cn";

const chip =
  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] whitespace-nowrap transition-colors";

function MoodChip({ mood, active, onClick }: { mood: AnonMood; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-mood={mood}
      aria-pressed={active}
      onClick={onClick}
      className={cn(chip, active ? "ah-mood-tag" : "border-border text-muted hover:border-border-strong hover:text-text")}
      style={active ? { boxShadow: "0 0 18px -6px var(--mood)" } : undefined}
    >
      <span aria-hidden>{MOODS[mood].emoji}</span>
      {MOODS[mood].label}
    </button>
  );
}

/** Filter row for the feed — "All" plus every mood. */
export function MoodFilterChips({ value, onChange }: { value: AnonMood | "all"; onChange: (next: AnonMood | "all") => void }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Filter by mood">
      <button
        type="button"
        aria-pressed={value === "all"}
        onClick={() => onChange("all")}
        className={cn(
          chip,
          value === "all" ? "border-accent bg-accent-wash text-accent-hi" : "border-border text-muted hover:border-border-strong hover:text-text",
        )}
      >
        All
      </button>
      {MOOD_ORDER.map((m) => (
        <MoodChip key={m} mood={m} active={value === m} onClick={() => onChange(m)} />
      ))}
    </div>
  );
}

/** Picker inside the composer — exactly one mood is always chosen. */
export function MoodPickerChips({ value, onChange }: { value: AnonMood; onChange: (next: AnonMood) => void }) {
  return (
    <div
      className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 pr-6 [mask-image:linear-gradient(to_right,#000_88%,transparent)]"
      role="group"
      aria-label="What kind of post is this?"
    >
      {MOOD_ORDER.map((m) => (
        <MoodChip key={m} mood={m} active={value === m} onClick={() => onChange(m)} />
      ))}
    </div>
  );
}
