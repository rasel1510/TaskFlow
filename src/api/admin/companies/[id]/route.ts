import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';
import { isSuperAdmin } from '@/lib/permissions';
import redisCache from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { id } = await params;

  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, projects: true, invitations: true },
        },
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            plan: true,
            subscriptionStatus: true,
            createdAt: true,
          },
        },
        projects: {
          include: {
            _count: { select: { tasks: true, members: true } },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: team });
  } catch (error) {
    console.error('[Admin Company GET Detail Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve company details' } },
      { status: 500 }
    );
  }
}

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
    const { name, plan, status } = body;

    const existingTeam = await prisma.team.findUnique({ where: { id } });
    if (!existingTeam) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 }
      );
    }

    // 1. Update company name if provided
    let updatedTeam = existingTeam;
    if (name && typeof name === 'string' && name.trim()) {
      updatedTeam = await prisma.team.update({
        where: { id },
        data: { name: name.trim() },
      });
    }

    // 2. Cascade plan change to all company members
    if (plan && ['free', 'pro'].includes(plan.toLowerCase())) {
      await prisma.user.updateMany({
        where: { teamId: id },
        data: { plan: plan.toLowerCase() },
      });
    }

    // 3. Cascade subscription status change to all company members
    if (status && ['active', 'past_due', 'suspended'].includes(status.toLowerCase())) {
      await prisma.user.updateMany({
        where: { teamId: id },
        data: { subscriptionStatus: status.toLowerCase() },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Company "${updatedTeam.name}" updated successfully`,
      data: updatedTeam,
    });
  } catch (error) {
    console.error('[Admin Company PATCH Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update company' } },
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
    const existingTeam = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    if (!existingTeam) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 }
      );
    }

    // Protection rule: FlowSync platform owner organization can never be deleted
    const teamNameLower = existingTeam.name.toLowerCase().trim();
    const teamSlugLower = existingTeam.slug.toLowerCase().trim();
    if (teamNameLower === 'flowsync' || teamSlugLower === 'flowsync') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'The FlowSync software owner organization cannot be deleted.',
          },
        },
        { status: 403 }
      );
    }

    // Identify member users
    const members = existingTeam.members || [];
    const nonSuperAdminMembers = members.filter(
      (m) => !isSuperAdmin({ email: m.email, role: m.role })
    );
    const nonSuperAdminMemberIds = nonSuperAdminMembers.map((m) => m.id);
    const nonSuperAdminEmails = nonSuperAdminMembers
      .map((m) => m.email?.toLowerCase().trim())
      .filter((email): email is string => Boolean(email));
    const superAdminMemberIds = members
      .filter((m) => isSuperAdmin({ email: m.email, role: m.role }))
      .map((m) => m.id);

    // Retrieve all project IDs under this company
    const companyProjects = await prisma.project.findMany({
      where: { teamId: id },
      select: { id: true },
    });
    const projectIds = companyProjects.map((p) => p.id);

    // Retrieve all task IDs across these projects
    const companyTasks = projectIds.length > 0
      ? await prisma.task.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true },
        })
      : [];
    const taskIds = companyTasks.map((t) => t.id);

    // Deep atomic purge: completely eliminate the entire history of this company
    await prisma.$transaction(async (tx) => {
      // 1. Delete notifications pointing to any tasks in this company
      if (taskIds.length > 0) {
        await tx.notification.deleteMany({
          where: { taskId: { in: taskIds } },
        });
      }

      // 2. Delete task comments and break circular reply references
      if (taskIds.length > 0) {
        await tx.comment.updateMany({
          where: { taskId: { in: taskIds }, replyToId: { not: null } },
          data: { replyToId: null },
        });
        await tx.comment.deleteMany({
          where: { taskId: { in: taskIds } },
        });
      }

      // 3. Delete task activity logs (task audit trail / history)
      if (taskIds.length > 0) {
        await tx.activity.deleteMany({
          where: { taskId: { in: taskIds } },
        });
      }

      // 4. Delete tasks in company projects
      if (projectIds.length > 0) {
        await tx.task.deleteMany({
          where: { projectId: { in: projectIds } },
        });
      }

      // 5. Delete project memberships, invitations, and join requests
      if (projectIds.length > 0) {
        await tx.projectMember.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        await tx.projectInvitation.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        await tx.projectJoinRequest.deleteMany({
          where: { projectId: { in: projectIds } },
        });
      }

      // 6. Delete all projects for this company
      if (projectIds.length > 0) {
        await tx.project.deleteMany({
          where: { id: { in: projectIds } },
        });
      }

      // 7. Delete all pending, accepted, or expired team invitations
      await tx.teamInvitation.deleteMany({
        where: { teamId: id },
      });

      // 8. Purge notifications for company members
      if (nonSuperAdminMemberIds.length > 0) {
        await tx.notification.deleteMany({
          where: { userId: { in: nonSuperAdminMemberIds } },
        });
      }

      // 9. Purge invoices and billing records for company members
      if (nonSuperAdminMemberIds.length > 0) {
        await tx.invoice.deleteMany({
          where: { userId: { in: nonSuperAdminMemberIds } },
        });
      }

      // 10. Purge any email verification codes for company members
      if (nonSuperAdminEmails.length > 0) {
        await tx.verificationCode.deleteMany({
          where: { email: { in: nonSuperAdminEmails } },
        });
      }

      // 11. Clean up stray comments, memberships, and task assignments for company members
      if (nonSuperAdminMemberIds.length > 0) {
        await tx.comment.deleteMany({
          where: { userId: { in: nonSuperAdminMemberIds } },
        });
        await tx.projectMember.deleteMany({
          where: { userId: { in: nonSuperAdminMemberIds } },
        });
        await tx.projectJoinRequest.deleteMany({
          where: { userId: { in: nonSuperAdminMemberIds } },
        });
        await tx.task.updateMany({
          where: {
            OR: [
              { assigneeId: { in: nonSuperAdminMemberIds } },
              { creatorId: { in: nonSuperAdminMemberIds } },
            ],
          },
          data: { assigneeId: null, creatorId: null },
        });
      }

      // 12. Completely delete all member accounts belonging to this company from the platform
      if (nonSuperAdminMemberIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: nonSuperAdminMemberIds } },
        });
      }

      // 13. Detach Super Admin users (if attached to this company) without deleting their superadmin privileges
      if (superAdminMemberIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: superAdminMemberIds } },
          data: { teamId: null },
        });
      }

      // 14. Permanently delete the company record itself
      await tx.team.delete({
        where: { id },
      });
    });

    // 12. Invalidate all affected Redis & L1 memory caches
    try {
      await Promise.allSettled([
        redisCache.delPattern('team:*'),
        redisCache.delPattern('projects:*'),
        redisCache.delPattern('tasks:*'),
        redisCache.delPattern('notifs:*'),
        redisCache.delPattern('admin:metrics:*'),
        redisCache.delPattern('admin:companies:*'),
        redisCache.delPattern('admin:users:*'),
        redisCache.delPattern('reports:*'),
        ...members.map((m) => redisCache.del(`tenant:${m.id}`)),
        ...members.map((m) => redisCache.del(`user:${m.id}`)),
        ...projectIds.map((pId) => redisCache.delPattern(`project:${pId}:*`)),
      ]);
    } catch (cacheErr) {
      console.warn('[Admin Company DELETE Cache Invalidation Warning]:', cacheErr);
    }

    return NextResponse.json({
      success: true,
      message: `Company "${existingTeam.name}" and its entire history have been permanently deleted`,
    });
  } catch (error) {
    console.error('[Admin Company DELETE Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete company and history' } },
      { status: 500 }
    );
  }
}

