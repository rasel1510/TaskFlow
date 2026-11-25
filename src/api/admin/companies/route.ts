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
    // Companies only — personal workspaces are listed under free-use requests instead
    const teams = await prisma.team.findMany({
      where: { kind: 'company' },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            memberships: true,
            projects: true,
            invitations: true,
          },
        },
        memberships: {
          select: {
            role: true,
            user: {
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

    const enrichedTeams = teams.map(t => {
      // Everyone who belongs to the company, with their role in it
      const team = { ...t, members: t.memberships.map(m => ({ ...m.user, role: m.role })) };
      const isPlatformOwner = team.name.toLowerCase().trim() === 'flowsync';
      
      // Determine primary company admin / owner
      const primaryAdmin =
        team.members.find(m => m.role.toLowerCase().includes('admin') || m.role.toLowerCase().includes('owner')) ||
        team.members[0] ||
        null;

      // Determine company plan tier
      const plan = team.plan === 'pro' ? 'pro' : 'free';

      // Determine company subscription status
      const isSuspended = team.subscriptionStatus === 'suspended';
      const isPastDue = team.subscriptionStatus === 'past_due';
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
        membersCount: team._count.memberships,
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

