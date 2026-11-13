import redisCache from '@/lib/redis';
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

    const cacheKey = `team:members:${teamContext.teamId}`;
    const payload = await redisCache.wrap(cacheKey, 15, async () => {
      // Parallel DB queries — cuts Neon round-trip latency in half
      const [members, invitations] = await Promise.all([
        prisma.user.findMany({
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
        }),
        prisma.teamInvitation.findMany({
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
            initialPassword: true,
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
        }),
      ]);

      let adminsCount = 0;
      let pmCount = 0;
      let usersCount = 0;

      for (const m of members) {
        const r = m.role?.toLowerCase() || '';
        if (r === 'admin') adminsCount++;
        else if (r === 'project manager' || r === 'project_manager') pmCount++;
        else usersCount++;
      }

      return {
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
      };
    });

    const currentUserRole =
      (session.user as { role?: string })?.role ||
      payload.members.find(m => m.id === userId)?.role ||
      'Member';

    return NextResponse.json(
      {
        success: true,
        data: {
          ...payload,
          currentUserRole,
          currentUserId: userId,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('[GET /api/team/members] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch team members' } },
      { status: 500 }
    );
  }
}
