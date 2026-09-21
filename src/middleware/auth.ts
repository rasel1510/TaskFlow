/**
 * src/middleware/auth.ts
 *
 * Authentication middleware logic:
 * - Reads NextAuth session-token cookies (all known variants)
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
 * Checks all four known cookie names (standard + __Secure- prefix variants).
 */
export function getSessionToken(request: NextRequest): string | undefined {
  return (
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value
  );
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
 * 1. Unauthenticated user on a protected route → redirect to /auth/login
 *    (preserves callbackUrl so the user lands back after sign-in)
 * 2. Authenticated user on an auth route (/auth/login, /auth/signup) → redirect to /
 * 3. All other cases → return null (allow Next.js to continue)
 */
export function applyAuthMiddleware(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const sessionToken = getSessionToken(request);
  const onAuthRoute = isAuthRoute(pathname);

  // Rule 1: unauthenticated access to a protected route
  if (!sessionToken && !onAuthRoute) {
    const loginUrl = new URL('/auth/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Rule 2: authenticated user hitting the auth pages
  if (sessionToken && onAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Rule 3: no action needed
  return null;
}
