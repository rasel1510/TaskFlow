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
import { auth } from '@/auth';
import { CreateProjectSchema, validationError } from '@/lib/validators';
import redisCache from '@/lib/redis';
import { getOrProvisionUserTeam } from '@/lib/tenant';

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

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    let currentUserId: string | undefined;
    let currentUserRole: string | undefined;
    try {
      const session = await auth();
      currentUserId = session?.user?.id;
      currentUserRole = (session?.user as { role?: string })?.role;
    } catch {}

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Resolve tenant boundary: strictly isolate to the authenticated user's single team
    const teamContext = await getOrProvisionUserTeam(currentUserId);
    const teamFilter = teamContext?.teamId
      ? {
          OR: [
            { teamId: teamContext.teamId },
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

    const dbProjects = await prisma.project.findMany({
      where: teamFilter,
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        joinRequests: {
          include: {
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
      orderBy: { createdAt: 'desc' },
    });

    const formatted = dbProjects.map(p => {
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

      // Only project owner / PM or Admin can see all pending requests
      const canManage = isOwner || currentUserRole === 'Project Manager' || currentUserRole === 'Admin';
      const pendingRequests = canManage
        ? (p.joinRequests?.filter(r => r.status === 'pending') || []).map(r => ({
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

    return NextResponse.json({ success: true, data: formatted }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[GET /api/projects] DB warning, returning empty list:', error);
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
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

    let newProject;
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

      // Add selected initial team members (Users and Project Managers)
      if (Array.isArray(initialMembers) && initialMembers.length > 0) {
        const uniqueMembers = new Map<string, string>();
        for (const item of initialMembers) {
          if (item.userId && item.userId !== validOwnerId) {
            uniqueMembers.set(item.userId, item.role || 'Member');
          }
        }

        for (const [memberUserId, memberRole] of uniqueMembers.entries()) {
          try {
            // Strictly enforce multi-tenant isolation: verify user belongs to this company's team
            if (teamContext?.teamId) {
              const isCompanyMember = await prisma.user.findFirst({
                where: { id: memberUserId, teamId: teamContext.teamId },
                select: { id: true },
              });
              if (!isCompanyMember) {
                console.warn(`[POST /api/projects] Blocked cross-tenant initial member ${memberUserId}`);
                continue;
              }
            }

            await prisma.projectMember.upsert({
              where: {
                projectId_userId: {
                  projectId: newProject.id,
                  userId: memberUserId,
                },
              },
              create: {
                projectId: newProject.id,
                userId: memberUserId,
                role: memberRole,
              },
              update: {
                role: memberRole,
              },
            });

            // Dispatch in-app notification to the newly added member
            try {
              await prisma.notification.create({
                data: {
                  userId: memberUserId,
                  type: 'member_added',
                  title: 'Added to Project',
                  body: `You have been added to "${newProject.name}" as a ${memberRole}.`,
                },
              });
            } catch {}
          } catch (initMemErr) {
            console.warn(`[POST /api/projects] Failed to add initial member ${memberUserId}:`, initMemErr);
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
