import type { Metadata } from "next";

// Only reachable mid-signup with a valid session — same reasoning as
// app/(app)/layout.tsx.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
