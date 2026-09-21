/**
 * src/api/tasks/route.ts
 *
 * Tasks collection endpoint — core API handler.
 *
 * Endpoints (re-exported via src/app/api/tasks/route.ts):
 *   GET  /api/tasks   — List tasks with optional filters
 *   POST /api/tasks   — Create a new task
 *
 * Query parameters for GET:
 *   ?status=in_progress        filter by status
 *   ?priority=high             filter by priority
 *   ?projectId=<id>            filter by project
 *   ?search=<term>             full-text search on title
 *   ?assigneeId=<id>           filter by assignee
 *
 * Architecture note:
 *   Business logic lives here.
 *   The Next.js App Router file at src/app/api/tasks/route.ts
 *   simply re-exports { GET, POST } from this module.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { tasks as mockTasks } from '@/data/mockData';

// Prisma-generated enum types (used for strict typing in create/update calls)
type PrismaStatus   = Prisma.TaskCreateInput['status'];
type PrismaPriority = Prisma.TaskCreateInput['priority'];

// ---------------------------------------------------------------------------
// GET /api/tasks
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const status     = searchParams.get('status')     ?? undefined;
    const priority   = searchParams.get('priority')   ?? undefined;
    const projectId  = searchParams.get('projectId')  ?? undefined;
    const assigneeId = searchParams.get('assigneeId') ?? undefined;
    const search     = searchParams.get('search')     ?? undefined;

    // Build a Prisma where clause from any filters provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (status)     where.status     = status;
    if (priority)   where.priority   = priority;
    if (projectId)  where.projectId  = projectId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (search)     where.title      = { contains: search, mode: 'insensitive' };

    const dbTasks = await prisma.task.findMany({
      where,
      include: {
        assignee: true,
        project: true,
        subtasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return real DB data when available; fall back to mock data in dev/offline
    const tasks = dbTasks.length > 0 ? dbTasks : mockTasks;
    return NextResponse.json(tasks, { status: 200 });
  } catch {
    // Graceful fallback when the database is unavailable (offline dev mode)
    return NextResponse.json(mockTasks, { status: 200 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/tasks
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const { title, projectId, assigneeId, status, priority, dueDate, description } = body;

    // Validate required fields
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { message: 'Task title is required' },
        { status: 400 }
      );
    }
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { message: 'projectId is required' },
        { status: 400 }
      );
    }

    const newTask = await prisma.task.create({
      data: {
        title:       (title as string).trim(),
        projectId:   projectId as string,
        assigneeId:  assigneeId as string | undefined,
        status:      ((status   as string | undefined) ?? 'todo')     as PrismaStatus,
        priority:    ((priority as string | undefined) ?? 'medium')   as PrismaPriority,
        description: description as string | undefined,
        dueDate:     dueDate ? new Date(dueDate as string) : undefined,
      },
      include: {
        assignee: true,
        project: true,
        subtasks: true,
      },
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('[POST /api/tasks] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error while creating task' },
      { status: 500 }
    );
  }
}
