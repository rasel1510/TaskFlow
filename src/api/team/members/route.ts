import redisCache from '@/lib/redis';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { getOrProvisionUserTeam } from '@/lib/tenant';
import { toCompanyRole, type CompanyRole } from '@/lib/companyRoles';

// ---------------------------------------------------------------------------
// GET /api/team/members — The whole company: everyone in the workspace plus anyone working in one
// of the company's projects, each with one of the three roles (Admin, Project Manager, Member) and
// the company projects they work in, and pending invitations.
// People added to a company project normally join the workspace (src/lib/companyMembership.ts);
// the rare person who still belongs to another active company is listed with their project role
// and `managedElsewhere: true` (their workspace role can't be changed from here).
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

    const cacheKey = `team:members:${teamContext.teamId}:${userId}`;
    const payload = await redisCache.wrap(cacheKey, 15, async () => {
      // Parallel DB queries — cuts Neon round-trip latency in half
      const [members, invitations, memberships] = await Promise.all([
        // Everyone who belongs to this company (wherever they are working right now), with their
        // role in this company. The platform owner keeps their Super Admin label.
        prisma.teamMembership
          .findMany({
            where: { teamId: teamContext.teamId },
            select: {
              role: true,
              user: { select: { id: true, name: true, email: true, role: true, avatar: true, expertise: true, createdAt: true } },
            },
            orderBy: { createdAt: 'asc' },
          })
          .then(rows =>
            rows.map(r => ({
              ...r.user,
              role: (r.user.role || '').toLowerCase().replace(/_/g, ' ').trim() === 'super admin' ? r.user.role : r.role,
            }))
          ),
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
        // Who works in which of the company's projects (one query; O(memberships) memory)
        prisma.projectMember.findMany({
          where: { project: { teamId: teamContext.teamId } },
          select: { userId: true, role: true, project: { select: { id: true, name: true } } },
        }),
      ]);

      // userId → company projects and highest project role (O(1) lookups while building the response)
      const RANK: Record<CompanyRole, number> = { Member: 0, 'Project Manager': 1, Admin: 2 };
      const projectsByUser = new Map<string, { id: string; name: string }[]>();
      const projectRoleByUser = new Map<string, CompanyRole>();
      for (const m of memberships) {
        const list = projectsByUser.get(m.userId);
        if (list) list.push(m.project);
        else projectsByUser.set(m.userId, [m.project]);
        const role = toCompanyRole(m.role);
        const prev = projectRoleByUser.get(m.userId);
        if (!prev || RANK[role] > RANK[prev]) projectRoleByUser.set(m.userId, role);
      }
      for (const list of projectsByUser.values()) list.sort((a, b) => a.name.localeCompare(b.name));

      // Anyone in a company project who isn't in the workspace (they belong to another company)
      const memberIds = new Set(members.map(m => m.id));
      const elsewhereIds = Array.from(projectsByUser.keys()).filter(id => !memberIds.has(id));
      const elsewhere = elsewhereIds.length
        ? await prisma.user.findMany({
            where: { id: { in: elsewhereIds } },
            select: { id: true, name: true, email: true, avatar: true, expertise: true, createdAt: true },
            orderBy: { name: 'asc' },
          })
        : [];

      const people = [
        ...members.map(m => ({
          ...m,
          role: toCompanyRole(m.role) as string,
          projects: projectsByUser.get(m.id) ?? [],
          managedElsewhere: false,
        })),
        ...elsewhere.map(u => ({
          ...u,
          role: (projectRoleByUser.get(u.id) ?? 'Member') as string,
          projects: projectsByUser.get(u.id) ?? [],
          managedElsewhere: true,
        })),
      ];
      // The platform owner account counts as an Admin of its own workspace
      for (let i = 0; i < members.length; i++) {
        if ((members[i].role || '').toLowerCase().replace(/_/g, ' ').trim() === 'super admin') people[i].role = 'Admin';
      }

      let adminsCount = 0;
      let pmCount = 0;
      let usersCount = 0;
      for (const p of people) {
        if (p.role === 'Admin') adminsCount++;
        else if (p.role === 'Project Manager') pmCount++;
        else usersCount++;
      }

      return {
        team: {
          id: teamContext.teamId,
          name: teamContext.teamName,
          slug: teamContext.teamSlug,
        },
        stats: {
          totalMembers: people.length,
          adminsCount,
          pmCount,
          usersCount,
          pendingInvitesCount: invitations.length,
        },
        members: people,
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
