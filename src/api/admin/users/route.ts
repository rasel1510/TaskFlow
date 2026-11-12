import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';

export const dynamic = 'force-dynamic';
import { isSuperAdmin } from '@/lib/permissions';

export async function GET() {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        plan: true,
        subscriptionStatus: true,
        hasCompletedOnboarding: true,
        createdAt: true,
        updatedAt: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            tasksAssigned: true,
            tasksCreated: true,
            projectsOwned: true,
          },
        },
      },
    });

    const enrichedUsers = users.map(u => ({
      ...u,
      isSuperAdmin: isSuperAdmin({ email: u.email, role: u.role, teamName: u.team?.name }),
      isPlatformOwnerMember: u.team?.name?.toLowerCase().trim() === 'flowsync',
    }));

    return NextResponse.json({
      success: true,
      data: enrichedUsers,
    });
  } catch (error) {
    console.error('[Admin Users GET Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve platform users' } },
      { status: 500 }
    );
  }
}

