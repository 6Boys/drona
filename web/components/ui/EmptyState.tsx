import type { ReactNode } from "react";
import { DronuAvatar } from "./DronuAvatar";

/** PRD 8: "Empty states are always a Dronu drawing, never a grey box." */
export function EmptyState({
  title,
  body,
  action,
  mood = "idle",
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  mood?: "idle" | "sleepy" | "excited";
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <DronuAvatar
        avatar={{ hat: "none", eyes: mood === "sleepy" ? "sleepy" : "sparkle", colour: "ube", accessory: "none" }}
        size={88}
        mood={mood}
      />
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      {body && <p className="max-w-xs text-sm text-text-muted">{body}</p>}
      {action}
    </div>
  );
}
