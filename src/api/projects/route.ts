/**
 * src/api/projects/route.ts
 *
 * Projects collection endpoint — core API handler.
 *
 * Endpoints (re-exported via src/app/api/projects/route.ts):
 *   GET  /api/projects   — List all projects (with owner + task count)
 *   POST /api/projects   — Create a new project
 *
 * Architecture note:
 *   Business logic lives here. The Next.js App Router bridge at
 *   src/app/api/projects/route.ts simply re-exports these handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { recipientsWanting, wantsNotification } from '@/lib/notificationPrefs';
import { auth } from '@/auth';
import { CreateProjectSchema, validationError } from '@/lib/validators';
import redisCache from '@/lib/redis';
import { getOrProvisionUserTeam } from '@/lib/tenant';
import { canManageProject, getSessionUser } from '@/lib/access';

/**
 * Safely parse a date string. Returns undefined for empty, invalid, or
 * out-of-range (year < 2000 or > 2100) values.
 */
function parseSafeDate(raw: unknown): Date | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return undefined;
  return d;
}

/** Local midnight — tasks due before today are overdue (a task due today is not). */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    let currentUserId: string | undefined;
    let currentUserRole: string | undefined;
    let sessionTeamId: string | undefined;
    try {
      const session = await auth();
      currentUserId = session?.user?.id;
      currentUserRole = (session?.user as { role?: string })?.role;
      sessionTeamId = (session?.user as { teamId?: string })?.teamId;
    } catch {}

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Keyset pagination parameters
    const searchParams = request ? new URL(request.url).searchParams : new URLSearchParams();
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
    const cursor = searchParams.get('cursor') || undefined;

    // Fast-path tenant resolution: check session first for zero-latency in-memory resolution
    let resolvedTeamId = sessionTeamId;
    if (!resolvedTeamId) {
      const teamContext = await getOrProvisionUserTeam(currentUserId);
      resolvedTeamId = teamContext?.teamId;
    }

    const teamFilter = resolvedTeamId
      ? {
          OR: [
            { teamId: resolvedTeamId },
            { ownerId: currentUserId },
            { members: { some: { userId: currentUserId } } },
          ],
        }
      : {
          OR: [
            { ownerId: currentUserId },
            { members: { some: { userId: currentUserId } } },
          ],
        };

    const cacheKey = `projects:list:${currentUserId}:${resolvedTeamId || 'no-team'}:${limit}:${cursor || 'root'}`;
    const sessionUser = await getSessionUser();
    const formatted = await redisCache.wrap(cacheKey, 60, async () => {
      const dbProjects = await prisma.project.findMany({
        where: teamFilter,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          health: true,
          progress: true,
          startDate: true,
          dueDate: true,
          createdAt: true,
          ownerId: true,
          teamId: true,
          owner: {
            select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
          },
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              joinedAt: true,
              user: {
                select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
          joinRequests: {
            where: { status: 'pending' },
            select: {
              id: true,
              userId: true,
              status: true,
              message: true,
              createdAt: true,
              user: {
                select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

      const hasMore = dbProjects.length > limit;
      const items = hasMore ? dbProjects.slice(0, limit) : dbProjects;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

      // Completed / overdue counts for the whole page in two grouped queries (no per-project N+1)
      const projectIds = items.map(p => p.id);
      const [doneGroups, overdueGroups] = projectIds.length
        ? await Promise.all([
            prisma.task.groupBy({
              by: ['projectId'],
              where: { projectId: { in: projectIds }, status: 'done' },
              _count: { _all: true },
            }),
            prisma.task.groupBy({
              by: ['projectId'],
              where: { projectId: { in: projectIds }, status: { not: 'done' }, dueDate: { lt: startOfToday() } },
              _count: { _all: true },
            }),
          ])
        : [[], []];
      const doneByProject = new Map(doneGroups.map(g => [g.projectId, g._count._all]));
      const overdueByProject = new Map(overdueGroups.map(g => [g.projectId, g._count._all]));

      const projectList = items.map(p => {
        const isOwner = currentUserId ? p.ownerId === currentUserId : false;
        const memberList = (p.members || []).map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: m.user,
        }));

        const isMember = currentUserId
          ? (isOwner || memberList.some(m => m.userId === currentUserId))
          : false;

        const userJoinRequest = currentUserId
          ? p.joinRequests?.find(r => r.userId === currentUserId && r.status === 'pending')
          : undefined;

        const hasPendingRequest = !!userJoinRequest;

        // Same rules as the project page and the server's write checks (src/lib/access.ts)
        const canManage = sessionUser
          ? canManageProject({
              user: sessionUser,
              project: { id: p.id, ownerId: p.ownerId, teamId: p.teamId },
              isOwner,
              memberRole: memberList.find(m => m.userId === currentUserId)?.role ?? null,
            })
          : false;
        const pendingRequests = canManage
          ? (p.joinRequests || []).map(r => ({
              id: r.id,
              userId: r.userId,
              status: r.status,
              message: r.message,
              createdAt: r.createdAt.toISOString(),
              user: r.user,
            }))
          : [];

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          color: p.color,
          health: p.health,
          progress: p.progress,
          startDate: p.startDate ? p.startDate.toISOString() : null,
          dueDate: p.dueDate ? p.dueDate.toISOString() : null,
          createdAt: p.createdAt.toISOString(),
          ownerId: p.ownerId,
          owner: p.owner,
          taskCount: p._count.tasks,
          completedTasks: doneByProject.get(p.id) ?? 0,
          overdueTasks: overdueByProject.get(p.id) ?? 0,
          members: memberList,
          isMember,
          hasPendingRequest,
          isOwner,
          canManage,
          pendingRequests,
          pendingRequestsCount: pendingRequests.length,
          lifecycleState: (p as any).lifecycleState || 'ACTIVE',
          archivedAt: (p as any).archivedAt ? (p as any).archivedAt.toISOString() : null,
        };
      });

      return { items: projectList, meta: { hasMore, nextCursor, limit } };
    });

    return NextResponse.json({ success: true, data: formatted.items, meta: formatted.meta }, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[GET /api/projects] DB warning, returning empty list:', error);
    return NextResponse.json({ success: true, data: [], meta: { hasMore: false, nextCursor: null, limit: 50 } }, { status: 200 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const sessionUserId = session?.user?.id;
    const sessionUserRole = (session?.user as { role?: string })?.role;

    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be logged in to create a project' } },
        { status: 401 }
      );
    }

    // Role check: Only Admin and Project Manager can create projects
    const isPMOrAdmin =
      sessionUserRole === 'Project Manager' ||
      sessionUserRole === 'Admin' ||
      sessionUserRole === 'ADMIN' ||
      sessionUserRole === 'PROJECT_MANAGER' ||
      sessionUserRole?.toLowerCase() === 'project manager' ||
      sessionUserRole?.toLowerCase() === 'admin';
    if (!isPMOrAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Admins and Project Managers can create projects' } },
        { status: 403 }
      );
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

    // --- Zod validation ---
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { name, description, color, startDate, dueDate, initialMembers } = parsed.data;

    let validOwnerId = sessionUserId;
    try {
      const existingUser = await prisma.user.findUnique({ where: { id: validOwnerId } });
      if (!existingUser) {
        // Try finding user by email
        const userByEmail = session?.user?.email
          ? await prisma.user.findUnique({ where: { email: session.user.email } })
          : null;
        if (userByEmail) {
          validOwnerId = userByEmail.id;
        } else {
          // Create the user in the database so foreign key relation is guaranteed
          const createdUser = await prisma.user.create({
            data: {
              id: validOwnerId,
              name: session?.user?.name || 'Project Manager',
              email: session?.user?.email || `pm-${Date.now()}@flowsync.io`,
              role: sessionUserRole || 'Project Manager',
              avatar: (session?.user as { avatar?: string })?.avatar || session?.user?.name?.slice(0, 2).toUpperCase() || 'PM',
              expertise: [],
            },
          });
          validOwnerId = createdUser.id;
        }
      }
    } catch (userErr) {
      console.warn('[POST /api/projects] User verification warning, trying first DB user:', userErr);
      const fallbackUser = await prisma.user.findFirst().catch(() => null);
      if (fallbackUser) {
        validOwnerId = fallbackUser.id;
      }
    }

    // Resolve PM's team
    const teamContext = await getOrProvisionUserTeam(validOwnerId);

    let newProject: any;
    let populatedMembers: any[] = [];
    try {
      newProject = await prisma.project.create({
        data: {
          name,
          description: description || '',
          ownerId: validOwnerId,
          teamId: teamContext?.teamId,
          color: color || '#2563EB',
          startDate: parseSafeDate(startDate),
          dueDate:   parseSafeDate(dueDate),
          lifecycleState: 'ACTIVE',
        },
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatar: true, role: true },
          },
          _count: { select: { tasks: true } },
        },
      });

      // Automatically add the Project Manager as a ProjectMember with role 'OWNER'
      try {
        await prisma.projectMember.create({
          data: {
            projectId: newProject.id,
            userId: validOwnerId,
            role: 'OWNER',
          },
        });
      } catch (memErr) {
        console.warn('[POST /api/projects] Member creation warning:', memErr);
      }

      // Add selected initial team members — Optimized batch insertion O(1) roundtrip
      if (Array.isArray(initialMembers) && initialMembers.length > 0) {
        const uniqueMembers = new Map<string, string>();
        for (const item of initialMembers) {
          if (item.userId && item.userId !== validOwnerId) {
            uniqueMembers.set(item.userId, item.role || 'Member');
          }
        }

        const candidateIds = Array.from(uniqueMembers.keys());
        if (candidateIds.length > 0) {
          try {
            // Single batch query: verify all members belong to the tenant in 1 round trip
            const validUsers = await prisma.user.findMany({
              where: {
                id: { in: candidateIds },
                ...(teamContext?.teamId ? { teamId: teamContext.teamId } : {}),
              },
              select: { id: true },
            });
            const validUserSet = new Set(validUsers.map(u => u.id));

            const membersToInsert = candidateIds
              .filter(id => validUserSet.has(id))
              .map(id => ({
                projectId: newProject.id,
                userId: id,
                role: uniqueMembers.get(id) || 'Member',
              }));

            if (membersToInsert.length > 0) {
              await prisma.projectMember.createMany({
                data: membersToInsert,
                skipDuplicates: true,
              });

              // Fire notifications asynchronously without delaying HTTP response
              (async () => {
                try {
                  const wanting = new Set(await recipientsWanting(membersToInsert.map(m => m.userId), 'project_activity'));
                  const toNotify = membersToInsert.filter(m => wanting.has(m.userId));
                  if (toNotify.length === 0) return;
                  await prisma.notification.createMany({
                    data: toNotify.map(m => ({
                      userId: m.userId,
                      type: 'member_added',
                      title: 'Added to Project',
                      body: `You have been added to "${newProject.name}" as a ${m.role}.`,
                    })),
                    skipDuplicates: true,
                  });
                } catch {}
              })().catch(() => {});
            }
          } catch (initMemErr) {
            console.warn('[POST /api/projects] Failed batch initial members:', initMemErr);
          }
        }
      }

      // Retrieve populated members list to return in API response
      try {
        const dbMembers = await prisma.projectMember.findMany({
          where: { projectId: newProject.id },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        });
        populatedMembers = dbMembers.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: m.user,
        }));
      } catch {}
    } catch (dbErr) {
      console.error('[POST /api/projects] DB creation failed:', dbErr);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create project in database' } },
        { status: 500 }
      );
    }

    // Invalidate project and report caches
    await Promise.all([
      redisCache.delPattern('projects:*'),
      redisCache.delPattern('reports:*'),
    ]).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        ...newProject,
        isMember: true,
        isOwner: true,
        canManage: true,
        members: populatedMembers.length > 0 ? populatedMembers : ((newProject as any).members || []),
        pendingRequests: [],
        pendingRequestsCount: 0,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error while creating project' } },
      { status: 500 }
    );
  }
}
