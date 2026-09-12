"use client";

import { useParams } from "next/navigation";
import { Conversation } from "@/components/chat/Conversation";
import { ThreadList } from "@/components/chat/ThreadList";

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex h-dvh min-h-0 pb-14 lg:pb-0">
      <ThreadList activeId={id} className="hidden w-[21rem] border-r lg:flex" />
      <Conversation key={id} threadId={id} />
    </div>
  );
}
