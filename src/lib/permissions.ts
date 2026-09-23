/**
 * src/lib/permissions.ts
 *
 * Project-Scoped Role-Based Access Control (RBAC) & Team Management (Step 4.10)
 * Evaluates fine-grained multi-role permissions on project resources:
 * - OWNER: Full project destruction, settings modification, transfer ownership.
 * - LEAD: Milestone management, project settings editing, member role modification.
 * - CONTRIBUTOR: Task creation, assignment, status progression, comment authoring.
 * - VIEWER: Read-only access to Kanban, lists, and burndown analytics.
 */

export type ProjectRole = 'OWNER' | 'LEAD' | 'CONTRIBUTOR' | 'VIEWER';

export const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  VIEWER: 1,
  CONTRIBUTOR: 2,
  LEAD: 3,
  OWNER: 4,
};

export function hasProjectPermission(
  userRole: ProjectRole | null | undefined,
  minimumRole: ProjectRole
): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}

export interface PermissionCapabilities {
  canDeleteProject: boolean;
  canEditSettings: boolean;
  canManageMembers: boolean;
  canManageMilestones: boolean;
  canMutateTasks: boolean;
  canView: boolean;
}

export function getProjectCapabilities(role: ProjectRole | null | undefined): PermissionCapabilities {
  return {
    canDeleteProject: role === 'OWNER',
    canEditSettings: hasProjectPermission(role, 'LEAD'),
    canManageMembers: hasProjectPermission(role, 'LEAD'),
    canManageMilestones: hasProjectPermission(role, 'LEAD'),
    canMutateTasks: hasProjectPermission(role, 'CONTRIBUTOR'),
    canView: hasProjectPermission(role, 'VIEWER'),
  };
}

export const ROLE_DESCRIPTIONS: Record<ProjectRole, { label: string; description: string; badgeColor: string }> = {
  OWNER: {
    label: 'Owner',
    description: 'Full administrative control, project destruction, ownership transfer',
    badgeColor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  LEAD: {
    label: 'Team Lead',
    description: 'Sprint roadmaps, milestone creation, and team member management',
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  CONTRIBUTOR: {
    label: 'Contributor',
    description: 'Create and assign tasks, progress statuses, write comments',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  VIEWER: {
    label: 'Viewer',
    description: 'Read-only access to roadmap, Kanban, tasks, and burndown analytics',
    badgeColor: 'bg-muted text-muted-foreground border-border',
  },
};
