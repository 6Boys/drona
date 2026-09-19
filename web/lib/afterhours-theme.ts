"use client";

import { useEffect, useState } from "react";
import type { AnonMood, AnonReaction } from "./types";

/* -----------------------------------------------------------------------------
   AfterHours is the one place in the app that changes the room, not just the
   accent. While the page is mounted `<html>` carries data-afterhours, which
   re-declares the tier-2 tokens (app/globals.css) — sidebar, nav and all go
   with it — and leaving puts everything back. Four ambiances; which one is a
   per-viewer choice kept in localStorage, since it's taste, not data.
   -------------------------------------------------------------------------- */

export type Ambiance = "velvet" | "candle" | "neon" | "noir";

export const AMBIANCES: Record<Ambiance, { name: string; tagline: string; themeColor: string; swatch: string }> = {
  velvet: {
    name: "Velvet",
    tagline: "Secrets & slow songs",
    themeColor: "#0c0610",
    swatch: "radial-gradient(circle at 30% 30%, #ff5c9a, #7b2cff 55%, #1a0a1f)",
  },
  candle: {
    name: "Candle",
    tagline: "The confession booth",
    themeColor: "#0d0906",
    swatch: "radial-gradient(circle at 35% 30%, #ffd27a, #ff7a2e 50%, #1c1109)",
  },
  neon: {
    name: "Neon",
    tagline: "3AM on the dance floor",
    themeColor: "#05060d",
    swatch: "radial-gradient(circle at 30% 30%, #3df5ff, #ff2bd6 55%, #0a0c1c)",
  },
  noir: {
    name: "Noir",
    tagline: "Black & white film",
    themeColor: "#0a0a0a",
    swatch: "radial-gradient(circle at 30% 30%, #ffffff, #8a8a8a 50%, #141414)",
  },
};

export const AMBIANCE_ORDER: Ambiance[] = ["velvet", "candle", "neon", "noir"];

export const MOODS: Record<AnonMood, { label: string; emoji: string; prompt: string; hint?: string }> = {
  confession: { label: "Confession", emoji: "🤫", prompt: "I've never told anyone this, but…" },
  secret: {
    label: "Secret",
    emoji: "🔒",
    prompt: "Something nobody on this campus knows about you…",
    hint: "Stays blurred until someone taps to reveal it.",
  },
  crush: { label: "Crush", emoji: "💘", prompt: "They have no idea, but…" },
  hottake: { label: "Hot take", emoji: "🌶️", prompt: "Unpopular opinion:" },
  rant: { label: "Rant", emoji: "😤", prompt: "Okay I need to get this out —" },
  "3am": { label: "3AM", emoji: "🌙", prompt: "It's late and I keep thinking about…" },
  ask: { label: "Ask", emoji: "❓", prompt: "Genuine question for campus:" },
};

export const MOOD_ORDER: AnonMood[] = ["confession", "secret", "crush", "hottake", "rant", "3am", "ask"];

export const REACTIONS: Record<AnonReaction, { emoji: string; label: string }> = {
  hug: { emoji: "🫂", label: "Sending a hug" },
  same: { emoji: "😭", label: "Same" },
  fire: { emoji: "🔥", label: "Fire" },
  tea: { emoji: "👀", label: "Need details" },
  dead: { emoji: "💀", label: "I'm dead" },
};

export const REACTION_ORDER: AnonReaction[] = ["hug", "same", "fire", "tea", "dead"];

const GLYPHS = ["✦", "☾", "◐", "✧", "◈", "⟡", "☽", "✶", "❖", "◉", "✺", "⌘"];

/** A number is easy to forget and impossible to tell apart at a glance; a
 * mask isn't. Derived purely from the number, so the same Anon always wears
 * the same one — and a flushed number gets a brand-new face with it. */
export function sigilFor(anonNumber: string) {
  let h = 2166136261;
  for (const ch of anonNumber) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const hueA = h % 360;
  const hueB = (hueA + 50 + ((h >>> 9) % 140)) % 360;
  return { hueA, hueB, angle: (h >>> 17) % 360, glyph: GLYPHS[(h >>> 5) % GLYPHS.length] };
}

const AMBIANCE_KEY = "drona.afterhours.ambiance";
let transitionTimer: number | undefined;

/** Everything painted with a token eases to its new value instead of cutting
 * — the "lights going down" when you walk in, and back up on the way out. */
function withTransition(apply: () => void) {
  const root = document.documentElement;
  root.classList.add("ah-transition");
  apply();
  window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(() => root.classList.remove("ah-transition"), 900);
}

function readStored(): Ambiance {
  try {
    const v = window.localStorage.getItem(AMBIANCE_KEY);
    return v && v in AMBIANCES ? (v as Ambiance) : "velvet";
  } catch {
    return "velvet";
  }
}

export function useAfterHoursAmbiance() {
  // The (app) routes only render after auth resolves on the client, so this
  // initializer never runs during a server render.
  const [ambiance, setAmbianceState] = useState<Ambiance>(() => (typeof window === "undefined" ? "velvet" : readStored()));

  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevMeta = meta?.content;
    // theme.ts sets color-scheme inline for light-mode users; inline beats the
    // stylesheet, so it has to be swapped here too or scrollbars and native
    // controls would stay light on a dark page.
    const prevScheme = root.style.colorScheme;
    return () => {
      withTransition(() => {
        delete root.dataset.afterhours;
        root.style.colorScheme = prevScheme;
      });
      if (meta && prevMeta) meta.content = prevMeta;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    withTransition(() => {
      root.dataset.afterhours = ambiance;
      root.style.colorScheme = "dark";
    });
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = AMBIANCES[ambiance].themeColor;
  }, [ambiance]);

  const setAmbiance = (next: Ambiance) => {
    setAmbianceState(next);
    try {
      window.localStorage.setItem(AMBIANCE_KEY, next);
    } catch {
      // Private mode / blocked storage: the choice just won't outlive the tab.
    }
  };

  return { ambiance, setAmbiance };
}
