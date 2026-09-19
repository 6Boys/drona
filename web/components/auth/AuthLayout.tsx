import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Atmosphere, DotBackdrop } from "@/components/fx/Backdrops";

/** The shell both signed-out surfaces share: a drifting colour field, a dot
 * rule over it, and one pane of glass in the middle. Deliberately the same
 * furniture as the marketing hero, so signing in doesn't feel like landing on a
 * different product. */
export function AuthLayout({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="grain relative flex min-h-dvh flex-col overflow-hidden bg-bg">
      <Atmosphere tone="brand" />
      <DotBackdrop size={22} />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" aria-label="DronaSphere home">
          <Logo />
        </Link>
        <Link href="/" className="text-[0.8125rem] text-muted transition-colors hover:text-text">
          Back to site
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-[26rem]">
          {children}
          {aside && <div className="mt-5">{aside}</div>}
        </div>
      </main>

      <footer className="relative z-10 px-5 py-6 text-center text-xs text-faint md:px-8">
        Verified students only. One account per college email.
      </footer>
    </div>
  );
}
