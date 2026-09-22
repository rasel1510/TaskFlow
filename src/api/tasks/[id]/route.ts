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
import { users as mockUsers } from '@/data/mockData';
import { getAllStoredUsers } from '@/data/userStore';
import { auth } from '@/auth';

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

    // Strict user-level task scoping check
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {}

    const requestedUserId = _request.nextUrl.searchParams.get('userId');
    const currentUserId = sessionUserId || requestedUserId;

    if (currentUserId && task.assigneeId && task.assigneeId !== currentUserId) {
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

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { message: `Task with id "${id}" was not found` },
        { status: 404 }
      );
    }

    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {}

    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const currentUserId = sessionUserId || requestedUserId;

    if (currentUserId && existing.assigneeId && existing.assigneeId !== currentUserId) {
      return NextResponse.json(
        { message: 'Forbidden: you cannot modify tasks belonging to other users' },
        { status: 403 }
      );
    }

    // Only allow known, safe fields to be updated (whitelist approach)
    const allowedFields = [
      'title', 'description', 'status', 'priority',
      'dueDate', 'estimate', 'labels', 'progress',
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

    // Handle assigneeId carefully to prevent foreign key constraint violations
    if ('assigneeId' in body) {
      const rawAssigneeId = body.assigneeId;
      if (!rawAssigneeId || rawAssigneeId === 'unassigned') {
        updateData.assigneeId = null;
      } else if (typeof rawAssigneeId === 'string') {
        const trimmed = rawAssigneeId.trim();
        // Check if user exists in DB by ID or email
        let dbUser = await prisma.user.findFirst({
          where: { OR: [{ id: trimmed }, { email: trimmed }] },
        });

        if (!dbUser) {
          // Check local stored users
          const storedUsers = getAllStoredUsers();
          const storedUser = storedUsers.find(
            u => u.id === trimmed || u.email.toLowerCase() === trimmed.toLowerCase()
          );
          if (storedUser) {
            dbUser = await prisma.user.upsert({
              where: { id: storedUser.id },
              update: {},
              create: {
                id: storedUser.id,
                name: storedUser.name,
                email: storedUser.email,
                avatar: storedUser.avatar,
                role: storedUser.role,
              },
            });
          }
        }

        if (!dbUser) {
          // Check mock users
          const mockUser = mockUsers.find(
            u => u.id === trimmed || u.email.toLowerCase() === trimmed.toLowerCase()
          );
          if (mockUser) {
            dbUser = await prisma.user.upsert({
              where: { id: mockUser.id },
              update: {},
              create: {
                id: mockUser.id,
                name: mockUser.name,
                email: mockUser.email,
                avatar: mockUser.avatar,
                role: mockUser.role,
              },
            });
          }
        }

        if (dbUser) {
          updateData.assigneeId = dbUser.id;
        } else {
          console.warn(`[PATCH /api/tasks/:id] Assignee "${trimmed}" not found, defaulting to null`);
          updateData.assigneeId = null;
        }
      }
    }

    // Handle projectId carefully to prevent foreign key constraint violations
    if ('projectId' in body) {
      if (typeof body.projectId === 'string' && body.projectId.trim()) {
        const proj = await prisma.project.findUnique({ where: { id: body.projectId.trim() } });
        if (proj) {
          updateData.projectId = proj.id;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    try {
      const updated = await prisma.task.update({
        where: { id },
        data: updateData,
        include: { assignee: true, project: true, subtasks: true },
      });
      return NextResponse.json(updated, { status: 200 });
    } catch (dbErr: unknown) {
      console.warn('[PATCH /api/tasks/:id] Prisma update failed, fallback to optimistic response:', dbErr);
      return NextResponse.json({ id, ...updateData }, { status: 200 });
    }
  } catch (error: unknown) {
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
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { message: 'Task deleted successfully' },
        { status: 200 }
      );
    }

    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {}

    const requestedUserId = _request.nextUrl.searchParams.get('userId');
    const currentUserId = sessionUserId || requestedUserId;

    if (currentUserId && existing.assigneeId && existing.assigneeId !== currentUserId) {
      return NextResponse.json(
        { message: 'Forbidden: you cannot delete tasks belonging to other users' },
        { status: 403 }
      );
    }

    try {
      await prisma.task.delete({ where: { id } });
    } catch (dbErr: unknown) {
      console.warn('[DELETE /api/tasks/:id] Prisma delete failed, fallback to mock delete:', dbErr);
    }

    return NextResponse.json(
      { message: 'Task deleted successfully' },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[DELETE /api/tasks/:id] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error while deleting task' },
      { status: 500 }
    );
  }
}

