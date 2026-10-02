/**
 * src/lib/projectLifecycle.ts
 *
 * Enterprise Project Lifecycle State Machine & Audited Archival (Step 4.11)
 * Enforces valid state transitions and non-destructive archival for audit compliance.
 */

export type ProjectLifecycleState =
  | 'PLANNING'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED';

// Deterministic state transition graph allowing flexible project management
const VALID_TRANSITIONS: Record<ProjectLifecycleState, ProjectLifecycleState[]> = {
  PLANNING: ['ACTIVE', 'ON_HOLD', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
  ACTIVE: ['PLANNING', 'ON_HOLD', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
  ON_HOLD: ['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
  PAUSED: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'PAUSED', 'ARCHIVED'],
  ARCHIVED: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'PAUSED', 'COMPLETED'],
};

export interface LifecycleTransitionResult {
  valid: boolean;
  error?: string;
  isArchival?: boolean;
  isUnarchival?: boolean;
}

export function validateLifecycleTransition(
  currentState: ProjectLifecycleState,
  targetState: ProjectLifecycleState
): LifecycleTransitionResult {
  if (currentState === targetState) {
    return { valid: true };
  }

  const allowed = VALID_TRANSITIONS[currentState] || [];
  if (!allowed.includes(targetState)) {
    return {
      valid: false,
      error: `Invalid lifecycle transition from ${currentState} to ${targetState}. Allowed transitions: ${allowed.join(', ') || 'None'}.`,
    };
  }

  return {
    valid: true,
    isArchival: targetState === 'ARCHIVED',
    isUnarchival: currentState === 'ARCHIVED',
  };
}

export const LIFECYCLE_STATE_CONFIG: Record<
  ProjectLifecycleState,
  { label: string; badgeColor: string; badgeClass: string; description: string }
> = {
  PLANNING: {
    label: 'Planning',
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
    description: 'Roadmap and requirements scoping prior to execution kick-off.',
  },
  ACTIVE: {
    label: 'Active',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    description: 'Tasks and deliverables actively under development.',
  },
  ON_HOLD: {
    label: 'On Hold',
    badgeColor: 'bg-orange-500/10 text-orange-600 border-orange-300',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-300',
    description: 'Work temporarily on hold pending cross-team dependencies or decisions.',
  },
  PAUSED: {
    label: 'Paused',
    badgeColor: 'bg-amber-600/10 text-amber-600 border-amber-600/20',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
    description: 'Work temporarily on hold pending cross-team dependencies.',
  },
  COMPLETED: {
    label: 'Completed',
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-300',
    description: 'All milestone deliverables accepted and deployed.',
  },
  ARCHIVED: {
    label: 'Archived',
    badgeColor: 'bg-gray-100 text-gray-500 border-gray-200',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-300',
    description: 'Historical archive. Read-only records preserved for audit reporting.',
  },
};
