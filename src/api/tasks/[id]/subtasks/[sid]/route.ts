/**
 * src/api/tasks/[id]/subtasks/[sid]/route.ts
 *
 * Single subtask resource handler:
 *   PATCH  /api/tasks/:id/subtasks/:sid — Toggle done status or update title
 *   DELETE /api/tasks/:id/subtasks/:sid — Delete subtask permanently
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { recomputeTaskProgress } from '@/lib/subtasks';

interface RouteContext {
  params: Promise<{ id: string; sid: string }>;
}

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/subtasks/:sid
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId, sid: subtaskId } = await context.params;

    let body: { done?: boolean; title?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
    }

    const { done, title } = body;

    const existing = await prisma.subTask.findFirst({
      where: { id: subtaskId, taskId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Subtask not found' } },
        { status: 404 }
      );
    }

    const updated = await prisma.subTask.update({
      where: { id: subtaskId },
      data: {
        ...(typeof done === 'boolean' ? { done } : {}),
        ...(typeof title === 'string' && title.trim() ? { title: title.trim() } : {}),
      },
      select: {
        id: true,
        title: true,
        done: true,
        taskId: true,
        createdAt: true,
      },
    });

    // Recompute parent task progress
    const progress = await recomputeTaskProgress(taskId);

    // Audit log if done status changed
    if (typeof done === 'boolean' && done !== existing.done) {
      await logActivity(
        taskId,
        `${done ? 'Completed' : 'Reopened'} subtask "${updated.title}"`,
        done ? '✅' : '🔄'
      );
    }

    return NextResponse.json(
      { success: true, data: { ...updated, taskProgress: progress } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/tasks/:id/subtasks/:sid] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update subtask' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id/subtasks/:sid
// ---------------------------------------------------------------------------
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId, sid: subtaskId } = await context.params;

    const existing = await prisma.subTask.findFirst({
      where: { id: subtaskId, taskId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Subtask not found' } },
        { status: 404 }
      );
    }

    await prisma.subTask.delete({
      where: { id: subtaskId },
    });

    // Recompute parent task progress
    const progress = await recomputeTaskProgress(taskId);

    await logActivity(taskId, `Deleted subtask "${existing.title}"`, '🗑️');

    return NextResponse.json(
      { success: true, data: { id: subtaskId, taskProgress: progress } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/tasks/:id/subtasks/:sid] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete subtask' } },
      { status: 500 }
    );
  }
}
