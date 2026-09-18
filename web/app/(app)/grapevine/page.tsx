"use client";

import { useState } from "react";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { AnonComposer } from "@/components/grapevine/AnonComposer";
import { AnonPostCard } from "@/components/grapevine/AnonPostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { FlameIcon } from "@/components/ui/Icons";
import { useGrapevineFeed, type GrapevineSort } from "@/lib/grapevine-store";

/* -----------------------------------------------------------------------------
   The one campus surface with no name attached to it. Everything you post
   here rides on a number instead — yours until you choose otherwise — and
   every post has a hard 24-hour lifespan, shown right on the post rather than
   left for someone to wonder about.
   -------------------------------------------------------------------------- */

export default function GrapevinePage() {
  const [sort, setSort] = useState<GrapevineSort>("hot");
  const feed = useGrapevineFeed(sort);

  return (
    <>
      <TopBar
        title="Grapevine"
        subtitle="Anonymous · campus-only · posts last 24 hours"
        tabs={
          <Segmented<GrapevineSort>
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: "hot", label: "Hot" },
              { value: "new", label: "New" },
            ]}
          />
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
              body="Every post here lasts 24 hours, then it's gone — so an empty Grapevine just means nobody's said anything recently. Be the first."
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
