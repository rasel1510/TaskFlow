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
  subtasks?: SubTask[];
}

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
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

export const users: User[] = [
  { id: 'u1', name: 'Rasel Ahmed', avatar: 'RA', role: 'Project Manager', email: 'rasel@flowsync.io', expertise: ['Project Management', 'Agile/Scrum', 'System Architecture'] },
  { id: 'u2', name: 'Sarah Chen', avatar: 'SC', role: 'Frontend Engineer', email: 'sarah@flowsync.io', expertise: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'] },
  { id: 'u3', name: 'Ahmed Malik', avatar: 'AM', role: 'Backend Engineer', email: 'ahmed@flowsync.io', expertise: ['Node.js', 'PostgreSQL', 'Prisma', 'Redis'] },
  { id: 'u4', name: 'John Torres', avatar: 'JT', role: 'QA Engineer', email: 'john@flowsync.io', expertise: ['Automated Testing', 'Jest', 'Playwright', 'Security'] },
  { id: 'u5', name: 'Maria Lopez', avatar: 'ML', role: 'UI Designer', email: 'maria@flowsync.io', expertise: ['UI/UX', 'Figma', 'Design Systems', 'Prototyping'] },
  { id: 'u6', name: 'David Kim', avatar: 'DK', role: 'DevOps Engineer', email: 'david@flowsync.io', expertise: ['Docker', 'Kubernetes', 'CI/CD', 'AWS Cloud'] },
];

export const currentUser = users[0];

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

export const notifications: MockNotification[] = [
  // User notifications
  {
    id: 'n1',
    category: 'user',
    type: 'task_assigned',
    title: 'Task assigned to you',
    body: 'Sarah Chen assigned you to TF-012: Accessibility audit & keyboard navigation',
    time: '15m ago',
    timeAgo: '15m ago',
    read: false,
    user: users[1],
    action: 'assigned you to',
    target: 'TF-012: Accessibility audit & keyboard navigation',
    taskId: 't2',
  },
  {
    id: 'n2',
    category: 'user',
    type: 'comment_mention',
    title: 'Mentioned in comment',
    body: 'Ahmed Malik mentioned you on TF-003: "The database indexes are ready for review."',
    time: '45m ago',
    timeAgo: '45m ago',
    read: false,
    user: users[2],
    action: 'commented on',
    target: 'TF-003: Fix authentication session timeout bug',
    taskId: 't3',
  },
  {
    id: 'n3',
    category: 'user',
    type: 'task_overdue',
    title: 'Task deadline approaching',
    body: 'TF-002: Authentication flows is due within 24 hours.',
    time: '3h ago',
    timeAgo: '3h ago',
    read: true,
    user: users[0],
    action: 'flagged due date for',
    target: 'TF-002: Authentication flows',
    taskId: 't1',
  },
  {
    id: 'n4',
    category: 'user',
    type: 'subtask_completed',
    title: 'Subtask completed',
    body: 'John Torres completed "Unit tests for token refresh" on TF-008.',
    time: '6h ago',
    timeAgo: '6h ago',
    read: true,
    user: users[3],
    action: 'completed subtask on',
    target: 'TF-008: Auth token refresh engine',
    taskId: 't4',
  },

  // Product Manager notifications
  {
    id: 'n5',
    category: 'project',
    type: 'project_at_risk',
    title: 'Project health: At Risk',
    body: 'Mobile App Redesign health dropped to At Risk due to 2 overdue milestones.',
    time: '30m ago',
    timeAgo: '30m ago',
    read: false,
    user: users[0],
    action: 'updated health of',
    target: 'Mobile App Redesign to At Risk',
    meta: 'Mobile App Redesign',
  },
  {
    id: 'n6',
    category: 'project',
    type: 'project_milestone',
    title: 'Sprint milestone reached',
    body: 'Sprint 14 reached 80% story points completion ahead of target cycle.',
    time: '2h ago',
    timeAgo: '2h ago',
    read: false,
    user: users[1],
    action: 'reached milestone on',
    target: 'Sprint 14 (80% completion)',
    meta: 'Sprint 14',
  },
  {
    id: 'n7',
    category: 'project',
    type: 'blocker_reported',
    title: 'Critical blocker reported',
    body: 'TF-045 flagged as blocker: "Cloudflare SSL certificate expired on staging environment."',
    time: '5h ago',
    timeAgo: '5h ago',
    read: true,
    user: users[2],
    action: 'flagged critical blocker on',
    target: 'TF-045: Staging Cloudflare SSL',
  },
  {
    id: 'n8',
    category: 'project',
    type: 'workload_alert',
    title: 'Team workload threshold',
    body: 'Frontend Engineering capacity exceeded 115% for upcoming release.',
    time: '1d ago',
    timeAgo: '1d ago',
    read: true,
    user: users[0],
    action: 'issued capacity warning for',
    target: 'Frontend Engineering Sprint Workload',
  },

  // Admin notifications
  {
    id: 'n9',
    category: 'admin',
    type: 'security_alert',
    title: 'Security audit alert',
    body: 'New administrative session initiated from Chrome on macOS (IP: 192.168.1.104).',
    time: '20m ago',
    timeAgo: '20m ago',
    read: false,
    user: users[2],
    action: 'logged security event for',
    target: 'New Admin Session from IP 192.168.1.104',
  },
  {
    id: 'n10',
    category: 'admin',
    type: 'user_registered',
    title: 'New user registered',
    body: 'David Miller (david@flowsync.io) successfully verified account as DevOps Engineer.',
    time: '1h ago',
    timeAgo: '1h ago',
    read: false,
    user: users[3],
    action: 'registered as',
    target: 'DevOps Engineer (david@flowsync.io)',
  },
  {
    id: 'n11',
    category: 'admin',
    type: 'backup_completed',
    title: 'Automated database snapshot',
    body: 'Daily PostgreSQL backup completed: 4.8MB compressed snapshot saved to cold storage.',
    time: '8h ago',
    timeAgo: '8h ago',
    read: true,
    user: users[0],
    action: 'completed system backup',
    target: 'PostgreSQL Snapshot #4912',
  },
  {
    id: 'n12',
    category: 'admin',
    type: 'system_metric',
    title: 'Distributed cache peak',
    body: 'Redis cache hit-rate reached 99.1% across 14,200 operations.',
    time: '1d ago',
    timeAgo: '1d ago',
    read: true,
    user: users[2],
    action: 'recorded metric peak on',
    target: 'Redis Distributed Cache Cluster',
  },
];

export const weeklyData = [
  { day: 'Mon', completed: 8, created: 5 },
  { day: 'Tue', completed: 12, created: 7 },
  { day: 'Wed', completed: 6, created: 9 },
  { day: 'Thu', completed: 15, created: 4 },
  { day: 'Fri', completed: 11, created: 6 },
  { day: 'Sat', completed: 4, created: 2 },
  { day: 'Sun', completed: 3, created: 1 },
];

export const teamWorkload = [
  { user: users[1], assigned: 14, completed: 9, remaining: 5 },
  { user: users[2], assigned: 18, completed: 11, remaining: 7 },
  { user: users[3], assigned: 10, completed: 6, remaining: 4 },
  { user: users[4], assigned: 12, completed: 8, remaining: 4 },
  { user: users[5], assigned: 8, completed: 5, remaining: 3 },
];

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
