"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { afterhours } from "@/lib/afterhours-store";
import { cn } from "@/lib/cn";

const REASONS = ["Harassment or hate speech", "Threat or doxxing", "Explicit content", "Spam", "Something else"];

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  onReported,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "AFTERHOURS_POST" | "AFTERHOURS_REPLY";
  targetId: string;
  onReported: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const noun = targetType === "AFTERHOURS_POST" ? "post" : "reply";

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await afterhours.report(targetType, targetId, reason);
      toast(`Reported — you won't see this ${noun} again.`, "success");
      setReason("");
      onClose();
      onReported();
    } catch (err) {
      toast(errorMessage(err, "could not file that report"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Report this ${noun}`}
      description="It disappears for you straight away, and for everyone once enough people flag it. The number on it tells a moderator no more about who wrote it than it tells you."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!reason} loading={busy} onClick={submit}>
            Submit report
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn(
              "block w-full cursor-pointer rounded-[var(--r-md)] border px-3 py-2.5 text-left text-sm transition-colors",
              reason === r
                ? "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-wash text-accent-hi"
                : "border-border text-text hover:border-border-strong",
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
