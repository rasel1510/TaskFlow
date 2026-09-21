/**
 * src/middleware.ts  — Next.js Middleware Entry Point
 *
 * This file is the single entry point required by Next.js.
 * All middleware logic is delegated to the modular `src/middleware/` directory:
 *
 *   src/middleware/
 *   ├── index.ts    — orchestrator: chains all handlers in order
 *   └── auth.ts     — session-token checks & auth/protected-route redirects
 *
 * To add new middleware, create a handler in src/middleware/ and register
 * it in src/middleware/index.ts — no changes needed here.
 */

import type { NextRequest } from 'next/server';
import { runMiddleware } from './middleware/index';

export function middleware(request: NextRequest) {
  return runMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api          (API routes — handled server-side)
     * - _next/static (Next.js static file chunks)
     * - _next/image  (Next.js image optimisation)
     * - favicon.ico and any file with an extension (.png, .jpg, .svg, .js …)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
