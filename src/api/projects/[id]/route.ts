/**
 * src/api/projects/[id]/route.ts
 *
 * Single project resource API endpoint.
 *
 * GET    /api/projects/:id  — Returns project with owner, tasks list, and computed stats
 * PATCH  /api/projects/:id  — Updates project name, description, health, color, dates
 * DELETE /api/projects/:id  — Deletes project
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { projects as mockProjects, tasks as mockTasks, users as mockUsers } from '@/data/mockData';
import { UpdateProjectSchema, validationError } from '@/lib/validators';

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

      if (dbProject) {
        const totalTasks = dbProject.tasks.length;
        const completedTasks = dbProject.tasks.filter(t => t.status === 'done').length;
        const inProgressTasks = dbProject.tasks.filter(
          t => t.status === 'in_progress' || t.status === 'in_review'
        ).length;

        const now = new Date();
        const overdueTasks = dbProject.tasks.filter(
          t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now
        ).length;

        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return NextResponse.json(
          {
            success: true,
            data: {
              ...dbProject,
              totalTasks,
              completedTasks,
              inProgressTasks,
              overdueTasks,
              completionRate,
            },
          },
          { status: 200 }
        );
      }
    } catch (dbErr) {
      console.warn('[GET /api/projects/:id] DB query warning, falling back to mock:', dbErr);
    }

    // Fallback: search in mock projects
    const fallbackProject = mockProjects.find(p => p.id === projectId);
    if (!fallbackProject) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Project "${projectId}" not found` } },
        { status: 404 }
      );
    }

    const projectTasks = mockTasks
      .filter(t => t.projectId === projectId)
      .map(t => ({
        id: t.id,
        taskNumber: t.taskNumber ?? t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        estimate: t.estimate,
        assignee: t.assignee,
        _count: { subtasks: t.subtasks?.length ?? 0, comments: t.commentsCount ?? 0 },
      }));

    const totalTasks = projectTasks.length;
    const completedTasks = projectTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = projectTasks.filter(
      t => t.status === 'in_progress' || t.status === 'in_review'
    ).length;
    const overdueTasks = fallbackProject.overdueTasks ?? 0;
    const completionRate = fallbackProject.progress ?? 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          ...fallbackProject,
          tasks: projectTasks,
          totalTasks,
          completedTasks,
          inProgressTasks,
          overdueTasks,
          completionRate,
        },
      },
      { status: 200 }
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

      return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (dbErr) {
      console.warn('[PATCH /api/projects/:id] DB error, updating mock fallback:', dbErr);
    }

    // Mock fallback update
    const proj = mockProjects.find(p => p.id === projectId);
    if (proj) {
      if (name) proj.name = name;
      if (description) proj.description = description;
      if (color) proj.color = color;
      if (body.health) proj.health = body.health as any;
      return NextResponse.json({ success: true, data: proj }, { status: 200 });
    }

    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: `Project "${projectId}" not found` } },
      { status: 404 }
    );
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
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    try {
      await prisma.project.delete({
        where: { id: projectId },
      });
      return NextResponse.json(
        { success: true, data: { message: `Project "${projectId}" deleted` } },
        { status: 200 }
      );
    } catch (dbErr) {
      console.warn('[DELETE /api/projects/:id] DB error:', dbErr);
    }

    const idx = mockProjects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      mockProjects.splice(idx, 1);
      return NextResponse.json(
        { success: true, data: { message: `Project "${projectId}" deleted` } },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: `Project "${projectId}" not found` } },
      { status: 404 }
    );
  } catch (err) {
    console.error('[DELETE /api/projects/:id] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete project' } },
      { status: 500 }
    );
  }
}
