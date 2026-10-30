import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { getOrProvisionUserTeam } from '@/lib/tenant';

// ---------------------------------------------------------------------------
// GET /api/team/members — Retrieve team details, all members, and invitations
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const teamContext = await getOrProvisionUserTeam(userId);
    if (!teamContext) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TEAM', message: 'No team workspace found' } },
        { status: 404 }
      );
    }

    // 1. Fetch all active members in the team (indexed by teamId)
    const members = await prisma.user.findMany({
      where: { teamId: teamContext.teamId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        expertise: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch pending invitations for this team
    const invitations = await prisma.teamInvitation.findMany({
      where: {
        teamId: teamContext.teamId,
        status: 'pending',
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Compute stats
    let adminsCount = 0;
    let pmCount = 0;
    let usersCount = 0;

    for (const m of members) {
      const r = m.role?.toLowerCase() || '';
      if (r === 'admin') adminsCount++;
      else if (r === 'project manager' || r === 'project_manager') pmCount++;
      else usersCount++;
    }

    const currentUserRole =
      (session.user as { role?: string })?.role ||
      members.find(m => m.id === userId)?.role ||
      'Member';

    return NextResponse.json({
      success: true,
      data: {
        team: {
          id: teamContext.teamId,
          name: teamContext.teamName,
          slug: teamContext.teamSlug,
        },
        stats: {
          totalMembers: members.length,
          adminsCount,
          pmCount,
          usersCount,
          pendingInvitesCount: invitations.length,
        },
        members: members.map(m => {
          const r = m.role?.toLowerCase() || '';
          const role = r === 'admin'
            ? 'Admin'
            : (r === 'project manager' || r === 'project_manager')
              ? 'Project Manager'
              : 'Member';
          return { ...m, role };
        }),
        invitations,
        currentUserRole,
        currentUserId: userId,
      },
    });
  } catch (error) {
    console.error('[GET /api/team/members] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch team members' } },
      { status: 500 }
    );
  }
}
