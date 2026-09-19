"use client";

import { useState } from "react";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { AnonComposer } from "@/components/afterhours/AnonComposer";
import { AnonPostCard } from "@/components/afterhours/AnonPostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { FlameIcon } from "@/components/ui/Icons";
import { useAfterHoursFeed, type AfterHoursSort } from "@/lib/afterhours-store";

/* -----------------------------------------------------------------------------
   The one campus surface with no name attached to it. Everything you post
   here rides on a number instead — yours until you choose otherwise — and
   every post has a hard 24-hour lifespan, shown right on the post rather than
   left for someone to wonder about.
   -------------------------------------------------------------------------- */

export default function AfterHoursPage() {
  const [sort, setSort] = useState<AfterHoursSort>("hot");
  const feed = useAfterHoursFeed(sort);

  return (
    <>
      <TopBar
        title="AfterHours"
        subtitle="Anonymous · campus-only · posts last 24 hours"
        tabs={
          <>
            <Segmented<AfterHoursSort>
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: "hot", label: "Hot" },
                { value: "new", label: "New" },
              ]}
            />
            {/* Lives in the sticky bar rather than over the list: anything
                pinned inside the page scrolls underneath the bar and is
                hidden exactly when it matters, mid-scroll. */}
            {feed.newCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  feed.showPending();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="ml-auto shrink-0 cursor-pointer rounded-full bg-accent-wash px-3 py-1 text-[0.75rem] font-medium whitespace-nowrap text-accent-hi transition-colors hover:bg-accent hover:text-on-accent"
              >
                {feed.newCount === 1 ? "1 new post" : `${feed.newCount} new posts`}
              </button>
            )}
          </>
        }
      />

      <PageBody width="md">
        <AnonComposer onPosted={feed.prepend} />

        <div className="mt-4 space-y-3">
          {feed.loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-[var(--r-lg)]" />)
          ) : feed.items.length === 0 ? (
            <EmptyState
              icon={FlameIcon}
              title="Nothing here right now"
              body="Every post here lasts 24 hours, then it's gone — so an empty AfterHours just means nobody's said anything recently. Be the first."
              compact
            />
          ) : (
            feed.items.map((post) => (
              <AnonPostCard
                key={post.id}
                post={post}
                onChange={(next) => feed.setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)))}
                onRemoved={() => feed.remove(post.id)}
              />
            ))
          )}
        </div>
      </PageBody>
    </>
  );
}
