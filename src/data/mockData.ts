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

export const projects: Project[] = [
  {
    id: 'p1',
    name: 'Website Redesign',
    description: 'Complete overhaul of the marketing website with new brand identity and improved UX',
    owner: users[1],
    members: [users[0], users[1], users[4]],
    progress: 68,
    taskCount: 47,
    completedTasks: 32,
    overdueTasks: 3,
    startDate: 'Sep 1, 2026',
    dueDate: 'Oct 15, 2026',
    health: 'on_track',
    color: '#2563EB',
  },
  {
    id: 'p2',
    name: 'Mobile App v2.0',
    description: 'Native mobile application rewrite with offline support and push notifications',
    owner: users[2],
    members: [users[0], users[2], users[3], users[5]],
    progress: 41,
    taskCount: 83,
    completedTasks: 34,
    overdueTasks: 8,
    startDate: 'Aug 15, 2026',
    dueDate: 'Nov 30, 2026',
    health: 'at_risk',
    color: '#7C3AED',
  },
  {
    id: 'p3',
    name: 'Research Portal',
    description: 'Internal knowledge base and research documentation platform for the team',
    owner: users[0],
    members: [users[0], users[4]],
    progress: 85,
    taskCount: 24,
    completedTasks: 20,
    overdueTasks: 0,
    startDate: 'Jul 1, 2026',
    dueDate: 'Sep 30, 2026',
    health: 'on_track',
    color: '#0891B2',
  },
  {
    id: 'p4',
    name: 'Marketing Campaign Q4',
    description: 'Q4 product launch campaign across digital channels and events',
    owner: users[4],
    members: [users[0], users[4], users[1]],
    progress: 22,
    taskCount: 36,
    completedTasks: 8,
    overdueTasks: 5,
    startDate: 'Sep 15, 2026',
    dueDate: 'Dec 31, 2026',
    health: 'delayed',
    color: '#F59E0B',
  },
  {
    id: 'p5',
    name: 'API Platform v3',
    description: 'Major API redesign with GraphQL layer and improved developer experience',
    owner: users[2],
    members: [users[2], users[3], users[5]],
    progress: 55,
    taskCount: 61,
    completedTasks: 33,
    overdueTasks: 2,
    startDate: 'Aug 1, 2026',
    dueDate: 'Nov 15, 2026',
    health: 'on_track',
    color: '#16A34A',
  },
];

export const tasks: Task[] = [];


export const notifications = [
  { id: 'n1', user: users[1], action: 'completed', target: 'UI Component Library setup', time: '2m ago', read: false },
  { id: 'n2', user: users[2], action: 'commented on', target: 'TF-003: Fix authentication session timeout bug', time: '15m ago', read: false },
  { id: 'n3', user: users[3], action: 'created', target: 'TF-009: Implement push notification service', time: '1h ago', read: false },
  { id: 'n4', user: users[4], action: 'changed priority of', target: 'TF-004 to High', time: '2h ago', read: true },
  { id: 'n5', user: users[5], action: 'assigned you to', target: 'TF-011: Setup CI/CD pipeline', time: '3h ago', read: true },
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
  if (!projectId) return 'Independent Task';
  return projects.find(p => p.id === projectId)?.name ?? 'Project';
}
