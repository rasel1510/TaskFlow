/**
 * src/lib/projectHealthEngine.ts
 *
 * Deterministic Predictive Health & SLA Risk Engine (Step 4.8)
 * Evaluates real-time project risk score, delivery velocity, and SLA breach warnings
 * using algorithmic heuristics rather than static guesses.
 */

export type HealthStatus = 'on_track' | 'at_risk' | 'delayed' | 'completed';

export interface HealthEngineInput {
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  progress: number; // 0 - 100
  totalTasks: number;
  completedTasks: number;
  overdueTasks?: number;
  recentCompletedTasks7d?: number; // completed in last 7 days
  referenceDate?: Date; // default is Date.now()
}

export interface HealthEngineResult {
  health: HealthStatus;
  riskScore: number; // 0 - 100
  slaBreached: boolean;
  velocityLast7Days: number;
  projectedDaysRemaining: number;
  daysUntilDue: number | null;
  warnings: string[];
  recommendation: string;
}

export function computeProjectHealth(input: HealthEngineInput): HealthEngineResult {
  const now = input.referenceDate || new Date();
  const progress = Math.min(100, Math.max(0, Math.round(input.progress || 0)));
  const totalTasks = Math.max(0, input.totalTasks || 0);
  const completedTasks = Math.min(totalTasks, Math.max(0, input.completedTasks || 0));
  const remainingTasks = Math.max(0, totalTasks - completedTasks);
  const overdueTasks = Math.max(0, input.overdueTasks || 0);
  const velocity7d = Math.max(0, input.recentCompletedTasks7d ?? Math.min(completedTasks, 1));

  const warnings: string[] = [];

  // Completed Project Rule
  if (totalTasks > 0 && completedTasks >= totalTasks && progress >= 100) {
    return {
      health: 'completed',
      riskScore: 0,
      slaBreached: false,
      velocityLast7Days: velocity7d,
      projectedDaysRemaining: 0,
      daysUntilDue: null,
      warnings: [],
      recommendation: 'All deliverables completed. Project is ready for sign-off or archiving.',
    };
  }

  // Parse due date
  let dueDate: Date | null = null;
  if (input.dueDate) {
    const d = new Date(input.dueDate);
    if (!isNaN(d.getTime())) dueDate = d;
  }

  // If no due date is configured
  if (!dueDate) {
    const riskScore = remainingTasks > 10 ? 25 : 10;
    return {
      health: 'on_track',
      riskScore,
      slaBreached: false,
      velocityLast7Days: velocity7d,
      projectedDaysRemaining: Math.ceil(remainingTasks / Math.max(velocity7d / 7, 0.5)),
      daysUntilDue: null,
      warnings: ['No deadline set for this project.'],
      recommendation: 'Establish milestone target dates to enable automated SLA forecasting.',
    };
  }

  const msRemaining = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  // Compute daily velocity (tasks per day) based on rolling 7 days
  const dailyVelocity = Math.max(velocity7d / 7, 0.2); // minimum baseline 0.2 tasks/day to prevent div by zero
  const projectedDaysRemaining = Math.ceil(remainingTasks / dailyVelocity);

  let health: HealthStatus = 'on_track';
  let riskScore = 10;
  let slaBreached = false;

  // Rule 1: Project past due date with uncompleted work
  if (daysUntilDue < 0 && remainingTasks > 0) {
    health = 'delayed';
    riskScore = 100;
    slaBreached = true;
    warnings.push(`Project deadline passed ${Math.abs(daysUntilDue)} day(s) ago with ${remainingTasks} task(s) unfinished.`);
  } 
  // Rule 2: Due within 3 days with < 70% progress or 2+ overdue tasks
  else if (daysUntilDue <= 3 && (progress < 70 || overdueTasks >= 2)) {
    health = 'at_risk';
    riskScore = Math.min(95, 75 + overdueTasks * 5);
    warnings.push(`Only ${daysUntilDue} day(s) remain, but progress is at ${progress}%. High risk of SLA breach.`);
    if (overdueTasks > 0) {
      warnings.push(`${overdueTasks} dependent task(s) are already overdue.`);
    }
  } 
  // Rule 3: Velocity forecast indicates completion will exceed deadline
  else if (daysUntilDue > 0 && projectedDaysRemaining > daysUntilDue) {
    health = 'at_risk';
    const slipDays = projectedDaysRemaining - daysUntilDue;
    riskScore = Math.min(85, 60 + slipDays * 3);
    warnings.push(`Velocity of ${velocity7d} tasks/wk projects delivery in ${projectedDaysRemaining} days (slips by ${slipDays}d).`);
  } 
  // Rule 4: Moderate risk if overdue tasks exist even if deadline is distant
  else if (overdueTasks > 0) {
    riskScore = 35 + overdueTasks * 10;
    if (overdueTasks >= 3) {
      health = 'at_risk';
      warnings.push(`Multiple overdue tasks (${overdueTasks}) are threatening sprint flow.`);
    } else {
      warnings.push(`${overdueTasks} task(s) currently overdue.`);
    }
  }

  // Recommendations based on health status
  let recommendation = 'Project is progressing on pace with velocity targets.';
  if (health === 'delayed') {
    recommendation = 'Immediate triage required: reschedule deadline or descope remaining backlog items.';
  } else if (health === 'at_risk') {
    recommendation = 'Reallocate engineering bandwidth or unblock high-priority dependencies to meet target SLA.';
  }

  return {
    health,
    riskScore: Math.min(100, Math.max(0, riskScore)),
    slaBreached,
    velocityLast7Days: velocity7d,
    projectedDaysRemaining,
    daysUntilDue,
    warnings,
    recommendation,
  };
}
