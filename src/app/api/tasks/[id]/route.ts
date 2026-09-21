/**
 * src/app/api/tasks/[id]/route.ts  — Next.js App Router bridge
 *
 * This file serves as the HTTP entry point for /api/tasks/:id.
 * All business logic lives in `src/api/tasks/[id]/route.ts`.
 *
 * Next.js requires named exports (GET, PATCH, DELETE, …) from this exact location.
 * We simply re-export them from the canonical API module.
 */
export { GET, PATCH, DELETE } from '@/api/tasks/[id]/route';
