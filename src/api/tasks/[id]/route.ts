/**
 * src/api/tasks/[id]/route.ts
 *
 * Single task resource endpoint — optimized for sub-50ms perceived latency.
 *
 * Performance strategy:
 *  - Respond immediately after the core DB write
 *  - Fire background work (activity log, progress recompute, cache invalidation)
 *    via setImmediate / Promise (non-blocking)
 *  - Every handler requires a session with access to the task (src/lib/access.ts)
 *  - Skip re-fetching the full task after update — return merged object instead
 */

import { NextRequest, NextResponse } from 'next/server';

function parseSafeDate(raw: unknown): Date | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  let str = raw.trim();
  if (str.includes('T')) {
    str = str.split('T')[0].trim();
  }
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    if (!isNaN(d.getTime()) && year >= 2000 && year <= 2100) {
      return d;
    }
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return undefined;
  return d;
}


import prisma from '@/lib/prisma';
import { readOnlyResponseFor } from '@/lib/workspaces';
import { recipientsWanting, wantsNotification } from '@/lib/notificationPrefs';
import { UpdateTaskSchema, validationError } from '@/lib/validators';
import { logActivity } from '@/lib/activity';
import { recomputeProjectProgress } from '@/lib/projectProgress';
import redisCache from '@/lib/redis';
import { enqueueBackgroundTask } from '@/lib/asyncQueue';
import { requireTaskAccess, requireProjectAccess } from '@/lib/access';
import { formatHours } from '@/lib/taskColumns';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Background work — fire and forget, never blocks the HTTP response
// ---------------------------------------------------------------------------

function fireAndForget(fn: () => Promise<void>, name = 'task_async_cleanup'): void {
  enqueueBackgroundTask(name, fn);
}

// ---------------------------------------------------------------------------
// GET /api/tasks/:id
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const access = await requireTaskAccess(id);
    if (!access.ok) return access.response;

    const cacheKey = `task:${id}`;
    const serializedTask = await redisCache.wrap(cacheKey, 30, async () => {
      const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        },
        creator: { select: { id: true, name: true, email: true, avatar: true, role: true } },
        project: true,
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

      if (!task) return null;
      return {
        ...task,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : null,
      };
    });

    if (!serializedTask) {
      return NextResponse.json(
        { message: `Task with id "${id}" was not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: serializedTask },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      }
    );
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

    const access = await requireTaskAccess(id);
    if (!access.ok) return access.response;
    {
      const readOnly = await readOnlyResponseFor(access.value.task.projectId, access.value.user.teamId);
      if (readOnly) return readOnly;
    }

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
        dueDate: true, assigneeId: true, projectId: true, customFields: true, completedAt: true, timeSpent: true,
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

    // Time spent (whole minutes, null clears)
    if ('timeSpent' in body) {
      updateData.timeSpent = typeof body.timeSpent === 'number' ? body.timeSpent : null;
    }

    // Custom column values: merge per key so concurrent edits to different columns don't clobber
    // each other. A null value removes that key.
    if (body.customFields && typeof body.customFields === 'object') {
      const merged: Record<string, unknown> = {
        ...((existing.customFields as Record<string, unknown> | null) ?? {}),
      };
      for (const [key, value] of Object.entries(body.customFields as Record<string, unknown>)) {
        if (value === null) delete merged[key];
        else merged[key] = value;
      }
      updateData.customFields = merged;
    }

    // Completion date is chosen by the user (YYYY-MM-DD, null clears it).
    // If a task becomes "done" and no date has been set, default to now.
    if ('completedAt' in body) {
      updateData.completedAt = body.completedAt ? parseSafeDate(body.completedAt as string) ?? null : null;
    } else if (updateData.status === 'done' && existing.status !== 'done' && !existing.completedAt) {
      updateData.completedAt = new Date();
    }

    // assigneeId — must be someone who can see the task: in its project (owner/member/same company)
    // or, for personal tasks, in the requester's company. Prevents assigning across organisations.
    if ('assigneeId' in body) {
      const rawId = body.assigneeId;
      if (!rawId || rawId === 'unassigned') {
        updateData.assigneeId = null;
      } else if (typeof rawId === 'string') {
        const trimmed = rawId.trim();
        const candidate = await prisma.user.findFirst({
          where: { OR: [{ id: trimmed }, { email: trimmed.toLowerCase() }] },
          select: { id: true, teamId: true, workspaceMemberships: { select: { teamId: true } } },
        });
        if (!candidate) {
          return NextResponse.json(
            { success: false, error: { code: 'BAD_REQUEST', message: 'Assignee not found' } },
            { status: 400 }
          );
        }

        const requester = access.value.user;
        const targetProjectId =
          (typeof body.projectId === 'string' && body.projectId.trim()) || existing.projectId || null;
        let allowed = candidate.id === requester.id;
        // Every company the candidate belongs to (not only the one they have open)
        const candidateTeams = new Set(candidate.workspaceMemberships.map(m => m.teamId));
        if (!allowed && targetProjectId) {
          const proj = await prisma.project.findUnique({
            where: { id: targetProjectId },
            select: { ownerId: true, teamId: true, members: { where: { userId: candidate.id }, select: { id: true }, take: 1 } },
          });
          allowed = Boolean(
            proj && (proj.ownerId === candidate.id || proj.members.length > 0 || (proj.teamId && candidateTeams.has(proj.teamId)))
          );
        } else if (!allowed) {
          allowed = Boolean(requester.teamId && candidateTeams.has(requester.teamId));
        }
        if (!allowed) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'You can only assign people who belong to this project or your company' } },
            { status: 403 }
          );
        }
        updateData.assigneeId = candidate.id;
      }
    }

    // projectId — resolve once
    if ('projectId' in body && typeof body.projectId === 'string' && body.projectId.trim()) {
      const pId = body.projectId.trim();
      if (pId !== access.value.task.projectId) {
        // Moving a task into another project requires access to that project.
        const projectAccess = await requireProjectAccess(pId);
        if (!projectAccess.ok) return projectAccess.response;
        updateData.projectId = projectAccess.value.project.id;
      }
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
        assignee: 'assigneeId' in updateData ? {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        } : false,
        project: 'projectId' in updateData,
      },
    });

    // ── Respond NOW — background work follows ────────────────────────────────
    const mergedTask = { ...existing, ...updated };
    const serializedTask = {
      ...mergedTask,
      dueDate: mergedTask.dueDate
        ? (mergedTask.dueDate instanceof Date
          ? mergedTask.dueDate.toISOString().split('T')[0]
          : String(mergedTask.dueDate).split('T')[0])
        : null,
    };
    const response = NextResponse.json({ success: true, data: serializedTask }, { status: 200 });

    // Fire-and-forget: activity log + progress + cache (none block the response)
    fireAndForget(async () => {
      const logs: Promise<unknown>[] = [];

      if (updateData.status && updateData.status !== existing.status) {
        const from = existing.status.replace(/_/g, ' ');
        const to = updateData.status.replace(/_/g, ' ');
        logs.push(logActivity(id, `Status changed from ${from} to ${to}`, '🔄'));
      }
      if (updateData.priority && updateData.priority !== existing.priority) {
        logs.push(logActivity(id, `Priority changed to ${updateData.priority}`, '⚡'));
      }
      if ('assigneeId' in updateData && updateData.assigneeId !== existing.assigneeId) {
        const name = (updated as { assignee?: { name?: string } }).assignee?.name || 'Unassigned';
        logs.push(logActivity(id, `Assigned to ${name}`, '👤'));
        // Tell the new assignee (unless they assigned themselves)
        if (updateData.assigneeId && updateData.assigneeId !== access.value.user.id) {
          const assigneeId = updateData.assigneeId as string;
          logs.push(
            (async () => {
              if (!(await wantsNotification(assigneeId, 'task_assigned'))) return;
              await prisma.notification.create({
                data: {
                  userId: assigneeId,
                  type: 'task_assigned',
                  title: 'Assigned to a task',
                  body: `You were assigned to ${updated.taskNumber ?? 'task'}: ${updated.title}`,
                  taskId: id,
                },
              });
            })()
          );
        }
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

      if ('timeSpent' in updateData && updateData.timeSpent !== existing.timeSpent) {
        logs.push(
          logActivity(
            id,
            updateData.timeSpent === null ? 'Time spent cleared' : `Time spent set to ${formatHours(updateData.timeSpent)}`,
            '⏱️'
          )
        );
      }
      if ('completedAt' in updateData) {
        const oldDay = existing.completedAt ? existing.completedAt.toISOString().slice(0, 10) : null;
        const newDay = updateData.completedAt ? new Date(updateData.completedAt).toISOString().slice(0, 10) : null;
        if (oldDay !== newDay) {
          logs.push(
            logActivity(
              id,
              newDay
                ? `Completion date set to ${new Date(updateData.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
                : 'Completion date cleared',
              '✅'
            )
          );
        }
      }
      if (body.customFields && typeof body.customFields === 'object' && existing.projectId) {
        const changedIds = Object.keys(body.customFields as Record<string, unknown>);
        if (changedIds.length) {
          logs.push(
            (async () => {
              const proj = await prisma.project.findUnique({ where: { id: existing.projectId! }, select: { customColumns: true } });
              const titles = new Map(
                ((proj?.customColumns as { id: string; title: string }[] | null) ?? []).map(c => [c.id, c.title])
              );
              const names = changedIds.map(k => titles.get(k)).filter(Boolean);
              if (names.length) await logActivity(id, `Updated ${names.join(', ')}`, '📝');
            })()
          );
        }
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
        redisCache.delPattern('project:detail:*'),
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

    const access = await requireTaskAccess(id);
    if (!access.ok) {
      // Already gone → keep DELETE idempotent
      if (access.response.status === 404) {
        return NextResponse.json(
          { success: true, data: { message: 'Task deleted successfully' } },
          { status: 200 }
        );
      }
      return access.response;
    }
    {
      const readOnly = await readOnlyResponseFor(access.value.task.projectId, access.value.user.teamId);
      if (readOnly) return readOnly;
    }

    // High-performance single-query atomic delete
    let deletedTask: { id: string; projectId: string | null; assigneeId: string | null } | null = null;
    try {
      deletedTask = await prisma.task.delete({
        where: { id },
        select: { id: true, projectId: true, assigneeId: true },
      });
    } catch (err: unknown) {
      // Prisma P2025: Record to delete does not exist (idempotent success)
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
        return NextResponse.json(
          { success: true, data: { message: 'Task deleted successfully' } },
          { status: 200 }
        );
      }
      throw err;
    }

    // Immediate response to client (<50ms)
    const response = NextResponse.json(
      { success: true, data: { message: 'Task deleted successfully' } },
      { status: 200 }
    );

    // Completely non-blocking background cleanup
    fireAndForget(async () => {
      await Promise.allSettled([
        deletedTask?.projectId ? recomputeProjectProgress(deletedTask.projectId) : Promise.resolve(),
        redisCache.del(`task:${id}`),
        redisCache.delPattern('tasks:*'),
        redisCache.delPattern('reports:*'),
        redisCache.delPattern('projects:*'),
        redisCache.delPattern('project:detail:*'),
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
