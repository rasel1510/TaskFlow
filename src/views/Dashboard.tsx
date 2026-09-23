'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { healthColors, priorityColors, statusColors, type ProjectHealth } from '../data/mockData';
import { StatCardSkeleton, TaskRowSkeleton } from '@/components/ui/Skeleton';

interface DashboardProps {
  onTaskClick: (taskId: string) => void;
  onViewChange: (view: 'tasks' | 'kanban' | 'projects' | 'reports') => void;
}

interface VelocityItem {
  day: string;
  completed: number;
  created: number;
}

interface ProjectSummaryItem {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  completedTasks: number;
  progress: number;
  dueDate: string;
  health: ProjectHealth;
}

interface TeamMemberWorkload {
  user: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  };
  assigned: number;
  completed: number;
  remaining: number;
}

const DEFAULT_VELOCITY: VelocityItem[] = [
  { day: 'Mon', completed: 0, created: 0 },
  { day: 'Tue', completed: 0, created: 0 },
  { day: 'Wed', completed: 0, created: 0 },
  { day: 'Thu', completed: 0, created: 0 },
  { day: 'Fri', completed: 0, created: 0 },
  { day: 'Sat', completed: 0, created: 0 },
  { day: 'Sun', completed: 0, created: 0 },
];

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + '20' }}>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[28px] font-bold text-[#111111] leading-none mb-1">{value}</div>
        <div className="text-[13px] text-[rgba(17,17,17,0.5)] mb-2">{label}</div>
      </div>
    </div>
  );
}

function MiniChart({ data }: { data: VelocityItem[] }) {
  const chartData = data.length > 0 ? data : DEFAULT_VELOCITY;
  const max = Math.max(1, ...chartData.map(d => Math.max(d.completed, d.created)));
  const h = 60;
  const w = 40;
  const points = (key: 'completed' | 'created') =>
    chartData.map((d, i) => `${i * w + 20},${h - (d[key] / max) * h}`).join(' ');

  return (
    <svg viewBox={`0 0 ${chartData.length * w + 20} ${h + 20}`} className="w-full" style={{ height: 80 }}>
      <polyline fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points('completed')} />
      <polyline fill="none" stroke="#DBEAFE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" points={points('created')} />
      {chartData.map((d, i) => (
        <g key={i}>
          <text x={i * w + 20} y={h + 18} textAnchor="middle" fontSize="10" fill="rgba(17,17,17,0.4)">{d.day}</text>
          <circle cx={i * w + 20} cy={h - (d.completed / max) * h} r="3" fill="#2563EB" />
        </g>
      ))}
    </svg>
  );
}

function Avatar({ initials, color = '#2563EB' }: { initials: string; color?: string }) {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
}

const avatarColors = ['#2563EB', '#7C3AED', '#0891B2', '#16A34A', '#EA580C'];

function safePriorityColor(priority: string) {
  const p = priority as keyof typeof priorityColors;
  return priorityColors[p] ?? priorityColors['medium'];
}

function safeStatusColor(status: string) {
  const s = status as keyof typeof statusColors;
  return statusColors[s] ?? statusColors['todo'];
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function Dashboard({ onTaskClick, onViewChange }: DashboardProps) {
  const { tasks, isLoading } = useTasks();
  const { data: session } = useSession();

  const [summary, setSummary] = useState<{
    weeklyVelocity: VelocityItem[];
    projectSummary: ProjectSummaryItem[];
    teamWorkload: TeamMemberWorkload[];
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reports/summary', { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setSummary(d.data);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          // ignore or handle
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const userName = session?.user?.name?.split(' ')[0] ?? 'there';

  // Live computed stats
  const overdueCount = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now).length;
  const inProgress   = tasks.filter(t => t.status === 'in_progress').length;
  const done         = tasks.filter(t => t.status === 'done').length;

  // My tasks = latest 5 tasks belonging to this user
  const myTasks: DBTask[] = tasks.slice(0, 5);

  // Upcoming deadlines (tasks with dueDate sorted nearest first)
  const upcomingDeadlines = tasks
    .filter(t => t.status !== 'done' && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-5 md:mb-6 gap-1">
          <div>
            <h1 className="text-[22px] md:text-[26px] font-bold text-[#111111]">Good {greeting}, {userName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] md:text-[13px] text-[rgba(17,17,17,0.5)]">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
            <StatCard
              label="Total Tasks"
              value={tasks.length}
              accent="#2563EB"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
            />
            <StatCard
              label="In Progress"
              value={inProgress}
              accent="#EA580C"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
            />
            <StatCard
              label="Completed"
              value={done}
              accent="#16A34A"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
            />
            <StatCard
              label="Overdue"
              value={overdueCount}
              accent="#DC2626"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
            />
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-4 md:mb-5">
          {/* My Tasks */}
          <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <div>
                <h2 className="text-[15px] font-semibold text-[#111111]">My Tasks</h2>
                <p className="text-[12px] text-[rgba(17,17,17,0.4)] mt-0.5">Assigned to you</p>
              </div>
              <button onClick={() => onViewChange('tasks')} className="text-[12.5px] text-[#2563EB] hover:underline font-medium">View all</button>
            </div>
            <div>
              {isLoading ? (
                <div>
                  <TaskRowSkeleton />
                  <TaskRowSkeleton />
                  <TaskRowSkeleton />
                </div>
              ) : myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" className="mb-2">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  <p className="text-[13px] text-[rgba(17,17,17,0.4)]">No tasks yet. Create your first task!</p>
                </div>
              ) : (
                myTasks.map((task, i) => {
                  const sc = safeStatusColor(task.status);
                  const pc = safePriorityColor(task.priority);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className={`flex items-center gap-3 px-5 py-3.5 hover:bg-[#F9FAFB] cursor-pointer transition-colors ${
                        i < myTasks.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc.text }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-medium text-[#111111] truncate">{task.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-[rgba(17,17,17,0.4)]">{task.project?.name ?? 'General'}</span>
                          <span className="text-[10px] text-[rgba(17,17,17,0.25)]">·</span>
                          <span className="text-[11px]" style={{ color: pc.color }}>{pc.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: sc.bg, color: sc.text }}
                        >
                          {sc.label}
                        </span>
                        <span className="text-[11.5px] text-[rgba(17,17,17,0.4)]">{formatDate(task.dueDate)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Velocity mini chart */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[15px] font-semibold text-[#111111]">Weekly Velocity</h2>
                <span className="text-[11px] font-semibold text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded-full">Active</span>
              </div>
              <p className="text-[12px] text-[rgba(17,17,17,0.4)] mb-4">Completed vs. Created</p>
              <MiniChart data={summary?.weeklyVelocity ?? DEFAULT_VELOCITY} />
            </div>
            <div className="pt-3 border-t border-[#F3F4F6] grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-[14px] font-bold text-[#2563EB]">
                  {(summary?.weeklyVelocity ?? []).reduce((acc, v) => acc + v.completed, 0)}
                </div>
                <div className="text-[10.5px] text-[rgba(17,17,17,0.4)]">Completed this week</div>
              </div>
              <div>
                <div className="text-[14px] font-bold text-[#111111]">
                  {(summary?.weeklyVelocity ?? []).reduce((acc, v) => acc + v.created, 0)}
                </div>
                <div className="text-[10.5px] text-[rgba(17,17,17,0.4)]">Created this week</div>
              </div>
            </div>
          </div>
        </div>

        {/* Second row: Project Progress & Team Workload & Upcoming Deadlines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-4 md:mb-5">
          {/* Projects */}
          <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[15px] font-semibold text-[#111111]">Project Progress</h2>
              <button onClick={() => onViewChange('projects')} className="text-[12.5px] text-[#2563EB] hover:underline font-medium">View all</button>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              {(!summary?.projectSummary || summary.projectSummary.length === 0) ? (
                <div className="py-8 text-center text-[13px] text-[rgba(17,17,17,0.4)]">
                  No projects created yet.
                </div>
              ) : (
                summary.projectSummary.map(p => {
                  const hc = healthColors[p.health] ?? healthColors['on_track'];
                  return (
                    <div key={p.id} onClick={() => onViewChange('projects')} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F9FAFB] cursor-pointer transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[13.5px] font-medium text-[#111111] truncate">{p.name}</span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ backgroundColor: hc.bg, color: hc.text }}
                          >
                            {hc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: p.color }} />
                          </div>
                          <span className="text-[11px] text-[rgba(17,17,17,0.45)] shrink-0">{p.progress}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-semibold text-[#111111]">{p.completedTasks}/{p.taskCount}</div>
                        <div className="text-[11px] text-[rgba(17,17,17,0.4)]">{p.dueDate}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming deadlines */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[15px] font-semibold text-[#111111]">Upcoming Deadlines</h2>
            </div>
            <div className="px-5 py-3 divide-y divide-[#F3F4F6]">
              {upcomingDeadlines.length === 0 ? (
                <p className="text-[12.5px] text-[rgba(17,17,17,0.4)] py-6 text-center">No upcoming deadlines</p>
              ) : (
                upcomingDeadlines.map(t => {
                  const pc = safePriorityColor(t.priority);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onTaskClick(t.id)}
                      className="py-3 cursor-pointer hover:opacity-75 transition-opacity"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12.5px] font-medium text-[#111111] truncate pr-2">{t.title}</span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pc.color }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[rgba(17,17,17,0.4)]">{t.project?.name ?? 'General'}</span>
                        <span className="text-[11px] text-[rgba(17,17,17,0.5)] font-medium">{formatDate(t.dueDate)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Third row: Team workload */}
        {summary?.teamWorkload && summary.teamWorkload.length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[15px] font-semibold text-[#111111]">Team Workload</h2>
              <button onClick={() => onViewChange('reports')} className="text-[12.5px] text-[#2563EB] hover:underline font-medium">View full report</button>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              {summary.teamWorkload.map((member, i) => (
                <div key={member.user.id || i} className="flex items-center gap-4 px-5 py-3">
                  <Avatar initials={member.user.avatar} color={avatarColors[i % avatarColors.length]} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-[#111111]">{member.user.name}</span>
                      <span className="text-[11.5px] text-[rgba(17,17,17,0.45)]">{member.completed}/{member.assigned} done</span>
                    </div>
                    <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${member.assigned > 0 ? (member.completed / member.assigned) * 100 : 0}%`,
                          backgroundColor: avatarColors[i % avatarColors.length],
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-[12px] text-[rgba(17,17,17,0.45)]">{member.remaining} left</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
