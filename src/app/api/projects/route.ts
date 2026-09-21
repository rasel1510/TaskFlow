/**
 * src/app/api/projects/route.ts  — Next.js App Router bridge
 *
 * This file serves as the HTTP entry point for /api/projects.
 * All business logic lives in `src/api/projects/route.ts`.
 *
 * Next.js requires named exports (GET, POST, …) from this exact location.
 * We simply re-export them from the canonical API module.
 */
export { GET, POST } from '@/api/projects/route';
