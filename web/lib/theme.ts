"use client";

// Dark mode reads the same tier-2 tokens the marketing `.surface-dark` panels
// already define (app/globals.css) — this just decides whether `<html>`
// carries the `dark` class that switches every component over to them.
import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark";

const THEME_KEY = "drona.theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: ThemePref) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function useTheme(): { theme: ThemePref; setTheme: (t: ThemePref) => void } {
  const [theme, setThemeState] = useState<ThemePref>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    setThemeState(stored === "dark" || stored === "light" ? stored : systemPrefersDark() ? "dark" : "light");
  }, []);

  const setTheme = (next: ThemePref) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };

  return { theme, setTheme };
}
