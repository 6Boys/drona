"use client";

import { ThreadList } from "@/components/chat/ThreadList";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ChatsPage() {
  return (
    <div className="flex h-dvh min-h-0 pb-14 lg:pb-0">
      <ThreadList className="w-full border-r lg:w-[21rem]" />

      <div className="hidden flex-1 items-center justify-center lg:flex">
        <EmptyState
          title="Pick a conversation"
          body="Your DMs, Dens and club Signals all live here. Nothing is end-to-end encrypted — we say so plainly rather than implying otherwise."
        />
      </div>
    </div>
  );
}
