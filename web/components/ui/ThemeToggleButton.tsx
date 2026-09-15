"use client";

import { useTheme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./Icons";
import { cn } from "@/lib/cn";

/** A single icon button that flips light/dark — separate from the full
 * Appearance toggle in Settings, for places (like the marketing header)
 * that want the switch one click away without a trip to a settings page.
 * Dark is the app's default (lib/theme.ts), so the resting state here is the
 * sun — "tap to go light" — rather than the other way around. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text",
        className,
      )}
    >
      {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}
