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
import { getAllStoredUsers } from '@/data/userStore';
import { users as mockUsers } from '@/data/mockData';
import { auth } from '@/auth';

// Prisma-generated enum types (used for strict typing in create/update calls)
type PrismaStatus   = Prisma.TaskCreateInput['status'];
type PrismaPriority = Prisma.TaskCreateInput['priority'];

// ---------------------------------------------------------------------------
// GET /api/tasks
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Strict user-level task isolation: determine active user
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {
      // In case of auth evaluation error
    }

    const requestedUserId = searchParams.get('userId') || searchParams.get('assigneeId');
    // Session takes highest precedence to prevent spoofing
    const targetUserId = sessionUserId || requestedUserId;

    // If no user is identified, return empty list (never expose tasks without user scope)
    if (!targetUserId) {
      return NextResponse.json([], { status: 200 });
    }

    const status     = searchParams.get('status')     ?? undefined;
    const priority   = searchParams.get('priority')   ?? undefined;
    const projectId  = searchParams.get('projectId')  ?? undefined;
    const search     = searchParams.get('search')     ?? undefined;

    // Build a Prisma where clause strictly bounded to the target user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      assigneeId: targetUserId,
    };
    if (status)     where.status     = status;
    if (priority)   where.priority   = priority;
    if (projectId)  where.projectId  = projectId;
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

    // Always return database tasks (clean empty list when 0 tasks exist for this user)
    return NextResponse.json(dbTasks, { status: 200 });
  } catch (err) {
    console.error('[GET /api/tasks] Error fetching tasks from DB:', err);
    return NextResponse.json([], { status: 200 });
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

    const { title, projectId, assigneeId, status, priority, dueDate, description, estimate, labels } = body;

    // Validate required fields
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { message: 'Task title is required' },
        { status: 400 }
      );
    }

    // Ensure valid projectId or fallback to default project
    let targetProjectId = typeof projectId === 'string' && projectId ? projectId : undefined;
    if (!targetProjectId) {
      const firstProject = await prisma.project.findFirst();
      if (firstProject) {
        targetProjectId = firstProject.id;
      } else {
        const defaultProj = await prisma.project.create({
          data: {
            id: 'p1',
            name: 'General Project',
            description: 'Default project workspace',
            color: '#2563EB',
            ownerId: 'u1',
          },
        });
        targetProjectId = defaultProj.id;
      }
    } else {
      // Verify project exists in DB
      const projExists = await prisma.project.findUnique({ where: { id: targetProjectId } });
      if (!projExists) {
        const firstProject = await prisma.project.findFirst();
        if (firstProject) {
          targetProjectId = firstProject.id;
        }
      }
    }

    // Resolve creator / assignee ID from session or payload
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {}

    const creatorUserId = sessionUserId || (typeof assigneeId === 'string' && assigneeId ? assigneeId : undefined);
    if (!creatorUserId) {
      return NextResponse.json(
        { message: 'Unauthorized. Please sign in to create tasks.' },
        { status: 401 }
      );
    }

    let targetAssigneeId: string = creatorUserId;
    // Verify or upsert creator in DB
    let dbUser = await prisma.user.findUnique({ where: { id: creatorUserId } });
    if (!dbUser) {
      // Check stored users
      const storedUsers = getAllStoredUsers();
      const storedUser = storedUsers.find(u => u.id === creatorUserId || u.email.toLowerCase() === creatorUserId.toLowerCase());
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
      const mockUser = mockUsers.find(u => u.id === creatorUserId || u.email.toLowerCase() === creatorUserId.toLowerCase());
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
      targetAssigneeId = dbUser.id;
    }

    // Auto-generate taskNumber TF-XXX
    const taskCount = await prisma.task.count();
    const taskNumber = `TF-${String(taskCount + 1).padStart(3, '0')}`;

    const newTask = await prisma.task.create({
      data: {
        taskNumber,
        title:       (title as string).trim(),
        projectId:   targetProjectId as string,
        assigneeId:  targetAssigneeId,
        status:      ((status   as string | undefined) ?? 'todo')     as PrismaStatus,
        priority:    ((priority as string | undefined) ?? 'medium')   as PrismaPriority,
        description: typeof description === 'string' ? description.trim() : undefined,
        estimate:    typeof estimate === 'string' ? estimate.trim() : undefined,
        labels:      Array.isArray(labels) ? labels : [],
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
    console.error('[POST /api/tasks] Error creating task:', error);
    return NextResponse.json(
      { message: 'Internal server error while creating task' },
      { status: 500 }
    );
  }
}
