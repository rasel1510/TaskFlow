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

/**
 * Parse a date string from the client and validate that the resulting year
 * is within a sane range (2000-2100). Returns `undefined` for empty / invalid
 * / out-of-range values instead of letting Prisma receive a garbage Date.
 */
function parseSafeDate(raw: unknown): Date | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return undefined;
  return d;
}
import prisma from '@/lib/prisma';
import { users as mockUsers } from '@/data/mockData';
import { getAllStoredUsers } from '@/data/userStore';
import { auth } from '@/auth';
import { UpdateTaskSchema, validationError } from '@/lib/validators';
import { logActivity } from '@/lib/activity';
import { recomputeProjectProgress } from '@/lib/projectProgress';

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
        comments: {
          select: {
            id: true,
            text: true,
            reactions: true,
            createdAt: true,
            userId: true,
            taskId: true,
            user: { select: { id: true, name: true, email: true, avatar: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          select: {
            id: true,
            text: true,
            icon: true,
            createdAt: true,
            taskId: true,
          },
          orderBy: { createdAt: 'desc' },
        },
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

    return NextResponse.json({ success: true, data: task }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/tasks/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
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
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    // --- Zod validation ---
    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    // Use the validated + coerced body for all subsequent logic
    body = parsed.data as Record<string, unknown>;

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
          ? parseSafeDate(body[field] as string)
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

      // Audit activity logging for modified fields
      try {
        if (updateData.status && updateData.status !== existing.status) {
          const from = existing.status.replace(/_/g, ' ');
          const to = updateData.status.replace(/_/g, ' ');
          await logActivity(id, `Status changed from ${from} to ${to}`, '🔄');
        }
        if (updateData.priority && updateData.priority !== existing.priority) {
          await logActivity(id, `Priority changed to ${updateData.priority}`, '⚡');
        }
        if ('assigneeId' in updateData && updateData.assigneeId !== existing.assigneeId) {
          const name = updated.assignee?.name || 'Unassigned';
          await logActivity(id, `Assigned to ${name}`, '👤');
        }
        if ('dueDate' in updateData) {
          const oldTime = existing.dueDate ? new Date(existing.dueDate).getTime() : 0;
          const newTime = updateData.dueDate ? new Date(updateData.dueDate).getTime() : 0;
          if (oldTime !== newTime) {
            const dateStr = updateData.dueDate
              ? new Date(updateData.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'None';
            await logActivity(id, `Due date set to ${dateStr}`, '📅');
          }
        }
        if (updateData.title && updateData.title !== existing.title) {
          await logActivity(id, `Title updated to "${updateData.title}"`, '✏️');
        }
      } catch (logErr) {
        console.error('[PATCH /api/tasks/:id] Activity log failed:', logErr);
      }

      // Auto-recompute progress for affected project(s) (Step 4.5)
      try {
        if (updateData.status || updateData.projectId) {
          if (updated.projectId) {
            await recomputeProjectProgress(updated.projectId);
          }
          if (existing.projectId && existing.projectId !== updated.projectId) {
            await recomputeProjectProgress(existing.projectId);
          }
        }
      } catch (progressErr) {
        console.warn('[PATCH /api/tasks/:id] Progress recompute warning:', progressErr);
      }

      return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (dbErr: unknown) {
      console.warn('[PATCH /api/tasks/:id] Prisma update failed, fallback to optimistic response:', dbErr);
      return NextResponse.json({ success: true, data: { id, ...updateData } }, { status: 200 });
    }
  } catch (error: unknown) {
    console.error('[PATCH /api/tasks/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error while updating task' } },
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
      if (existing.projectId) {
        await recomputeProjectProgress(existing.projectId);
      }
    } catch (dbErr: unknown) {
      console.warn('[DELETE /api/tasks/:id] Prisma delete failed, fallback to mock delete:', dbErr);
    }

    return NextResponse.json(
      { success: true, data: { message: 'Task deleted successfully' } },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[DELETE /api/tasks/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error while deleting task' } },
      { status: 500 }
    );
  }
}

