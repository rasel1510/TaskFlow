/**
 * src/middleware/auth.ts
 *
 * Authentication middleware logic:
 * - Reads NextAuth session-token cookies (all known variants & chunked cookies)
 * - Determines whether the current path is a protected or auth route
 * - Returns a redirect response when access rules are violated, or null to continue
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the NextAuth session token from the request cookies.
 * Checks all known cookie names (standard, secure, and chunked variants).
 */
export function getSessionToken(request: NextRequest): string | undefined {
  const cookieNames = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.session-token.0',
    '__Secure-authjs.session-token.0',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.session-token.0',
    '__Secure-next-auth.session-token.0',
  ];

  for (const name of cookieNames) {
    const val = request.cookies.get(name)?.value;
    if (val) return val;
  }

  return undefined;
}

/**
 * Returns true if the current pathname lives under the /auth/* tree.
 */
export function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith('/auth');
}

// ---------------------------------------------------------------------------
// Core auth middleware handler
// ---------------------------------------------------------------------------

/**
 * Enforces authentication rules for the incoming request.
 *
 * Rules:
 * 1. Authenticated user accessing root ('/') or auth routes (/auth/login, /auth/signup)
 *    → redirect immediately to '/app' workspace (seamless persistent login).
 * 2. Unauthenticated user on a protected route → redirect to '/' (home page).
 * 3. All other cases (e.g. '/landing', static assets) → return null.
 */
export function applyAuthMiddleware(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  const sessionToken = getSessionToken(request);
  const onAuthRoute = isAuthRoute(pathname);

  // Only the signed-in areas are protected. Everything else (home, landing, invite links, docs,
  // and unknown addresses — which should show the "Page not found" screen) stays public.
  const isProtectedRoute =
    pathname === '/app' ||
    pathname.startsWith('/app/') ||
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/');

  // Protected routes require authentication if no session token is present
  if (!sessionToken && !onAuthRoute && isProtectedRoute) {
    const loginUrl = new URL('/auth/login', request.url);
    const fullCallback = pathname + (search || '');
    loginUrl.searchParams.set('callbackUrl', fullCallback);
    return NextResponse.redirect(loginUrl);
  }

  // Allow all other requests to continue naturally
  return null;
}
