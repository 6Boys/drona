"use client";

import { useSyncExternalStore } from "react";
import { INCOMING_LIKES, MOCK_DECK, MOCK_MATCH_HANDLES } from "./mock-dating";
import type {
  DatingCandidate,
  DatingLike,
  DatingMatch,
  LikeTarget,
  MyDatingProfile,
} from "./types";

/* -----------------------------------------------------------------------------
   The Love Finder's state, held locally.

   The dating service isn't shipped yet, so the decisions a person makes here —
   what they passed on, what they liked and what they said with it, who they
   matched with, what their own card says — live in one store backed by
   localStorage. It is deliberately the same shape as the API's future payloads:
   handles, targets and ISO timestamps, not React state trees. Swapping this for
   real endpoints means replacing the bodies of the actions, not the screens.

   Written as an external store rather than context so the deck, the badge
   counts in the tab strip and the sidebar all read one source and re-render
   together.
   -------------------------------------------------------------------------- */

const KEY = "ds:love-finder:v1";
const MATCH_WINDOW_DAYS = 7;
const DAILY_TWINKLES = 1;

export interface SentLike {
  handle: string;
  target: LikeTarget;
  note?: string;
  twinkle?: boolean;
  at: string;
}

export interface DatingState {
  /** Handles the viewer swiped past. */
  passed: string[];
  sent: SentLike[];
  matches: DatingMatch[];
  /** Incoming likes that have been answered, either way. */
  handledLikes: string[];
  /** yyyy-mm-dd — twinkles reset with the calendar day, not a rolling 24h. */
  twinkleDay: string;
  twinklesUsed: number;
  profile: MyDatingProfile;
}

const EMPTY_PROFILE: MyDatingProfile = {
  vibe: "",
  interests: [],
  prompts: [],
};

const INITIAL: DatingState = {
  passed: [],
  sent: [],
  matches: [],
  handledLikes: [],
  twinkleDay: "",
  twinklesUsed: 0,
  profile: EMPTY_PROFILE,
};

const today = () => new Date().toISOString().slice(0, 10);

function load(): DatingState {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<DatingState>;
    // Merge rather than trust: a stored blob from an older build should never
    // be able to leave a required field undefined.
    return {
      ...INITIAL,
      ...parsed,
      profile: { ...EMPTY_PROFILE, ...(parsed.profile ?? {}) },
    };
  } catch {
    return INITIAL;
  }
}

let state: DatingState = INITIAL;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function set(next: Partial<DatingState>) {
  state = { ...state, ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — the session still works, it just won't persist */
  }
  emit();
}

function subscribe(listener: () => void) {
  // First subscriber pulls from storage. Doing it here rather than at module
  // scope keeps the server render and the first client render identical, which
  // is what stops React from throwing a hydration mismatch.
  if (!hydrated) {
    hydrated = true;
    state = load();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => state;
const serverSnapshot = () => INITIAL;

export function useDating(): DatingState {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/* ------------------------------------------------------------------ derive -- */

export function twinklesLeft(s: DatingState): number {
  if (s.twinkleDay !== today()) return DAILY_TWINKLES;
  return Math.max(0, DAILY_TWINKLES - s.twinklesUsed);
}

/** The deck minus anyone already dealt with, in either direction. */
export function deckFor(s: DatingState, viewerHandle?: string): DatingCandidate[] {
  const done = new Set([...s.passed, ...s.sent.map((l) => l.handle)]);
  return MOCK_DECK.filter((c) => c.handle !== viewerHandle && !done.has(c.handle));
}

export function pendingLikes(s: DatingState): DatingLike[] {
  const handled = new Set(s.handledLikes);
  return INCOMING_LIKES.filter((like) => !handled.has(like.id));
}

/** Newest first, and anything past its window is already gone. */
export function liveMatches(s: DatingState): DatingMatch[] {
  const now = Date.now();
  return s.matches
    .filter((m) => new Date(m.expiresAt).getTime() > now)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function hoursLeft(match: DatingMatch): number {
  return Math.max(0, Math.round((new Date(match.expiresAt).getTime() - Date.now()) / 3_600_000));
}

/* ----------------------------------------------------------------- actions -- */

function makeMatch(candidate: DatingCandidate): DatingMatch {
  const at = new Date();
  const expires = new Date(at.getTime() + MATCH_WINDOW_DAYS * 86_400_000);
  return {
    handle: candidate.handle,
    candidate,
    at: at.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

export const dating = {
  pass(handle: string) {
    if (state.passed.includes(handle)) return;
    set({ passed: [...state.passed, handle] });
  },

  /**
   * Records a like and reports whether it matched. A like matches when the
   * other person already liked you (they're in the incoming list) or when the
   * demo data says they always do.
   */
  like(
    candidate: DatingCandidate,
    target: LikeTarget = { kind: "photo" },
    note?: string,
    twinkle = false,
  ): DatingMatch | null {
    const trimmed = note?.trim();
    const entry: SentLike = {
      handle: candidate.handle,
      target,
      at: new Date().toISOString(),
      ...(trimmed ? { note: trimmed } : {}),
      ...(twinkle ? { twinkle: true } : {}),
    };

    const day = today();
    const patch: Partial<DatingState> = {
      sent: [entry, ...state.sent.filter((l) => l.handle !== candidate.handle)],
    };

    if (twinkle) {
      patch.twinkleDay = day;
      patch.twinklesUsed = state.twinkleDay === day ? state.twinklesUsed + 1 : 1;
    }

    const alreadyLikedYou = INCOMING_LIKES.some((l) => l.candidate.handle === candidate.handle);
    const match =
      alreadyLikedYou || MOCK_MATCH_HANDLES.has(candidate.handle) ? makeMatch(candidate) : null;

    if (match && !state.matches.some((m) => m.handle === match.handle)) {
      patch.matches = [match, ...state.matches];
    }

    set(patch);
    return match;
  },

  /** Answering an incoming like: yes always matches, since they went first. */
  answerLike(like: DatingLike, accept: boolean, note?: string): DatingMatch | null {
    const patch: Partial<DatingState> = {
      handledLikes: [...state.handledLikes, like.id],
    };

    if (!accept) {
      set(patch);
      return null;
    }

    const trimmed = note?.trim();
    const match = makeMatch(like.candidate);
    patch.sent = [
      {
        handle: like.candidate.handle,
        target: like.target,
        at: new Date().toISOString(),
        ...(trimmed ? { note: trimmed } : {}),
      },
      ...state.sent.filter((l) => l.handle !== like.candidate.handle),
    ];
    if (!state.matches.some((m) => m.handle === match.handle)) {
      patch.matches = [match, ...state.matches];
    }

    set(patch);
    return match;
  },

  /** The first message. Stored on the match so the list can show it's alive. */
  sayHi(handle: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    set({
      matches: state.matches.map((m) => (m.handle === handle ? { ...m, opener: trimmed } : m)),
    });
  },

  unmatch(handle: string) {
    set({ matches: state.matches.filter((m) => m.handle !== handle) });
  },

  saveProfile(profile: MyDatingProfile) {
    set({ profile });
  },

  /** Deals the passes back in. Anyone already liked stays out — bringing them
   * back would let you like the same person twice. */
  resetDeck() {
    set({ passed: [] });
  },
};

export { DAILY_TWINKLES };
