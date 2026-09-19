"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { afterhours } from "@/lib/afterhours-store";
import { REACTION_ORDER, REACTIONS } from "@/lib/afterhours-theme";
import type { AnonPost, AnonReaction } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Tapback-style: one reaction per person, tap another to switch, tap yours
 * again to take it back. Optimistic — the count moves before the network does. */
export function ReactionBar({ post, onChange }: { post: AnonPost; onChange: (next: AnonPost) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const react = async (key: AnonReaction) => {
    if (busy) return;
    const next = post.viewerReaction === key ? null : key;
    const counts = { ...post.reactions };
    if (post.viewerReaction) counts[post.viewerReaction] = Math.max(0, counts[post.viewerReaction] - 1);
    if (next) counts[next] += 1;
    const before = post;
    onChange({ ...post, reactions: counts, viewerReaction: next });
    setBusy(true);
    try {
      const res = await afterhours.react(post.id, next);
      onChange({ ...post, reactions: res.reactions, viewerReaction: res.viewerReaction });
    } catch (err) {
      onChange(before);
      toast(errorMessage(err, "couldn't react to that"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="React">
      {REACTION_ORDER.map((key) => {
        const count = post.reactions[key];
        const mine = post.viewerReaction === key;
        return (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.86 }}
            aria-pressed={mine}
            aria-label={`${REACTIONS[key].label}${count ? `, ${count}` : ""}`}
            title={REACTIONS[key].label}
            onClick={() => react(key)}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.8125rem] transition-colors",
              mine
                ? "border-[color-mix(in_oklab,var(--mood)_55%,transparent)] bg-[color-mix(in_oklab,var(--mood)_18%,transparent)] text-text"
                : count
                  ? "border-border bg-surface-2/60 text-muted hover:border-border-strong"
                  : "border-transparent text-faint opacity-70 hover:border-border hover:opacity-100",
            )}
          >
            <motion.span
              aria-hidden
              key={mine ? "on" : "off"}
              initial={mine ? { scale: 0.4, rotate: -12 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 14 }}
              className="text-[0.95rem] leading-none"
            >
              {REACTIONS[key].emoji}
            </motion.span>
            {count > 0 && <span className="tabnum text-[0.75rem]">{count}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
