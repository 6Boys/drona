import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { ArrowRightIcon } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div id="main-content" className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-5 text-center text-text">
      <Link href="/" aria-label="DronaSphere home">
        <Logo size={22} />
      </Link>
      <div>
        <p className="mono-label">404</p>
        <h1 className="display mt-3 text-[clamp(1.75rem,4vw,2.75rem)]">Nothing lives at this address.</h1>
        <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-muted">
          The page you&apos;re looking for moved, was renamed, or never existed on this campus.
        </p>
      </div>
      <ButtonLink href="/" size="lg" icon={<ArrowRightIcon size={16} />}>
        Back home
      </ButtonLink>
    </div>
  );
}
