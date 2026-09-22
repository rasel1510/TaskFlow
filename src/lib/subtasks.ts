/**
 * src/lib/subtasks.ts
 *
 * Subtask business logic and progress recomputation utilities.
 */

import prisma from '@/lib/prisma';

/**
 * Recomputes and updates the progress of a parent task based on its subtasks.
 * Executes parallel COUNT queries in Postgres — O(1) memory, zero heap overhead.
 *
 * @param taskId - ID of the parent task
 * @returns The newly computed progress integer (0-100)
 */
export async function recomputeTaskProgress(taskId: string): Promise<number> {
  const [doneCount, totalCount] = await Promise.all([
    prisma.subTask.count({ where: { taskId, done: true } }),
    prisma.subTask.count({ where: { taskId } }),
  ]);

  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  await prisma.task.update({
    where: { id: taskId },
    data: { progress },
  });

  return progress;
}
