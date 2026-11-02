import prisma from '@/lib/prisma';
import redisCache from '@/lib/redis';

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
 * Results are cached in L1 memory/Redis with a 5-minute TTL to eliminate
 * redundant database network roundtrips on every API request.
 */
export async function getOrProvisionUserTeam(userId: string): Promise<UserTeamContext | null> {
  if (!userId) return null;

  return redisCache.wrap(`tenant:${userId}`, 300, async () => {
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
  });
}
