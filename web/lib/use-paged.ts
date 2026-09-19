"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";
import type { Page } from "./types";

type Query = Record<string, string | number | boolean | undefined>;

export interface Paged<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  reload: () => void;
  setItems: (updater: T[] | ((prev: T[]) => T[])) => void;
}

/** Cursor pagination against any endpoint that returns `Page<T>`. The API uses
 * keyset cursors, never offsets, so appending is always safe even while the
 * list is being written to underneath us. */
export function usePaged<T>(path: string, query?: Query, enabled = true): Paged<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = JSON.stringify(query ?? {});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const fetchPage = useCallback(
    async (after?: string) => {
      if (!enabled) {
        setLoading(false);
        return;
      }
      if (after) setLoadingMore(true);
      else setLoading(true);

      try {
        const page = await api.get<Page<T>>(path, { ...JSON.parse(queryKey), cursor: after });
        if (!alive.current) return;
        setItems((prev) => (after ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setError(null);
      } catch (err) {
        if (alive.current) setError(errorMessage(err, "could not load that"));
      } finally {
        if (alive.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [path, queryKey, enabled],
  );

  // A changed path or filter is a different list: drop what's on screen rather
  // than appending the new query's first page onto the old one's results.
  useEffect(() => {
    setItems([]);
    setCursor(undefined);
    setHasMore(false);
    fetchPage();
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (cursor && !loadingMore) fetchPage(cursor);
  }, [cursor, loadingMore, fetchPage]);

  const reload = useCallback(() => fetchPage(), [fetchPage]);

  return { items, loading, loadingMore, hasMore, error, loadMore, reload, setItems };
}
