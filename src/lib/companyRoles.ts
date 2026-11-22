/**
 * src/lib/companyRoles.ts
 *
 * The three roles FlowSync uses everywhere — workspace (company) roles and project roles alike:
 * Admin, Project Manager, Member. Pure helpers with no server imports, safe in any bundle.
 * ("Super Admin" is a platform flag for the FlowSync owner account, not a company role.)
 */

export const COMPANY_ROLES = ['Admin', 'Project Manager', 'Member'] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

/**
 * Any role spelling (Admin, ADMIN, OWNER, PROJECT_MANAGER, LEAD, CONTRIBUTOR, VIEWER, job titles…)
 * → one of the three company roles. Unknown values become Member.
 */
export function toCompanyRole(raw: string | null | undefined): CompanyRole {
  const r = (raw || '').toLowerCase().replace(/_/g, ' ').trim();
  if (r === 'admin' || r === 'owner') return 'Admin';
  if (r === 'project manager' || r === 'lead' || r === 'pm' || r === 'team lead') return 'Project Manager';
  return 'Member';
}

/** True when the string is exactly one of the three company roles (any case / underscore). */
export function isCompanyRole(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const r = raw.toLowerCase().replace(/_/g, ' ').trim();
  return r === 'admin' || r === 'project manager' || r === 'member';
}
