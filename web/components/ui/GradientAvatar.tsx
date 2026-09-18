import type { Avatar as AvatarShape } from "@/lib/types";
import { cn } from "@/lib/cn";

// Identity is a gradient, not a photo. Every account gets a deterministic
// two-stop ramp plus its initials, so a profile reads instantly in a list and
// nobody is blocked from posting because they don't have a good picture.
//
// The API validates four avatar fields (hat / eyes / colour / accessory), so
// the picker maps onto those rather than inventing a parallel schema:
//   colour -> hue pair     hat -> gradient geometry
// `eyes` and `accessory` stay at their defaults; they have no visual meaning
// here but must still be valid values on the wire.

interface Ramp {
  from: string;
  to: string;
  label: string;
}

export const AVATAR_RAMPS: Record<string, Ramp> = {
  ube: { from: "#7c5c86", to: "#a88bb0", label: "Plum" },
  peach: { from: "#c2705c", to: "#e0a68c", label: "Clay" },
  mint: { from: "#5d7f62", to: "#9bb79b", label: "Sage" },
  butter: { from: "#c39447", to: "#e3c489", label: "Ochre" },
  cocoa: { from: "#5c6f86", to: "#93a7bb", label: "Slate" },
  cream: { from: "#8a8377", to: "#c2bbac", label: "Stone" },
};

const DEFAULT_RAMP = AVATAR_RAMPS.ube as Ramp;

// One gradient shape for everyone, radial. There used to be a "Shape" picker
// (diagonal, vertical, rising…) stored on `avatar.hat`; it produced six ways to
// look slightly different rather than recognisably yourself. The field is still
// in the payload so existing accounts don't fail validation — it just no longer
// changes anything.
export function avatarBackground(avatar: AvatarShape | undefined): string {
  const ramp = AVATAR_RAMPS[avatar?.colour ?? ""] ?? DEFAULT_RAMP;
  return `radial-gradient(circle at 30% 25%, ${ramp.from} 0%, ${ramp.to} 100%)`;
}

/** The two stops on their own, for effects that need to paint in a person's
 * colours rather than draw their gradient. */
export function avatarColours(avatar: AvatarShape | undefined): [string, string] {
  const ramp = AVATAR_RAMPS[avatar?.colour ?? ""] ?? DEFAULT_RAMP;
  return [ramp.from, ramp.to];
}

/** First letter of each of the first two words — "Akshit Jain" -> "AJ". */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return "?";
  return words.map((w) => w[0]!.toUpperCase()).join("");
}

export function GradientAvatar({
  avatar,
  name,
  size = 36,
  rounded = "full",
  className,
}: {
  avatar: AvatarShape | undefined;
  name: string;
  size?: number;
  rounded?: "full" | "squircle";
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white select-none",
        rounded === "full" ? "rounded-full" : "rounded-[28%]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: avatarBackground(avatar),
        fontSize: Math.max(9, Math.round(size * 0.38)),
        letterSpacing: size > 28 ? "-0.02em" : "0",
      }}
    >
      {/* top-edge sheen, so the disc reads as lit rather than flat */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 55%)" }}
      />
      <span className="relative">{initialsFor(name)}</span>
    </span>
  );
}
