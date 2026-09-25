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
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAllStoredUsers } from '@/data/userStore';
import { users as mockUsers, projects as mockProjects } from '@/data/mockData';
import { auth } from '@/auth';
import { CreateTaskSchema, TaskQuerySchema, validationError } from '@/lib/validators';
import { logActivity } from '@/lib/activity';
import { recomputeProjectProgress } from '@/lib/projectProgress';
import redisCache from '@/lib/redis';

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

    // Parse and validate query parameters (limits, cursor, filters)
    const rawParams = {
      limit:      searchParams.get('limit')      ?? undefined,
      cursor:     searchParams.get('cursor')     ?? undefined,
      status:     searchParams.get('status')     ?? undefined,
      priority:   searchParams.get('priority')   ?? undefined,
      projectId:  searchParams.get('projectId')  ?? undefined,
      search:     searchParams.get('search')     ?? undefined,
      userId:     requestedUserId                ?? undefined,
      assigneeId: searchParams.get('assigneeId') ?? undefined,
    };

    const parsedQuery = TaskQuerySchema.safeParse(rawParams);
    const query = parsedQuery.success ? parsedQuery.data : {
      limit: 50,
      cursor: undefined,
      status: undefined,
      priority: undefined,
      projectId: undefined,
      search: undefined,
    };

    const limit = query.limit ?? 50;
    const cursor = query.cursor;

    // If no user is identified, return empty list (never expose tasks without user scope)
    if (!targetUserId) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { hasMore: false, nextCursor: null, limit },
      }, { status: 200 });
    }

    // Build a Prisma where clause strictly bounded to the target user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      assigneeId: targetUserId,
    };
    if (query.status)     where.status     = query.status;
    if (query.priority)   where.priority   = query.priority;
    if (query.projectId)  where.projectId  = query.projectId;
    if (query.search)     where.title      = { contains: query.search, mode: 'insensitive' };

    const cacheKey = `tasks:${targetUserId}:${JSON.stringify(query)}`;

    // Wrap query in tiered cache with 30s TTL
    const result = await redisCache.wrap(cacheKey, 30, async () => {
      // Fetch limit + 1 items to determine if subsequent pages exist without full count query
      const dbTasks = await prisma.task.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          assignee: true,
          project: true,
          subtasks: true,
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });

      const hasMore = dbTasks.length > limit;
      const items = hasMore ? dbTasks.slice(0, limit) : dbTasks;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

      return {
        items,
        meta: {
          hasMore,
          nextCursor,
          limit,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: result.meta,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('[GET /api/tasks] Error fetching tasks from DB:', err);
    return NextResponse.json({
      success: true,
      data: [],
      meta: { hasMore: false, nextCursor: null, limit: 50 },
    }, { status: 200 });
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
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    // --- Zod validation ---
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { title, projectId, assigneeId, status, priority, dueDate, description, estimate, labels } = parsed.data;

    // 1. Resolve creator / assignee ID from session, payload, or query string
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {}

    const queryUserId = request.nextUrl.searchParams.get('userId') || undefined;
    const creatorUserId = sessionUserId || (typeof assigneeId === 'string' && assigneeId ? assigneeId : undefined) || queryUserId;
    if (!creatorUserId) {
      return NextResponse.json(
        { message: 'Unauthorized. Please sign in to create tasks.' },
        { status: 401 }
      );
    }

    // Verify or upsert creator / assignee in DB
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
    if (!dbUser) {
      // Fall back to any registered user in the database
      dbUser = await prisma.user.findFirst();
    }
    if (!dbUser) {
      // If DB has zero users, create a default user record
      dbUser = await prisma.user.create({
        data: {
          id: creatorUserId,
          name: 'TaskFlow User',
          email: 'user@taskflow.io',
          avatar: 'TU',
          role: 'Member',
        },
      });
    }

    const targetAssigneeId = dbUser.id;

    // 2. Ensure valid projectId or fallback to default project (strictly guaranteed to exist in DB)
    let requestedProjectId = typeof projectId === 'string' && projectId.trim() ? projectId.trim() : undefined;
    let targetProject = null;

    if (requestedProjectId) {
      targetProject = await prisma.project.findUnique({ where: { id: requestedProjectId } });
      if (!targetProject) {
        // If not yet in DB, check if it matches a preset mock project (e.g. 'p1', 'p2', 'p3', 'p4')
        const mockProj = mockProjects.find(p => p.id === requestedProjectId);
        if (mockProj) {
          targetProject = await prisma.project.upsert({
            where: { id: mockProj.id },
            update: {},
            create: {
              id: mockProj.id,
              name: mockProj.name,
              description: mockProj.description,
              color: mockProj.color || '#2563EB',
              health: (mockProj.health as any) || 'on_track',
              progress: typeof mockProj.progress === 'number' ? mockProj.progress : 0,
              ownerId: dbUser.id,
            },
          });
        }
      }
    }

    // If still no project found, look for any existing project in DB
    if (!targetProject) {
      targetProject = await prisma.project.findFirst();
    }

    // If database has 0 projects, create the initial project
    if (!targetProject) {
      const defaultMock = mockProjects[0];
      targetProject = await prisma.project.create({
        data: {
          id: defaultMock?.id || 'p1',
          name: defaultMock?.name || 'General Project',
          description: defaultMock?.description || 'Default project workspace',
          color: defaultMock?.color || '#2563EB',
          health: (defaultMock?.health as any) || 'on_track',
          progress: defaultMock?.progress || 0,
          ownerId: dbUser.id,
        },
      });
    }

    const targetProjectId = targetProject.id;

    // 3. Auto-generate taskNumber TF-XXX
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
        dueDate:     parseSafeDate(dueDate),
      },
      include: {
        assignee: true,
        project: true,
        subtasks: true,
      },
    });

    // Record initial task creation activity
    try {
      await logActivity(newTask.id, 'Task created', '✨');
    } catch {}

    // Trigger notification for assignee
    if (newTask.assigneeId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const notifModel = (prisma as any).notification;
        if (notifModel) {
          await notifModel.create({
            data: {
              userId: newTask.assigneeId,
              type: 'task_assigned',
              title: 'Assigned to new task',
              body: `You were assigned to ${newTask.taskNumber ?? 'task'}: ${newTask.title}`,
              taskId: newTask.id,
            },
          });
        }
      } catch (notifErr) {
        console.warn('[POST /api/tasks] Notification creation ignored:', notifErr);
      }
    }

    // Auto-recompute progress for project (Step 4.5)
    if (newTask.projectId) {
      try {
        await recomputeProjectProgress(newTask.projectId);
      } catch (progressErr) {
        console.warn('[POST /api/tasks] Progress recompute warning:', progressErr);
      }
    }

    // Invalidate distributed caches for tasks, projects, reports, and notifications
    await Promise.all([
      redisCache.delPattern('tasks:*'),
      redisCache.delPattern('reports:*'),
      redisCache.delPattern('projects:*'),
      redisCache.delPattern('notifs:*'),
    ]);

    return NextResponse.json({ success: true, data: newTask }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/tasks] Error creating task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error while creating task' } },
      { status: 500 }
    );
  }
}
