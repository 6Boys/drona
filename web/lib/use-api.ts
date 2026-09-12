"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

type Query = Record<string, string | number | boolean | undefined>;

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
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

  const run = useCallback(async () => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<T>(path, JSON.parse(queryKey));
      if (alive.current) {
        setData(res);
        setError(null);
      }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "request failed");
    } finally {
      if (alive.current) setLoading(false);
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
