import prisma from '@/lib/prisma';
import redisCache from '@/lib/redis';
import { switchWorkspace } from '@/lib/workspaces';

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
 * Resolves the authenticated user's open workspace (a company or their Personal workspace).
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
          hasCompletedOnboarding: true,
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

      // No workspace open yet → open their Personal workspace (created on first use)
      const personal = await switchWorkspace(user.id, 'personal');
      if (!personal) return null;
      const team = await prisma.team.findUnique({ where: { id: personal.id }, select: { id: true, name: true, slug: true } });
      if (!team) return null;
      const refreshed = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: refreshed?.role ?? user.role,
        teamId: team.id,
        teamName: team.name,
        teamSlug: team.slug,
      };
    } catch (error) {
      console.error('[tenant.ts] Error resolving user team:', error);
      return null;
    }
  });
}
