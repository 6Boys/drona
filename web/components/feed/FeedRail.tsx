"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { MoonIcon } from "@/components/ui/Icons";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useNight } from "@/lib/night-context";
import type { Items, Space, SuggestionsResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="mono-label">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function FollowSuggestions() {
  const { data, loading } = useApi<SuggestionsResponse>("/v1/onboarding/suggestions", { limit: 5 });
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  const follow = async (handle: string) => {
    setFollowed((prev) => new Set(prev).add(handle));
    try {
      await api.post(`/v1/users/${handle}/follow`);
    } catch {
      setFollowed((prev) => {
        const next = new Set(prev);
        next.delete(handle);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }

  const items = (data?.items ?? []).slice(0, 5);
  if (!items.length) return <p className="text-xs text-faint">You already follow everyone we&apos;d suggest.</p>;

  return (
    <ul className="space-y-2.5">
      {items.map((user) => (
        <li key={user.id} className="flex items-center gap-2.5">
          <Link href={`/profile/${user.handle}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar user={user} size={30} />
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] font-medium text-text">{user.displayName}</span>
              <span className="block truncate text-[0.6875rem] text-faint">
                @{user.handle}
                {user.branch ? ` · ${user.branch}` : ""}
              </span>
            </span>
          </Link>
          <Button
            size="sm"
            variant={followed.has(user.handle) ? "secondary" : "outline"}
            onClick={() => follow(user.handle)}
            disabled={followed.has(user.handle)}
          >
            {followed.has(user.handle) ? "Following" : "Follow"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function FeedRail() {
  const { status } = useNight();
  const spaces = useApi<Items<Space>>("/v1/spaces");

  return (
    <aside className="hidden w-[17rem] shrink-0 space-y-4 xl:block">
      {status && (
        <section
          className={cn(
            "card p-4",
            status.nightOpen && !status.cozyMode && "border-[color-mix(in_oklab,var(--accent)_35%,transparent)]",
          )}
        >
          <header className="flex items-center gap-2">
            <MoonIcon size={15} className={status.cozyMode ? "text-faint" : "text-accent-hi"} />
            <h2 className="mono-label">owl board</h2>
          </header>

          <p className="mt-2 text-sm text-muted">{status.message}</p>

          <dl className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[var(--r-sm)] bg-surface-2 px-2.5 py-2">
              <dt className="mono-label">week</dt>
              <dd className="tabnum mt-0.5 text-base font-medium text-text">{status.weekPoints}</dd>
            </div>
            <div className="rounded-[var(--r-sm)] bg-surface-2 px-2.5 py-2">
              <dt className="mono-label">rank</dt>
              <dd className="tabnum mt-0.5 text-base font-medium text-text">
                {status.rank > 0 ? `#${status.rank}` : "—"}
              </dd>
            </div>
          </dl>

          {status.nightOpen && !status.cozyMode && status.actionsToCount > 0 && (
            <p className="mt-2.5 text-xs text-faint">
              {status.actionsToCount} more action{status.actionsToCount === 1 ? "" : "s"} before tonight
              counts.
            </p>
          )}

          <Link
            href="/owl-board"
            className="mt-3 block text-xs text-accent-hi transition-colors hover:underline"
          >
            Open the board →
          </Link>
        </section>
      )}

      <Card title="who to follow">
        <FollowSuggestions />
      </Card>

      <Card
        title="spaces"
        action={
          <Link href="/spaces" className="text-xs text-accent-hi hover:underline">
            All
          </Link>
        }
      >
        <ul className="space-y-1">
          {(spaces.data?.items ?? []).slice(0, 6).map((space) => (
            <li key={space.id}>
              <Link
                href={`/spaces/${space.slug}`}
                className="flex items-center gap-2 rounded-[var(--r-sm)] px-1.5 py-1 text-[0.8125rem] text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <span aria-hidden>{space.icon}</span>
                <span className="truncate">{space.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <p className="px-1 text-[0.6875rem] leading-relaxed text-faint">
        Chats are encrypted in transit and at rest, but not end-to-end. Staff access is logged and
        restricted.
      </p>
    </aside>
  );
}
