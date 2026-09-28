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

    // ── Resolve the active user ──────────────────────────────────────────────
    // Priority: server-side session > ?userId param > ?userEmail param
    // We intentionally support email-based lookup because session.user.id can
    // be stale after a password reset, but email is always canonical.
    let sessionUserId: string | undefined;
    let sessionUserEmail: string | undefined;
    try {
      const session = await auth();
      sessionUserId  = session?.user?.id    as string | undefined;
      sessionUserEmail = session?.user?.email as string | undefined;
    } catch {
      // auth() may throw in some edge cases — fall back to query params
    }

    const requestedUserId    = searchParams.get('userId')    || undefined;
    const requestedUserEmail = searchParams.get('userEmail') || undefined;

    const targetUserId    = sessionUserId    || requestedUserId;
    const targetUserEmail = sessionUserEmail || requestedUserEmail;

    // Resolve the canonical DB user ID from email when the ID is not available
    // or when we want to catch tasks assigned via a fallback ID
    let resolvedDbUserId: string | undefined = targetUserId;
    if (targetUserEmail && !resolvedDbUserId) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: targetUserEmail.toLowerCase().trim() },
          select: { id: true },
        });
        resolvedDbUserId = dbUser?.id;
      } catch { /* non-critical */ }
    }

    // Collect ALL user IDs that could own tasks for this person
    // This handles the case where tasks were created with a fallback/wrong assigneeId
    const userIdSet = new Set<string>();
    if (resolvedDbUserId) userIdSet.add(resolvedDbUserId);
    if (targetUserId && targetUserId !== resolvedDbUserId) userIdSet.add(targetUserId);

    // If we have an email, also find assignee by email match for legacy data
    if (targetUserEmail) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: targetUserEmail.toLowerCase().trim() },
          select: { id: true },
        });
        if (dbUser) userIdSet.add(dbUser.id);
      } catch { /* non-critical */ }
    }

    if (userIdSet.size === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { hasMore: false, nextCursor: null, limit: 50 },
      }, { status: 200 });
    }

    // Parse and validate query parameters
    const rawParams = {
      limit:     searchParams.get('limit')     ?? undefined,
      cursor:    searchParams.get('cursor')    ?? undefined,
      status:    searchParams.get('status')    ?? undefined,
      priority:  searchParams.get('priority')  ?? undefined,
      projectId: searchParams.get('projectId') ?? undefined,
      search:    searchParams.get('search')    ?? undefined,
    };

    const parsedQuery = TaskQuerySchema.safeParse(rawParams);
    const query = parsedQuery.success ? parsedQuery.data : {
      limit: 50, cursor: undefined, status: undefined,
      priority: undefined, projectId: undefined, search: undefined,
    };

    const limit  = query.limit ?? 50;
    const cursor = query.cursor;

    // Build Prisma where — match any of the user's known IDs, projects owned by user, or projects where user is member
    const userIds = Array.from(userIdSet);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      OR: [
        { assigneeId: { in: userIds } },
        { project: { ownerId: { in: userIds } } },
        { project: { members: { some: { userId: { in: userIds } } } } },
      ],
    };
    if (query.status)    where.status    = query.status;
    if (query.priority)  where.priority  = query.priority;
    if (query.projectId) where.projectId = query.projectId;
    if (query.search)    where.title     = { contains: query.search, mode: 'insensitive' };

    const primaryId  = resolvedDbUserId || Array.from(userIdSet)[0];
    const cacheKey   = `tasks:${primaryId}:${JSON.stringify(query)}`;

    // Tiered cache — 30s TTL
    const result = await redisCache.wrap(cacheKey, 30, async () => {
      const dbTasks = await prisma.task.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatar: true, role: true },
          },
          project:  true,
          subtasks: true,
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });

      const hasMore    = dbTasks.length > limit;
      const items      = hasMore ? dbTasks.slice(0, limit) : dbTasks;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

      return { items, meta: { hasMore, nextCursor, limit } };
    });

    return NextResponse.json({
      success: true,
      data:    result.items,
      meta:    result.meta,
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

    // 1. Resolve creator / assignee — prefer email (always canonical) over ID
    let sessionUserId:    string | undefined;
    let sessionUserEmail: string | undefined;
    try {
      const session = await auth();
      sessionUserId    = session?.user?.id    as string | undefined;
      sessionUserEmail = session?.user?.email as string | undefined;
    } catch {}

    const queryUserId    = request.nextUrl.searchParams.get('userId')    || undefined;
    const queryUserEmail = request.nextUrl.searchParams.get('userEmail') || undefined;

    const resolvedEmail = (sessionUserEmail || queryUserEmail || '')?.toLowerCase().trim();
    const resolvedId    = sessionUserId || queryUserId;

    if (!resolvedEmail && !resolvedId) {
      return NextResponse.json(
        { message: 'Unauthorized. Please sign in to create tasks.' },
        { status: 401 }
      );
    }

    // Resolve DB user — email lookup is most reliable
    let dbUser = null;
    if (resolvedEmail) {
      try {
        dbUser = await prisma.user.findUnique({ where: { email: resolvedEmail } });
      } catch { /* try ID next */ }
    }
    if (!dbUser && resolvedId) {
      try {
        dbUser = await prisma.user.findUnique({ where: { id: resolvedId } });
      } catch { /* try local store next */ }
    }
    if (!dbUser) {
      // Try local userStore
      const storedUsers = getAllStoredUsers();
      const storedUser = storedUsers.find(u =>
        (resolvedEmail && u.email.toLowerCase() === resolvedEmail) ||
        (resolvedId    && u.id === resolvedId)
      );
      if (storedUser) {
        try {
          dbUser = await prisma.user.upsert({
            where: { email: storedUser.email },
            update: { name: storedUser.name, avatar: storedUser.avatar, role: storedUser.role },
            create: {
              id:     storedUser.id,
              name:   storedUser.name,
              email:  storedUser.email,
              avatar: storedUser.avatar,
              role:   storedUser.role,
            },
          });
        } catch { dbUser = null; }
      }
    }
    if (!dbUser) {
      // Try mock users
      const mockUser = mockUsers.find(u =>
        (resolvedEmail && u.email.toLowerCase() === resolvedEmail) ||
        (resolvedId    && u.id === resolvedId)
      );
      if (mockUser) {
        try {
          dbUser = await prisma.user.upsert({
            where: { id: mockUser.id },
            update: {},
            create: { id: mockUser.id, name: mockUser.name, email: mockUser.email, avatar: mockUser.avatar, role: mockUser.role },
          });
        } catch { dbUser = null; }
      }
    }
    if (!dbUser) {
      return NextResponse.json(
        { message: 'Unauthorized. Please sign in to create tasks.' },
        { status: 401 }
      );
    }

    const targetAssigneeId = dbUser.id;

    // 2. Project Assignment & Permission Check:
    // If projectId is provided, user must be the Project Owner, an Admin, or an approved Project Member.
    // If projectId is empty / omitted, this is an independent personal task for the user alone.
    let targetProjectId: string | null = null;
    const requestedProjectId = typeof projectId === 'string' && projectId.trim() ? projectId.trim() : undefined;

    if (requestedProjectId) {
      const targetProject = await prisma.project.findUnique({
        where: { id: requestedProjectId },
        include: { members: true },
      });

      if (!targetProject) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
          { status: 404 }
        );
      }

      const isOwner = targetProject.ownerId === dbUser.id;
      const isAdminOrPM = dbUser.role === 'Admin' || (dbUser.role === 'Project Manager' && isOwner);
      const isMember = targetProject.members.some(m => m.userId === dbUser.id);

      if (!isOwner && !isAdminOrPM && !isMember) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You are not a member of this project. You must be added by the Project Manager or have an approved join request to create tasks in this project.',
            },
          },
          { status: 403 }
        );
      }

      targetProjectId = targetProject.id;
    }

    // 3. Auto-generate taskNumber TF-XXX
    const taskCount = await prisma.task.count();
    const taskNumber = `TF-${String(taskCount + 1).padStart(3, '0')}`;

    const newTask = await prisma.task.create({
      data: {
        taskNumber,
        title:       (title as string).trim(),
        projectId:   targetProjectId,
        assigneeId:  targetAssigneeId,
        status:      ((status   as string | undefined) ?? 'todo')     as PrismaStatus,
        priority:    ((priority as string | undefined) ?? 'medium')   as PrismaPriority,
        description: typeof description === 'string' ? description.trim() : undefined,
        estimate:    typeof estimate === 'string' ? estimate.trim() : undefined,
        labels:      Array.isArray(labels) ? labels : [],
        dueDate:     parseSafeDate(dueDate),
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        },
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
