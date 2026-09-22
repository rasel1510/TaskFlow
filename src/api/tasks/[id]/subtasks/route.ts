/**
 * src/api/tasks/[id]/subtasks/route.ts
 *
 * Canonical subtask resource handler:
 *   GET    /api/tasks/:id/subtasks — List subtasks for task
 *   POST   /api/tasks/:id/subtasks — Create a subtask
 *   PATCH  /api/tasks/:id/subtasks — Toggle or update subtask
 *   DELETE /api/tasks/:id/subtasks — Delete subtask
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { CreateSubtaskSchema, validationError } from '@/lib/validators';
import { logActivity } from '@/lib/activity';
import { recomputeTaskProgress } from '@/lib/subtasks';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/subtasks
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const subtasks = await prisma.subTask.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        done: true,
        taskId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: subtasks }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/tasks/:id/subtasks] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch subtasks' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/subtasks
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Task "${id}" not found` } },
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = CreateSubtaskSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const subtask = await prisma.subTask.create({
      data: {
        taskId: id,
        title: parsed.data.title,
        done: false,
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
    const progress = await recomputeTaskProgress(id);

    // Audit log
    await logActivity(id, `Added subtask "${subtask.title}"`, '📝');

    return NextResponse.json(
      { success: true, data: { ...subtask, taskProgress: progress } },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/tasks/:id/subtasks] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create subtask' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/subtasks
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    let body: { subtaskId?: string; done?: boolean; title?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
    }

    const { subtaskId, done, title } = body;
    if (!subtaskId || typeof subtaskId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'subtaskId is required' } },
        { status: 400 }
      );
    }

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

    // Audit log if done state changed
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
    console.error('[PATCH /api/tasks/:id/subtasks] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update subtask' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id/subtasks
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    const url = new URL(request.url);
    let subtaskId = url.searchParams.get('subtaskId');

    if (!subtaskId) {
      try {
        const body = await request.json();
        subtaskId = body.subtaskId;
      } catch {}
    }

    if (!subtaskId || typeof subtaskId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'subtaskId is required' } },
        { status: 400 }
      );
    }

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
    console.error('[DELETE /api/tasks/:id/subtasks] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete subtask' } },
      { status: 500 }
    );
  }
}
