'use client';

/**
 * src/lib/liveSync.ts — live updates without the Refresh button.
 *
 * One shared engine per page asks the server "what changed?" (GET /api/sync — a few bytes of
 * fingerprints per area) and tells only the affected screens to refresh, quietly:
 *
 *   live:tasks          tasks created, edited, moved or deleted
 *   live:projects       projects or project membership changed
 *   live:comments       comments or activity on tasks
 *   live:notifications  new or read notifications (also fires 'notifications-updated')
 *   live:team           people, roles, invitations or join requests changed
 *   live:messages       project chat messages sent, edited, reacted to or deleted
 *
 * Cost-aware scheduling (no wasted requests):
 *   - every 5 s while the tab is visible and the person was active in the last 2 minutes
 *   - every 30 s while visible but idle; paused completely in background tabs
 *   - an immediate check when the tab regains focus or the network comes back
 *   - exponential back-off (up to 60 s) while the server can't be reached
 *   - on mobile data, slow networks or with Data Saver on: every 15 s active / 60 s idle, so the
 *     phone's radio can sleep between checks (where the browser reports the connection type)
 */

import { useEffect, useRef } from 'react';

export type LiveTopic = 'tasks' | 'projects' | 'comments' | 'notifications' | 'team' | 'messages';
const TOPICS: LiveTopic[] = ['tasks', 'projects', 'comments', 'notifications', 'team', 'messages'];

const ACTIVE_MS = 5_000;
const IDLE_MS = 30_000;
const IDLE_AFTER_MS = 120_000;
const MAX_BACKOFF_MS = 60_000;
const METERED_ACTIVE_MS = 15_000;
const METERED_IDLE_MS = 60_000;

type NetInfo = { saveData?: boolean; type?: string; effectiveType?: string };

/** True on cellular data, slow connections or with Data Saver on (Chromium browsers report this). */
function isMeteredConnection(): boolean {
  const c = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (!c) return false;
  return Boolean(c.saveData) || c.type === 'cellular' || ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? '');
}

let started = false;
let subscribers = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;
let lastActivity = Date.now();
let failures = 0;
let last: { workspace: string | null; v: Record<LiveTopic, string> } | null = null;

function emit(topic: LiveTopic) {
  window.dispatchEvent(new CustomEvent(`live:${topic}`));
  // Existing listeners (Header) already reload notifications on this event
  if (topic === 'notifications') window.dispatchEvent(new CustomEvent('notifications-updated'));
}

function nextDelay(): number {
  if (failures > 0) return Math.min(MAX_BACKOFF_MS, ACTIVE_MS * 2 ** failures);
  const active = Date.now() - lastActivity < IDLE_AFTER_MS;
  if (isMeteredConnection()) return active ? METERED_ACTIVE_MS : METERED_IDLE_MS;
  return active ? ACTIVE_MS : IDLE_MS;
}

function schedule(delay = nextDelay()) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!started || document.visibilityState !== 'visible') return; // paused while hidden
  timer = setTimeout(check, delay);
}

async function check() {
  if (!started || inflight || document.visibilityState !== 'visible') return;
  inflight = true;
  try {
    const res = await fetch('/api/sync', { cache: 'no-store', credentials: 'same-origin' });
    if (res.status === 401) {
      // Signed out — stop quietly
      stop();
      return;
    }
    const json = res.ok ? await res.json() : null;
    if (!json?.success) throw new Error('sync failed');
    const next = json.data as { workspace: string | null; v: Record<LiveTopic, string> };
    // A different workspace means a fresh page is coming; just take a new baseline
    if (last && last.workspace === next.workspace) {
      for (const topic of TOPICS) if (last.v[topic] !== next.v[topic]) emit(topic);
    }
    last = next;
    failures = 0;
  } catch {
    failures = Math.min(failures + 1, 6);
  } finally {
    inflight = false;
    schedule();
  }
}

const onActivity = () => {
  const wasIdle = Date.now() - lastActivity >= IDLE_AFTER_MS;
  lastActivity = Date.now();
  if (wasIdle) schedule(0); // coming back from idle → check right away
};
const onVisible = () => {
  if (document.visibilityState === 'visible') {
    lastActivity = Date.now();
    schedule(300);
  } else if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};
const onOnline = () => {
  failures = 0;
  schedule(300);
};

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('pointerdown', onActivity, { passive: true });
  window.addEventListener('keydown', onActivity);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  schedule(1_000);
}

function stop() {
  started = false;
  if (timer) clearTimeout(timer);
  timer = null;
  window.removeEventListener('pointerdown', onActivity);
  window.removeEventListener('keydown', onActivity);
  window.removeEventListener('focus', onVisible);
  window.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisible);
}

/** Mount once in the app shell: runs the shared engine while the app is open. */
export function useLiveSyncEngine() {
  useEffect(() => {
    subscribers++;
    start();
    return () => {
      subscribers--;
      if (subscribers <= 0) {
        stop();
        last = null;
      }
    };
  }, []);
}

/**
 * Calls `onChange` (a quiet, spinner-free reload) whenever one of `topics` changes elsewhere.
 * Bursts are coalesced into a single call.
 */
export function useLiveRefresh(topics: LiveTopic[], onChange: () => void) {
  const handler = useRef(onChange);
  handler.current = onChange;
  const key = topics.join(',');

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        handler.current();
      }, 150);
    };
    const names = key.split(',').map(t => `live:${t}`);
    names.forEach(n => window.addEventListener(n, fire));
    return () => {
      names.forEach(n => window.removeEventListener(n, fire));
      if (pending) clearTimeout(pending);
    };
  }, [key]);
}
