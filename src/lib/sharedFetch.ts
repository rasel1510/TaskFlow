/**
 * src/lib/sharedFetch.ts
 *
 * Tiny client-side request de-duplicator. Several components (Header, Sidebar, Dashboard, the app
 * shell) need the same small JSON (the signed-in user's profile, billing status) on every page load.
 * They now share one in-flight request instead of each firing their own.
 *
 * Responses are reused for a few seconds only; call `invalidateShared(prefix)` after a write.
 */

export interface SharedResponse<T = unknown> {
  ok: boolean;
  status: number;
  json: T | null;
}

const store = new Map<string, { at: number; promise: Promise<SharedResponse> }>();

export function sharedFetchJson<T = unknown>(url: string, maxAgeMs = 10_000): Promise<SharedResponse<T>> {
  const hit = store.get(url);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.promise as Promise<SharedResponse<T>>;

  const promise: Promise<SharedResponse> = fetch(url, { cache: 'no-store' }).then(async res => ({
    ok: res.ok,
    status: res.status,
    json: await res.json().catch(() => null),
  }));
  // Never cache failures — let the next caller retry
  promise.then(r => !r.ok && store.delete(url), () => store.delete(url));

  store.set(url, { at: Date.now(), promise });
  return promise as Promise<SharedResponse<T>>;
}

/** Drop cached responses whose URL starts with `prefix` (e.g. after saving the profile). */
export function invalidateShared(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
