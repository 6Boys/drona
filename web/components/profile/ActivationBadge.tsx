import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

/* -----------------------------------------------------------------------------
   A seat held for someone who hasn't shown up yet, versus someone who has.
   Same mark either way — outline only, no fill, so it never competes with a
   photo or the rank badge next to it — and only the color carries the
   difference, white for a ghost import, the app's own red the moment that
   exact email clears its first OTP (POST /v1/auth/otp/verify).
   -------------------------------------------------------------------------- */
export function ActivationBadge({ activated }: { activated: boolean }) {
  return (
    <Tooltip label={activated ? "Activated profile" : "This profile is not yet activated"}>
      <span
        aria-label={activated ? "Activated profile" : "Profile not yet activated"}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[0.625rem] font-semibold",
          // `muted`, not a literal white — this app has a light theme too,
          // and a hardcoded white outline would vanish on a light card. The
          // token still reads as the same "plain, unlit" white the dark
          // theme (the default, and everywhere this got designed against)
          // actually shows.
          activated ? "border-danger text-danger" : "border-muted text-muted",
        )}
      >
        A
      </span>
    </Tooltip>
  );
}
