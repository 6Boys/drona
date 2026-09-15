"use client";

// Dark mode reads the same tier-2 tokens the marketing `.surface-dark` panels
// already define (app/globals.css) — this just decides whether `<html>`
// carries the `dark` class that switches every component over to them.
import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark";

const THEME_KEY = "drona.theme";

// Dark is the product's default look, not just a fallback for a dark OS —
// a visitor who has never touched the toggle gets dark regardless of system
// preference. Keep this in sync with the inline script in app/layout.tsx,
// which makes the same choice before hydration to avoid a flash.
const DEFAULT_THEME: ThemePref = "dark";

function applyTheme(theme: ThemePref) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function useTheme(): { theme: ThemePref; setTheme: (t: ThemePref) => void; toggleTheme: () => void } {
  const [theme, setThemeState] = useState<ThemePref>(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    setThemeState(stored === "dark" || stored === "light" ? stored : DEFAULT_THEME);
  }, []);

  const setTheme = (next: ThemePref) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggleTheme };
}
