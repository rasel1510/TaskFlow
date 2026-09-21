'use client';

import { useSession } from 'next-auth/react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { projects as mockProjects, teamWorkload, weeklyData, healthColors, priorityColors, statusColors } from '../data/mockData';

interface DashboardProps {
  onTaskClick: (taskId: string) => void;
  onViewChange: (view: 'tasks' | 'kanban' | 'projects' | 'reports') => void;
}

// ---- Helper components (no change needed) ----

function StatCard({ label, value, change, icon, accent }: { label: string; value: string | number; change: string; icon: React.ReactNode; accent: string }) {
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

function MiniChart({ data }: { data: typeof weeklyData }) {
  const max = Math.max(...data.map(d => Math.max(d.completed, d.created)));
  const h = 60;
  const w = 40;
  const points = (key: 'completed' | 'created') =>
    data.map((d, i) => `${i * w + 20},${h - (d[key] / max) * h}`).join(' ');

  return (
    <svg viewBox={`0 0 ${data.length * w + 20} ${h + 20}`} className="w-full" style={{ height: 80 }}>
      <polyline fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points('completed')} />
      <polyline fill="none" stroke="#DBEAFE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" points={points('created')} />
      {data.map((d, i) => (
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

// Safely format a priority color — fallback to medium if unknown
function safePriorityColor(priority: string) {
  const p = priority as keyof typeof priorityColors;
  return priorityColors[p] ?? priorityColors['medium'];
}

// Safely format a status color — fallback to todo if unknown
function safeStatusColor(status: string) {
  const s = status as keyof typeof statusColors;
  return statusColors[s] ?? statusColors['todo'];
}

// Format a date string (ISO or Date) to a readable format
function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

const recentActivity = [
  { user: 'Sarah Chen', action: 'completed', target: 'UI Component Library setup', time: '2m ago', avatar: 'SC', color: '#7C3AED' },
  { user: 'Ahmed Malik', action: 'commented on', target: 'Fix authentication session timeout bug', time: '15m ago', avatar: 'AM', color: '#0891B2' },
  { user: 'John Torres', action: 'created', target: 'Implement push notification service', time: '1h ago', avatar: 'JT', color: '#16A34A' },
  { user: 'Maria Lopez', action: 'changed priority of', target: 'Mobile UI Review to High', time: '2h ago', avatar: 'ML', color: '#EA580C' },
];

export default function Dashboard({ onTaskClick, onViewChange }: DashboardProps) {
  const { tasks, isLoading } = useTasks();
  const { data: session } = useSession();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const userName = session?.user?.name?.split(' ')[0] ?? 'there';

  // Live computed stats
  const overdueCount = tasks.filter(t => t.status !== 'done' && t.priority === 'urgent').length;
  const inProgress   = tasks.filter(t => t.status === 'in_progress').length;
  const done         = tasks.filter(t => t.status === 'done').length;

  // My tasks = tasks assigned to current session user, or latest 5
  const sessionUserId = (session?.user as { id?: string })?.id;
  const myTasks: DBTask[] = sessionUserId
    ? tasks.filter(t => t.assigneeId === sessionUserId).slice(0, 5)
    : tasks.slice(0, 5);

  // Upcoming deadlines (first 4 non-done tasks)
  const upcomingDeadlines = tasks.filter(t => t.status !== 'done').slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-bold text-[#111111] mb-1">Good {greeting}, {userName}</h1>
            <p className="text-[14px] text-[rgba(17,17,17,0.5)]">Here's what needs your attention today.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[rgba(17,17,17,0.5)]">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Tasks"
            value={isLoading ? '...' : tasks.length}
            change="+12%"
            accent="#2563EB"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
          />
          <StatCard
            label="In Progress"
            value={isLoading ? '...' : inProgress}
            change="+2"
            accent="#EA580C"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
          />
          <StatCard
            label="Completed"
            value={isLoading ? '...' : done}
            change="+18%"
            accent="#16A34A"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
          />
          <StatCard
            label="Overdue"
            value={isLoading ? '...' : overdueCount}
            change="-1"
            accent="#DC2626"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-5 mb-5">
          {/* My Tasks */}
          <div className="col-span-2 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <div>
                <h2 className="text-[15px] font-semibold text-[#111111]">My Tasks</h2>
                <p className="text-[12px] text-[rgba(17,17,17,0.4)] mt-0.5">Assigned to you</p>
              </div>
              <button onClick={() => onViewChange('tasks')} className="text-[12.5px] text-[#2563EB] hover:underline font-medium">View all</button>
            </div>
            <div>
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-[13px] text-[rgba(17,17,17,0.4)]">
                  <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
                  Loading tasks...
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
                  const pc = safePriorityColor(task.priority);
                  const sc = safeStatusColor(task.status);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className={`flex items-center gap-3 px-5 py-3.5 hover:bg-[#F9FAFB] cursor-pointer transition-colors ${i < myTasks.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={task.status === 'done'}
                        onChange={() => {}}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-[#D1D5DB] accent-[#2563EB] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-medium text-[#111111] truncate">{task.title}</div>
                        <div className="text-[11.5px] text-[rgba(17,17,17,0.4)] mt-0.5">{task.project?.name ?? 'Unknown Project'}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: pc.color + '18', color: pc.color }}>
                          {pc.label}
                        </span>
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>
                          {sc.label}
                        </span>
                        {task.dueDate && (
                          <span className="text-[11.5px] text-[rgba(17,17,17,0.4)]">{formatDate(task.dueDate)}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[15px] font-semibold text-[#111111]">Recent Activity</h2>
            </div>
            <div className="px-5 py-3">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 py-3 border-b border-[#F3F4F6] last:border-0">
                  <Avatar initials={a.avatar} color={a.color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] text-[#111111] leading-snug">
                      <span className="font-semibold">{a.user}</span>
                      {' '}{a.action}{' '}
                      <span className="font-medium">{a.target}</span>
                    </p>
                    <p className="text-[11px] text-[rgba(17,17,17,0.4)] mt-0.5">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-3 gap-5 mb-5">
          {/* Weekly Chart */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <div>
                <h2 className="text-[15px] font-semibold text-[#111111]">Task Completion</h2>
                <p className="text-[12px] text-[rgba(17,17,17,0.4)] mt-0.5">This week</p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#2563EB] inline-block rounded" />Completed</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#DBEAFE] inline-block rounded" />Created</span>
              </div>
            </div>
            <div className="px-4 pt-3 pb-2">
              <MiniChart data={weeklyData} />
              <div className="flex justify-between mt-1">
                {weeklyData.map((d, i) => (
                  <div key={i} className="text-center">
                    <div className="text-[13px] font-semibold text-[#111111]">{d.completed}</div>
                    <div className="text-[10px] text-[rgba(17,17,17,0.4)]">done</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="col-span-2 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[15px] font-semibold text-[#111111]">Project Progress</h2>
              <button onClick={() => onViewChange('projects')} className="text-[12.5px] text-[#2563EB] hover:underline font-medium">View all</button>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              {mockProjects.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F9FAFB] cursor-pointer transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13.5px] font-medium text-[#111111] truncate">{p.name}</span>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ backgroundColor: healthColors[p.health].bg, color: healthColors[p.health].text }}
                      >
                        {healthColors[p.health].label}
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
              ))}
            </div>
          </div>
        </div>

        {/* Third row */}
        <div className="grid grid-cols-3 gap-5">
          {/* Team workload */}
          <div className="col-span-2 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[15px] font-semibold text-[#111111]">Team Workload</h2>
              <button onClick={() => onViewChange('reports')} className="text-[12.5px] text-[#2563EB] hover:underline font-medium">View report</button>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              {teamWorkload.map((member, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3">
                  <Avatar initials={member.user.avatar} color={avatarColors[i % avatarColors.length]} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-[#111111]">{member.user.name}</span>
                      <span className="text-[11.5px] text-[rgba(17,17,17,0.45)]">{member.completed}/{member.assigned} done</span>
                    </div>
                    <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(member.completed / member.assigned) * 100}%`, backgroundColor: avatarColors[i % avatarColors.length] }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-[12px] text-[rgba(17,17,17,0.45)]">{member.remaining} left</div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming deadlines */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[15px] font-semibold text-[#111111]">Upcoming Deadlines</h2>
            </div>
            <div className="px-5 py-3 divide-y divide-[#F3F4F6]">
              {upcomingDeadlines.length === 0 ? (
                <p className="text-[12.5px] text-[rgba(17,17,17,0.4)] py-4 text-center">No upcoming deadlines</p>
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
                        <span className="text-[11px] text-[rgba(17,17,17,0.4)]">{t.project?.name ?? 'Unknown Project'}</span>
                        <span className="text-[11px] text-[rgba(17,17,17,0.5)] font-medium">{formatDate(t.dueDate)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
