"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { FlagIcon, MoreIcon, ShieldIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import type { DatingCandidate } from "@/lib/types";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   The "..." every real dating app puts on a stranger's card — PRD 10 already
   promises "report and block on every surface," and the API has carried
   POST /v1/reports and POST /v1/users/{handle}/block since early on, but
   nothing in the app has ever called either. The one surface where a report
   button matters most (a deck of strangers) had the least of it.
   -------------------------------------------------------------------------- */

const REASONS = ["Fake profile", "Inappropriate photo", "Harassment or hate speech", "Underage", "Something else"];

type Step = "menu" | "report" | "block" | null;

export function ReportBlockMenu({
  candidate,
  onHandled,
  className,
}: {
  candidate: DatingCandidate;
  /** Called after a successful report or block — the caller drops the card. */
  onHandled?: () => void;
  className?: string;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setStep(null);
    setReason("");
    setDetails("");
  };

  const submitReport = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api.post("/v1/reports", { targetType: "USER", targetId: candidate.id, reason, details });
      toast("Reported. A moderator will review this within 24 hours.", "success");
      close();
      onHandled?.();
    } catch (err) {
      toast(errorMessage(err, "could not file that report"), "error");
    } finally {
      setBusy(false);
    }
  };

  const submitBlock = async () => {
    setBusy(true);
    try {
      await api.post(`/v1/users/${candidate.handle}/block`);
      toast(`Blocked @${candidate.handle}`, "info");
      close();
      onHandled?.();
    } catch (err) {
      toast(errorMessage(err, "could not block that account"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Report or block ${candidate.displayName}`}
        onClick={(e) => {
          e.stopPropagation();
          setStep("menu");
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "flex size-9 cursor-pointer items-center justify-center rounded-full bg-surface/80 text-muted shadow-[var(--sh-card)] backdrop-blur-sm transition-colors hover:text-text",
          className,
        )}
      >
        <MoreIcon size={16} />
      </button>

      <Dialog open={step === "menu"} onClose={close} title={candidate.displayName} width="sm">
        <div className="-mx-1 space-y-1">
          <button
            type="button"
            onClick={() => setStep("report")}
            className="flex w-full cursor-pointer items-center gap-3 rounded-[var(--r-md)] px-3 py-3 text-left text-sm text-text transition-colors hover:bg-surface-2"
          >
            <FlagIcon size={16} className="text-muted" />
            Report {candidate.displayName}
          </button>
          <button
            type="button"
            onClick={() => setStep("block")}
            className="flex w-full cursor-pointer items-center gap-3 rounded-[var(--r-md)] px-3 py-3 text-left text-sm text-danger transition-colors hover:bg-surface-2"
          >
            <ShieldIcon size={16} />
            Block {candidate.displayName}
          </button>
        </div>
      </Dialog>

      <Dialog
        open={step === "report"}
        onClose={close}
        title={`Report ${candidate.displayName}`}
        description="Seen by a moderator, never by them."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!reason} loading={busy} onClick={submitReport}>
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
          <Textarea
            placeholder="Anything else? (optional)"
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
          />
        </div>
      </Dialog>

      <Dialog
        open={step === "block"}
        onClose={close}
        title={`Block ${candidate.displayName}?`}
        description="They won't be able to see your profile or message you, and their card leaves your deck for good."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={submitBlock}>
              Block
            </Button>
          </>
        }
      />
    </>
  );
}
