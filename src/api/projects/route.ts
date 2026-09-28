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
import { projects as mockProjects } from '@/data/mockData';
import { CreateProjectSchema, validationError } from '@/lib/validators';
import redisCache from '@/lib/redis';

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

    const dbProjects = await prisma.project.findMany({
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
      };
    });

    return NextResponse.json({ success: true, data: formatted }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[GET /api/projects] DB warning, falling back to mock:', error);
    return NextResponse.json({ success: true, data: mockProjects }, { status: 200 });
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

    // Role check: Only Project Manager can create projects
    const isPM = sessionUserRole === 'Project Manager' || sessionUserRole?.toLowerCase() === 'project manager';
    if (!isPM) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Project Managers can create projects' } },
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

    const { name, description, color, startDate, dueDate } = parsed.data;

    const validOwnerId = sessionUserId;

    const newProject = await prisma.project.create({
      data: {
        name,
        description,
        ownerId: validOwnerId,
        color: color || '#2563EB',
        startDate: parseSafeDate(startDate),
        dueDate:   parseSafeDate(dueDate),
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

    // Invalidate project and report caches
    await Promise.all([
      redisCache.delPattern('projects:*'),
      redisCache.delPattern('reports:*'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...newProject,
        isMember: true,
        isOwner: true,
        canManage: true,
        members: [],
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
