/**
 * src/lib/permissions.ts
 *
 * FlowSync Role & Designation System.
 * Strictly standardizes all designations across the platform into three canonical roles:
 *   - Admin: Full governance, project destruction, ownership, security settings.
 *   - Project Manager: Project creation, sprint roadmaps, milestones, and member management.
 *   - Member: Task progression, collaboration, comment authoring, and project execution.
 */

export type Designation = 'Admin' | 'Project Manager' | 'Member';

export type ProjectRole =
  | 'Admin'
  | 'Project Manager'
  | 'Member'
  | 'OWNER'
  | 'LEAD'
  | 'CONTRIBUTOR'
  | 'VIEWER';

export const CANONICAL_DESIGNATIONS: Designation[] = ['Admin', 'Project Manager', 'Member'];

/**
 * Normalizes any legacy or arbitrary string role into one of the 3 canonical designations.
 */
export function normalizeDesignation(role: string | null | undefined): Designation {
  if (!role) return 'Member';
  const lower = role.toLowerCase().trim();
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

export const ROLE_HIERARCHY: Record<string, number> = {
  Member: 1,
  'Project Manager': 2,
  Admin: 3,
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
