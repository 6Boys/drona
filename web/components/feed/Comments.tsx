"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { SupportCard } from "@/components/ui/SupportCard";
import { ReplyIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { VoteBar } from "./VoteBar";
import { api, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Comment, CommentResult, SupportCard as SupportCardData } from "@/lib/types";
import { cn } from "@/lib/cn";

function CommentForm({
  postId,
  parentId,
  autoFocus,
  placeholder = "Add a comment",
  onDone,
  onCancel,
}: {
  postId: string;
  parentId?: string;
  autoFocus?: boolean;
  placeholder?: string;
  onDone: (comment: Comment) => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState<SupportCardData | null>(null);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await api.post<CommentResult>(`/v1/posts/${postId}/comments`, {
        body: body.trim(),
        parentId: parentId ?? null,
      });
      onDone(result.comment);
      setBody("");
      if (result.supportCard) setSupport(result.supportCard);
      if (result.owlPoints?.points) {
        toast(`+${result.owlPoints.points} owl points · ${result.owlPoints.reason}`, "success");
      }
      onCancel?.();
    } catch (err) {
      toast(errorMessage(err, "comment didn't send"), "error");
    } finally {
      setBusy(false);
    }
  };

  if (support) return <SupportCard card={support} />;

  return (
    <div className="space-y-2">
      <Textarea
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        value={body}
        placeholder={placeholder}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" loading={busy} disabled={body.trim().length < 2} onClick={submit}>
          {parentId ? "Reply" : "Comment"}
        </Button>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  onReplyAdded,
  onChange,
}: {
  comment: Comment;
  postId: string;
  onReplyAdded: (parentId: string, reply: Comment) => void;
  onChange: (id: string, patch: Partial<Comment>) => void;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li className={cn(comment.depth > 0 && "border-l border-border pl-3 sm:pl-4")}>
      <div className="py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Avatar user={comment.author} size={22} />
          <Link href={`/profile/${comment.author.handle}`} className="font-medium text-text hover:underline">
            {comment.author.displayName}
          </Link>
          <span className="text-faint">{timeAgo(comment.createdAt)}</span>
        </div>

        <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted">
          {comment.isRemoved ? <span className="text-faint italic">Removed by a moderator.</span> : comment.body}
        </p>

        <div className="mt-2 flex items-center gap-2">
          <VoteBar
            size="sm"
            path={`/v1/comments/${comment.id}/vote`}
            score={comment.score}
            viewerVote={comment.viewerVote}
            onChange={(result) => onChange(comment.id, result)}
          />
          <button
            onClick={() => setReplying((v) => !v)}
            className="flex h-6 cursor-pointer items-center gap-1 rounded-full border border-border px-2 text-[0.6875rem] text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            <ReplyIcon size={12} />
            Reply
          </button>
        </div>

        {replying && (
          <div className="mt-2.5">
            <CommentForm
              postId={postId}
              parentId={comment.id}
              autoFocus
              placeholder={`Replying to @${comment.author.handle}`}
              onDone={(reply) => onReplyAdded(comment.id, reply)}
              onCancel={() => setReplying(false)}
            />
          </div>
        )}
      </div>

      {comment.children?.length ? (
        <ul>
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              postId={postId}
              onReplyAdded={onReplyAdded}
              onChange={onChange}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Recursively patches one comment anywhere in the tree. */
function patchTree(list: Comment[], id: string, patch: Partial<Comment>): Comment[] {
  return list.map((c) =>
    c.id === id
      ? { ...c, ...patch }
      : c.children?.length
        ? { ...c, children: patchTree(c.children, id, patch) }
        : c,
  );
}

function appendReply(list: Comment[], parentId: string, reply: Comment): Comment[] {
  return list.map((c) =>
    c.id === parentId
      ? { ...c, children: [...(c.children ?? []), reply] }
      : c.children?.length
        ? { ...c, children: appendReply(c.children, parentId, reply) }
        : c,
  );
}

export function Comments({
  postId,
  comments,
  setComments,
  locked,
  onCountChange,
}: {
  postId: string;
  comments: Comment[];
  setComments: (updater: (prev: Comment[]) => Comment[]) => void;
  locked?: boolean;
  onCountChange: (delta: number) => void;
}) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mono-label mb-3">
        {comments.length === 0 ? "comments" : `${comments.length} thread${comments.length === 1 ? "" : "s"}`}
      </h2>

      {locked ? (
        <p className="rounded-[var(--r-md)] border border-border bg-surface-2 px-3 py-2.5 text-sm text-muted">
          This post is locked. Nobody can add new comments.
        </p>
      ) : (
        <CommentForm
          postId={postId}
          onDone={(comment) => {
            setComments((prev) => [...prev, comment]);
            onCountChange(1);
          }}
        />
      )}

      {comments.length === 0 ? (
        <EmptyState compact title="No comments yet" body="First one sets the tone." />
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              onReplyAdded={(parentId, reply) => {
                setComments((prev) => appendReply(prev, parentId, reply));
                onCountChange(1);
              }}
              onChange={(id, patch) => setComments((prev) => patchTree(prev, id, patch))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
