"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type {
  DatingLike,
  DatingMatch,
  DatingProfile,
  DeckResponse,
  SwipeAction,
  LikeTarget,
  SwipeResult,
} from "./types";

/* -----------------------------------------------------------------------------
   Love Finder's client state.

   Everything here is a thin wrapper over /v1/dating/* — the deck, the swipes,
   the likes and the matches are rows in Postgres (see api/internal/store/
   dating.go), not browser state. What this file keeps locally is only what a
   screen needs between renders: the cards already fetched, and how many
   SuperLikes and swipes the server last said were left.

   The one rule worth stating: nothing here decides anything. Whether a swipe
   is allowed, whether it matched, and how many SuperLikes remain are all the
   server's answers, echoed back into React state — clearing local storage
   cannot buy a second SuperLike or undo a pass.
   -------------------------------------------------------------------------- */

/** How the deck, likes and matches tabs load and reload themselves. */
export function useDeck() {
  const [items, setItems] = useState<DeckResponse["items"]>([]);
  const [superlikesLeft, setSuperlikesLeft] = useState(0);
  const [swipesLeft, setSwipesLeft] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const deck = await api.get<DeckResponse>("/v1/dating/deck", { limit: 20 });
      if (!alive.current) return;
      setItems(deck.items ?? []);
      setSuperlikesLeft(deck.superlikesLeft);
      setSwipesLeft(deck.swipesLeft);
    } catch (err) {
      if (alive.current) setError(err);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Drops the top card locally so the next one is ready before the network
   * settles — the swipe itself is still the server's call. */
  const advance = useCallback((handle: string) => {
    setItems((prev) => prev.filter((c) => c.handle !== handle));
  }, []);

  return { items, superlikesLeft, setSuperlikesLeft, swipesLeft, setSwipesLeft, loading, error, reload: load, advance };
}

// try/finally with no catch was the shape here: the rejection escaped as an
// unhandled promise rejection, and because `loading` still flipped to false the
// screen settled into an empty list (or, for the card, a skeleton that never
// resolves) with no error and no way to retry. Each of these now records the
// failure so the caller can say so and offer a reload.
export function useLikes() {
  const [items, setItems] = useState<DatingLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: DatingLike[] }>("/v1/dating/likes", { limit: 30 });
      setItems(res.items ?? []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}

export function useMatches() {
  const [items, setItems] = useState<DatingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: DatingMatch[] }>("/v1/dating/matches");
      setItems(res.items ?? []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}

export function useDatingProfile() {
  const [profile, setProfile] = useState<DatingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.get<DatingProfile>("/v1/dating/profile");
      setProfile(p);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, setProfile, loading, error, reload: load };
}

/* ----------------------------------------------------------------- actions -- */

export const dating = {
  /** One decision on one person. Returns whatever the server made of it. */
  swipe(handle: string, action: SwipeAction, target?: LikeTarget, note?: string) {
    return api.post<SwipeResult>("/v1/dating/swipe", {
      handle,
      action,
      ...(target ? { target } : {}),
      ...(note?.trim() ? { note: note.trim() } : {}),
    });
  },

  saveProfile(profile: DatingProfile) {
    return api.put<DatingProfile>("/v1/dating/profile", profile);
  },

  buySuperlikes(quantity: number) {
    return api.post<{ superlikesLeft: number; quantity: number; chargedInr: number }>("/v1/dating/superlikes/buy", { quantity });
  },

  unmatch(handle: string) {
    return api.delete<void>(`/v1/dating/matches/${encodeURIComponent(handle)}`);
  },

  /** The first message in a match's Nest thread — an ordinary chat send, so
   * the conversation lives in Chats like any other from that moment on. */
  sayHi(threadId: string, body: string) {
    return api.post(`/v1/threads/${encodeURIComponent(threadId)}/messages`, { body: body.trim() });
  },
};

/** Hours until a match wilts, or null once someone has spoken. */
export function hoursLeft(match: DatingMatch): number | null {
  if (!match.wiltsAt) return null;
  const ms = new Date(match.wiltsAt).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 3_600_000));
}
