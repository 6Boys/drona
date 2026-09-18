"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LockIcon, SparkleIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { premium, PLANS, type PlanId } from "@/lib/premium";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   The one paywall, reused everywhere premium is sold — Likes You and the
   "read the rules" section under a profile's followers/following both render
   this rather than each inventing their own plan cards and redeem box.

   Two ways in: pick a plan (checkout — a real gateway integration swaps in
   behind `premium.checkout`, see lib/premium.ts), or a redeem code, kept
   small and below the plans on purpose — it is an escape hatch for staff and
   testers, not something to advertise next to the price.
   -------------------------------------------------------------------------- */

export function Paywall({
  title = "Go premium",
  body = "Unlock this for as long as your plan is active.",
  onUnlocked,
}: {
  title?: string;
  body?: string;
  onUnlocked?: () => void;
}) {
  const { apply } = useAuth();
  const toast = useToast();
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [code, setCode] = useState("");

  const choosePlan = async (plan: PlanId) => {
    setBusyPlan(plan);
    try {
      apply(await premium.checkout(plan));
      toast("Premium unlocked", "success");
      onUnlocked?.();
    } catch (err) {
      toast(errorMessage(err, "could not complete that"), "error");
    } finally {
      setBusyPlan(null);
    }
  };

  const submitCode = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      apply(await premium.redeem(code.trim()));
      toast("Code accepted — premium unlocked", "success");
      setCode("");
      onUnlocked?.();
    } catch (err) {
      toast(errorMessage(err, "that code doesn't work"), "error");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="mx-auto max-w-md text-center">
      <span className="glass glass-pill mx-auto flex size-12 items-center justify-center text-accent">
        <LockIcon size={20} />
      </span>
      <h2 className="display mt-4 text-[1.5rem] text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-muted">{body}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 text-left">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            disabled={busyPlan !== null}
            onClick={() => void choosePlan(plan.id)}
            className={cn(
              "cursor-pointer rounded-[var(--r-lg)] border border-border bg-surface p-4 text-left transition-colors",
              "hover:border-accent disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <p className="mono-label">{plan.label}</p>
            <p className="display mt-1 text-[1.5rem] text-text">
              ₹{plan.priceInr}
              {busyPlan === plan.id && <span className="ml-2 text-xs font-normal text-muted">…</span>}
            </p>
            <p className="mt-1 text-[0.75rem] text-muted">{plan.note}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowRedeem((s) => !s)}
        className="mt-5 cursor-pointer text-[0.75rem] text-faint underline decoration-dotted underline-offset-2 hover:text-muted"
      >
        Have a code?
      </button>

      {showRedeem && (
        <div className="mt-2.5 flex justify-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submitCode()}
            placeholder="redeem code"
            className="w-36 rounded-[var(--r-md)] border border-border bg-surface px-3 py-1.5 text-[0.8125rem] text-text outline-none placeholder:text-faint focus:border-accent"
          />
          <Button size="sm" variant="outline" loading={redeeming} onClick={submitCode}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}

/** A thin banner version for spots that want a one-line pitch rather than the
 * full plan grid — tapping it opens the same Paywall in a dialog. */
export function PremiumBanner({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass glass-panel flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:border-accent"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-wash text-accent-hi">
        <SparkleIcon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] font-medium text-text">See who liked you, instantly</span>
        <span className="block text-[0.75rem] text-muted">Skip the guessing — match directly, no waiting.</span>
      </span>
    </button>
  );
}
