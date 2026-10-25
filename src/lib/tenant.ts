import prisma from '@/lib/prisma';

export interface UserTeamContext {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
}

/**
 * Resolves the authenticated user's single team in O(1) time.
 * If the user does not have a team assigned yet (legacy or new user),
 * an organization/team is automatically provisioned and linked, ensuring zero downtime.
 */
export async function getOrProvisionUserTeam(userId: string): Promise<UserTeamContext | null> {
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) return null;

    // If user already belongs to a team, return immediately (O(1))
    if (user.teamId && user.team) {
      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        teamId: user.team.id,
        teamName: user.team.name,
        teamSlug: user.team.slug,
      };
    }

    // Auto-provision team for unassigned user (e.g. initial setup or legacy records)
    const baseSlug = (user.name || 'team')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 24);
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
    const teamName = `${user.name || 'My'}'s Team`;

    const newTeam = await prisma.team.create({
      data: {
        name: teamName,
        slug: uniqueSlug,
      },
    });

    // Link user to this team
    await prisma.user.update({
      where: { id: user.id },
      data: { teamId: newTeam.id },
    });

    // Also associate any projects previously created by this user that lacked a teamId
    await prisma.project.updateMany({
      where: {
        ownerId: user.id,
        teamId: null,
      },
      data: {
        teamId: newTeam.id,
      },
    });

    return {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      teamId: newTeam.id,
      teamName: newTeam.name,
      teamSlug: newTeam.slug,
    };
  } catch (error) {
    console.error('[tenant.ts] Error resolving user team:', error);
    return null;
  }
}
