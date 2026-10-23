import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import AuthProvider from '@/components/providers/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563EB' },
    { media: '(prefers-color-scheme: dark)', color: '#1D4ED8' },
  ],
};

export const metadata: Metadata = {
  title: 'FlowSync — Modern Project & Task Management',
  description:
    'Organize tasks, track projects, and ship faster — your all-in-one SaaS workspace for individuals and teams.',
  keywords: ['task management', 'project management', 'productivity', 'kanban', 'timeline'],
  applicationName: 'FlowSync',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FlowSync',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'FlowSync — Modern Project & Task Management',
    description: 'Organize tasks, track projects, and ship faster.',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.png" />
        <link rel="apple-touch-icon" sizes="128x128" href="/icons/icon-128.png" />
        {/* Microsoft Tile */}
        <meta name="msapplication-TileImage" content="/icons/icon-144.png" />
        <meta name="msapplication-TileColor" content="#2563EB" />
        {/* PWA capable flags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased bg-white text-[#111111] selection:bg-blue-50 selection:text-[#2563EB]">

        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>

        {/*
          Global Error Event Guard — catches unhandled promise rejections that reject with DOM Event objects
          or stale chunk loading failures (e.g., across deployments or cache mismatches) and recovers smoothly.
        */}
        <Script
          id="error-guard"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('unhandledrejection', function(event) {
                  if (event && (event.reason instanceof Event || (typeof event.reason === 'object' && event.reason !== null && !(event.reason instanceof Error)))) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                  }
                });
                window.addEventListener('error', function(event) {
                  var msg = (event && event.message) ? event.message : '';
                  if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1 || msg.indexOf('Cannot find module') !== -1) {
                    var lastReload = sessionStorage.getItem('tf_chunk_reload');
                    var now = Date.now();
                    if (!lastReload || now - Number(lastReload) > 10000) {
                      sessionStorage.setItem('tf_chunk_reload', String(now));
                      window.location.reload();
                    }
                  }
                });
              }
            `,
          }}
        />

        {/*
          PWA Prompt Capture — captures beforeinstallprompt globally as early as possible so no component
          misses it, and notifies all PWA components across the application.
        */}
        <Script
          id="pwa-prompt-capture"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.deferredPWAInstallPrompt = null;
                window.addEventListener('beforeinstallprompt', function(e) {
                  e.preventDefault();
                  window.deferredPWAInstallPrompt = e;
                  window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
                });
                window.addEventListener('appinstalled', function() {
                  window.deferredPWAInstallPrompt = null;
                  window.dispatchEvent(new CustomEvent('pwa-installed'));
                });
              }
            `,
          }}
        />

        {/*
          Service Worker management:
          - Development: Immediately unregister any lingering service workers and purge all
            CacheStorage caches so developers never need Ctrl+Shift+R or get served stale chunks.
          - Production: Register /sw.js for PWA caching & offline support.
        */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                var isDev = window.location.hostname === 'localhost' ||
                            window.location.hostname === '127.0.0.1' ||
                            window.location.hostname.endsWith('.local') ||
                            Boolean(window.location.port);

                if (isDev) {
                  // In development mode, kill any registered service worker and wipe CacheStorage
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (var i = 0; i < registrations.length; i++) {
                      registrations[i].unregister();
                    }
                  });
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      for (var i = 0; i < names.length; i++) {
                        caches.delete(names[i]);
                      }
                    });
                  }
                } else {
                  // In production, register the service worker after load
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                      .then(function(reg) {
                        reg.update().catch(function() {});
                        reg.addEventListener('updatefound', function() {
                          var newWorker = reg.installing;
                          if (!newWorker) return;
                          newWorker.addEventListener('statechange', function() {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                              window.dispatchEvent(new CustomEvent('sw-update-available', { detail: reg }));
                            }
                          });
                        });
                      })
                      .catch(function(err) {
                        console.warn('[SW] Registration failed:', err);
                      });
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
