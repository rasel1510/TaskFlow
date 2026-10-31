export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type ProjectHealth = 'on_track' | 'at_risk' | 'delayed' | 'completed';

export interface User {
  id: string;
  name: string;
  avatar: string;
  role: string;
  email: string;
  expertise?: string[];
}

export interface Task {
  id: string;
  taskNumber?: string | null;
  title: string;
  projectId: string;
  status: Status;
  priority: Priority;
  assignee: User;
  dueDate: string;
  estimate: string;
  labels: string[];
  commentsCount: number;
  attachmentsCount: number;
  progress?: number;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: User;
  members: User[];
  progress: number;
  taskCount: number;
  completedTasks: number;
  overdueTasks: number;
  startDate: string;
  dueDate: string;
  health: ProjectHealth;
  color: string;
  lifecycleState?: string;
  archivedAt?: string | null;
}

export const users: User[] = [];

export const projects: Project[] = [];

export const tasks: Task[] = [];

export interface MockNotification {
  id: string;
  category: 'user' | 'project' | 'admin';
  type: string;
  title: string;
  body: string;
  time: string;
  timeAgo: string;
  read: boolean;
  user: User;
  action: string;
  target: string;
  taskId?: string;
  meta?: string;
}

export const notifications: MockNotification[] = [];

export const weeklyData: { day: string; completed: number; created: number }[] = [];

export const teamWorkload: { user: User; assigned: number; completed: number; remaining: number }[] = [];

export const statusColors: Record<Status, { bg: string; text: string; label: string }> = {
  backlog: { bg: '#F3F4F6', text: '#6B7280', label: 'Backlog' },
  todo: { bg: '#EFF6FF', text: '#2563EB', label: 'To Do' },
  in_progress: { bg: '#FFF7ED', text: '#EA580C', label: 'In Progress' },
  in_review: { bg: '#F5F3FF', text: '#7C3AED', label: 'In Review' },
  done: { bg: '#F0FDF4', text: '#16A34A', label: 'Done' },
};

export const priorityColors: Record<Priority, { color: string; label: string }> = {
  low: { color: '#6B7280', label: 'Low' },
  medium: { color: '#F59E0B', label: 'Medium' },
  high: { color: '#EA580C', label: 'High' },
  urgent: { color: '#DC2626', label: 'Urgent' },
};

export const healthColors: Record<ProjectHealth, { bg: string; text: string; label: string }> = {
  on_track: { bg: '#F0FDF4', text: '#16A34A', label: 'On Track' },
  at_risk: { bg: '#FFFBEB', text: '#D97706', label: 'At Risk' },
  delayed: { bg: '#FEF2F2', text: '#DC2626', label: 'Delayed' },
  completed: { bg: '#EFF6FF', text: '#2563EB', label: 'Completed' },
};

export function getProjectName(projectId?: string | null): string {
  if (!projectId) return 'Personal Task';
  return projects.find(p => p.id === projectId)?.name ?? 'Project';
}
