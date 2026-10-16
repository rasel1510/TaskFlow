/**
 * src/api/projects/[id]/requests/route.ts
 *
 * Project Join Requests API:
 *   GET   /api/projects/:id/requests — List join requests (PM sees all; User sees own)
 *   POST  /api/projects/:id/requests — Submit request to join project
 *   PATCH /api/projects/:id/requests — PM approve or reject a join request
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import redisCache from '@/lib/redis';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id/requests
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const session = await auth();
    const currentUserId = session?.user?.id;
    const currentUserRole = (session?.user as { role?: string })?.role;

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true, name: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    const isOwnerOrPM = project.ownerId === currentUserId || currentUserRole === 'Project Manager' || currentUserRole === 'Admin';

    // PM/Owner sees all pending requests; regular user sees their own request
    const whereClause = isOwnerOrPM
      ? { projectId }
      : { projectId, userId: currentUserId };

    const requests = await prisma.projectJoinRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            expertise: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: requests,
    }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/projects/:id/requests] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve join requests' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/:id/requests — User submits request to join project
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Check if already owner
    if (project.ownerId === currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_MEMBER', message: 'You are the owner of this project' } },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: currentUserId } },
    });
    if (existingMember) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_MEMBER', message: 'You are already a member of this project' } },
        { status: 400 }
      );
    }

    let body: { message?: string } = {};
    try {
      body = await request.json();
    } catch {}

    // Upsert join request (updates existing if previously rejected/pending)
    const joinRequest = await prisma.projectJoinRequest.upsert({
      where: {
        projectId_userId: { projectId, userId: currentUserId },
      },
      update: {
        status: 'pending',
        message: body.message || 'I would like to contribute to this project.',
        updatedAt: new Date(),
      },
      create: {
        projectId,
        userId: currentUserId,
        status: 'pending',
        message: body.message || 'I would like to contribute to this project.',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
        },
      },
    });

    // Notify project manager / owner
    try {
      await prisma.notification.create({
        data: {
          userId: project.ownerId,
          type: 'join_request',
          title: 'New Project Join Request',
          body: `${session.user?.name || 'A user'} has requested to join "${project.name}"`,
          taskId: projectId,
        },
      });
    } catch (notifErr) {
      console.warn('[POST /api/projects/:id/requests] Notification warning:', notifErr);
    }

    // Invalidate project cache
    await redisCache.delPattern('projects:*');

    return NextResponse.json({
      success: true,
      data: joinRequest,
      message: 'Request sent successfully to Project Manager',
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects/:id/requests] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit join request' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/:id/requests — PM approve or reject request
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const session = await auth();
    const currentUserId = session?.user?.id;
    const currentUserRole = (session?.user as { role?: string })?.role;

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Permission check: only Project Manager / owner or Admin can review requests
    const isAuthorized = project.ownerId === currentUserId || currentUserRole === 'Project Manager' || currentUserRole === 'Admin';
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only the Project Manager can approve or reject join requests' } },
        { status: 403 }
      );
    }

    let body: { requestId?: string; userId?: string; action: 'approve' | 'reject'; role?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const { requestId, userId, action, role } = body;
    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Action must be "approve" or "reject"' } },
        { status: 400 }
      );
    }

    // Find the join request
    const joinReq = requestId
      ? await prisma.projectJoinRequest.findUnique({ where: { id: requestId }, include: { user: true } })
      : userId
      ? await prisma.projectJoinRequest.findUnique({ where: { projectId_userId: { projectId, userId } }, include: { user: true } })
      : null;

    if (!joinReq || joinReq.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Join request not found' } },
        { status: 404 }
      );
    }

    const targetUserId = joinReq.userId;

    if (action === 'approve') {
      // 1. Mark request approved
      await prisma.projectJoinRequest.update({
        where: { id: joinReq.id },
        data: { status: 'approved', updatedAt: new Date() },
      });

      // 2. Add to ProjectMember
      const memberRole = role || 'CONTRIBUTOR';
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: targetUserId } },
        create: {
          projectId,
          userId: targetUserId,
          role: memberRole,
        },
        update: {
          role: memberRole,
        },
      });

      // 3. Notify applicant
      try {
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            type: 'request_approved',
            title: 'Project Request Approved!',
            body: `Your request to join "${project.name}" has been approved. You can now work on this project!`,
          },
        });
      } catch (notifErr) {
        console.warn('[PATCH /api/projects/:id/requests] Notification warning:', notifErr);
      }

      await redisCache.delPattern('projects:*');

      return NextResponse.json({
        success: true,
        message: `${joinReq.user?.name || 'User'} has been added to ${project.name}`,
      }, { status: 200 });
    } else {
      // Reject
      await prisma.projectJoinRequest.update({
        where: { id: joinReq.id },
        data: { status: 'rejected', updatedAt: new Date() },
      });

      try {
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            type: 'request_rejected',
            title: 'Project Request Update',
            body: `Your request to join "${project.name}" was not approved at this time.`,
          },
        });
      } catch (notifErr) {
        console.warn('[PATCH /api/projects/:id/requests] Notification warning:', notifErr);
      }

      await redisCache.delPattern('projects:*');

      return NextResponse.json({
        success: true,
        message: 'Join request rejected',
      }, { status: 200 });
    }
  } catch (error) {
    console.error('[PATCH /api/projects/:id/requests] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}
