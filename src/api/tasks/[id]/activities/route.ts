/**
 * src/api/tasks/[id]/activities/route.ts
 *
 * Activities resource endpoint for a specific task.
 *
 * Endpoints (re-exported via src/app/api/tasks/[id]/activities/route.ts):
 *   GET /api/tasks/:id/activities  — List all activity events for this task (newest first, with computed timeAgo)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { timeAgo } from '@/lib/timeAgo';
import { requireTaskAccess } from '@/lib/access';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/activities
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    const access = await requireTaskAccess(taskId);
    if (!access.ok) return access.response;

    const dbActivities = await prisma.activity.findMany({
      where: { taskId },
      select: {
        id: true,
        text: true,
        icon: true,
        createdAt: true,
        taskId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = dbActivities.map(a => ({
      ...a,
      timeAgo: timeAgo(a.createdAt),
    }));

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/tasks/:id/activities] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activities' } },
      { status: 500 }
    );
  }
}
