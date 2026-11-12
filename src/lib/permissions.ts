/**
 * src/lib/permissions.ts
 *
 * FlowSync Role & Designation System.
 * Standardizes designations across the platform into canonical roles:
 *   - Super Admin: FlowSync Platform Owner, multi-tenant governance, software & company operations.
 *   - Admin: Full governance, project destruction, ownership, company settings.
 *   - Project Manager: Project creation, sprint roadmaps, milestones, and member management.
 *   - Member: Task progression, collaboration, comment authoring, and project execution.
 */

export type Designation = 'Super Admin' | 'Admin' | 'Project Manager' | 'Member';

export type ProjectRole =
  | 'Super Admin'
  | 'Admin'
  | 'Project Manager'
  | 'Member'
  | 'OWNER'
  | 'LEAD'
  | 'CONTRIBUTOR'
  | 'VIEWER';

export const CANONICAL_DESIGNATIONS: Designation[] = ['Super Admin', 'Admin', 'Project Manager', 'Member'];

/**
 * Normalizes any legacy or arbitrary string role into one of the canonical designations.
 */
export function normalizeDesignation(role: string | null | undefined): Designation {
  if (!role) return 'Member';
  const lower = role.toLowerCase().trim();
  if (
    lower === 'super admin' ||
    lower === 'super_admin' ||
    lower === 'superadmin' ||
    lower === 'platform admin' ||
    lower === 'platform_admin'
  ) {
    return 'Super Admin';
  }
  if (lower === 'admin' || lower === 'owner') return 'Admin';
  if (
    lower === 'project manager' ||
    lower === 'project_manager' ||
    lower === 'pm' ||
    lower === 'lead' ||
    lower === 'team lead'
  ) {
    return 'Project Manager';
  }
  return 'Member';
}

/**
 * Checks whether a user possesses Super Admin privileges for the FlowSync platform.
 */
export function isSuperAdmin(user?: {
  role?: string | null;
  email?: string | null;
  teamName?: string | null;
  team?: { name?: string | null } | null;
}): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const role = (user.role || '').toLowerCase().trim();
  const teamName = (user.teamName || user.team?.name || '').toLowerCase().trim();

  // 1. Explicit owner email
  if (email === 'rasel4897981@gmail.com') return true;

  // 2. Explicit Super Admin designation
  if (normalizeDesignation(role) === 'Super Admin') return true;

  // 3. FlowSync platform company administrator
  if (teamName === 'flowsync' && (role === 'admin' || role === 'owner' || role === 'super admin')) {
    return true;
  }

  return false;
}

export const ROLE_HIERARCHY: Record<string, number> = {
  Member: 1,
  'Project Manager': 2,
  Admin: 3,
  'Super Admin': 4,
  SUPER_ADMIN: 4,
  super_admin: 4,
  superadmin: 4,
  // Legacy mappings for backwards-compatibility
  VIEWER: 1,
  CONTRIBUTOR: 1,
  MEMBER: 1,
  User: 1,
  LEAD: 2,
  PROJECT_MANAGER: 2,
  OWNER: 3,
  ADMIN: 3,
};

export function hasProjectPermission(
  userRole: string | null | undefined,
  minimumRole: ProjectRole
): boolean {
  if (!userRole) return false;
  const userRank = ROLE_HIERARCHY[userRole] ?? ROLE_HIERARCHY[normalizeDesignation(userRole)] ?? 1;
  const minRank = ROLE_HIERARCHY[minimumRole] ?? ROLE_HIERARCHY[normalizeDesignation(minimumRole)] ?? 1;
  return userRank >= minRank;
}

export interface PermissionCapabilities {
  canDeleteProject: boolean;
  canEditSettings: boolean;
  canManageMembers: boolean;
  canManageMilestones: boolean;
  canMutateTasks: boolean;
  canView: boolean;
}

export function getProjectCapabilities(role: string | null | undefined): PermissionCapabilities {
  const designation = normalizeDesignation(role);
  if (designation === 'Super Admin') {
    return {
      canDeleteProject: true,
      canEditSettings: true,
      canManageMembers: true,
      canManageMilestones: true,
      canMutateTasks: true,
      canView: true,
    };
  }
  return {
    canDeleteProject: designation === 'Admin',
    canEditSettings: designation === 'Admin' || designation === 'Project Manager',
    canManageMembers: designation === 'Admin' || designation === 'Project Manager',
    canManageMilestones: designation === 'Admin' || designation === 'Project Manager',
    canMutateTasks: true,
    canView: true,
  };
}

export const ROLE_DESCRIPTIONS: Record<string, { label: Designation; description: string; badgeColor: string }> = {
  'Super Admin': {
    label: 'Super Admin',
    description: 'FlowSync platform owner, global tenant oversight, cross-company management',
    badgeColor: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400',
  },
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'FlowSync platform owner, global tenant oversight, cross-company management',
    badgeColor: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400',
  },
  Admin: {
    label: 'Admin',
    description: 'Full administrative control, project destruction, ownership transfer',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  'Project Manager': {
    label: 'Project Manager',
    description: 'Sprint roadmaps, milestone creation, and team member management',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  Member: {
    label: 'Member',
    description: 'Create and assign tasks, progress statuses, write comments',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  // Legacy alias redirects to canonical designations
  OWNER: {
    label: 'Admin',
    description: 'Full administrative control, project destruction, ownership transfer',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  ADMIN: {
    label: 'Admin',
    description: 'Full administrative control, project destruction, ownership transfer',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  LEAD: {
    label: 'Project Manager',
    description: 'Sprint roadmaps, milestone creation, and team member management',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  PROJECT_MANAGER: {
    label: 'Project Manager',
    description: 'Sprint roadmaps, milestone creation, and team member management',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  CONTRIBUTOR: {
    label: 'Member',
    description: 'Create and assign tasks, progress statuses, write comments',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  VIEWER: {
    label: 'Member',
    description: 'Create and assign tasks, progress statuses, write comments',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  MEMBER: {
    label: 'Member',
    description: 'Create and assign tasks, progress statuses, write comments',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  User: {
    label: 'Member',
    description: 'Create and assign tasks, progress statuses, write comments',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
};
