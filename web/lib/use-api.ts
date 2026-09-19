"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

type Query = Record<string, string | number | boolean | undefined>;

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** `{ silent: true }` re-fetches without flipping `loading` — for a
   * background poll that shouldn't blank the list with a skeleton every
   * cycle, as opposed to a user-initiated retry. */
  refetch: (opts?: { silent?: boolean }) => Promise<void>;
  /** Local write for optimistic updates — vote counts, sticker toggles, a
   * message appended before the socket echoes it back. */
  set: (updater: T | ((prev: T | null) => T | null)) => void;
}

/** Fetches one GET endpoint while `enabled`. Each caller gets its own loading
 * and error state so a single failing surface never blanks a whole page. */
export function useApi<T>(path: string | null, query?: Query, enabled = true): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled && !!path);
  const [error, setError] = useState<string | null>(null);

  // Serialised so a fresh object literal on every render doesn't re-fire.
  const queryKey = JSON.stringify(query ?? {});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async (opts?: { silent?: boolean }) => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const res = await api.get<T>(path, JSON.parse(queryKey));
      if (alive.current) {
        setData(res);
        setError(null);
      }
    } catch (err) {
      if (alive.current && !opts?.silent) setError(err instanceof Error ? err.message : "request failed");
    } finally {
      if (alive.current && !opts?.silent) setLoading(false);
    }
  }, [path, queryKey, enabled]);

  useEffect(() => {
    run();
  }, [run]);

  const set = useCallback((updater: T | ((prev: T | null) => T | null)) => {
    setData((prev) => (typeof updater === "function" ? (updater as (p: T | null) => T | null)(prev) : updater));
  }, []);

  return { data, loading, error, refetch: run, set };
}

/** Backstops `useLive`: the push channel is what a WS-capable server uses to
 * say "refetch, something changed," but Vercel's serverless functions can't
 * hold that socket open at all, so a deployment running there would
 * otherwise never see a live update. Polling silently underneath the socket
 * costs one redundant request per interval when the socket does work, and
 * is the only thing that keeps the inbox/notification badge current when
 * it doesn't. */
export function usePoll(fn: () => void, enabled: boolean, intervalMs = 20_000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}
