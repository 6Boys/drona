import type { Thread, User } from "@/lib/types";

/** DMs are named after the other person; Dens and Signals carry their own
 * title. Falls back rather than rendering an empty header. */
export function threadLabel(thread: Thread, viewerId: string): string {
  if (thread.title) return thread.title;
  const other = thread.members?.find((m) => m.id !== viewerId);
  return other?.displayName ?? "Direct message";
}

/** Only a DM has a "other person" to show. Dens and Signals wear their own
 * icon — borrowing one member's face to represent a group of 24 is a lie. */
export function threadPartner(thread: Thread, viewerId: string): User | undefined {
  if (thread.type !== "DM") return undefined;
  return thread.members?.find((m) => m.id !== viewerId);
}

export function threadSubtitle(thread: Thread, viewerId: string): string {
  switch (thread.type) {
    case "DEN":
      return `${thread.memberCount} members`;
    case "SIGNAL":
      return `Broadcast · ${thread.memberCount} subscribers`;
    default: {
      const other = threadPartner(thread, viewerId);
      return other ? `@${other.handle}` : "Direct message";
    }
  }
}
