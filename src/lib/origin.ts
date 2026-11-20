import { NextRequest } from 'next/server';

/**
 * Resolves the canonical base URL (origin) for invitation and verification links.
 *
 * Priority Order:
 * 1. Explicit `APP_URL` or `NEXT_PUBLIC_APP_URL` in environment variables
 * 2. Vercel deployment URL (`process.env.VERCEL_URL`)
 * 3. Reverse proxy / Tunnel forwarded headers (`x-forwarded-host`, `x-forwarded-proto`)
 * 4. Request `host` header + protocol (e.g., LAN IP http://192.168.1.X:3000 or custom port)
 * 5. Request `origin` header
 * 6. `req.nextUrl.origin`
 * 7. `process.env.NEXTAUTH_URL`
 * 8. Fallback to `http://localhost:3000`
 */
export function getAppOrigin(req?: NextRequest): string {
  // 1. Explicitly configured APP_URL or NEXT_PUBLIC_APP_URL
  const envAppUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envAppUrl && envAppUrl.trim()) {
    return envAppUrl.trim().replace(/\/+$/, '');
  }

  // 2a. Vercel production: the stable production domain (e.g. flow-sync-ruby.vercel.app).
  // VERCEL_URL is the per-deployment URL, which changes on every deploy and can sit behind
  // Vercel's deployment protection — wrong for links in emails.
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/\/+$/, '')}`;
  }

  // 2b. Vercel preview URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/+$/, '')}`;
  }

  if (req) {
    // 3. Reverse proxy / Tunnel forwarded headers (e.g. ngrok, localtunnel, Cloudflare)
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    if (forwardedHost) {
      const primaryHost = forwardedHost.split(',')[0].trim();
      return `${forwardedProto}://${primaryHost}`.replace(/\/+$/, '');
    }

    // 4. Request host header (captures actual dev port or local IP address)
    const host = req.headers.get('host');
    if (host) {
      const isLocal =
        host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        host.startsWith('172.');
      const proto = req.headers.get('x-forwarded-proto') || (isLocal ? 'http' : 'https');
      return `${proto}://${host}`.replace(/\/+$/, '');
    }

    // 5. Origin or Next URL origin
    const origin = req.headers.get('origin') || req.nextUrl.origin;
    if (origin && origin !== 'null') {
      return origin.replace(/\/+$/, '');
    }
  }

  // 6. NextAuth URL
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.trim()) {
    return process.env.NEXTAUTH_URL.trim().replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}
