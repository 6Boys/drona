"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { PostCard } from "@/components/feed/PostCard";
import { Comments } from "@/components/feed/Comments";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ButtonLink } from "@/components/ui/Button";
import { useApi } from "@/lib/use-api";
import type { Comment, Items, Post } from "@/lib/types";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const post = useApi<Post>(`/v1/posts/${id}`);
  const commentData = useApi<Items<Comment>>(`/v1/posts/${id}/comments`);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (commentData.data) setComments(commentData.data.items);
  }, [commentData.data]);

  return (
    <>
      <TopBar
        title="Post"
        back
        subtitle={post.data ? `in ${post.data.space.name}` : undefined}
        titleIsHeading={false}
      />

      <PageBody width="sm">
        {post.loading ? (
          <div className="space-y-3">
            <Skeleton className="h-48 rounded-[var(--r-lg)]" />
            <Skeleton className="h-32 rounded-[var(--r-lg)]" />
          </div>
        ) : !post.data ? (
          <EmptyState
            title="Nothing lives at this address"
            body={post.error ?? "This post may have been removed."}
            action={
              <ButtonLink href="/feed" size="sm" variant="outline">
                Back to the Nest
              </ButtonLink>
            }
          />
        ) : (
          <div className="space-y-3">
            <PostCard detail post={post.data} onChange={(next) => post.set(next)} />
            <Comments
              postId={id}
              comments={comments}
              setComments={setComments}
              locked={post.data.isLocked}
              onCountChange={(delta) =>
                post.set((prev) => (prev ? { ...prev, commentCount: prev.commentCount + delta } : prev))
              }
            />
          </div>
        )}
      </PageBody>
    </>
  );
}
