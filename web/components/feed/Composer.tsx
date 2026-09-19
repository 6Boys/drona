"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { MediaUpload } from "@/components/ui/MediaUpload";
import { PlusIcon, XIcon } from "@/components/ui/Icons";
import { SupportCard } from "@/components/ui/SupportCard";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { Items, Post, PostResult, PostType, Space, SupportCard as SupportCardData } from "@/lib/types";

const TYPES: { value: PostType; label: string }[] = [
  { value: "TEXT", label: "Post" },
  { value: "ASK", label: "Ask" },
  { value: "POLL", label: "Poll" },
  { value: "LINK", label: "Link" },
  { value: "IMAGE", label: "Image" },
];

export function Composer({
  open,
  onClose,
  onPosted,
  defaultSpace,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: (post: Post) => void;
  defaultSpace?: string;
}) {
  const toast = useToast();
  const spaces = useApi<Items<Space>>("/v1/spaces", undefined, open);

  const [type, setType] = useState<PostType>("TEXT");
  const [space, setSpace] = useState(defaultSpace ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<SupportCardData | null>(null);

  const options = spaces.data?.items ?? [];
  const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollReady = type !== "POLL" || filledOptions.length >= 2;
  const urlReady = (type !== "LINK" && type !== "IMAGE") || url.trim().length > 0;
  const chosen = space || defaultSpace || options[0]?.slug || "";

  const reset = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setPollOptions(["", ""]);
    setError(null);
    setSupport(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<PostResult>("/v1/posts", {
        space: chosen,
        type,
        title: title.trim(),
        body: body.trim() || undefined,
        linkUrl: type === "LINK" ? url.trim() : undefined,
        imageUrl: type === "IMAGE" ? url.trim() : undefined,
        pollOptions: type === "POLL" ? filledOptions : undefined,
      });

      onPosted(result.post);

      // The post publishes either way; a matched crisis pattern adds a support
      // card rather than silencing it (PRD 10).
      if (result.supportCard) {
        setSupport(result.supportCard);
      } else {
        reset();
        onClose();
      }

      if (result.owlPoints?.points) {
        toast(`+${result.owlPoints.points} night points · ${result.owlPoints.reason}`, "success");
      } else {
        toast("Posted to the Nest", "success");
      }
    } catch (err) {
      setError(errorMessage(err, "could not post that"));
    } finally {
      setBusy(false);
    }
  };

  if (support) {
    return (
      <Dialog
        open={open}
        onClose={() => {
          reset();
          onClose();
        }}
        title="Your post is live"
        description="Before you go, this is here if you want it."
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Close
          </Button>
        }
      >
        <SupportCard card={support} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New post"
      description="Your handle is attached. Anonymity lives on the Whisper Wall, not here."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={title.trim().length < 3 || !chosen || !pollReady || !urlReady}
            onClick={submit}
          >
            Post
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            options={TYPES}
            value={type}
            // `url` backs both the link field and the uploaded picture, so
            // switching type has to drop it — otherwise an image you just
            // uploaded turns up prefilled as a link.
            onChange={(next) => {
              setType(next);
              setUrl("");
            }}
            size="sm"
          />
          <Select
            aria-label="Space"
            value={chosen}
            onChange={(e) => setSpace(e.target.value)}
            className="w-auto py-1.5 text-[0.8125rem]"
          >
            {options.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.icon} {s.name}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label={type === "ASK" ? "Your question" : "Title"}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "ASK" ? "What do you need help with?" : "Say it in one line"}
          maxLength={160}
        />

        {type === "POLL" && (
          <div className="space-y-2">
            <p className="text-[0.8125rem] font-medium text-muted">Options</p>
            {pollOptions.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Option ${i + 1}`}
                  placeholder={`Option ${i + 1}`}
                  value={option}
                  maxLength={80}
                  className="flex-1"
                  onChange={(e) =>
                    setPollOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
                  }
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="cursor-pointer rounded-[var(--r-sm)] p-2 text-faint transition-colors hover:bg-surface-2 hover:text-danger"
                  >
                    <XIcon size={15} />
                  </button>
                )}
              </div>
            ))}

            {pollOptions.length < 6 && (
              <Button
                size="sm"
                variant="ghost"
                icon={<PlusIcon size={14} />}
                onClick={() => setPollOptions((prev) => [...prev, ""])}
              >
                Add option
              </Button>
            )}
          </div>
        )}

        {type === "LINK" && (
          <Input label="Link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        )}

        {type === "IMAGE" && <MediaUpload value={url} onChange={setUrl} />}

        <Textarea
          label="Body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional. Context, details, the actual question."
          maxLength={4000}
        />

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
