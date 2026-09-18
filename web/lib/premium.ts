import { api } from "./api";
import type { MeResponse, User } from "./types";

/* -----------------------------------------------------------------------------
   One premium concept, one place it's defined — the plans, the price, and the
   "are they actually unlocked right now" check all live here so the paywall
   on Likes You and the one under a profile's followers/following can't drift
   into disagreeing with each other.
   -------------------------------------------------------------------------- */

export type PlanId = "weekly" | "monthly";

export interface Plan {
  id: PlanId;
  label: string;
  priceInr: number;
  /** What a person reads under the price — the monthly plan's whole pitch is
   * that four weeks of the weekly price would cost more than this. */
  note: string;
}

export const PLANS: Plan[] = [
  { id: "weekly", label: "Weekly", priceInr: 39, note: "billed every week" },
  { id: "monthly", label: "Monthly", priceInr: 59, note: "less than two weeks, for four" },
];

/** `premiumUntil` is a snapshot from whenever the account was last fetched —
 * this only ever answers "as of that snapshot," so re-check after anything
 * that might have changed it (a redeem, a completed checkout, a plain
 * refresh). Never cached beyond the User object the caller already has. */
export function isPremiumActive(user: Pick<User, "premiumUntil"> | null | undefined): boolean {
  return !!user?.premiumUntil && new Date(user.premiumUntil).getTime() > Date.now();
}

export const premium = {
  /** A code that unlocks premium outright — "admin" today. Same endpoint
   * shape a promo or referral code would use later. */
  redeem: (code: string) => api.post<MeResponse>("/v1/premium/redeem", { code }),

  /**
   * Starts (or, on a real gateway, would start) paying for a plan.
   *
   * Today this is one call because the mock backend has nowhere real to send
   * a payment and grants the period immediately. A real Razorpay integration
   * splits this into the same two-step order/verify flow the callers below
   * are already written to expect from `dating.startCheckout`-style hooks:
   * create an order server-side, open Razorpay Checkout with it client-side,
   * then POST the payment id/order id/signature Checkout hands back to a
   * `/v1/premium/verify` route that only grants the period once Razorpay's
   * signature actually checks out. Nothing above this function needs to
   * change when that split happens — it would just await one more await.
   */
  checkout: (plan: PlanId) => api.post<MeResponse>("/v1/premium/checkout", { plan }),
};
