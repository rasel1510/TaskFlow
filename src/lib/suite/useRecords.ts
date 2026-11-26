'use client';

/**
 * src/lib/suite/useRecords.ts — load and change suite records from a screen.
 *
 *   const { items, loading, create, update, remove, loadMore, hasMore } = useRecords('deals', { stage: 'won' });
 *
 * Paged (cursor, 50 per page), optimistic edits with automatic rollback on error, and a quiet reload
 * when anyone in the company changes suite data (live updates).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveRefresh } from '@/lib/liveSync';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Rec = { id: string; [k: string]: any };

export class SuiteError extends Error {}

export async function suiteApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new SuiteError(json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || 'Something went wrong. Please try again.');
  }
  return json.data as T;
}

export function useRecords<T extends Rec = Rec>(entity: string, filters: Record<string, string | undefined> = {}, opts: { limit?: number; enabled?: boolean } = {}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const enabled = opts.enabled !== false;
  const limit = opts.limit ?? 50;

  const query = new URLSearchParams(
    Object.entries({ ...filters, limit: String(limit) }).filter((e): e is [string, string] => Boolean(e[1]))
  ).toString();
  const queryRef = useRef(query);
  queryRef.current = query;

  const fetchPage = useCallback(
    async (after: string | null) => {
      const res = await fetch(`/api/suite/${entity}?${queryRef.current}${after ? `&cursor=${after}` : ''}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new SuiteError(json?.error?.message || 'Could not load.');
      return json as { data: T[]; meta: { hasMore: boolean; nextCursor: string | null } };
    },
    [entity]
  );

  const reload = useCallback(
    async (quiet = false) => {
      if (!enabled) return;
      if (!quiet) setLoading(true);
      try {
        const page = await fetchPage(null);
        setItems(page.data);
        setHasMore(page.meta.hasMore);
        setCursor(page.meta.nextCursor);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [fetchPage, enabled]
  );

  useEffect(() => {
    void reload();
  }, [reload, query]);

  useLiveRefresh(['suite'], () => void reload(true));

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const page = await fetchPage(cursor);
    setItems(prev => [...prev, ...page.data]);
    setHasMore(page.meta.hasMore);
    setCursor(page.meta.nextCursor);
  }, [cursor, fetchPage]);

  const create = useCallback(
    async (data: Record<string, unknown>) => {
      const created = await suiteApi<T>(`/api/suite/${entity}`, { method: 'POST', body: JSON.stringify(data) });
      setItems(prev => [created, ...prev]);
      return created;
    },
    [entity]
  );

  const update = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      let before: T | undefined;
      setItems(prev =>
        prev.map(it => {
          if (it.id !== id) return it;
          before = it;
          return { ...it, ...data };
        })
      );
      try {
        const saved = await suiteApi<T>(`/api/suite/${entity}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
        setItems(prev => prev.map(it => (it.id === id ? saved : it)));
        return saved;
      } catch (e) {
        if (before) setItems(prev => prev.map(it => (it.id === id ? (before as T) : it)));
        throw e;
      }
    },
    [entity]
  );

  const remove = useCallback(
    async (id: string) => {
      let snapshot: T[] = [];
      setItems(prev => {
        snapshot = prev;
        return prev.filter(it => it.id !== id);
      });
      try {
        await suiteApi(`/api/suite/${entity}/${id}`, { method: 'DELETE' });
      } catch (e) {
        setItems(snapshot);
        throw e;
      }
    },
    [entity]
  );

  return { items, setItems, loading, error, hasMore, loadMore, reload, create, update, remove };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
