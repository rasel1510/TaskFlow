import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const teams = await prisma.team.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
            invitations: true,
          },
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
          orderBy: { createdAt: 'asc' },
        },
        projects: {
          select: {
            id: true,
            name: true,
            color: true,
            health: true,
            progress: true,
            lifecycleState: true,
            createdAt: true,
            _count: {
              select: { tasks: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const enrichedTeams = teams.map(team => {
      const isPlatformOwner = team.name.toLowerCase().trim() === 'flowsync';
      
      // Determine primary company admin / owner
      const primaryAdmin =
        team.members.find(m => m.role.toLowerCase().includes('admin') || m.role.toLowerCase().includes('owner')) ||
        team.members[0] ||
        null;

      // Determine company plan tier
      const hasPro = team.members.some(m => m.plan === 'pro');
      const plan = hasPro ? 'pro' : 'free';

      // Determine company subscription status
      const isSuspended = team.members.some(m => m.subscriptionStatus === 'suspended');
      const isPastDue = team.members.some(m => m.subscriptionStatus === 'past_due');
      const status = isSuspended ? 'suspended' : isPastDue ? 'past_due' : 'active';

      // Total tasks in company projects
      const totalTasks = team.projects.reduce((acc, p) => acc + (p._count?.tasks ?? 0), 0);

      return {
        id: team.id,
        name: team.name,
        slug: team.slug,
        isPlatformOwner,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        plan,
        status,
        membersCount: team._count.members,
        projectsCount: team._count.projects,
        tasksCount: totalTasks,
        owner: primaryAdmin
          ? {
              id: primaryAdmin.id,
              name: primaryAdmin.name,
              email: primaryAdmin.email,
              role: primaryAdmin.role,
              avatar: primaryAdmin.avatar,
            }
          : null,
        members: team.members,
        projects: team.projects,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedTeams,
    });
  } catch (error) {
    console.error('[Admin Companies GET Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve registered companies' } },
      { status: 500 }
    );
  }
}

