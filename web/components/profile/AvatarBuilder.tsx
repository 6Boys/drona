"use client";

import {
  AVATAR_GEOMETRIES,
  AVATAR_RAMPS,
  GradientAvatar,
  avatarBackground,
} from "@/components/ui/GradientAvatar";
import type { Avatar } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Picks the two fields that actually change how an identity looks — the hue
 * ramp and its geometry. Both write to the avatar fields the API already
 * validates, so nothing new has to ship server-side for this to persist.
 */
export function AvatarBuilder({
  value,
  onChange,
  name,
  size = 96,
}: {
  value: Avatar;
  onChange: (next: Avatar) => void;
  name: string;
  size?: number;
}) {
  return (
    <div className="space-y-5">
      <div className="relative flex justify-center overflow-hidden rounded-[var(--r-lg)] border border-border bg-surface-2 py-8">
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.12]"
          style={{ background: avatarBackground(value) }}
        />
        <GradientAvatar avatar={value} name={name} size={size} rounded="squircle" className="relative shadow-[var(--sh-pop)]" />
      </div>

      <div>
        <p className="mono-label mb-2.5">Colour</p>
        <div className="grid grid-cols-6 gap-2">
          {Object.entries(AVATAR_RAMPS).map(([key, ramp]) => {
            const active = value.colour === key;
            return (
              <button
                key={key}
                type="button"
                title={ramp.label}
                aria-label={ramp.label}
                aria-pressed={active}
                onClick={() => onChange({ ...value, colour: key })}
                className={cn(
                  "relative h-11 cursor-pointer rounded-[var(--r-sm)] transition-transform hover:scale-105",
                  active && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
                )}
                style={{ background: `linear-gradient(135deg, ${ramp.from} 0%, ${ramp.to} 100%)` }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <p className="mono-label mb-2.5">Shape</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(AVATAR_GEOMETRIES).map(([key, geometry]) => {
            const active = value.hat === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...value, hat: key })}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "border-accent bg-accent-wash text-accent-hi"
                    : "border-border text-muted hover:border-border-strong hover:text-text",
                )}
              >
                {geometry.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
