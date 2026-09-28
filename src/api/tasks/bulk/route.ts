/**
 * src/api/tasks/bulk/route.ts
 *
 * Bulk Task Operations (Step 4.6)
 * High-throughput batch updates and deletions using Prisma updateMany and deleteMany.
 * Automatically recomputes project completion progress for all affected projects.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { BulkTaskActionSchema, validationError } from '@/lib/validators';
import { recomputeProjectProgress } from '@/lib/projectProgress';
import redisCache from '@/lib/redis';
import type { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
    }

    const parseResult = BulkTaskActionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { ids, action, payload } = parseResult.data;

    // Verify session
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {}

    // Find affected tasks and their distinct projectIds
    const affectedTasks = await prisma.task.findMany({
      where: { id: { in: ids } },
      select: { id: true, projectId: true, assigneeId: true },
    });

    if (affectedTasks.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No matching tasks found for the provided IDs' } },
        { status: 404 }
      );
    }

    const distinctProjectIds = Array.from(
      new Set(affectedTasks.map((t) => t.projectId).filter((id): id is string => Boolean(id)))
    );

    if (action === 'delete') {
      const deleteResult = await prisma.task.deleteMany({
        where: { id: { in: ids } },
      });

      // Recompute project progress in parallel
      await Promise.all(distinctProjectIds.map((pId) => recomputeProjectProgress(pId)));

      // Invalidate caches
      await Promise.all([
        redisCache.delPattern('tasks:*'),
        redisCache.delPattern('reports:*'),
        redisCache.delPattern('projects:*'),
      ]);

      return NextResponse.json(
        {
          success: true,
          data: {
            count: deleteResult.count,
            action: 'delete',
            affectedProjectIds: distinctProjectIds,
          },
        },
        { status: 200 }
      );
    }

    if (action === 'update' && payload) {
      const updateData: Prisma.TaskUpdateManyMutationInput = {};
      if (payload.status) updateData.status = payload.status;
      if (payload.priority) updateData.priority = payload.priority;
      // Note: assigneeId is a relation field — not directly settable via updateMany mutation input

      const updateResult = await prisma.task.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });

      // If status changed, recompute project progress
      if (payload.status) {
        await Promise.all(distinctProjectIds.map((pId) => recomputeProjectProgress(pId)));
      }

      // Invalidate caches
      await Promise.all([
        redisCache.delPattern('tasks:*'),
        redisCache.delPattern('reports:*'),
        redisCache.delPattern('projects:*'),
      ]);

      return NextResponse.json(
        {
          success: true,
          data: {
            count: updateResult.count,
            action: 'update',
            affectedProjectIds: distinctProjectIds,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing update payload for action "update"' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[POST /api/tasks/bulk] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process bulk task operations' } },
      { status: 500 }
    );
  }
}
