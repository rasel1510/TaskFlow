import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-neon',
    '@neondatabase/serverless',
    'ws',
  ],
  webpack: (config, { dev }) => {
    if (dev) {
      // Use in-memory cache in development to eliminate Windows filesystem locking & PackFileCacheStrategy ENOENT rename collisions
      config.cache = {
        type: 'memory',
      };
    }
    return config;
  },
  // Browsers request /favicon.ico automatically; serve the app icon instead of a 404
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon.svg' }];
  },
  async headers() {
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            },
            {
              key: 'Pragma',
              value: 'no-cache',
            },
            {
              key: 'Expires',
              value: '0',
            },
          ],
        },
      ];
    }
    return [
      {
        // Baseline browser security headers for every page and API response
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // `payment` is left allowed so Stripe's embedded checkout can offer Apple Pay / Google Pay
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Always HTTPS (the site is only served over HTTPS)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // No framing, no plugins, no <base> hijacking (scripts/styles are left unrestricted on purpose)
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
