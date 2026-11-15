import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';
import { normalizeDesignation, isSuperAdmin } from '@/lib/permissions';
import redisCache from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { role, plan, subscriptionStatus, teamId } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { team: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Safety rule: Primary super admin email cannot be demoted or deactivated
    if (existingUser.email === 'rasel4897981@gmail.com') {
      if (role && normalizeDesignation(role) !== 'Super Admin') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'The FlowSync primary Super Admin cannot be demoted.',
            },
          },
          { status: 403 }
        );
      }
      if (subscriptionStatus && subscriptionStatus !== 'active') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'The FlowSync primary Super Admin account cannot be suspended.',
            },
          },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, any> = {};

    if (role && typeof role === 'string') {
      updateData.role = normalizeDesignation(role);
    }

    if (plan && ['free', 'pro'].includes(plan.toLowerCase())) {
      updateData.plan = plan.toLowerCase();
    }

    if (subscriptionStatus && ['active', 'past_due', 'suspended'].includes(subscriptionStatus.toLowerCase())) {
      updateData.subscriptionStatus = subscriptionStatus.toLowerCase();
    }

    if (teamId !== undefined) {
      updateData.teamId = teamId || null;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        team: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${updatedUser.name} updated successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error('[Admin User PATCH Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { id } = await params;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { team: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Protection rule: Primary Super Admin and any Super Admin cannot be deleted
    if (
      existingUser.email === 'rasel4897981@gmail.com' ||
      isSuperAdmin({ email: existingUser.email, role: existingUser.role, teamName: existingUser.team?.name })
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Super Admin accounts cannot be deleted.',
          },
        },
        { status: 403 }
      );
    }

    // Atomic cascade deletion of user and all related data
    await prisma.$transaction(async (tx) => {
      // 1. Invoices
      await tx.invoice.deleteMany({ where: { userId: id } });

      // 2. Email verification codes
      if (existingUser.email) {
        await tx.verificationCode.deleteMany({
          where: { email: existingUser.email.toLowerCase().trim() },
        });
      }

      // 3. User notifications
      await tx.notification.deleteMany({ where: { userId: id } });

      // 4. Comments & replies authored by user
      await tx.comment.updateMany({
        where: { userId: id, replyToId: { not: null } },
        data: { replyToId: null },
      });
      await tx.comment.deleteMany({ where: { userId: id } });

      // 5. Project memberships, invitations, and join requests
      await tx.projectMember.deleteMany({ where: { userId: id } });
      await tx.projectJoinRequest.deleteMany({ where: { userId: id } });
      await tx.projectInvitation.deleteMany({ where: { invitedById: id } });
      await tx.teamInvitation.deleteMany({ where: { invitedById: id } });

      // 6. Detach user from assigned or created tasks
      await tx.task.updateMany({
        where: { OR: [{ assigneeId: id }, { creatorId: id }] },
        data: { assigneeId: null, creatorId: null },
      });

      // 7. Projects owned by this user
      const ownedProjects = await tx.project.findMany({
        where: { ownerId: id },
        select: { id: true },
      });
      const ownedProjectIds = ownedProjects.map((p) => p.id);

      if (ownedProjectIds.length > 0) {
        const tasksInOwned = await tx.task.findMany({
          where: { projectId: { in: ownedProjectIds } },
          select: { id: true },
        });
        const taskIdsInOwned = tasksInOwned.map((t) => t.id);

        if (taskIdsInOwned.length > 0) {
          await tx.notification.deleteMany({ where: { taskId: { in: taskIdsInOwned } } });
          await tx.comment.updateMany({
            where: { taskId: { in: taskIdsInOwned }, replyToId: { not: null } },
            data: { replyToId: null },
          });
          await tx.comment.deleteMany({ where: { taskId: { in: taskIdsInOwned } } });
          await tx.activity.deleteMany({ where: { taskId: { in: taskIdsInOwned } } });
          await tx.task.deleteMany({ where: { id: { in: taskIdsInOwned } } });
        }

        await tx.projectMember.deleteMany({ where: { projectId: { in: ownedProjectIds } } });
        await tx.projectInvitation.deleteMany({ where: { projectId: { in: ownedProjectIds } } });
        await tx.projectJoinRequest.deleteMany({ where: { projectId: { in: ownedProjectIds } } });
        await tx.project.deleteMany({ where: { id: { in: ownedProjectIds } } });
      }

      // 8. Delete user record
      await tx.user.delete({ where: { id } });
    });

    // Invalidate caches
    try {
      await Promise.allSettled([
        redisCache.del(`user:${id}`),
        redisCache.del(`tenant:${id}`),
        redisCache.delPattern('admin:users:*'),
        redisCache.delPattern('admin:metrics:*'),
        redisCache.delPattern('notifs:*'),
        redisCache.delPattern('projects:*'),
        redisCache.delPattern('tasks:*'),
      ]);
    } catch (cacheErr) {
      console.warn('[Admin User DELETE Cache Warning]:', cacheErr);
    }

    return NextResponse.json({
      success: true,
      message: `User "${existingUser.name}" (${existingUser.email}) and all associated data have been permanently deleted`,
    });
  } catch (error) {
    console.error('[Admin User DELETE Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' } },
      { status: 500 }
    );
  }
}

