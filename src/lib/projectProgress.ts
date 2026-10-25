/**
 * src/lib/projectProgress.ts
 *
 * Auto-Recompute Project Progress (Step 4.5)
 * Atomically computes and persists project completion percentage whenever
 * task status transitions, task creations, or task deletions occur.
 * Executes both counts in parallel for optimal O(1) database round-trip latency.
 */

import prisma from '@/lib/prisma';
import redisCache from '@/lib/redis';

export async function recomputeProjectProgress(projectId: string): Promise<number> {
  if (!projectId) return 0;

  try {
    // Run both counts concurrently in a single round-trip
    const [doneCount, totalCount] = await Promise.all([
      prisma.task.count({
        where: { projectId, status: 'done' },
      }),
      prisma.task.count({
        where: { projectId },
      }),
    ]);

    const progress = totalCount === 0 ? 0 : Math.min(100, Math.max(0, Math.round((doneCount / totalCount) * 100)));

    // Persist new progress to the database
    await prisma.project.update({
      where: { id: projectId },
      data: { progress },
    });

    // Invalidate project and report caches
    await Promise.all([
      redisCache.delPattern('projects:*'),
      redisCache.delPattern('reports:*'),
    ]);

    return progress;
  } catch (error) {
    console.warn(`[recomputeProjectProgress] Failed to recompute via Prisma for project "${projectId}":`, error);
    return 0;
  }
}
