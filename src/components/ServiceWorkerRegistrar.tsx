'use client';

/**
 * ServiceWorkerRegistrar
 *
 * Registers /sw.js after the page has fully hydrated on the client side.
 * Shows a subtle banner when a new version of the app is available.
 * Renders nothing visible — pure side-effect component.
 */

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegistrar() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let mounted = true;

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // Always check for updates
        });

        if (!mounted) return;
        setRegistration(reg);

        // Check for waiting SW (new version available)
        if (reg.waiting) {
          setUpdateAvailable(true);
        }

        // Detect newly installed waiting worker
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW is ready but the old one is still controlling the page
              if (mounted) setUpdateAvailable(true);
            }
          });
        });

        // Trigger update check on every page visit
        reg.update().catch(() => {});

      } catch (err) {
        // SW registration failed — non-fatal, app continues to work normally
        console.warn('[SW] Registration failed:', err);
      }
    };

    // Register after initial render to not block LCP
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Tell the waiting service worker to skip waiting and take control
  const handleUpdate = () => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Reload after the new SW takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });
    setUpdateAvailable(false);
  };

  if (!updateAvailable) return null;

  // Subtle update banner — non-blocking, dismissible
  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-[#111111] text-white text-[13px] font-medium px-4 py-3 rounded-2xl shadow-2xl shadow-black/30 border border-white/10 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300"
    >
      <span className="text-base">🔄</span>
      <span>A new version of FlowSync is available!</span>
      <button
        onClick={handleUpdate}
        className="ml-1 px-3 py-1.5 text-[12px] font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg transition-colors cursor-pointer shrink-0"
      >
        Update Now
      </button>
      <button
        onClick={() => setUpdateAvailable(false)}
        aria-label="Dismiss update banner"
        className="w-6 h-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
