import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api routes, and Next.js internals
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check for NextAuth session token cookies (standard + secure prefixes)
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  const isAuthRoute = pathname.startsWith('/auth');

  // If user is not logged in and trying to access protected route -> redirect to login
  if (!sessionToken && !isAuthRoute) {
    const loginUrl = new URL('/auth/login', request.url);
    // Keep callbackUrl so user can return to their target page after login
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If user is already logged in and tries to access login or signup -> redirect to app root
  if (sessionToken && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and API routes
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
