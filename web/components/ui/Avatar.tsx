import Image from "next/image";
import type { User } from "@/lib/types";
import { GradientAvatar } from "./GradientAvatar";
import { cn } from "@/lib/cn";

interface AvatarProps {
  user: Pick<User, "avatar" | "photoUrl" | "displayName">;
  size?: number;
  ring?: boolean;
  /** Online dot; `night` paints it violet for the night window (PRD 6.6). */
  presence?: "online" | "night" | null;
  rounded?: "full" | "squircle";
  className?: string;
}

/** A user's photo when they have one, their gradient identity otherwise —
 * never a blank placeholder (PRD 6.1). */
export function Avatar({ user, size = 36, ring, presence, rounded = "full", className }: AvatarProps) {
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {user.photoUrl ? (
        <span
          className={cn(
            "block size-full overflow-hidden bg-surface-2",
            rounded === "full" ? "rounded-full" : "rounded-[28%]",
            ring && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
          )}
        >
          <Image
            src={user.photoUrl}
            alt={user.displayName}
            width={size}
            height={size}
            className="size-full object-cover"
          />
        </span>
      ) : (
        <GradientAvatar
          avatar={user.avatar}
          name={user.displayName}
          size={size}
          rounded={rounded}
          className={cn(ring && "ring-2 ring-accent ring-offset-2 ring-offset-bg")}
        />
      )}

      {presence && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -bottom-0.5 block rounded-full border-2 border-bg",
            presence === "night" ? "bg-accent" : "bg-positive",
          )}
          style={{ width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }}
        />
      )}
    </span>
  );
}
