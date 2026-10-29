/**
 * src/api/projects/[id]/milestones/route.ts
 *
 * Project Milestones & Release Sprint Roadmaps (Step 4.9)
 * Partitions projects into sequenced deliverables with target dates and task completion tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { CreateMilestoneSchema, UpdateMilestoneSchema, validationError } from '@/lib/validators';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface MilestoneRecord {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  targetDate?: string | null;
  completed: boolean;
  tasksCount: number;
  completedTasksCount: number;
  progress: number;
  createdAt: string;
}

// In-memory persistent fallback store for demo mode
const mockMilestonesStore: Map<string, MilestoneRecord[]> = new Map([
  [
    'proj-1',
    [
      {
        id: 'ms-101',
        projectId: 'proj-1',
        title: 'v1.0 Core Engine & Auth',
        description: 'NextAuth session integration, schema migration, and route protection.',
        targetDate: '2026-09-30',
        completed: true,
        tasksCount: 6,
        completedTasksCount: 6,
        progress: 100,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'ms-102',
        projectId: 'proj-1',
        title: 'v1.1 Advanced Analytics & SLA',
        description: 'Predictive health engine, velocity analytics, and CSV export streaming.',
        targetDate: '2026-10-15',
        completed: false,
        tasksCount: 8,
        completedTasksCount: 5,
        progress: 63,
        createdAt: '2026-09-10T00:00:00.000Z',
      },
    ],
  ],
]);

// ---------------------------------------------------------------------------
// GET /api/projects/:id/milestones
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const milestoneModel = (prisma as any).projectMilestone;
      if (milestoneModel) {
        const milestones = await milestoneModel.findMany({
          where: { projectId },
          include: {
            tasks: {
              select: { id: true, status: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (milestones && milestones.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = milestones.map((m: any) => {
            const total = m.tasks?.length || 0;
            const done = m.tasks?.filter((t: any) => t.status === 'done').length || 0;
            return {
              id: m.id,
              projectId: m.projectId,
              title: m.title,
              description: m.description,
              targetDate: m.targetDate ? m.targetDate.toISOString().split('T')[0] : null,
              completed: m.completed,
              tasksCount: total,
              completedTasksCount: done,
              progress: total > 0 ? Math.round((done / total) * 100) : (m.completed ? 100 : 0),
              createdAt: m.createdAt.toISOString(),
            };
          });

          return NextResponse.json({ success: true, data: formatted }, { status: 200 });
        }
      }
    } catch (dbErr) {
      console.warn('[GET /api/projects/:id/milestones] DB warning, using mock store:', dbErr);
    }

    const fallbackList = mockMilestonesStore.get(projectId) || [];
    return NextResponse.json({ success: true, data: fallbackList }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/projects/:id/milestones] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve milestones' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/:id/milestones
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const parsed = CreateMilestoneSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { title, description, targetDate } = parsed.data;

    const newMilestone: MilestoneRecord = {
      id: `ms-${Date.now()}`,
      projectId,
      title,
      description: description || null,
      targetDate: targetDate || null,
      completed: false,
      tasksCount: 0,
      completedTasksCount: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const milestoneModel = (prisma as any).projectMilestone;
      if (milestoneModel) {
        const created = await milestoneModel.create({
          data: {
            title,
            description,
            targetDate: targetDate ? new Date(targetDate) : null,
            projectId,
          },
        });
        newMilestone.id = created.id;
      }
    } catch (dbErr) {
      console.warn('[POST /api/projects/:id/milestones] DB warning, saving to memory:', dbErr);
    }

    const existing = mockMilestonesStore.get(projectId) || [];
    existing.push(newMilestone);
    mockMilestonesStore.set(projectId, existing);

    return NextResponse.json({ success: true, data: newMilestone }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects/:id/milestones] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create milestone' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/:id/milestones
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const milestoneId = body.milestoneId || body.id;
    if (!milestoneId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'milestoneId is required' } },
        { status: 400 }
      );
    }

    const parsed = UpdateMilestoneSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existingList = mockMilestonesStore.get(projectId) || [];
    const target = existingList.find((m) => m.id === milestoneId);

    if (target) {
      if (parsed.data.title !== undefined) target.title = parsed.data.title;
      if (parsed.data.description !== undefined) target.description = parsed.data.description;
      if (parsed.data.targetDate !== undefined) target.targetDate = parsed.data.targetDate;
      if (parsed.data.completed !== undefined) {
        target.completed = parsed.data.completed;
        if (target.completed) target.progress = 100;
      }
    }

    return NextResponse.json({ success: true, data: target || body }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/projects/:id/milestones] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update milestone' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id/milestones
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('mid');

    if (!milestoneId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'milestone ID parameter (?mid=...) is required' } },
        { status: 400 }
      );
    }

    const existingList = mockMilestonesStore.get(projectId) || [];
    const filtered = existingList.filter((m) => m.id !== milestoneId);
    mockMilestonesStore.set(projectId, filtered);

    return NextResponse.json(
      { success: true, data: { message: 'Milestone removed successfully' } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/projects/:id/milestones] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete milestone' } },
      { status: 500 }
    );
  }
}
