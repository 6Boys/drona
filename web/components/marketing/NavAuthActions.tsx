"use client";

import { ButtonLink } from "@/components/ui/Button";
import { ThemeToggleButton } from "@/components/ui/ThemeToggleButton";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { useAuth } from "@/lib/auth-context";

/* -----------------------------------------------------------------------------
   The marketing header used to show "Log in / Get started" unconditionally —
   harmless in a browser tab (tapping either just bounces off /login straight
   back to /feed), but a real bug for anyone who added this page to their
   iPhone home screen: iOS bookmarks whatever URL was on screen when you hit
   Share → Add to Home Screen, not the manifest's start_url, so a lot of
   people's home-screen icon opens here, not /feed. Landing on a header that
   still says "Log in" after you already are reads as "it forgot me," not as
   "you're on the marketing page" — this checks the same auth state the rest
   of the app does so that icon shows the truth.
   -------------------------------------------------------------------------- */
export function NavAuthActions() {
  const { me, loading } = useAuth();

  return (
    <>
      <ThemeToggleButton />
      {loading ? null : me ? (
        <ButtonLink href="/feed" size="sm" icon={<ArrowRightIcon size={14} />}>
          Open the app
        </ButtonLink>
      ) : (
        <>
          <ButtonLink href="/login" variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href="/login" size="sm">
            Get started
          </ButtonLink>
        </>
      )}
    </>
  );
}
