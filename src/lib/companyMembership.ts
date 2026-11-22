/**
 * src/lib/companyMembership.ts
 *
 * One rule for the whole system: when someone is invited to or added to a company's project,
 * they become part of that company (workspace) with the role the admin assigned. Companies use
 * exactly three roles — Admin, Project Manager, Member.
 *
 * Safety: a person is moved from another workspace only when that workspace is empty apart from
 * them (a personal, one-person workspace with no projects). Someone who belongs to another active
 * company is never pulled out of it silently; they keep project access through their membership.
 */

import prisma from '@/lib/prisma';
import redisCache from '@/lib/redis';
import { toCompanyRole } from '@/lib/companyRoles';

export { COMPANY_ROLES, toCompanyRole, isCompanyRole, type CompanyRole } from '@/lib/companyRoles';

export type JoinCompanyResult = 'already-member' | 'joined' | 'kept-other-company' | 'skipped';

/**
 * Makes `userId` part of company `teamId` with `role` (already normalized or raw).
 * Existing members keep their current role — the admin's earlier choice stands.
 */
export async function joinCompany(userId: string, teamId: string | null | undefined, role: string): Promise<JoinCompanyResult> {
  if (!userId || !teamId) return 'skipped';

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, teamId: true, role: true },
  });
  if (!user) return 'skipped';
  if (user.teamId === teamId) return 'already-member';
  // The platform owner account is never re-homed
  if ((user.role || '').toLowerCase().replace(/_/g, ' ').trim() === 'super admin') return 'skipped';

  if (user.teamId) {
    const [otherPeople, ownProjects] = await Promise.all([
      prisma.user.count({ where: { teamId: user.teamId, id: { not: userId } } }),
      prisma.project.count({ where: { teamId: user.teamId } }),
    ]);
    if (otherPeople > 0 || ownProjects > 0) return 'kept-other-company';
  }

  await prisma.user.update({
    where: { id: userId },
    data: { teamId, role: toCompanyRole(role), hasCompletedOnboarding: true },
  });

  await Promise.all([
    redisCache.del(`tenant:${userId}`).catch(() => {}),
    redisCache.delPattern('team:members:*').catch(() => {}),
    redisCache.delPattern('projects:*').catch(() => {}),
  ]);
  return 'joined';
}
