'use client';

/**
 * src/lib/suite/useSuite.ts — the Software Company suite context in the browser.
 *
 * One request per page (shared by every component), refreshed quietly by live updates and when
 * an Admin switches the suite on/off or a department changes.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLiveRefresh } from '@/lib/liveSync';
import type { Department, SuiteModule } from '@/lib/suite/departments';

export interface SuiteMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  department: Department;
  departmentSet: boolean;
  jobTitle: string;
}

export interface SuiteContextData {
  enabled: boolean;
  canEnable: boolean;
  teamId?: string;
  teamName?: string;
  me?: { id: string; role: string; department: Department; jobTitle: string; isAdmin: boolean; isManager: boolean };
  modules?: SuiteModule[];
  insights?: { overview: boolean; engineering: boolean; sales: boolean; marketing: boolean; customers: boolean };
  settings?: Record<string, boolean>;
  projects?: { id: string; name: string; color: string }[];
  members?: SuiteMember[];
}

let cache: SuiteContextData | null = null;
let inflight: Promise<SuiteContextData | null> | null = null;
const listeners = new Set<(d: SuiteContextData | null) => void>();

async function load(force = false): Promise<SuiteContextData | null> {
  if (!force && cache) return cache;
  if (inflight) return inflight;
  inflight = fetch('/api/suite/context', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      cache = j?.success ? (j.data as SuiteContextData) : { enabled: false, canEnable: false };
      listeners.forEach(fn => fn(cache));
      return cache;
    })
    .catch(() => cache)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Ask every component using the suite to reload it (after switching it on, changing a department …). */
export function refreshSuite() {
  void load(true);
}

export function useSuite() {
  const [data, setData] = useState<SuiteContextData | null>(cache);

  useEffect(() => {
    listeners.add(setData);
    void load();
    const onChange = () => void load(true);
    window.addEventListener('suite-context-changed', onChange);
    window.addEventListener('workspace-switched', onChange);
    return () => {
      listeners.delete(setData);
      window.removeEventListener('suite-context-changed', onChange);
      window.removeEventListener('workspace-switched', onChange);
    };
  }, []);

  useLiveRefresh(['team'], () => void load(true));

  const memberName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return '';
      return data?.members?.find(m => m.id === id)?.name || 'Former member';
    },
    [data]
  );

  return { suite: data, loading: data === null, memberName };
}
