"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { Logo } from "@/components/ui/Logo";
import { SpinnerIcon } from "@/components/ui/Icons";
import { useAuth } from "@/lib/auth-context";
import { NightProvider } from "@/lib/night-context";

/** Guards every signed-in surface. The API owns the onboarding step; this only
 * routes on it, so a half-finished account can never reach the app (PRD 6.1:
 * "user cannot reach home with 0 follows"). */
export function AppShell({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!me) {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? "/feed")}`);
      return;
    }
    if (me.onboardingStep !== "DONE") router.replace("/onboarding");
  }, [loading, me, router, pathname]);

  if (loading || !me || me.onboardingStep !== "DONE") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Logo size={30} />
        <SpinnerIcon size={18} className="text-faint" />
      </div>
    );
  }

  return (
    <NightProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <main id="main-content" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
        <MobileNav />
        <CommandPalette />
        <InstallPrompt />
      </div>
    </NightProvider>
  );
}
