"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Glow } from "@/components/fx/Glow";
import { Badge } from "@/components/ui/Badge";
import { StickerBar } from "@/components/ui/StickerBar";
import { VoteBar } from "./VoteBar";
import { MessageIcon, LinkIcon, LockIcon, BookmarkIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { PollBlock } from "./PollBlock";
import type { BookmarkResult, Poll, Post, ReactResult, Sticker } from "@/lib/types";
import { cn } from "@/lib/cn";

const TYPE_BADGE: Partial<Record<Post["type"], string>> = {
  ASK: "ask",
  POLL: "poll",
  LINK: "link",
};

export function PostCard({
  post,
  onChange,
  /** Detail view: full body, and the card stops being one big link. */
  detail,
}: {
  post: Post;
  onChange: (next: Post) => void;
  detail?: boolean;
}) {
  const toast = useToast();
  const [reacting, setReacting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  // `post` is a prop, so the copy captured when a handler starts goes stale the
  // moment anything else about the post lands mid-flight — a vote, someone
  // else's reaction. Spreading that captured copy on the way back silently
  // reverted whatever arrived in between; merge into the current one instead.
  const postRef = useRef(post);
  postRef.current = post;

  const toggleBookmark = async () => {
    // Bookmarking is a toggle, so a double-tap isn't idempotent the way a
    // second vote would be: it saved and then immediately unsaved.
    if (bookmarking) return;
    setBookmarking(true);
    const optimistic = !postRef.current.viewerBookmarked;
    onChange({ ...postRef.current, viewerBookmarked: optimistic });
    try {
      const result = await api.post<BookmarkResult>(`/v1/posts/${post.id}/bookmark`);
      onChange({ ...postRef.current, viewerBookmarked: result.bookmarked });
      toast(result.bookmarked ? "Saved" : "Removed from saved", "success");
    } catch (err) {
      onChange({ ...postRef.current, viewerBookmarked: !optimistic });
      toast(errorMessage(err, "could not save that"), "error");
    } finally {
      setBookmarking(false);
    }
  };

  const react = async (sticker: Sticker) => {
    if (reacting) return;
    setReacting(true);
    try {
      const result = await api.post<ReactResult>(`/v1/posts/${post.id}/react`, { sticker });
      onChange({ ...postRef.current, stickers: result.stickers });
    } catch (err) {
      toast(errorMessage(err, "reaction didn't stick"), "error");
    } finally {
      setReacting(false);
    }
  };

  // The whole card opens the post, but author/space/vote controls are their own
  // targets — so the card link is stretched from the title rather than wrapping
  // the markup, which would nest anchors inside an anchor.
  const stretch = !detail
    ? "after:absolute after:inset-0 after:content-[''] after:rounded-[var(--r-lg)]"
    : "";

  return (
    // Content sits on an opaque surface, not on glass. A feed is dozens of
    // these at once, and dozens of backdrop filters is a scroll-jank machine —
    // glass is for the chrome around the content, which there is one of.
    <article
      className={cn(
        "group/post card-lit relative p-4",
        !detail && "transition-shadow duration-300 hover:shadow-[var(--sh-pop)]",
        detail && "sm:p-5",
      )}
    >
      {!detail && <Glow radius={340} fill={false} opacity={0.45} />}
      <header className="relative z-10 flex items-center gap-2 text-xs">
        <Avatar user={post.author} size={26} />
        <Link href={`/profile/${post.author.handle}`} className="font-medium text-text hover:underline">
          {post.author.displayName}
        </Link>
        <span className="hidden text-faint sm:inline">@{post.author.handle}</span>
        <span className="text-faint">·</span>
        <span className="text-faint">{timeAgo(post.createdAt)}</span>

        <Link
          href={`/spaces/${post.space.slug}`}
          className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-muted transition-colors hover:border-border-strong hover:text-text"
        >
          <span aria-hidden>{post.space.icon} </span>
          {post.space.name}
        </Link>
      </header>

      <div className="mt-2.5">
        {(TYPE_BADGE[post.type] || post.isPinned || post.isLocked) && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {TYPE_BADGE[post.type] && (
              <Badge tone="accent" mono>
                {TYPE_BADGE[post.type]}
              </Badge>
            )}
            {post.isPinned && (
              <Badge tone="gold" mono>
                pinned
              </Badge>
            )}
            {post.isLocked && (
              <Badge tone="neutral" mono>
                <LockIcon size={10} /> locked
              </Badge>
            )}
          </div>
        )}

        {detail ? (
          post.title && <h1 className="text-lg font-medium tracking-[-0.015em] text-text">{post.title}</h1>
        ) : (
          <h2 className="text-[0.9375rem] font-medium tracking-[-0.01em] text-text">
            <Link href={`/posts/${post.id}`} className={cn("outline-offset-4", stretch)}>
              {post.title || "Open post"}
            </Link>
          </h2>
        )}

        {post.body && (
          <p className={cn("mt-1 text-sm whitespace-pre-wrap text-muted", !detail && "line-clamp-3")}>
            {post.body}
          </p>
        )}

        {post.poll && (
          <div className="relative z-10">
            <PollBlock
              postId={post.id}
              poll={post.poll}
              onChange={(poll: Poll) => onChange({ ...post, poll })}
            />
          </div>
        )}

        {post.imageUrl && (
          <div className="relative z-10 mt-3 overflow-hidden rounded-[var(--r-md)] border border-border">
            <Image
              src={post.imageUrl}
              alt={post.title || "Post image"}
              width={900}
              height={600}
              className="h-auto w-full object-cover"
            />
          </div>
        )}

        {post.linkUrl && (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 mt-3 flex items-center gap-2 rounded-[var(--r-md)] border border-border bg-surface-2 px-3 py-2 text-xs text-accent-hi transition-colors hover:border-border-strong"
          >
            <LinkIcon size={14} />
            <span className="truncate">{post.linkUrl}</span>
          </a>
        )}
      </div>

      <footer className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
        <VoteBar
          path={`/v1/posts/${post.id}/vote`}
          score={post.score}
          viewerVote={post.viewerVote}
          onChange={(result) => onChange({ ...post, ...result })}
        />

        <Link
          href={`/posts/${post.id}`}
          className="flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-text"
        >
          <MessageIcon size={13} />
          <span className="tabnum">{post.commentCount}</span>
        </Link>

        <button
          type="button"
          onClick={toggleBookmark}
          aria-label={post.viewerBookmarked ? "Remove from saved" : "Save post"}
          aria-pressed={post.viewerBookmarked}
          className={cn(
            "flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
            post.viewerBookmarked
              ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-wash text-accent-hi"
              : "border-border text-muted hover:border-border-strong hover:text-text",
          )}
        >
          <BookmarkIcon size={13} filled={post.viewerBookmarked} />
          <span className="hidden sm:inline">{post.viewerBookmarked ? "Saved" : "Save"}</span>
        </button>

        <div className="ml-auto">
          <StickerBar stickers={post.stickers} onToggle={react} compact={!detail} />
        </div>
      </footer>
    </article>
  );
}
