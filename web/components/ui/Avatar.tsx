import Image from "next/image";
import type { User } from "@/lib/types";
import { DronuAvatar } from "./DronuAvatar";
import { cn } from "@/lib/cn";

interface AvatarProps {
  user: Pick<User, "avatar" | "photoUrl" | "displayName">;
  size?: number;
  ring?: boolean;
  className?: string;
}

/** A user's photo when they've added one, their Dronu character otherwise —
 * PRD 6.1: avatar builder first, photo optional, never a placeholder blank. */
export function Avatar({ user, size = 40, ring, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-surface-2",
        ring && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {user.photoUrl ? (
        <Image
          src={user.photoUrl}
          alt={user.displayName}
          width={size}
          height={size}
          className="size-full object-cover"
        />
      ) : (
        <DronuAvatar avatar={user.avatar} size={size} mood="idle" className="scale-110" />
      )}
    </div>
  );
}
