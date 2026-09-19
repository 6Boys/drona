"use client";

import type { ReactNode } from "react";
import { PostCard } from "./PostCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Paged } from "@/lib/use-paged";
import type { Post } from "@/lib/types";

export function PostList({
  paged,
  emptyTitle = "Nothing here yet",
  emptyBody,
  emptyAction,
}: {
  paged: Paged<Post>;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
}) {
  const { items, loading, loadingMore, hasMore, error, loadMore, setItems } = paged;

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-[var(--r-lg)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="That didn't load"
        body={error}
        action={
          <Button variant="outline" size="sm" onClick={paged.reload}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!items.length) {
    return <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />;
  }

  return (
    <div className="space-y-3">
      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onChange={(next) => setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)))}
        />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
