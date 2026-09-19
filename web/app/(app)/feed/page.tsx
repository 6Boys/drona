"use client";

import { useState } from "react";
import Link from "next/link";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { Composer } from "@/components/feed/Composer";
import { LoveFinderInvite } from "@/components/dating/LoveFinderInvite";
import { FeedRail } from "@/components/feed/FeedRail";
import { PostList } from "@/components/feed/PostList";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { MobileSidebarDrawer } from "@/components/app-shell/MobileSidebarDrawer";
import { PlusIcon, FlameIcon, ChevronRightIcon, MenuIcon } from "@/components/ui/Icons";
import { usePaged } from "@/lib/use-paged";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import type { Post } from "@/lib/types";

type Sort = "hot" | "new";
type Source = "all" | "following";

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
        active ? "bg-surface text-text shadow-[var(--sh-card)]" : "text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export default function FeedPage() {
  const { me } = useAuth();
  const [sort, setSort] = useState<Sort>("hot");
  const [source, setSource] = useState<Source>("all");
  const [composing, setComposing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Campus-only, with no cross-campus scope to pick: there is no plan to run
  // this beyond one college, so a "Global" that shows the same rows as
  // "Campus" was a switch that only ever promised something.
  const paged = usePaged<Post>("/v1/feed", { sort, source, scope: "campus", limit: 20 });

  return (
    <>
      <TopBar
        title="The Nest"
        subtitle={`${me?.campusVerifiedUsers ?? 0} verified students on your campus`}
        actions={
          <Button size="sm" icon={<PlusIcon size={15} />} onClick={() => setComposing(true)}>
            <span className="hidden sm:inline">New post</span>
          </Button>
        }
        tabs={
          <>
            {/* Below lg, Hot/New and All/Following used to be two separate
                boxed Segmented controls. The sidebar rail (desktop-only) is
                the one-tap way to Spaces/Note Locker/Night Shift on a
                wide screen; a phone has no equivalent, so the space the old
                Hot/New box occupied becomes a menu button instead, and its
                four options fold into one continuous scrollable strip with
                All/Following rather than disappearing. Desktop keeps the
                original two separate Segmented controls untouched below. */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="glass glass-pill flex shrink-0 items-center justify-center p-2 text-muted transition-colors hover:text-text lg:hidden"
            >
              <MenuIcon size={16} />
            </button>

            <div className="glass glass-pill flex shrink-0 items-center gap-0.5 p-1 lg:hidden">
              <Chip active={sort === "hot"} onClick={() => setSort("hot")}>
                Hot
              </Chip>
              <Chip active={sort === "new"} onClick={() => setSort("new")}>
                New
              </Chip>
              <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
              <Chip active={source === "all"} onClick={() => setSource("all")}>
                All
              </Chip>
              <Chip active={source === "following"} onClick={() => setSource("following")}>
                Following
              </Chip>
            </div>

            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <Segmented
                size="sm"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "hot", label: "Hot" },
                  { value: "new", label: "New" },
                ]}
              />
              <Segmented
                size="sm"
                value={source}
                onChange={setSource}
                options={[
                  { value: "all", label: "All" },
                  { value: "following", label: "Following" },
                ]}
              />
            </div>

            {/* The sidebar already has an AfterHours link, so this is
                deliberately lg:hidden — a phone-width Nest has no other one-
                tap way there (five bottom-nav slots, all already spoken for),
                right beside the strip above rather than off in a scrollable
                tail past it (this row is overflow-x-auto — an ml-auto here
                would push it out of view instead of next to it). "Slide" is
                the motion, not a literal drawer: a small nudge on tap toward
                the thing it opens. */}
            <Link
              href="/afterhours"
              aria-label="Open AfterHours — the anonymous feed"
              className="glass glass-pill flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[0.75rem] font-medium text-accent-hi transition-transform active:translate-x-0.5 lg:hidden"
            >
              <FlameIcon size={13} />
              AfterHours
              <ChevronRightIcon size={12} />
            </Link>
          </>
        }
      />

      <PageBody width="lg">
        <div className="flex gap-6">
          <div className="min-w-0 flex-1">
            <LoveFinderInvite />

            <PostList
              paged={paged}
              emptyTitle={source === "following" ? "Your follows have been quiet" : "No posts yet"}
              emptyBody={
                source === "following"
                  ? "Switch to All to see what the rest of campus is up to, or follow a few more people."
                  : "Be the first to put something here. Somebody has to go first."
              }
              emptyAction={
                <Button size="sm" onClick={() => setComposing(true)}>
                  Write a post
                </Button>
              }
            />
          </div>

          <FeedRail />
        </div>
      </PageBody>

      <Composer
        open={composing}
        onClose={() => setComposing(false)}
        onPosted={(post) => paged.setItems((prev) => [post, ...prev])}
      />

      <MobileSidebarDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
