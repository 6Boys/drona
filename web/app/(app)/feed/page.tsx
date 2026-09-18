"use client";

import { useState } from "react";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { Composer } from "@/components/feed/Composer";
import { LoveFinderInvite } from "@/components/dating/LoveFinderInvite";
import { FeedRail } from "@/components/feed/FeedRail";
import { PostList } from "@/components/feed/PostList";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { PlusIcon } from "@/components/ui/Icons";
import { usePaged } from "@/lib/use-paged";
import { useAuth } from "@/lib/auth-context";
import type { Post } from "@/lib/types";

type Sort = "hot" | "new";
type Source = "all" | "following";

export default function FeedPage() {
  const { me } = useAuth();
  const [sort, setSort] = useState<Sort>("hot");
  const [source, setSource] = useState<Source>("all");
  const [composing, setComposing] = useState(false);

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
    </>
  );
}
