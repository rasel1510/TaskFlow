/**
 * src/middleware/index.ts
 *
 * Middleware orchestrator — chains all middleware handlers in order.
 *
 * Each handler follows the convention:
 *   (request: NextRequest) => NextResponse | null
 *
 * The chain short-circuits on the first non-null return value, ensuring
 * that only one redirect/response is ever issued per request.
 *
 * To add new middleware (e.g. RBAC, rate-limiting, i18n redirects), simply:
 *   1. Create a new file in src/middleware/
 *   2. Export a handler function matching the signature above
 *   3. Add it to the `middlewareChain` array below
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyAuthMiddleware } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A middleware handler that either responds or passes control to the next handler. */
type MiddlewareHandler = (request: NextRequest) => NextResponse | null;

// ---------------------------------------------------------------------------
// Middleware chain — order matters
// ---------------------------------------------------------------------------
const middlewareChain: MiddlewareHandler[] = [
  applyAuthMiddleware,
  // Add future handlers here, e.g.:
  // applyRateLimitMiddleware,
  // applyI18nRedirectMiddleware,
];

// ---------------------------------------------------------------------------
// Exported orchestrator
// ---------------------------------------------------------------------------

/**
 * Runs all middleware handlers in sequence.
 * Returns the first non-null response, or NextResponse.next() if all pass.
 */
export function runMiddleware(request: NextRequest): NextResponse {
  for (const handler of middlewareChain) {
    const response = handler(request);
    if (response !== null) {
      return response;
    }
  }
  return NextResponse.next();
}
