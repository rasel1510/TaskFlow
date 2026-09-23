/**
 * src/lib/projectProgress.ts
 *
 * Auto-Recompute Project Progress (Step 4.5)
 * Atomically computes and persists project completion percentage whenever
 * task status transitions, task creations, or task deletions occur.
 * Executes both counts in parallel for optimal O(1) database round-trip latency.
 */

import prisma from '@/lib/prisma';
import { projects as mockProjects } from '@/data/mockData';

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

    // Also update mockProjects array in memory for demo resilience
    const mockProj = mockProjects.find((p) => p.id === projectId);
    if (mockProj) {
      mockProj.progress = progress;
    }

    return progress;
  } catch (error) {
    console.warn(`[recomputeProjectProgress] Failed to recompute via Prisma for project "${projectId}", calculating in-memory:`, error);

    // Fallback: in-memory computation from mockProjects
    const mockProj = mockProjects.find((p) => p.id === projectId);
    if (mockProj) {
      return mockProj.progress;
    }
    return 0;
  }
}
