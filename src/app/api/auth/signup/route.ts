/**
 * src/app/api/auth/signup/route.ts  — Next.js App Router bridge
 *
 * This file serves as the HTTP entry point for /api/auth/signup.
 * All business logic lives in `src/api/auth/signup/route.ts`.
 *
 * Next.js requires named exports (POST, …) from this exact location.
 * We simply re-export them from the canonical API module.
 */
export { POST } from '@/api/auth/signup/route';
