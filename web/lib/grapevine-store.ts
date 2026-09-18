"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AnonIdentity, AnonPost } from "./types";

/* -----------------------------------------------------------------------------
   Client state for the anonymous feed. Everything here is a thin wrapper over
   /v1/grapevine/* — the server owns the number, the posts, and which ones are
   still alive. This only keeps what a screen needs between renders.
   -------------------------------------------------------------------------- */

export type GrapevineSort = "hot" | "new";

/** Your current anon number, and the one action that changes it. */
export function useGrapevineIdentity() {
  const [identity, setIdentity] = useState<AnonIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIdentity(await api.get<AnonIdentity>("/v1/grapevine/me"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    const next = await api.post<AnonIdentity>("/v1/grapevine/flush");
    setIdentity(next);
    return next;
  }, []);

  return { identity, loading, flush };
}

export function useGrapevineFeed(sort: GrapevineSort) {
  const [items, setItems] = useState<AnonPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: AnonPost[] }>("/v1/grapevine/feed", { sort, limit: 50 });
      setItems(res.items ?? []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Drops an expired or deleted post locally, without waiting for the next
   * poll — the same "advance before the network confirms" pattern the dating
   * deck uses. */
  const remove = useCallback((postId: string) => {
    setItems((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const prepend = useCallback((post: AnonPost) => {
    setItems((prev) => [post, ...prev]);
  }, []);

  return { items, loading, error, reload: load, remove, prepend, setItems };
}

export const grapevine = {
  createPost(body: string) {
    return api.post<{ post: AnonPost; supportCard?: unknown }>("/v1/grapevine/posts", { body });
  },
  vote(postId: string, value: number) {
    return api.post<{ score: number; viewerVote: number }>(`/v1/grapevine/posts/${postId}/vote`, { value });
  },
  deletePost(postId: string) {
    return api.delete<void>(`/v1/grapevine/posts/${postId}`);
  },
};
