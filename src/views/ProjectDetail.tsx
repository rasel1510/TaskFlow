'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { healthColors, statusColors, priorityColors, type ProjectHealth, type Status, type Priority } from '@/data/mockData';
import { useToast } from '@/components/ui/Toast';
import { LIFECYCLE_STATE_CONFIG, validateLifecycleTransition, type ProjectLifecycleState } from '@/lib/projectLifecycle';
import { ROLE_DESCRIPTIONS, type ProjectRole } from '@/lib/permissions';
import type { MilestoneRecord } from '@/api/projects/[id]/milestones/route';
import type { MemberRecord } from '@/api/projects/[id]/members/route';
import type { BurndownResult } from '@/api/projects/[id]/burndown/route';

interface ProjectTask {
  id: string;
  taskNumber: string | null;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  estimate?: string | null;
  assignee?: {
    id: string;
    name: string;
    avatar: string;
    role?: string;
  } | null;
  _count?: {
    subtasks: number;
    comments: number;
  };
}

interface ProjectData {
  id: string;
  name: string;
  description: string;
  color: string;
  health: ProjectHealth;
  progress: number;
  startDate?: string | null;
  dueDate?: string | null;
  owner?: {
    id: string;
    name: string;
    avatar: string;
    role: string;
    email: string;
  } | null;
  tasks: ProjectTask[];
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
}

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onTaskClick: (taskId: string) => void;
  onCreateTask?: (projectId: string) => void;
}

export default function ProjectDetail({
  projectId,
  onBack,
  onTaskClick,
  onCreateTask,
}: ProjectDetailProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'milestones' | 'members' | 'burndown' | 'settings'>('overview');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');

  // Milestones state
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);

  // Members state
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Burndown state
  const [burndown, setBurndown] = useState<BurndownResult | null>(null);
  const [burndownLoading, setBurndownLoading] = useState(false);

  // Lifecycle state
  const [lifecycleState, setLifecycleState] = useState<ProjectLifecycleState>('ACTIVE');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Edit settings form state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#2563EB');
  const [editHealth, setEditHealth] = useState<ProjectHealth>('on_track');
  const [editDueDate, setEditDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toast = useToast();

  const fetchProject = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}`, { signal });
      const json = await res.json();
      if (json.success && json.data) {
        setProject(json.data);
        setEditName(json.data.name || '');
        setEditDesc(json.data.description || '');
        setEditColor(json.data.color || '#2563EB');
        setEditHealth(json.data.health || 'on_track');
        setEditDueDate(
          json.data.dueDate ? new Date(json.data.dueDate).toISOString().split('T')[0] : ''
        );
        setLifecycleState(json.data.lifecycleState || 'ACTIVE');
      } else {
        if (signal?.aborted) return;
        toast.error('Project not found');
        onBack();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[ProjectDetail] Fetch error:', err);
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [projectId, onBack, toast]);

  const fetchMilestones = useCallback(async () => {
    setMilestonesLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`);
      const json = await res.json();
      if (json.success) setMilestones(json.data || []);
    } catch (e) { console.warn('[ProjectDetail] Milestones fetch error:', e); }
    finally { setMilestonesLoading(false); }
  }, [projectId]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      const json = await res.json();
      if (json.success) setMembers(json.data || []);
    } catch (e) { console.warn('[ProjectDetail] Members fetch error:', e); }
    finally { setMembersLoading(false); }
  }, [projectId]);

  const fetchBurndown = useCallback(async () => {
    setBurndownLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/burndown`);
      const json = await res.json();
      if (json.success) setBurndown(json.data);
    } catch (e) { console.warn('[ProjectDetail] Burndown fetch error:', e); }
    finally { setBurndownLoading(false); }
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProject(controller.signal);
    return () => controller.abort();
  }, [fetchProject]);

  useEffect(() => {
    if (activeTab === 'milestones') fetchMilestones();
    if (activeTab === 'members') fetchMembers();
    if (activeTab === 'burndown') fetchBurndown();
  }, [activeTab, fetchMilestones, fetchMembers, fetchBurndown]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          color: editColor,
          health: editHealth,
          dueDate: editDueDate || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Project settings updated');
        setProject(prev =>
          prev
            ? {
                ...prev,
                name: editName,
                description: editDesc,
                color: editColor,
                health: editHealth,
                dueDate: editDueDate,
              }
            : null
        );
        setActiveTab('overview');
      } else {
        toast.error(json.error?.message || 'Failed to update project');
      }
    } catch (err) {
      console.error('[ProjectDetail] Update error:', err);
      toast.error('Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!window.confirm(`Are you sure you want to archive project "${project.name}"? It will be soft-archived and can be restored.`)) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('Project archived successfully');
        onBack();
      } else {
        toast.error('Failed to archive project');
      }
    } catch {
      toast.error('Failed to archive project');
    }
  };

  const handleLifecycleTransition = async (targetState: ProjectLifecycleState) => {
    if (!project) return;
    const validation = validateLifecycleTransition(lifecycleState, targetState);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid state transition');
      return;
    }
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lifecycleState: targetState }),
      });
      const json = await res.json();
      if (json.success) {
        setLifecycleState(targetState);
        toast.success(`Project moved to ${LIFECYCLE_STATE_CONFIG[targetState].label}`);
      } else {
        toast.error(json.error?.message || 'Lifecycle transition failed');
      }
    } catch {
      toast.error('Failed to update lifecycle state');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;
    setAddingMilestone(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newMilestoneTitle.trim(), targetDate: newMilestoneDate || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setMilestones(prev => [...prev, json.data]);
        setNewMilestoneTitle('');
        setNewMilestoneDate('');
        toast.success('Milestone added');
      } else {
        toast.error(json.error?.message || 'Failed to add milestone');
      }
    } catch { toast.error('Failed to add milestone'); }
    finally { setAddingMilestone(false); }
  };

  const handleToggleMilestone = async (ms: MilestoneRecord) => {
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ms.id, milestoneId: ms.id, completed: !ms.completed }),
    }).catch(() => null);
    if (res?.ok) {
      setMilestones(prev => prev.map(m => m.id === ms.id ? { ...m, completed: !m.completed, progress: !m.completed ? 100 : m.progress } : m));
    }
  };

  if (loading || !project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-[#6B7280]">Loading project details...</span>
        </div>
      </div>
    );
  }

  const healthConfig = healthColors[project.health] || {
    bg: '#F0FDF4',
    text: '#16A34A',
    label: 'On Track',
  };

  const filteredTasks = (project.tasks || []).filter(task => {
    if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false;
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchNumber = task.taskNumber && task.taskNumber.toLowerCase().includes(q);
      if (!matchTitle && !matchNumber) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white">
      {/* Top Banner Navigation */}
      <div className="border-b border-[#E5E7EB] bg-white px-4 sm:px-6 py-3.5 sm:py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-[rgba(17,17,17,0.5)] hover:text-[#111111] transition-colors mb-3"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Projects
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
              style={{ backgroundColor: project.color + '1A', color: project.color }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[19px] sm:text-[22px] font-bold text-[#111111] tracking-tight">
                  {project.name}
                </h1>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: healthConfig.bg, color: healthConfig.text }}
                >
                  {healthConfig.label}
                </span>
              </div>
              <p className="text-[12.5px] sm:text-[13px] text-[rgba(17,17,17,0.5)] mt-0.5 line-clamp-1">
                {project.description || 'No description provided'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onCreateTask && (
              <button
                onClick={() => onCreateTask(project.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium transition-colors shadow-xs"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Task
              </button>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[13px] font-medium text-[rgba(17,17,17,0.7)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
          </div>
        </div>

        {/* Tabs switcher */}
        <div className="flex items-center gap-4 sm:gap-5 mt-5 sm:mt-6 border-b border-[#F3F4F6] text-[13px] overflow-x-auto no-scrollbar">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'tasks', label: `Tasks (${project.totalTasks})` },
            { key: 'milestones', label: 'Roadmap' },
            { key: 'members', label: 'Team & RBAC' },
            { key: 'burndown', label: 'Burndown' },
            { key: 'settings', label: 'Settings' },
          ] as { key: typeof activeTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-2.5 font-medium border-b-2 whitespace-nowrap transition-colors shrink-0 ${
                activeTab === key
                  ? 'border-[#2563EB] text-[#2563EB] font-semibold'
                  : 'border-transparent text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-5 sm:space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFB]">
            <span className="text-[12px] font-medium text-[rgba(17,17,17,0.5)]">Total Tasks</span>
            <div className="text-[22px] font-bold text-[#111111] mt-1">{project.totalTasks}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFB]">
            <span className="text-[12px] font-medium text-[rgba(17,17,17,0.5)]">Completed</span>
            <div className="text-[22px] font-bold text-[#16A34A] mt-1">
              {project.completedTasks}
              <span className="text-[12px] font-normal text-[rgba(17,17,17,0.4)] ml-1.5">
                ({project.completionRate}%)
              </span>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFB]">
            <span className="text-[12px] font-medium text-[rgba(17,17,17,0.5)]">In Progress</span>
            <div className="text-[22px] font-bold text-[#2563EB] mt-1">{project.inProgressTasks}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFB]">
            <span className="text-[12px] font-medium text-[rgba(17,17,17,0.5)]">Overdue</span>
            <div className="text-[22px] font-bold text-[#DC2626] mt-1">{project.overdueTasks}</div>
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Progress bar */}
            <div className="p-5 rounded-2xl border border-[#E5E7EB] bg-white space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-[#111111]">Overall Progress</span>
                <span className="font-bold text-[#2563EB]">{project.completionRate}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${project.completionRate}%`, backgroundColor: project.color }}
                />
              </div>
            </div>

            {/* Description & Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 p-5 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
                <h3 className="text-[15px] font-semibold text-[#111111]">About this project</h3>
                <p className="text-[13.5px] text-[rgba(17,17,17,0.7)] leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>

                <div className="pt-4 border-t border-[#F3F4F6] grid grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <span className="text-[rgba(17,17,17,0.45)] text-[12px] block">Start Date</span>
                    <span className="font-medium text-[#111111]">
                      {project.startDate
                        ? new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[rgba(17,17,17,0.45)] text-[12px] block">Target Due Date</span>
                    <span className="font-medium text-[#111111]">
                      {project.dueDate
                        ? new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'No deadline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Owner card */}
              <div className="p-5 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
                <h3 className="text-[15px] font-semibold text-[#111111]">Project Lead</h3>
                {project.owner ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center font-bold text-[12px] text-[#111111]">
                      {project.owner.avatar}
                    </div>
                    <div>
                      <div className="text-[13.5px] font-semibold text-[#111111]">{project.owner.name}</div>
                      <div className="text-[12px] text-[rgba(17,17,17,0.5)]">{project.owner.role}</div>
                      <div className="text-[11px] text-[rgba(17,17,17,0.4)]">{project.owner.email}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px] text-[rgba(17,17,17,0.4)]">No owner assigned</div>
                )}
              </div>
            </div>

            {/* Recent Tasks */}
            <div className="p-5 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[#111111]">Recent Tasks</h3>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-[12px] font-medium text-[#2563EB] hover:underline"
                >
                  View all ({project.totalTasks}) →
                </button>
              </div>

              <div className="divide-y divide-[#F3F4F6]">
                {project.tasks.slice(0, 5).map(task => {
                  const statusCfg = statusColors[task.status as Status] || { bg: '#F3F4F6', text: '#6B7280', label: task.status };
                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className="flex items-center justify-between py-2.5 px-2 hover:bg-[#F9FAFB] rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {task.taskNumber && (
                          <span className="font-mono text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                            {task.taskNumber}
                          </span>
                        )}
                        <span className="text-[13px] font-medium text-[#111111] truncate">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-medium"
                          style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                        >
                          {statusCfg.label}
                        </span>
                        {task.assignee && (
                          <span className="w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[9px] font-bold text-[#111111]">
                            {task.assignee.avatar}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Milestones / Roadmap (Step 4.9) */}
        {activeTab === 'milestones' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#111111]">Sprint Milestones &amp; Roadmap</h3>
              <span className="text-[12px] text-[rgba(17,17,17,0.4)]">{milestones.filter(m => m.completed).length}/{milestones.length} completed</span>
            </div>
            <form onSubmit={handleAddMilestone} className="flex items-center gap-2">
              <input type="text" placeholder="New milestone title..." value={newMilestoneTitle}
                onChange={e => setNewMilestoneTitle(e.target.value)}
                className="flex-1 text-[13px] px-3 py-2 border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB]" />
              <input type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)}
                className="text-[12px] px-2 py-2 border border-[#E5E7EB] rounded-lg outline-none" />
              <button type="submit" disabled={addingMilestone || !newMilestoneTitle.trim()}
                className="px-4 py-2 bg-[#2563EB] text-white text-[12.5px] font-medium rounded-lg disabled:opacity-50">
                {addingMilestone ? 'Adding...' : '+ Add'}
              </button>
            </form>
            {milestonesLoading ? (
              <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">Loading milestones...</div>
            ) : milestones.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">No milestones yet. Add your first sprint milestone above.</div>
            ) : (
              <div className="space-y-3">
                {milestones.map(ms => (
                  <div key={ms.id} className={`p-4 rounded-xl border ${ms.completed ? 'border-[#D1FAE5] bg-[#ECFDF5]' : 'border-[#E5E7EB] bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => handleToggleMilestone(ms)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${ms.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[#D1D5DB] hover:border-[#2563EB]'}`}>
                        {ms.completed && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[14px] font-semibold ${ms.completed ? 'line-through text-[rgba(17,17,17,0.4)]' : 'text-[#111111]'}`}>{ms.title}</span>
                          {ms.targetDate && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[rgba(17,17,17,0.5)]">
                              Due {new Date(ms.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {ms.description && <p className="text-[12px] text-[rgba(17,17,17,0.5)] mt-0.5">{ms.description}</p>}
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${ms.progress}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-[rgba(17,17,17,0.5)] shrink-0">{ms.progress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Team & RBAC (Step 4.10) */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <h3 className="text-[16px] font-semibold text-[#111111]">Team &amp; Access Control (RBAC)</h3>
            {membersLoading ? (
              <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">Loading team members...</div>
            ) : members.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">No members assigned to this project.</div>
            ) : (
              <div className="space-y-2">
                {members.map(m => {
                  const roleConfig = ROLE_DESCRIPTIONS[(m.role as ProjectRole)] || ROLE_DESCRIPTIONS['VIEWER'];
                  return (
                    <div key={m.userId} className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E7EB] bg-white">
                      <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center font-bold text-[13px] text-[#2563EB] shrink-0">
                        {m.name?.slice(0, 2).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-[#111111]">{m.name}</div>
                        <div className="text-[12px] text-[rgba(17,17,17,0.45)]">{m.email}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${roleConfig.badgeColor}`}>
                          {roleConfig.label}
                        </span>
                        <div className="text-[10.5px] text-[rgba(17,17,17,0.35)] mt-0.5">
                          Joined {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Burndown & Velocity (Step 4.12) */}
        {activeTab === 'burndown' && (
          <div className="space-y-5">
            <h3 className="text-[16px] font-semibold text-[#111111]">Burndown &amp; Velocity Analytics</h3>
            {burndownLoading ? (
              <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">Computing burndown chart...</div>
            ) : !burndown ? (
              <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">Burndown data unavailable for this project.</div>
            ) : (
              <>
                {/* KPI strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Tasks', value: String(burndown.totalTasks), color: '#2563EB' },
                    { label: 'Completed', value: String(burndown.completedTasks), color: '#16A34A' },
                    { label: 'Velocity (7d)', value: `${burndown.velocityLast7Days} tasks`, color: '#7C3AED' },
                    { label: 'Forecast', value: burndown.forecastedCompletionDate || 'N/A', color: burndown.isOnTrack ? '#16A34A' : '#DC2626' },
                  ].map(k => (
                    <div key={k.label} className="p-4 rounded-xl border border-[#E5E7EB] bg-white">
                      <div className="text-[11.5px] text-[rgba(17,17,17,0.45)]">{k.label}</div>
                      <div className="text-[18px] font-bold mt-1" style={{ color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* SLA status banner */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-[13px] font-medium ${burndown.isOnTrack ? 'bg-[#ECFDF5] border-[#D1FAE5] text-emerald-700' : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'}`}>
                  <span>{burndown.isOnTrack ? '✅ On Track — within SLA' : '⚠️ At Risk — velocity below target'}</span>
                  {burndown.daysUntilForecastedCompletion !== null && (
                    <span className="ml-auto text-[12px] opacity-70">~{burndown.daysUntilForecastedCompletion}d to projected completion</span>
                  )}
                </div>

                {/* SVG Burndown Chart */}
                {burndown.series.length > 1 && (
                  <div className="p-5 rounded-xl border border-[#E5E7EB] bg-white">
                    <div className="flex items-center gap-5 text-[12px] mb-4 text-[rgba(17,17,17,0.6)]">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 border-b-2 border-dashed border-[#9CA3AF]"></span>Ideal Burndown
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 border-b-2 border-[#2563EB]"></span>Actual Remaining
                      </span>
                    </div>
                    <svg width="100%" viewBox="0 0 640 220" style={{ overflow: 'visible' }}>
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map(t => {
                        const maxY = Math.max(burndown.totalTasks, 1);
                        const y = 10 + 180 - (t * 180);
                        return (
                          <g key={t}>
                            <line x1={40} x2={620} y1={y} y2={y} stroke="#F3F4F6" strokeWidth="1" />
                            <text x={36} y={y + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">{Math.round(maxY * t)}</text>
                          </g>
                        );
                      })}
                      {/* Ideal line (dashed grey) */}
                      <path
                        d={burndown.series.map((p, i) => {
                          const maxY = Math.max(burndown.totalTasks, 1);
                          const x = 40 + (i / (burndown.series.length - 1)) * 580;
                          const y = 10 + 180 - (p.ideal / maxY) * 180;
                          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(' ')}
                        fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 3"
                      />
                      {/* Actual line (solid blue) */}
                      <path
                        d={burndown.series
                          .map((p, i) => ({ p, i }))
                          .filter(({ p }) => p.actual !== null)
                          .map(({ p, i }, idx) => {
                            const maxY = Math.max(burndown.totalTasks, 1);
                            const x = 40 + (i / (burndown.series.length - 1)) * 580;
                            const y = 10 + 180 - ((p.actual as number) / maxY) * 180;
                            return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                          }).join(' ')}
                        fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"
                      />
                      {/* X-axis date labels */}
                      {burndown.series
                        .filter((_, i) => i % Math.max(1, Math.floor(burndown.series.length / 6)) === 0)
                        .map((p, idx) => {
                          const origIdx = burndown.series.indexOf(p);
                          const x = 40 + (origIdx / (burndown.series.length - 1)) * 580;
                          return (
                            <text key={idx} x={x} y={215} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                              {p.date.slice(5)}
                            </text>
                          );
                        })}
                    </svg>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Tasks List */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Filter toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[13px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  placeholder="Filter tasks..."
                  className="bg-transparent text-[#111111] placeholder-[#9CA3AF] outline-none w-44"
                />
              </div>

              <select
                value={taskStatusFilter}
                onChange={e => setTaskStatusFilter(e.target.value)}
                className="text-[12px] border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white text-[#111111] outline-none"
              >
                <option value="all">All statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Tasks table */}
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white shadow-2xs divide-y divide-[#F3F4F6]">
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-[rgba(17,17,17,0.4)]">
                  No tasks found in this project matching your filter.
                </div>
              ) : (
                filteredTasks.map(task => {
                  const statusCfg = statusColors[task.status as Status] || { bg: '#F3F4F6', text: '#6B7280', label: task.status };
                  const priorityCfg = priorityColors[task.priority as Priority] || { color: '#6B7280', label: task.priority };

                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className="flex items-center justify-between p-3.5 hover:bg-[#F9FAFB] cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {task.taskNumber && (
                          <span className="font-mono text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded shrink-0">
                            {task.taskNumber}
                          </span>
                        )}
                        <span className="text-[13.5px] font-medium text-[#111111] group-hover:text-[#2563EB] transition-colors truncate">
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-medium"
                          style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                        >
                          {statusCfg.label}
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: priorityCfg.color }}>
                          {priorityCfg.label}
                        </span>
                        {task.assignee && (
                          <span className="w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[9px] font-bold text-[#111111]">
                            {task.assignee.avatar}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl border border-[#E5E7EB] bg-white space-y-4">
              <h3 className="text-[16px] font-semibold text-[#111111]">Project Settings</h3>

              <div>
                <label className="text-[12px] font-medium text-[#374151] block mb-1">Project Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-[13px] px-3 py-2 border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB]"
                  required
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#374151] block mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full text-[13px] px-3 py-2 border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[12px] font-medium text-[#374151] block mb-1">Theme Color</label>
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="w-full h-9 p-1 border border-[#E5E7EB] rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#374151] block mb-1">Health Status</label>
                  <select
                    value={editHealth}
                    onChange={e => setEditHealth(e.target.value as ProjectHealth)}
                    className="w-full text-[13px] px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white outline-none"
                  >
                    <option value="on_track">On Track</option>
                    <option value="at_risk">At Risk</option>
                    <option value="delayed">Delayed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#374151] block mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full text-[13px] px-3 py-2 border border-[#E5E7EB] rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>

            {/* Lifecycle State Machine (Step 4.11) */}
            <div className="p-6 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFB] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[#111111]">Project Lifecycle</h3>
                <span className={`px-3 py-1 rounded-full text-[12px] font-semibold border ${
                  LIFECYCLE_STATE_CONFIG[lifecycleState]?.badgeClass || 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]'
                }`}>
                  {LIFECYCLE_STATE_CONFIG[lifecycleState]?.label || lifecycleState}
                </span>
              </div>
              <p className="text-[12.5px] text-[rgba(17,17,17,0.55)]">
                {LIFECYCLE_STATE_CONFIG[lifecycleState]?.description || 'Manage the project lifecycle state.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as ProjectLifecycleState[]).map(state => {
                  const cfg = LIFECYCLE_STATE_CONFIG[state];
                  const isCurrent = state === lifecycleState;
                  return (
                    <button
                      key={state}
                      disabled={isCurrent || isTransitioning}
                      onClick={() => handleLifecycleTransition(state)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                        isCurrent
                          ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#2563EB] cursor-default'
                          : 'border-[#E5E7EB] text-[rgba(17,17,17,0.6)] hover:bg-white hover:border-[#2563EB] hover:text-[#2563EB]'
                      }`}
                    >
                      {isCurrent && '✓ '}{cfg?.label || state}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2]/40 space-y-3">
              <h3 className="text-[15px] font-semibold text-[#DC2626]">Danger Zone</h3>
              <p className="text-[12.5px] text-[#7F1D1D]/80">
                Archiving moves this project to ARCHIVED state. All tasks remain intact and the project can be restored.
              </p>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="px-3.5 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[12.5px] font-semibold transition-colors"
              >
                Archive this project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
