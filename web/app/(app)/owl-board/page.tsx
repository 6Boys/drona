"use client";

import Link from "next/link";
import { useState } from "react";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { OwlRankBadge } from "@/components/ui/OwlRankBadge";
import { Segmented } from "@/components/ui/Segmented";
import { NightChart } from "@/components/owl/NightChart";
import { Skeleton } from "@/components/ui/Skeleton";
import { MoonIcon, TimerIcon } from "@/components/ui/Icons";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { useNight } from "@/lib/night-context";
import type { OwlBoard } from "@/lib/types";
import { cn } from "@/lib/cn";

type Scope = "campus" | "batch" | "buddies";

function countdown(minutes: number): string {
  if (minutes <= 0) return "closed";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-border bg-surface px-3.5 py-3">
      <p className="mono-label">{label}</p>
      <p className="tabnum mt-1 text-xl font-medium text-text">{value}</p>
      {hint && <p className="mt-0.5 text-[0.6875rem] text-faint">{hint}</p>}
    </div>
  );
}

export default function OwlBoardPage() {
  const { me } = useAuth();
  const { status } = useNight();
  const [scope, setScope] = useState<Scope>("campus");

  const board = useApi<OwlBoard>("/v1/owl/board", { scope, limit: 50 });

  const cozy = status?.cozyMode ?? false;
  const open = (status?.nightOpen ?? false) && !cozy;

  return (
    <>
      <TopBar
        title="Night Shift"
        subtitle="10 PM to 3 AM · weekly reset"
        tabs={
          <Segmented
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: "campus", label: "Campus" },
              { value: "batch", label: "Batch" },
              { value: "buddies", label: "Buddies" },
            ]}
          />
        }
      />

      <PageBody width="md">
        <section className="relative overflow-hidden rounded-[var(--r-lg)] border border-border bg-surface p-5">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.14]"
            style={{ background: open ? "var(--grad-night)" : "linear-gradient(135deg,#334155,#0f172a)" }}
          />
          {open && (
            <div
              className="glow -top-24 -right-16 h-56 w-56"
              style={{ ["--ramp" as string]: "var(--grad-night)" }}
            />
          )}

          <div className="relative flex flex-wrap items-start gap-4">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-[var(--r-md)] text-white shadow-[var(--sh-card)]"
              style={{ background: open ? "var(--grad-night)" : "linear-gradient(135deg,#475569,#1e293b)" }}
            >
              <MoonIcon size={24} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <MoonIcon size={15} className={open ? "text-accent-hi" : "text-faint"} />
                <span className="mono-label">
                  {cozy ? "cozy mode" : open ? "night window open" : "board closed"}
                </span>
                {open && <span className="size-1.5 rounded-full bg-accent breathe" />}
              </div>

              <p className="mt-1.5 text-[0.9375rem] text-text">
                {status?.message ?? "Checking the clock…"}
              </p>

              {open && status && (
                <p className="mt-1 text-sm text-muted">
                  <span className="tabnum font-medium text-text">{countdown(status.minutesToCurfew)}</span> until
                  the hard stop.
                  {status.actionsToCount > 0 && (
                    <>
                      {" "}
                      {status.actionsToCount} more action{status.actionsToCount === 1 ? "" : "s"} before tonight
                      counts.
                    </>
                  )}
                </p>
              )}
            </div>

            {me && <OwlRankBadge rank={me.user.owlRank} label={me.user.owlRankLabel} />}
          </div>

          {status && (
            <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="this week" value={String(status.weekPoints)} hint="points" />
              <Stat label="rank" value={status.rank > 0 ? `#${status.rank}` : "—"} hint="on campus" />
              <Stat label="tonight" value={String(status.sessionPoints)} hint={`${status.sessionActions} actions`} />
              <Stat label="sparks" value={(me?.user.stardust ?? 0).toLocaleString()} />
            </div>
          )}
        </section>

        <div className="mt-4">
          <NightChart />
        </div>

        <section className="card mt-4 overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="mono-label">{scope} leaderboard</h2>
            {board.data && (
              <span className="mono-label">
                week {board.data.weekKey}
              </span>
            )}
          </header>

          {board.loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          ) : !board.data?.entries.length ? (
            <EmptyState
              compact
              title="Nobody on the board yet"
              body={
                scope === "buddies"
                  ? "Follow people who follow you back — mutuals show up here."
                  : "Points start accruing when the night window opens at 10 PM."
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {board.data.entries.map((entry) => (
                <li
                  key={entry.user.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    entry.isViewer && "bg-accent-wash",
                  )}
                >
                  <span
                    className={cn(
                      "tabnum w-8 shrink-0 font-mono text-xs",
                      entry.rank <= 3 ? "text-gold" : "text-faint",
                    )}
                  >
                    {String(entry.rank).padStart(2, "0")}
                  </span>

                  <Avatar user={entry.user} size={30} />

                  <Link href={`/profile/${entry.user.handle}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-text hover:underline">
                      {entry.user.displayName}
                    </span>
                    <span className="block truncate text-[0.6875rem] text-faint">
                      @{entry.user.handle}
                      {entry.user.branch ? ` · ${entry.user.branch}` : ""}
                    </span>
                  </Link>

                  <span className="hidden sm:block">
                    <OwlRankBadge rank={entry.owlRank} label={entry.owlRankLabel} />
                  </span>

                  <span className="tabnum w-14 shrink-0 text-right text-sm font-medium text-text">
                    {entry.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-4 text-xs leading-relaxed text-faint">
          Points come from posting, commenting, replying in Dens and time in{" "}
          <Link href="/burrows" className="text-muted underline-offset-2 hover:underline">
            Study Burrows
          </Link>
          {" "}— never from leaving the app open. At 3 AM everything stops and the app gets quieter,
          however long you stay up. A board that scored sleep deprivation would be gameable by a
          script and bad for you; this one isn&apos;t either.
        </p>
      </PageBody>
    </>
  );
}
