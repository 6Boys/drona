"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/cn";

/** The per-page header: a breadcrumb-ish title on the left, page actions on the
 * right, and on small screens the product mark, since the sidebar is gone. */
export function TopBar({
  title,
  subtitle,
  actions,
  back,
  tabs,
  sticky = true,
  /** False when the page body already renders its own <h1> for `title`
   * (post/profile pages) — this bar's copy is then chrome, not content, so it
   * must not add a second page-level heading. */
  titleIsHeading = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Shows a back control; `true` uses history, a string navigates to a route. */
  back?: boolean | string;
  tabs?: ReactNode;
  sticky?: boolean;
  titleIsHeading?: boolean;
}) {
  const router = useRouter();

  return (
    <header
      className={cn(
        // Glass, but only on the bottom edge — a full pane with four borders
        // floating at the top of every page would read as a toolbar rather
        // than as the page's own header.
        "z-20 border-b border-border bg-[rgb(var(--glass-tint)/0.72)] backdrop-blur-xl backdrop-saturate-150",
        // Installed standalone on iOS (Home Screen icon, not a Safari tab),
        // there is no browser chrome reserving space for the status bar —
        // viewport-fit=cover (app/layout.tsx) lets this header's own
        // background paint all the way under it, which is what we want, but
        // without this the title/actions row painted right along with it,
        // landing directly behind the clock/battery icons instead of below
        // them. env() resolves to 0 anywhere without a notch, so this is a
        // no-op on desktop, Android, and a plain Safari tab.
        "pt-[env(safe-area-inset-top)]",
        sticky && "sticky top-0",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        {back ? (
          typeof back === "string" ? (
            <Link
              href={back}
              aria-label="Back"
              className="-ml-1.5 rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <ChevronLeftIcon size={18} />
            </Link>
          ) : (
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="-ml-1.5 cursor-pointer rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <ChevronLeftIcon size={18} />
            </button>
          )
        ) : (
          <Link href="/feed" className="lg:hidden" aria-label="DronaSphere home">
            <Logo showWordmark={false} size={24} />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          {titleIsHeading ? (
            <h1 className="truncate text-[0.9375rem] font-medium text-text">{title}</h1>
          ) : (
            <p className="truncate text-[0.9375rem] font-medium text-text">{title}</p>
          )}
          {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <NotificationBell />
        </div>
      </div>

      {tabs && <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 md:px-6 no-scrollbar">{tabs}</div>}
    </header>
  );
}

/** Consistent page gutters and reading width. */
export function PageBody({
  children,
  className,
  width = "md",
}: {
  children: ReactNode;
  className?: string;
  width?: "sm" | "md" | "lg" | "full";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-5 pb-28 md:px-6 lg:pb-10",
        width === "sm" && "max-w-2xl",
        width === "md" && "max-w-4xl",
        width === "lg" && "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
