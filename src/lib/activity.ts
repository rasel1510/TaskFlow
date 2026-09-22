/**
 * src/lib/activity.ts
 *
 * Server-side activity audit logging utility.
 *
 * Records change history for tasks, providing a verifiable audit trail
 * for task lifecycle transitions, status updates, reassignments, and modifications.
 */

import prisma from '@/lib/prisma';

/**
 * Log an audit activity entry for a task in the database.
 * Gracefully logs errors to stdout without throwing to prevent breaking
 * primary business operations if the audit log fails.
 *
 * @param taskId - ID of the task being modified
 * @param text   - Human-readable description of what changed
 * @param icon   - Emoji / symbol visual indicator (default: 🔄)
 */
export async function logActivity(
  taskId: string,
  text: string,
  icon = '🔄'
) {
  try {
    return await prisma.activity.create({
      data: {
        taskId,
        text,
        icon,
      },
      select: {
        id: true,
        taskId: true,
        text: true,
        icon: true,
        createdAt: true,
      },
    });
  } catch (err) {
    console.error(`[logActivity] Failed to log activity for task ${taskId}:`, err);
    return null;
  }
}
