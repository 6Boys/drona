"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";
import { cn } from "@/lib/cn";

/** Copies `text` to the clipboard with a brief "Copied" confirmation. Falls
 * back to a hidden-textarea + execCommand on http:// origins, where
 * navigator.clipboard.writeText is unavailable for the same secure-context
 * reason crypto.randomUUID is (see lib/api.ts randomId) — a homelab reached
 * over plain Tailscale/LAN http:// is exactly that case. */
export function CopyButton({ text, label = "Copy link", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Nothing sensible to do beyond leaving the button un-confirmed —
      // the user still has the raw text selectable on screen.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted transition-colors hover:border-border-strong hover:text-text",
        className,
      )}
    >
      {copied ? <CheckIcon size={13} className="text-positive" /> : <CopyIcon size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}
