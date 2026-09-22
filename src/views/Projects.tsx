'use client';

import { useState, useEffect, useCallback } from 'react';
import { healthColors, type ProjectHealth, type User } from '../data/mockData';
import CreateProjectModal from '@/components/CreateProjectModal';

interface ProjectsProps {
  onViewChange?: (view: 'kanban') => void;
}

interface UIProject {
  id: string;
  name: string;
  description: string;
  color: string;
  progress: number;
  taskCount: number;
  completedTasks: number;
  overdueTasks: number;
  startDate?: string;
  dueDate: string;
  health: ProjectHealth;
  owner?: User;
  members: User[];
}

function ProgressRing({ progress, color, size = 44 }: { progress: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#111111">{progress}%</text>
    </svg>
  );
}

const healthIcons: Record<ProjectHealth, React.ReactNode> = {
  on_track: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  at_risk: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  delayed: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  completed: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
};

export default function Projects({ onViewChange }: ProjectsProps) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<UIProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const envelope = await res.json();
      const rawList = Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized: UIProject[] = rawList.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || 'No description provided.',
        color: p.color || '#2563EB',
        progress: typeof p.progress === 'number' ? p.progress : 0,
        taskCount: p.taskCount ?? p._count?.tasks ?? 0,
        completedTasks: typeof p.completedTasks === 'number' ? p.completedTasks : 0,
        overdueTasks: typeof p.overdueTasks === 'number' ? p.overdueTasks : 0,
        health: (p.health && p.health in healthColors ? p.health : 'on_track') as ProjectHealth,
        dueDate: p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline',
        owner: p.owner,
        members: p.members ?? (p.owner ? [p.owner] : []),
      }));
      setProjects(normalized);
    } catch (err) {
      console.error('[Projects] Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[24px] font-bold text-[#111111]">Projects</h1>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mt-0.5">
              {loading ? 'Loading projects...' : `${projects.length} active projects`}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13.5px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Project
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="bg-transparent text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none w-44"
            />
          </div>
          <div className="ml-auto flex items-center gap-0.5 p-1 bg-[#F3F4F6] rounded-lg">
            <button
              onClick={() => setView('grid')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                view === 'grid' ? 'bg-white shadow-sm text-[#111111]' : 'text-[rgba(17,17,17,0.4)] hover:text-[#111111]'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                view === 'list' ? 'bg-white shadow-sm text-[#111111]' : 'text-[rgba(17,17,17,0.4)] hover:text-[#111111]'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Skeleton Loaders */}
        {loading ? (
          view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="border border-[#E5E7EB] rounded-xl p-5 bg-white space-y-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#E5E7EB]" />
                    <div className="space-y-1.5 flex-1">
                      <div className="w-28 h-4 bg-[#E5E7EB] rounded" />
                      <div className="w-16 h-3 bg-[#F3F4F6] rounded" />
                    </div>
                  </div>
                  <div className="w-full h-8 bg-[#F3F4F6] rounded" />
                  <div className="h-10 bg-[#F9FAFB] rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white divide-y divide-[#F3F4F6]">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-[#E5E7EB]" />
                  <div className="flex-1 space-y-1">
                    <div className="w-32 h-4 bg-[#E5E7EB] rounded" />
                    <div className="w-48 h-3 bg-[#F3F4F6] rounded" />
                  </div>
                  <div className="w-20 h-4 bg-[#E5E7EB] rounded" />
                </div>
              ))}
            </div>
          )
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => onViewChange?.('kanban')}
                className="bg-white border border-[#E5E7EB] rounded-xl p-5 hover:border-[#93C5FD] hover:shadow-sm transition-all cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: p.color + '20' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="1.75">
                        <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#111111]">{p.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span style={{ color: healthColors[p.health].text }}>{healthIcons[p.health]}</span>
                        <span className="text-[11px]" style={{ color: healthColors[p.health].text }}>{healthColors[p.health].label}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[12.5px] text-[rgba(17,17,17,0.5)] mb-4 leading-relaxed line-clamp-2">{p.description}</p>

                {/* Progress */}
                <div className="flex items-center gap-3 mb-4">
                  <ProgressRing progress={p.progress} color={p.color} />
                  <div className="flex-1">
                    <div className="flex justify-between text-[11.5px] mb-1.5">
                      <span className="text-[rgba(17,17,17,0.5)]">{p.completedTasks} completed</span>
                      <span className="text-[rgba(17,17,17,0.5)]">{Math.max(0, p.taskCount - p.completedTasks)} remaining</span>
                    </div>
                    <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: p.color }} />
                    </div>
                    {p.overdueTasks > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10.5px] text-[#DC2626] font-medium">{p.overdueTasks} overdue</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-[#F3F4F6]">
                  <div className="text-center">
                    <div className="text-[14px] font-bold text-[#111111]">{p.taskCount}</div>
                    <div className="text-[10.5px] text-[rgba(17,17,17,0.4)]">Tasks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[14px] font-bold text-[#111111]">{p.members.length}</div>
                    <div className="text-[10.5px] text-[rgba(17,17,17,0.4)]">Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[14px] font-bold text-[#111111]">{p.overdueTasks}</div>
                    <div className="text-[10.5px] text-[rgba(17,17,17,0.4)]">Overdue</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {p.members.slice(0, 4).map((m, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ backgroundColor: ['#2563EB', '#7C3AED', '#0891B2', '#16A34A'][i % 4] }}
                      >
                        {m.avatar}
                      </div>
                    ))}
                    {p.members.length > 4 && (
                      <div className="w-6 h-6 rounded-full border-2 border-white bg-[#F3F4F6] flex items-center justify-center text-[8px] font-semibold text-[#555]">
                        +{p.members.length - 4}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10.5px] text-[rgba(17,17,17,0.4)]">{p.dueDate}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* New project card */}
            <div
              onClick={() => setShowCreateModal(true)}
              className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-5 flex flex-col items-center justify-center gap-3 hover:border-[#93C5FD] hover:bg-[#FAFBFF] cursor-pointer transition-all group min-h-[260px]"
            >
              <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] group-hover:bg-[#DBEAFE] flex items-center justify-center transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" className="group-hover:stroke-[#2563EB] transition-colors" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[13.5px] font-medium text-[rgba(17,17,17,0.5)] group-hover:text-[#2563EB] transition-colors">New Project</p>
                <p className="text-[11.5px] text-[rgba(17,17,17,0.35)] mt-0.5">Create a new project</p>
              </div>
            </div>
          </div>
        ) : (
          /* List view */
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11.5px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
              <span className="flex-1">Project</span>
              <span className="w-28">Health</span>
              <span className="w-20">Progress</span>
              <span className="w-20">Tasks</span>
              <span className="w-24">Members</span>
              <span className="w-28">Deadline</span>
              <span className="w-8" />
            </div>
            {filtered.map((p, i) => (
              <div
                key={p.id}
                onClick={() => onViewChange?.('kanban')}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-[#F9FAFB] cursor-pointer transition-colors ${i < filtered.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
              >
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: p.color + '20' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-[#111111] truncate">{p.name}</div>
                    <div className="text-[11.5px] text-[rgba(17,17,17,0.4)] truncate mt-0.5">{p.description}</div>
                  </div>
                </div>
                <div className="w-28">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: healthColors[p.health].text }}>
                    {healthIcons[p.health]}
                    {healthColors[p.health].label}
                  </span>
                </div>
                <div className="w-20 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: p.color }} />
                  </div>
                  <span className="text-[11.5px] text-[rgba(17,17,17,0.5)] shrink-0">{p.progress}%</span>
                </div>
                <div className="w-20 text-[12.5px] text-[rgba(17,17,17,0.6)]">{p.completedTasks}/{p.taskCount}</div>
                <div className="w-24 flex -space-x-1.5">
                  {p.members.slice(0, 3).map((m, mi) => (
                    <div
                      key={mi}
                      className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ backgroundColor: ['#2563EB', '#7C3AED', '#0891B2'][mi % 3] }}
                    >
                      {m.avatar}
                    </div>
                  ))}
                </div>
                <span className="w-28 text-[12.5px] text-[rgba(17,17,17,0.6)]">{p.dueDate}</span>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.3)] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="5" r="1"/>
                    <circle cx="12" cy="12" r="1"/>
                    <circle cx="12" cy="19" r="1"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchProjects}
        />
      )}
    </div>
  );
}
