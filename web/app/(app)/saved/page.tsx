"use client";

import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { PostList } from "@/components/feed/PostList";
import { ButtonLink } from "@/components/ui/Button";
import { usePaged } from "@/lib/use-paged";
import type { Post } from "@/lib/types";

export default function SavedPage() {
  const paged = usePaged<Post>("/v1/bookmarks", { limit: 20 });

  return (
    <>
      <TopBar title="Saved" subtitle="Posts you bookmarked, newest first" />

      <PageBody width="sm">
        <PostList
          paged={paged}
          emptyTitle="Nothing saved yet"
          emptyBody="Hit Save on any post and it lands here — useful for placement threads and PYQ drops you want to find again."
          emptyAction={
            <ButtonLink href="/feed" size="sm" variant="outline">
              Back to the Nest
            </ButtonLink>
          }
        />
      </PageBody>
    </>
  );
}
