"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { AnonIdentity, AnonMood, AnonPost, AnonReaction, AnonReply, SupportCard } from "./types";

/* -----------------------------------------------------------------------------
   Client state for the anonymous feed. Everything here is a thin wrapper over
   /v1/afterhours/* — the server owns the number, the posts, and which ones are
   still alive. This only keeps what a screen needs between renders.
   -------------------------------------------------------------------------- */

export type AfterHoursSort = "hot" | "new";
export type MoodFilter = AnonMood | "all";

type FeedResponse = { items: AnonPost[]; liveCount: number };

const POLL_MS = 30_000;

const moodParam = (mood: MoodFilter) => (mood === "all" ? undefined : mood);

/** Your current anon number, and the one action that changes it. */
export function useAfterHoursIdentity() {
  const [identity, setIdentity] = useState<AnonIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIdentity(await api.get<AnonIdentity>("/v1/afterhours/me"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    const next = await api.post<AnonIdentity>("/v1/afterhours/flush");
    setIdentity(next);
    return next;
  }, []);

  return { identity, loading, flush };
}

export function useAfterHoursFeed(sort: AfterHoursSort, mood: MoodFilter = "all") {
  const [items, setItems] = useState<AnonPost[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  // The latest server view, held back rather than swapped in: replacing the
  // list mid-read would reshuffle Hot under someone's thumb. Shown as a
  // "new posts" pill instead, and applied when they tap it.
  const [pending, setPending] = useState<AnonPost[] | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Mood chips invite rapid tapping; only the most recent request may land,
  // or a slow "Crush" response could overwrite the "Rant" list asked for after.
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latestLoad.current;
    setLoading(true);
    setError(null);
    setPending(null);
    try {
      const res = await api.get<FeedResponse>("/v1/afterhours/feed", { sort, limit: 50, mood: moodParam(mood) });
      if (ticket !== latestLoad.current) return;
      setItems(res.items ?? []);
      setLiveCount(res.liveCount ?? 0);
    } catch (err) {
      if (ticket === latestLoad.current) setError(err);
    } finally {
      if (ticket === latestLoad.current) setLoading(false);
    }
  }, [sort, mood]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await api.get<FeedResponse>("/v1/afterhours/feed", { sort, limit: 50, mood: moodParam(mood) });
        const latest = res.items ?? [];
        setLiveCount(res.liveCount ?? 0);
        const known = new Set(itemsRef.current.map((p) => p.id));
        if (latest.some((p) => !known.has(p.id))) setPending(latest);
      } catch {
        // A missed background poll is not worth a toast; the next one retries.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [sort, mood]);

  const newCount = pending ? pending.filter((p) => !items.some((i) => i.id === p.id)).length : 0;

  // The arrivals go first regardless of sort: on Hot a brand-new post has no
  // votes and would rank near the bottom, so the pill would scroll you to the
  // top of a list whose "new post" is out of sight. They settle into rank on
  // the next load.
  const showPending = useCallback(() => {
    if (pending) {
      const known = new Set(items.map((p) => p.id));
      const arrived = pending.filter((p) => !known.has(p.id));
      setItems([...arrived, ...pending.filter((p) => known.has(p.id))]);
    }
    setPending(null);
  }, [pending, items]);

  /** Drops an expired, deleted or reported post locally, without waiting for
   * the next poll — the same "advance before the network confirms" pattern
   * the dating deck uses. */
  const remove = useCallback((postId: string) => {
    setItems((prev) => prev.filter((p) => p.id !== postId));
    setPending((prev) => prev && prev.filter((p) => p.id !== postId));
  }, []);

  const prepend = useCallback((post: AnonPost) => {
    setItems((prev) => [post, ...prev]);
    setLiveCount((n) => n + 1);
  }, []);

  return { items, loading, error, reload: load, remove, prepend, setItems, newCount, showPending, liveCount };
}

export const afterhours = {
  createPost(body: string, mood: AnonMood) {
    return api.post<{ post: AnonPost; supportCard?: SupportCard }>("/v1/afterhours/posts", { body, mood });
  },
  react(postId: string, reaction: AnonReaction | null) {
    return api.post<{ reactions: AnonPost["reactions"]; viewerReaction: AnonReaction | null }>(
      `/v1/afterhours/posts/${postId}/react`,
      { reaction },
    );
  },
  deletePost(postId: string) {
    return api.delete<void>(`/v1/afterhours/posts/${postId}`);
  },
  replies(postId: string) {
    return api.get<{ items: AnonReply[] }>(`/v1/afterhours/posts/${postId}/replies`);
  },
  reply(postId: string, body: string) {
    return api.post<{ reply: AnonReply; supportCard?: SupportCard }>(`/v1/afterhours/posts/${postId}/replies`, { body });
  },
  deleteReply(replyId: string) {
    return api.delete<void>(`/v1/afterhours/replies/${replyId}`);
  },
  report(targetType: "AFTERHOURS_POST" | "AFTERHOURS_REPLY", targetId: string, reason: string) {
    return api.post("/v1/reports", { targetType, targetId, reason });
  },
};
