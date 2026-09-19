"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, SpinnerIcon, UploadIcon, XIcon } from "./Icons";
import { uploadMedia, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";

// Matches api/internal/media exactly — this is the client-side half of one
// policy, not an independent one. Failing fast here is purely a courtesy (no
// pointless upload of a file the server will reject anyway); the server
// enforces the same limits on the real bytes regardless of what this checks.
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const ALLOWED_TYPES = new Set(ACCEPT.split(","));

function friendlySize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Client-side pre-check, mirroring api/internal/media's policy — fails fast
 * with a specific reason before ever opening a connection. Exported for its
 * test; the server is still the thing that decides. */
export function precheck(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return file.type.startsWith("video/")
      ? "Videos aren't supported here — pictures and GIFs only."
      : "Only JPEG, PNG, WEBP or GIF images are accepted.";
  }
  if (file.size > MAX_BYTES) {
    return `That file is ${friendlySize(file.size)} — 5 MB max.`;
  }
  return null;
}

/**
 * A picture-or-GIF picker that uploads through this instance's own media
 * store (POST /v1/media/upload) and hands back the URL. Drag a file in, pick
 * one, or paste an image straight from the clipboard — all three end at the
 * same upload call.
 */
export function MediaUpload({
  value,
  onChange,
  label = "Picture",
  hint = "JPEG, PNG, WEBP or GIF · 5 MB max · no video",
  className,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const send = useCallback(
    async (file: File) => {
      const problem = precheck(file);
      if (problem) {
        setError(problem);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await uploadMedia(file);
        onChange(result.url);
      } catch (err) {
        setError(errorMessage(err, "that upload failed"));
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets picking the same file twice re-fire onChange
    if (file) void send(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void send(file);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) void send(file);
  };

  if (value) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
        <div className="relative overflow-hidden rounded-[var(--r-md)] border border-border">
          <Image
            src={value}
            alt="Uploaded picture"
            width={800}
            height={450}
            unoptimized
            className="h-auto max-h-64 w-full object-cover"
          />
          <button
            type="button"
            aria-label="Remove picture"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-accent bg-accent-wash" : "border-border-strong hover:border-accent",
          busy && "pointer-events-none opacity-60",
        )}
      >
        {busy ? (
          <SpinnerIcon size={20} className="text-muted" />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted">
            <UploadIcon size={16} />
          </span>
        )}
        <p className="text-[0.8125rem] text-text">
          {busy ? "Uploading…" : "Click to choose, drag a file in, or paste an image"}
        </p>
        <p className="flex items-center gap-1 text-[0.6875rem] text-faint">
          <ImageIcon size={11} />
          {hint}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onPick}
          aria-label={label}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
