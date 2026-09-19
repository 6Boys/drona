"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { Composer } from "@/components/feed/Composer";
import { PostList } from "@/components/feed/PostList";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { PlusIcon } from "@/components/ui/Icons";
import { useApi } from "@/lib/use-api";
import { usePaged } from "@/lib/use-paged";
import type { Items, Post, Space } from "@/lib/types";

export default function SpacePage() {
  const { slug } = useParams<{ slug: string }>();
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [composing, setComposing] = useState(false);

  const spaces = useApi<Items<Space>>("/v1/spaces");
  const space = useMemo(
    () => spaces.data?.items.find((s) => s.slug === slug),
    [spaces.data, slug],
  );

  const paged = usePaged<Post>("/v1/feed", { space: slug, sort, limit: 20 });

  return (
    <>
      <TopBar
        title={space ? `${space.icon ?? ""} ${space.name}`.trim() : `#${slug}`}
        subtitle={space?.description ?? `#${slug}`}
        back="/spaces"
        actions={
          <Button size="sm" icon={<PlusIcon size={15} />} onClick={() => setComposing(true)}>
            <span className="hidden sm:inline">New post</span>
          </Button>
        }
        tabs={
          <Segmented
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

      <PageBody width="sm">
        <PostList
          paged={paged}
          emptyTitle={`#${slug} is empty`}
          emptyBody="No posts in this space yet. Start it off."
          emptyAction={
            <Button size="sm" onClick={() => setComposing(true)}>
              Write the first post
            </Button>
          }
        />
      </PageBody>

      <Composer
        open={composing}
        onClose={() => setComposing(false)}
        defaultSpace={slug}
        onPosted={(post) => paged.setItems((prev) => [post, ...prev])}
      />
    </>
  );
}
