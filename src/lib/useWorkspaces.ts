'use client';

/**
 * Client access to the person's workspaces (Personal + companies) and the open one.
 * One shared fetch for every component on the page; switching re-syncs the session and reloads
 * the app so every view shows the newly opened workspace.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export interface WorkspaceInfo {
  id: string;
  name: string;
  kind: 'company' | 'personal';
  role: string;
  state: 'company' | 'trial' | 'free' | 'expired';
  trialEndsAt: string | null;
  daysLeft: number | null;
  freeAccess: string;
  writable: boolean;
}

interface Snapshot {
  active: string | null;
  workspaces: WorkspaceInfo[];
}

let cache: Snapshot | null = null;
let inflight: Promise<Snapshot | null> | null = null;
const listeners = new Set<(s: Snapshot | null) => void>();

async function load(force = false): Promise<Snapshot | null> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = fetch('/api/workspaces', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      cache = j?.success ? (j.data as Snapshot) : null;
      listeners.forEach(l => l(cache));
      return cache;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useWorkspaces() {
  const { update } = useSession();
  const [snap, setSnap] = useState<Snapshot | null>(cache);

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    listeners.add(setSnap);
    load().then(s => {
      setSnap(s);
      // A failed first load (e.g. a slow cold start) is retried once
      if (!s) retry = setTimeout(() => load(true), 1500);
    });
    return () => {
      listeners.delete(setSnap);
      if (retry) clearTimeout(retry);
    };
  }, []);

  const current = snap?.workspaces.find(w => w.id === snap.active) ?? null;

  const reload = useCallback(() => load(true), []);

  /** Opens a workspace ('personal' or a company id), then reloads into it (optionally at `goTo`). */
  const switchTo = useCallback(
    async (id: string, goTo = '/app') => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'Couldn’t switch workspace.');
      try {
        await update({ refreshWorkspace: true });
      } catch {
        /* the session re-syncs on the next request anyway */
      }
      cache = null;
      window.location.assign(goTo);
    },
    [update]
  );

  return { active: snap?.active ?? null, workspaces: snap?.workspaces ?? [], current, loaded: snap !== null, reload, switchTo };
}
