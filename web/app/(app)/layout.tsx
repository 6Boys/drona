import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/AppShell";

// Everything under this segment is a signed-in user's own feed, chats, and
// profile — there is no version of a search result pointing here that isn't
// either a dead end (not logged in) or a privacy problem (someone else's DMs).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
