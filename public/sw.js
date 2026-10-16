/**
 * FlowSync Service Worker — Stale-While-Revalidate + Network-First Strategy
 *
 * Caching strategy:
 * - App Shell (HTML, JS, CSS): Cache-first with background update
 * - API routes (/api/*): Network-first, stale fallback
 * - Static assets (_next/static/*): Immutable cache (hashed filenames)
 * - Images/fonts: Stale-while-revalidate (30 days)
 *
 * Offline: Serves cached pages gracefully, queues write requests for retry.
 */

const CACHE_NAME = 'flowsync-v9';
const STATIC_CACHE = 'flowsync-static-v9';
const API_CACHE = 'flowsync-api-v9';

// Assets to precache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// ── Install: precache app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed for some URLs:', err);
      });
    })
  );
});



// ── Activate: remove stale caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const VALID_CACHES = new Set([CACHE_NAME, STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !VALID_CACHES.has(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, browser-extension, and Next.js HMR requests
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.pathname.startsWith('/api/auth') // Never cache NextAuth sessions
  ) {
    return;
  }

  // 0. Navigation requests (HTML pages) — ALWAYS Network-First, offline fallback only
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 1. Immutable Next.js static assets (_next/static/) — Cache Forever
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // 2. API routes — Network-first, fallback to cache (read-only endpoints)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(API_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Static assets & images — Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// ── Background Sync: retry failed mutations ───────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'task-mutations') {
    event.waitUntil(replayMutations());
  }
});

async function replayMutations() {
  // Placeholder — mutations stored in IndexedDB would be replayed here
  // Left as no-op until offline write queue is implemented
  return Promise.resolve();
}

// ── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'FlowSync', body: event.data.text() };
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'FlowSync', options)
  );
});

// ── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});










