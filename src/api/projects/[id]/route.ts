/**
 * src/api/projects/[id]/route.ts
 *
 * Single project resource API endpoint with:
 * - Algorithmic Predictive Health & SLA Risk Engine (Step 4.8)
 * - Enterprise Project Lifecycle State Machine & Audited Archival (Step 4.11)
 *
 * GET    /api/projects/:id  — Returns project with owner, tasks list, SLA metrics, and lifecycle state
 * PATCH  /api/projects/:id  — Updates project metadata, lifecycle state, health, dates, or archival status
 * DELETE /api/projects/:id  — Soft-archives or deletes project
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { UpdateProjectSchema, validationError } from '@/lib/validators';
import { computeProjectHealth } from '@/lib/projectHealthEngine';
import { validateLifecycleTransition, type ProjectLifecycleState } from '@/lib/projectLifecycle';
import redisCache from '@/lib/redis';
import { getOrProvisionUserTeam } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parseSafeDate(raw: unknown): Date | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return undefined;
  return d;
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    try {
      const cacheKey = `project:detail:${projectId}`;
      const payload = await redisCache.wrap(cacheKey, 15, async () => {
        const dbProject = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            owner: {
              select: { id: true, name: true, email: true, avatar: true, role: true },
            },
            tasks: {
              select: {
                id: true,
                taskNumber: true,
                title: true,
                status: true,
                priority: true,
                dueDate: true,
                estimate: true,
                createdAt: true,
                updatedAt: true,
                assignee: {
                  select: { id: true, name: true, avatar: true, role: true, email: true },
                },
                _count: {
                  select: { subtasks: true, comments: true },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        if (!dbProject) return null;

        const totalTasks = dbProject.tasks.length;
        const completedTasks = dbProject.tasks.filter((t) => t.status === 'done').length;
        const inProgressTasks = dbProject.tasks.filter(
          (t) => t.status === 'in_progress' || t.status === 'in_review'
        ).length;

        const now = new Date();
        const overdueTasks = dbProject.tasks.filter(
          (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now
        ).length;

        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const recentCompletedTasks7d = dbProject.tasks.filter(
          (t) => t.status === 'done' && t.updatedAt && new Date(t.updatedAt) >= sevenDaysAgo
        ).length;

        const completionRate =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Step 4.8 Predictive Health & SLA Risk Engine
        const slaAnalysis = computeProjectHealth({
          startDate: dbProject.startDate,
          dueDate: dbProject.dueDate,
          progress: completionRate,
          totalTasks,
          completedTasks,
          overdueTasks,
          recentCompletedTasks7d,
          referenceDate: now,
        });

        const lifecycleState: ProjectLifecycleState = (dbProject as any).lifecycleState || 'ACTIVE';
        const archivedAt: Date | null = (dbProject as any).archivedAt || null;

        return {
          ...dbProject,
          health: slaAnalysis.health,
          totalTasks,
          completedTasks,
          inProgressTasks,
          overdueTasks,
          completionRate,
          slaAnalysis,
          lifecycleState,
          archivedAt,
        };
      });

      if (payload) {
        return NextResponse.json(
          {
            success: true,
            data: payload,
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
            },
          }
        );
      }
    } catch (dbErr) {
      console.warn('[GET /api/projects/:id] DB query warning:', dbErr);
    }

    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: `Project "${projectId}" not found` } },
      { status: 404 }
    );
  } catch (err) {
    console.error('[GET /api/projects/:id] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve project' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/:id
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const parsed = UpdateProjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { name, description, color, startDate, dueDate } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (startDate !== undefined) updateData.startDate = parseSafeDate(startDate);
    if (dueDate !== undefined) updateData.dueDate = parseSafeDate(dueDate);
    if (body.health !== undefined && typeof body.health === 'string') updateData.health = body.health;

    // Step 4.11 Lifecycle State Transition Validation
    if (body.lifecycleState && typeof body.lifecycleState === 'string') {
      const targetState = body.lifecycleState as ProjectLifecycleState;
      // Fetch current state from DB
      const current = await prisma.project.findUnique({ where: { id: projectId } }).catch(() => null);
      if (!current) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: `Project "${projectId}" not found` } },
          { status: 404 }
        );
      }
      const currentState: ProjectLifecycleState =
        ((current as any)?.lifecycleState as ProjectLifecycleState) || 'ACTIVE';

      const validation = validateLifecycleTransition(currentState, targetState);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TRANSITION', message: validation.error } },
          { status: 400 }
        );
      }

      updateData.lifecycleState = targetState;
      if (validation.isArchival || targetState === 'ARCHIVED') {
        updateData.archivedAt = new Date();
      } else {
        updateData.archivedAt = null;
      }
    }

    // Direct archival toggle support
    if (body.archived !== undefined) {
      if (body.archived === true) {
        updateData.lifecycleState = 'ARCHIVED';
        updateData.archivedAt = new Date();
      } else {
        updateData.lifecycleState = 'ACTIVE';
        updateData.archivedAt = null;
      }
    }

    try {
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: updateData,
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatar: true, role: true },
          },
        },
      });

      await Promise.all([
        redisCache.delPattern('projects:*'),
        redisCache.delPattern('reports:*'),
      ]).catch(() => {});

      return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (dbErr) {
      console.error('[PATCH /api/projects/:id] DB update error:', dbErr);
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Project "${projectId}" not found or failed to update` } },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('[PATCH /api/projects/:id] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update project' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const sessionUserRole = (session?.user as { role?: string })?.role;
    const isPMOrAdmin =
      sessionUserRole === 'Project Manager' ||
      sessionUserRole === 'Admin' ||
      sessionUserRole === 'ADMIN' ||
      sessionUserRole === 'PROJECT_MANAGER' ||
      sessionUserRole?.toLowerCase() === 'project manager' ||
      sessionUserRole?.toLowerCase() === 'admin';

    if (!isPMOrAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Admins and Project Managers can delete projects' } },
        { status: 403 }
      );
    }

    const { id: projectId } = await context.params;

    try {
      await prisma.project.delete({
        where: { id: projectId },
      });
      return NextResponse.json(
        { success: true, data: { message: `Project "${projectId}" permanently deleted` } },
        { status: 200 }
      );
    } catch (dbErr) {
      console.error('[DELETE /api/projects/:id] DB error:', dbErr);
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Project "${projectId}" not found or already deleted` } },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('[DELETE /api/projects/:id] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete project' } },
      { status: 500 }
    );
  }
}
