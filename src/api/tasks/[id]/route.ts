/**
 * src/api/tasks/[id]/route.ts
 *
 * Single task resource endpoint — core API handler.
 *
 * Endpoints (re-exported via src/app/api/tasks/[id]/route.ts):
 *   GET    /api/tasks/:id  — Retrieve a single task by ID
 *   PATCH  /api/tasks/:id  — Update a task (partial update — any subset of fields)
 *   DELETE /api/tasks/:id  — Delete a task permanently
 *
 * Architecture note:
 *   Business logic lives here. The Next.js App Router bridge at
 *   src/app/api/tasks/[id]/route.ts simply re-exports these handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Route-segment context provided by Next.js App Router
interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/tasks/:id
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        project: true,
        subtasks: true,
        comments: { include: { user: true }, orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!task) {
      return NextResponse.json(
        { message: `Task with id "${id}" was not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(task, { status: 200 });
  } catch (error) {
    console.error('[GET /api/tasks/:id] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    // Only allow known, safe fields to be updated (whitelist approach)
    const allowedFields = [
      'title', 'description', 'status', 'priority',
      'assigneeId', 'projectId', 'dueDate', 'estimate',
      'labels', 'progress',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = field === 'dueDate' && body[field]
          ? new Date(body[field] as string)
          : body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { assignee: true, project: true, subtasks: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    // Prisma error P2025 = record not found
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json(
        { message: 'Task not found' },
        { status: 404 }
      );
    }
    console.error('[PATCH /api/tasks/:id] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error while updating task' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// ---------------------------------------------------------------------------
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    await prisma.task.delete({ where: { id } });

    return NextResponse.json(
      { message: 'Task deleted successfully' },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json(
        { message: 'Task not found' },
        { status: 404 }
      );
    }
    console.error('[DELETE /api/tasks/:id] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error while deleting task' },
      { status: 500 }
    );
  }
}
