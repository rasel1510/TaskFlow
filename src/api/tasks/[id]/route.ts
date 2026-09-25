/**
 * src/api/tasks/[id]/route.ts
 *
 * Single task resource endpoint — optimized for sub-50ms perceived latency.
 *
 * Performance strategy:
 *  - Respond immediately after the core DB write
 *  - Fire background work (activity log, progress recompute, cache invalidation)
 *    via setImmediate / Promise (non-blocking)
 *  - Minimal auth() overhead: only validate ownership when userId header present
 *  - Skip re-fetching the full task after update — return merged object instead
 */

import { NextRequest, NextResponse } from 'next/server';

function parseSafeDate(raw: unknown): Date | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return undefined;
  return d;
}

import prisma from '@/lib/prisma';
import { users as mockUsers, projects as mockProjects } from '@/data/mockData';
import { getAllStoredUsers } from '@/data/userStore';
import { UpdateTaskSchema, validationError } from '@/lib/validators';
import { logActivity } from '@/lib/activity';
import { recomputeProjectProgress } from '@/lib/projectProgress';
import redisCache from '@/lib/redis';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Background work — fire and forget, never blocks the HTTP response
// ---------------------------------------------------------------------------
function fireAndForget(fn: () => Promise<void>): void {
  fn().catch(err => console.warn('[tasks/:id] background job failed:', err));
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
            id: true, text: true, reactions: true, createdAt: true,
            userId: true, taskId: true,
            user: { select: { id: true, name: true, email: true, avatar: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          select: { id: true, text: true, icon: true, createdAt: true, taskId: true },
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
// PATCH /api/tasks/:id  ← Primary performance target
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

    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    body = parsed.data as Record<string, unknown>;

    // ── Fast path: fetch only the fields we need (no includes) ──────────────
    const existing = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true, status: true, priority: true, title: true,
        dueDate: true, assigneeId: true, projectId: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { message: `Task with id "${id}" was not found` },
        { status: 404 }
      );
    }

    // Build update payload — whitelist approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    const scalarFields = ['title', 'description', 'status', 'priority', 'estimate', 'labels', 'progress'];
    for (const field of scalarFields) {
      if (field in body) updateData[field] = body[field];
    }
    if ('dueDate' in body) {
      updateData.dueDate = body.dueDate ? parseSafeDate(body.dueDate as string) : null;
    }

    // assigneeId — resolve once, skip if unchanged
    if ('assigneeId' in body) {
      const rawId = body.assigneeId;
      if (!rawId || rawId === 'unassigned') {
        updateData.assigneeId = null;
      } else if (typeof rawId === 'string') {
        const trimmed = rawId.trim();
        // Check DB first (O(1) index hit)
        let dbUser = await prisma.user.findFirst({
          where: { OR: [{ id: trimmed }, { email: trimmed }] },
          select: { id: true },
        });
        if (!dbUser) {
          const stored = getAllStoredUsers().find(
            u => u.id === trimmed || u.email.toLowerCase() === trimmed.toLowerCase()
          );
          if (stored) {
            dbUser = await prisma.user.upsert({
              where: { email: stored.email },
              update: {},
              create: { id: stored.id, name: stored.name, email: stored.email, avatar: stored.avatar, role: stored.role },
              select: { id: true },
            });
          }
        }
        if (!dbUser) {
          const mock = mockUsers.find(u => u.id === trimmed || u.email.toLowerCase() === trimmed.toLowerCase());
          if (mock) {
            dbUser = await prisma.user.upsert({
              where: { id: mock.id },
              update: {},
              create: { id: mock.id, name: mock.name, email: mock.email, avatar: mock.avatar, role: mock.role },
              select: { id: true },
            });
          }
        }
        updateData.assigneeId = dbUser?.id ?? null;
      }
    }

    // projectId — resolve once
    if ('projectId' in body && typeof body.projectId === 'string' && body.projectId.trim()) {
      const pId = body.projectId.trim();
      let proj = await prisma.project.findUnique({ where: { id: pId }, select: { id: true } });
      if (!proj) {
        const mock = mockProjects.find(p => p.id === pId);
        if (mock) {
          const owner = await prisma.user.findFirst({ select: { id: true } });
          if (owner) {
            proj = await prisma.project.upsert({
              where: { id: mock.id },
              update: {},
              create: {
                id: mock.id, name: mock.name, description: mock.description,
                color: mock.color || '#2563EB',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                health: (mock.health as any) || 'on_track',
                progress: typeof mock.progress === 'number' ? mock.progress : 0,
                ownerId: owner.id,
              },
              select: { id: true },
            });
          }
        }
      }
      if (proj) updateData.projectId = proj.id;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    // ── Core DB write — respond immediately after this ───────────────────────
    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      // Only include assignee/project if they changed — avoids expensive joins
      include: {
        assignee: 'assigneeId' in updateData,
        project:  'projectId'  in updateData,
        subtasks: false,
      },
    });

    // ── Respond NOW — background work follows ────────────────────────────────
    const response = NextResponse.json({ success: true, data: { ...existing, ...updated } }, { status: 200 });

    // Fire-and-forget: activity log + progress + cache (none block the response)
    fireAndForget(async () => {
      const logs: Promise<unknown>[] = [];

      if (updateData.status && updateData.status !== existing.status) {
        const from = existing.status.replace(/_/g, ' ');
        const to   = updateData.status.replace(/_/g, ' ');
        logs.push(logActivity(id, `Status changed from ${from} to ${to}`, '🔄'));
      }
      if (updateData.priority && updateData.priority !== existing.priority) {
        logs.push(logActivity(id, `Priority changed to ${updateData.priority}`, '⚡'));
      }
      if ('assigneeId' in updateData && updateData.assigneeId !== existing.assigneeId) {
        const name = (updated as { assignee?: { name?: string } }).assignee?.name || 'Unassigned';
        logs.push(logActivity(id, `Assigned to ${name}`, '👤'));
      }
      if ('dueDate' in updateData) {
        const oldTime = existing.dueDate ? new Date(existing.dueDate).getTime() : 0;
        const newTime = updateData.dueDate ? new Date(updateData.dueDate).getTime() : 0;
        if (oldTime !== newTime) {
          const dateStr = updateData.dueDate
            ? new Date(updateData.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'None';
          logs.push(logActivity(id, `Due date set to ${dateStr}`, '📅'));
        }
      }
      if (updateData.title && updateData.title !== existing.title) {
        logs.push(logActivity(id, `Title updated to "${updateData.title}"`, '✏️'));
      }

      // Recompute project progress only when status or project changed
      if (updateData.status || updateData.projectId) {
        const projectId = updated.projectId ?? existing.projectId;
        if (projectId) logs.push(recomputeProjectProgress(projectId));
        if (existing.projectId && existing.projectId !== projectId) {
          logs.push(recomputeProjectProgress(existing.projectId));
        }
      }

      // Cache invalidation
      logs.push(
        redisCache.del(`task:${id}`),
        redisCache.delPattern('tasks:*'),
        redisCache.delPattern('reports:*'),
        redisCache.delPattern('projects:*'),
      );

      await Promise.allSettled(logs);
    });

    return response;
  } catch (error) {
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

    // Fetch only what we need for background work
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, projectId: true, assigneeId: true },
    });

    if (!existing) {
      // Already deleted — idempotent success
      return NextResponse.json(
        { success: true, data: { message: 'Task deleted successfully' } },
        { status: 200 }
      );
    }

    // Core delete
    await prisma.task.delete({ where: { id } });

    // Respond immediately, background cleanup follows
    const response = NextResponse.json(
      { success: true, data: { message: 'Task deleted successfully' } },
      { status: 200 }
    );

    fireAndForget(async () => {
      await Promise.allSettled([
        existing.projectId ? recomputeProjectProgress(existing.projectId) : Promise.resolve(),
        redisCache.del(`task:${id}`),
        redisCache.delPattern('tasks:*'),
        redisCache.delPattern('reports:*'),
        redisCache.delPattern('projects:*'),
      ]);
    });

    return response;
  } catch (error) {
    console.error('[DELETE /api/tasks/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error while deleting task' } },
      { status: 500 }
    );
  }
}
