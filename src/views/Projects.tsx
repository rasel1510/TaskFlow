'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { healthColors, type ProjectHealth, type User } from '../data/mockData';
import CreateProjectModal from '@/components/CreateProjectModal';
import { ProjectCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/ui/Toast';

interface ProjectsProps {
  onViewChange?: (view: 'kanban') => void;
  onSelectProject?: (projectId: string) => void;
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
  isMember?: boolean;
  hasPendingRequest?: boolean;
  isOwner?: boolean;
  canManage?: boolean;
  pendingRequestsCount?: number;
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

export default function Projects({ onViewChange, onSelectProject }: ProjectsProps) {
  const { data: session } = useSession();
  const toast = useToast();
  const userRole = (session?.user as { role?: string })?.role;
  const canCreateProject = userRole === 'Project Manager' || userRole?.toLowerCase() === 'project manager';

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<UIProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Request to join modal state
  const [requestModalProject, setRequestModalProject] = useState<UIProject | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Project deletion state (Project Managers only)
  const [projectToDelete, setProjectToDelete] = useState<UIProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/projects', { signal });
      const envelope = await res.json();
      const rawList = Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized: UIProject[] = rawList.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        color: p.color || '#2563EB',
        progress: typeof p.progress === 'number' ? p.progress : 0,
        taskCount: p.taskCount ?? p._count?.tasks ?? 0,
        completedTasks: typeof p.completedTasks === 'number' ? p.completedTasks : 0,
        overdueTasks: typeof p.overdueTasks === 'number' ? p.overdueTasks : 0,
        health: (p.health && p.health in healthColors ? p.health : 'on_track') as ProjectHealth,
        dueDate: p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline',
        owner: p.owner,
        members: p.members ?? (p.owner ? [p.owner] : []),
        isMember: Boolean(p.isMember),
        hasPendingRequest: Boolean(p.hasPendingRequest),
        isOwner: Boolean(p.isOwner),
        canManage: Boolean(p.canManage),
        pendingRequestsCount: p.pendingRequestsCount ?? 0,
      }));
      setProjects(normalized);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[Projects] Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchProjects(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchProjects]);

  const handleSendJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestModalProject) return;
    setSubmittingRequest(true);
    try {
      const res = await fetch(`/api/projects/${requestModalProject.id}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: requestMessage.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || 'Failed to submit join request');
      }
      toast.success('Join request sent to Project Manager!');
      setProjects(prev =>
        prev.map(p => (p.id === requestModalProject.id ? { ...p, hasPendingRequest: true } : p))
      );
      setRequestModalProject(null);
      setRequestMessage('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit request';
      toast.error(msg);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || 'Failed to delete project');
      }
      toast.success(`Project "${projectToDelete.name}" deleted successfully`);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-[20px] md:text-[24px] font-bold text-[#111111]">Projects</h1>
            <p className="text-[12px] md:text-[13px] text-[rgba(17,17,17,0.45)] mt-0.5">
              {loading ? 'Loading projects...' : `${projects.length} active projects`}
            </p>
          </div>
          {canCreateProject && (
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
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[#E5E7EB] hover:border-[#CBD5E1] rounded-lg bg-[#F9FAFB] focus-within:bg-white focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all w-60 sm:w-72 shadow-2xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="bg-transparent text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none border-none focus:outline-none focus:ring-0 w-full"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] hover:bg-[#E5E7EB] transition-colors shrink-0"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
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
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
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
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No projects found"
            description={search ? `No projects match "${search}".` : "Create your first project to organize your team's tasks."}
            action={!search && canCreateProject ? { label: 'Create Project', onClick: () => setShowCreateModal(true) } : undefined}
          />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => {
                  if (p.isMember || p.isOwner || canCreateProject) {
                    if (onSelectProject) onSelectProject(p.id);
                    else onViewChange?.('kanban');
                  } else {
                    setRequestModalProject(p);
                    setRequestMessage('');
                  }
                }}
                className="bg-white border border-[#E5E7EB] rounded-xl p-5 hover:border-[#93C5FD] hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: p.color + '20' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="1.75">
                          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-semibold text-[#111111] truncate">{p.name}</h3>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span style={{ color: healthColors[p.health].text }}>{healthIcons[p.health]}</span>
                          <span className="text-[11px]" style={{ color: healthColors[p.health].text }}>{healthColors[p.health].label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Project Membership / Join Status / PM Actions */}
                    <div className="shrink-0 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      {canCreateProject && (
                        <button
                          type="button"
                          title="Delete Project"
                          onClick={() => setProjectToDelete(p)}
                          className="p-1.5 text-gray-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors cursor-pointer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                          </svg>
                        </button>
                      )}
                      {p.isOwner ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                          Owner
                        </span>
                      ) : p.isMember ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]">
                          ✓ Member
                        </span>
                      ) : p.hasPendingRequest ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRequestModalProject(p);
                            setRequestMessage('');
                          }}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-2xs transition-colors cursor-pointer"
                        >
                          Request to Join
                        </button>
                      )}
                    </div>
                  </div>

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
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
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

            {/* New project card (Project Managers & Admins only) */}
            {canCreateProject && (
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
            )}
          </div>
        ) : (
          /* List view */
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto shadow-xs">
            <div className="min-w-[680px]">
              <div className="flex items-center gap-4 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11.5px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
                <span className="flex-1">Project</span>
                <span className="w-28">Health</span>
                <span className="w-20">Progress</span>
                <span className="w-20">Tasks</span>
                <span className="w-24">Members</span>
                <span className="w-24">Deadline</span>
                <span className="w-28 text-right">Status / Access</span>
              </div>
              {filtered.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (p.isMember || p.isOwner || canCreateProject) {
                      if (onSelectProject) onSelectProject(p.id);
                      else onViewChange?.('kanban');
                    } else {
                      setRequestModalProject(p);
                      setRequestMessage('');
                    }
                  }}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-[#F9FAFB] cursor-pointer transition-colors ${i < filtered.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
                >
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: p.color + '20' }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-[#111111] truncate">{p.name}</div>
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
                  <span className="w-24 text-[12.5px] text-[rgba(17,17,17,0.6)]">{p.dueDate}</span>
                  <div className="w-28 text-right flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                    {p.isOwner ? (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                        Owner
                      </span>
                    ) : p.isMember ? (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]">
                        ✓ Member
                      </span>
                    ) : p.hasPendingRequest ? (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                        Pending
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRequestModalProject(p);
                          setRequestMessage('');
                        }}
                        className="px-2 py-1 rounded text-[11px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                      >
                        Request
                      </button>
                    )}
                    {canCreateProject && (
                      <button
                        type="button"
                        title="Delete Project"
                        onClick={() => setProjectToDelete(p)}
                        className="p-1 text-gray-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded transition-colors cursor-pointer"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"/>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Request to Join Modal */}
      {requestModalProject && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setRequestModalProject(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F3F4F6]">
              <div>
                <h3 className="text-[16px] font-bold text-[#111111]">Request to Join Project</h3>
                <p className="text-[12px] text-[rgba(17,17,17,0.5)] mt-0.5">
                  Submit a request to the Project Manager for <strong>{requestModalProject.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalProject(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F4F6] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleSendJoinRequest} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.5)] mb-1.5">
                  Note / Relevant Skills for Project Manager
                </label>
                <textarea
                  value={requestMessage}
                  onChange={e => setRequestMessage(e.target.value)}
                  placeholder="Tell the Project Manager what skills and expertise you can contribute..."
                  rows={3}
                  className="w-full text-[13px] border border-[#E5E7EB] rounded-lg p-3 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] resize-none"
                />
                <p className="text-[11px] text-[rgba(17,17,17,0.4)] mt-1">
                  The Project Manager will review your profile and expertise matrix before approving.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestModalProject(null)}
                  className="px-3.5 py-2 text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="px-4 py-2 text-[13px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingRequest ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal (Project Managers only) */}
      {projectToDelete && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeleting && setProjectToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-bold text-[#111111]">Delete Project</h3>
                <p className="text-[12.5px] text-[rgba(17,17,17,0.6)] mt-1">
                  Are you sure you want to permanently delete <strong className="text-[#111111]">{projectToDelete.name}</strong>?
                </p>
              </div>
            </div>

            <p className="text-[12px] text-[#DC2626] bg-[#FEF2F2] p-3 rounded-lg border border-[#FEE2E2] mb-5">
              Warning: This action will permanently remove this project, all associated tasks, team memberships, and milestones. This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProjectToDelete(null)}
                className="px-3.5 py-2 text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProject}
                className="px-4 py-2 text-[13px] font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

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
