/**
 * src/lib/companyMembership.ts
 *
 * One rule for the whole system: when someone is invited to or added to a company's project,
 * they become part of that company with the role the admin assigned. Companies use exactly three
 * roles — Admin, Project Manager, Member.
 *
 * A person can belong to several companies (plus their own Personal workspace). Joining a company
 * adds a membership; it never takes them out of another one.
 */

import prisma from '@/lib/prisma';
import { addMembership, switchWorkspace } from '@/lib/workspaces';

export { COMPANY_ROLES, toCompanyRole, isCompanyRole, type CompanyRole } from '@/lib/companyRoles';

export type JoinCompanyResult = 'already-member' | 'joined' | 'skipped';

/**
 * Makes `userId` a member of company `teamId` with `role` (already normalized or raw).
 * Existing members keep their current role — the admin's earlier choice stands. Someone with no
 * workspace open yet gets this company opened for them.
 */
export async function joinCompany(userId: string, teamId: string | null | undefined, role: string): Promise<JoinCompanyResult> {
  if (!userId || !teamId) return 'skipped';
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { teamId: true } });
  if (!user) return 'skipped';

  const result = await addMembership(userId, teamId, role);
  if (!user.teamId) await switchWorkspace(userId, teamId);
  return result === 'added' ? 'joined' : 'already-member';
}
