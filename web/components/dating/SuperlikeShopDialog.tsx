"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { SparkleIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { dating } from "@/lib/dating-store";
import { cn } from "@/lib/cn";

const SUPERLIKE_PRICE_INR = 7;
const QUANTITIES = [1, 3, 5];

/* -----------------------------------------------------------------------------
   The out-of-SuperLikes moment: buy a few at ₹7 each, or go premium for 4 a
   day instead of 3 a week — the dialog says both, since someone who just hit
   the wall is exactly who premium is for, not only who a one-off top-up is for.
   -------------------------------------------------------------------------- */
export function SuperlikeShopDialog({
  open,
  onClose,
  onBought,
  onGoPremium,
}: {
  open: boolean;
  onClose: () => void;
  onBought: (superlikesLeft: number) => void;
  onGoPremium: () => void;
}) {
  const toast = useToast();
  const [busyQty, setBusyQty] = useState<number | null>(null);

  const buy = async (quantity: number) => {
    setBusyQty(quantity);
    try {
      const result = await dating.buySuperlikes(quantity);
      onBought(result.superlikesLeft);
      toast(`${quantity} SuperLike${quantity === 1 ? "" : "s"} added`, "success");
      onClose();
    } catch (err) {
      toast(errorMessage(err, "that didn't go through"), "error");
    } finally {
      setBusyQty(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Out of SuperLikes" width="sm">
      <p className="text-[0.875rem] leading-relaxed text-muted">
        Buy a few more at ₹{SUPERLIKE_PRICE_INR} each, or go premium for 4 fresh SuperLikes a day and unlimited swipes.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {QUANTITIES.map((qty) => (
          <button
            key={qty}
            type="button"
            disabled={busyQty !== null}
            onClick={() => void buy(qty)}
            className={cn(
              "cursor-pointer rounded-[var(--r-lg)] border border-border bg-surface p-3.5 text-center transition-colors",
              "hover:border-accent disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <SparkleIcon size={16} className="mx-auto text-gold" />
            <p className="mt-1.5 text-[0.9375rem] font-medium text-text">
              {qty}
              {busyQty === qty && <span className="ml-1 text-xs font-normal text-muted">…</span>}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-muted">₹{qty * SUPERLIKE_PRICE_INR}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onGoPremium}
        className="mt-4 w-full cursor-pointer rounded-[var(--r-md)] border border-border-strong bg-accent-wash px-3.5 py-3 text-left transition-colors hover:border-accent"
      >
        <span className="block text-[0.8125rem] font-medium text-accent-hi">Go premium instead</span>
        <span className="mt-0.5 block text-[0.75rem] text-muted">4 SuperLikes a day and unlimited swipes.</span>
      </button>
    </Dialog>
  );
}
