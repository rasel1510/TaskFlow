import redisCache from '@/lib/redis';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { getOrProvisionUserTeam } from '@/lib/tenant';

// ---------------------------------------------------------------------------
// GET /api/team/members — Everyone you work with: your workspace members, plus collaborators —
// people from outside the workspace who share a project with the company or with you (including
// projects owned by another workspace that you were invited into) — with the projects each person
// works in, and pending invitations.
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

    // Per user: the set of shared projects depends on which projects this user belongs to
    const cacheKey = `team:members:${teamContext.teamId}:${userId}`;
    const payload = await redisCache.wrap(cacheKey, 15, async () => {
      // Parallel DB queries — cuts Neon round-trip latency in half
      const [members, invitations, memberships] = await Promise.all([
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
        // Who works in which project — the company's projects plus any project this user is in
        // (one query; O(memberships) memory)
        prisma.projectMember.findMany({
          where: {
            project: {
              OR: [{ teamId: teamContext.teamId }, { members: { some: { userId } } }],
            },
          },
          select: { userId: true, project: { select: { id: true, name: true } } },
        }),
      ]);

      // userId → projects (O(1) lookups while building the response)
      const projectsByUser = new Map<string, { id: string; name: string }[]>();
      for (const m of memberships) {
        const list = projectsByUser.get(m.userId);
        if (list) list.push(m.project);
        else projectsByUser.set(m.userId, [m.project]);
      }
      for (const list of projectsByUser.values()) list.sort((a, b) => a.name.localeCompare(b.name));

      // People from outside the workspace who share one of those projects
      const memberIds = new Set(members.map(m => m.id));
      const collaboratorIds = Array.from(projectsByUser.keys()).filter(id => !memberIds.has(id));
      const collaborators = collaboratorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: collaboratorIds } },
            select: { id: true, name: true, email: true, avatar: true, createdAt: true },
            orderBy: { name: 'asc' },
          })
        : [];

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
          collaboratorsCount: collaborators.length,
        },
        members: members.map(m => {
          const r = m.role?.toLowerCase() || '';
          const role = r === 'admin'
            ? 'Admin'
            : (r === 'project manager' || r === 'project_manager')
              ? 'Project Manager'
              : 'Member';
          return { ...m, role, projects: projectsByUser.get(m.id) ?? [] };
        }),
        collaborators: collaborators.map(c => ({ ...c, projects: projectsByUser.get(c.id) ?? [] })),
        invitations,
      };
    });

    const currentUserRole =
      (session.user as { role?: string })?.role ||
      payload.members.find(m => m.id === userId)?.role ||
      'Member';

    // Invite tokens and initial passwords are credentials — only Admins / Project Managers
    // (the people who send invites and use "Copy link / password") may receive them.
    const normalizedRole = currentUserRole.toLowerCase().replace(/_/g, ' ').trim();
    const canSeeInviteSecrets =
      normalizedRole === 'admin' ||
      normalizedRole === 'owner' ||
      normalizedRole === 'project manager' ||
      Boolean((session.user as { isSuperAdmin?: boolean })?.isSuperAdmin);
    const invitations = canSeeInviteSecrets
      ? payload.invitations
      : payload.invitations.map(inv => ({ ...inv, token: '', initialPassword: null }));

    return NextResponse.json(
      {
        success: true,
        data: {
          ...payload,
          invitations,
          currentUserRole,
          currentUserId: userId,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
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
