"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, PROFILE_ITEM } from "./nav-items";
import { Avatar } from "@/components/ui/Avatar";
import { CoinIcon, SettingsIcon, LogOutIcon } from "@/components/ui/Icons";
import { DronuAvatar } from "@/components/ui/DronuAvatar";
import { useAuth } from "@/lib/auth-context";
import { navigateThemed } from "@/lib/theme-nav";
import { cn } from "@/lib/cn";

/** Desktop left rail — Instagram's sidebar structure (icon + label, profile
 * pinned near the bottom), with a Reddit-flavoured "spaces" idea folded into
 * the Explore tab rather than duplicated as its own column. */
export function Sidebar() {
  const pathname = usePathname();
  const { me } = useAuth();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-bg-raised px-3 py-5 md:flex">
      <Link href="/feed" className="flex items-center gap-2 px-3 pb-6">
        <DronuAvatar
          avatar={{ hat: "none", eyes: "sparkle", colour: "ube", accessory: "none" }}
          size={34}
          mood="idle"
        />
        <span className="font-heading text-lg font-bold">DronaSphere</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.romance ? (e) => navigateThemed(e, item.href) : undefined}
              className={cn(
                "flex items-center gap-3 rounded-full px-3.5 py-2.5 font-heading text-[0.95rem] font-medium transition-colors",
                active ? "bg-accent-wash text-accent-strong" : "text-text hover:bg-surface-2",
                item.romance && !active && "hover:bg-[color:var(--rose-100,var(--surface-2))] hover:text-[color:var(--rose-600,var(--accent))]",
              )}
            >
              <Icon size={22} className={item.romance ? "text-[color:var(--rose-500,var(--accent))]" : undefined} />
              {item.label}
            </Link>
          );
        })}

        <Link
          href={PROFILE_ITEM.href}
          className={cn(
            "flex items-center gap-3 rounded-full px-3.5 py-2.5 font-heading text-[0.95rem] font-medium transition-colors",
            pathname?.startsWith("/profile/me") ? "bg-accent-wash text-accent-strong" : "text-text hover:bg-surface-2",
          )}
        >
          {me ? <Avatar user={me.user} size={22} /> : <PROFILE_ITEM.icon size={22} />}
          Profile
        </Link>
      </nav>

      {me && (
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-surface-2 px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-currency">
            <CoinIcon size={18} />
            {me.user.stardust.toLocaleString()}
          </div>
          <div className="flex items-center gap-1">
            <Link href="/settings" className="rounded-full p-1.5 text-text-muted hover:bg-surface hover:text-text">
              <SettingsIcon size={18} />
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
