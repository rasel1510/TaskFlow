'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { healthColors, statusColors, priorityColors, type ProjectHealth, type Status, type Priority } from '@/data/mockData';
import { useToast } from '@/components/ui/Toast';
import { LIFECYCLE_STATE_CONFIG, validateLifecycleTransition, type ProjectLifecycleState } from '@/lib/projectLifecycle';
import { ROLE_DESCRIPTIONS, type ProjectRole } from '@/lib/permissions';
import type { MilestoneRecord } from '@/api/projects/[id]/milestones/route';
import type { MemberRecord } from '@/api/projects/[id]/members/route';
import type { BurndownResult } from '@/api/projects/[id]/burndown/route';
import DatePicker from '@/components/ui/DatePicker';

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
  initialTab?: 'overview' | 'tasks' | 'milestones' | 'members' | 'burndown' | 'settings';
}

function getTwoLetterCapital(name?: string | null, fallbackAvatar?: string | null): string {
  if (fallbackAvatar && /^[A-Za-z]{2}$/.test(fallbackAvatar.trim())) {
    return fallbackAvatar.trim().toUpperCase();
  }

  if (!name || !name.trim()) return '??';

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return parts[0].slice(0, 2).toUpperCase();
}

function isMockImage(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('unsplash.com') ||
    lower.includes('placeholder') ||
    lower.includes('dummy') ||
    lower.includes('mock') ||
    lower.includes('avatar.vercel.sh') ||
    lower.includes('pravatar') ||
    lower.includes('dicebear') ||
    lower.includes('ui-avatars.com')
  );
}

function renderUserAvatar(
  avatar?: string | null,
  name?: string | null,
  sizeClasses = 'w-10 h-10',
  customBgText = 'bg-[#EFF6FF] text-[#2563EB] text-[13px] font-bold border border-[#DBEAFE]'
) {
  const twoLetters = getTwoLetterCapital(name, avatar);

  // If mock avatar/image or no image available, strictly display Two letter of name in Capital
  const hasRealImage = Boolean(
    avatar &&
      !isMockImage(avatar) &&
      (avatar.startsWith('http://') ||
        avatar.startsWith('https://') ||
        avatar.startsWith('/') ||
        avatar.startsWith('data:image/')) &&
      !/^[A-Za-z]{1,4}$/.test(avatar.trim())
  );

  if (hasRealImage) {
    return (
      <div className={`${sizeClasses} rounded-full overflow-hidden shrink-0 border border-[#DBEAFE] bg-[#EFF6FF] flex items-center justify-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar!}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent && !parent.querySelector('.avatar-fallback')) {
              const span = document.createElement('span');
              span.className = 'avatar-fallback font-bold text-[#2563EB] text-[12px]';
              span.textContent = twoLetters;
              parent.appendChild(span);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full ${customBgText} flex items-center justify-center shrink-0`}>
      {twoLetters}
    </div>
  );
}

export default function ProjectDetail({
  projectId,
  onBack,
  onTaskClick,
  onCreateTask,
  initialTab = 'overview',
}: ProjectDetailProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'milestones' | 'members' | 'burndown' | 'settings'>(initialTab);
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

  // Session & Project Manager authorization
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const currentUserRole = (session?.user as { role?: string })?.role;
  const isPM = currentUserRole === 'Project Manager' || currentUserRole?.toLowerCase() === 'project manager';
  const isPMOrOwner = project?.owner?.id === currentUserId || isPM || currentUserRole === 'Admin';

  // Join Requests state
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [requestApprovalRoles, setRequestApprovalRoles] = useState<Record<string, ProjectRole>>({});

  // Add Member Modal state with Expertise Matrix needed
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableUsersLoading, setAvailableUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [selectedUserRoles, setSelectedUserRoles] = useState<Record<string, ProjectRole>>({});
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // Delete Project modal state (PM only)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Remove Contributor modal state
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
    email?: string;
    role?: string;
    avatar?: string;
  } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

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

  // Dismiss modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (memberToRemove && !isRemovingMember) {
          setMemberToRemove(null);
        } else if (showDeleteModal && !isDeletingProject) {
          setShowDeleteModal(false);
        } else if (showAddMemberModal) {
          setShowAddMemberModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [memberToRemove, isRemovingMember, showDeleteModal, isDeletingProject, showAddMemberModal]);

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

  const fetchJoinRequests = useCallback(async () => {
    setJoinRequestsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/requests`);
      const json = await res.json();
      if (json.success) setJoinRequests(json.data || []);
    } catch (e) { console.warn('[ProjectDetail] Requests fetch error:', e); }
    finally { setJoinRequestsLoading(false); }
  }, [projectId]);

  const fetchAvailableUsers = async () => {
    setAvailableUsersLoading(true);
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      const usersList = Array.isArray(json) ? json : (json?.data || []);
      setAvailableUsers(usersList);
    } catch (e) { console.warn('Failed to load users', e); }
    finally { setAvailableUsersLoading(false); }
  };

  const handleReviewRequest = async (requestId: string, action: 'approve' | 'reject', role?: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          role: role || requestApprovalRoles[requestId] || 'CONTRIBUTOR',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || 'Failed to review request');
      }
      toast.success(action === 'approve' ? 'Request approved and member added to project!' : 'Request rejected');
      fetchMembers();
      fetchJoinRequests();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  };

  const handleAddMember = async (userId: string, role: ProjectRole) => {
    setAddingUserId(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || 'Failed to add member');
      }
      toast.success('Member added to project successfully!');
      fetchMembers();
      fetchJoinRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveMember = (m: MemberRecord) => {
    setMemberToRemove({
      id: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      avatar: m.avatar,
    });
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemovingMember(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members?uid=${memberToRemove.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || 'Failed to remove member');
      }
      toast.success(`${memberToRemove.name} removed from project`);
      setMemberToRemove(null);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleUpdateMemberRole = async (userId: string, role: ProjectRole) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || 'Failed to update member role');
      }
      toast.success('Member role updated');
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member role');
    }
  };

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
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'members') {
      const timer = setTimeout(() => {
        const el = document.getElementById('pending-requests');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'milestones') fetchMilestones();
    if (activeTab === 'members') {
      fetchMembers();
      fetchJoinRequests();
    }
    if (activeTab === 'burndown') fetchBurndown();
  }, [activeTab, fetchMilestones, fetchMembers, fetchJoinRequests, fetchBurndown]);

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

  const handleConfirmDeleteProject = async () => {
    if (!project) return;
    setIsDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Project "${project.name}" deleted successfully`);
        setShowDeleteModal(false);
        onBack();
      } else {
        throw new Error(json.error?.message || json.message || 'Failed to delete project');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project';
      toast.error(msg);
    } finally {
      setIsDeletingProject(false);
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
        setProject(prev => (prev ? { ...prev, lifecycleState: targetState } : null));
        toast.success(`Project moved to ${LIFECYCLE_STATE_CONFIG[targetState]?.label || targetState}`);
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                  : 'border-[#E5E7EB] hover:bg-[#F9FAFB] text-[rgba(17,17,17,0.7)]'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
            {isPM && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FECACA] hover:bg-[#FEF2F2] text-[13px] font-medium text-[#DC2626] transition-colors cursor-pointer"
                title="Delete Project"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Tabs switcher */}
        <div className="flex items-center gap-4 sm:gap-5 mt-5 sm:mt-6 border-b border-[#F3F4F6] text-[13px] overflow-x-auto no-scrollbar">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'tasks', label: `Tasks (${project.totalTasks})` },
            { key: 'milestones', label: 'Roadmap' },
            { key: 'members', label: 'Team' },
            { key: 'burndown', label: 'Burndown' },
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
            <form onSubmit={handleAddMilestone} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input type="text" placeholder="New milestone title..." value={newMilestoneTitle}
                onChange={e => setNewMilestoneTitle(e.target.value)}
                className="flex-1 text-[13px] px-3 py-2 border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB]" />
              <div className="w-full sm:w-44 shrink-0">
                <DatePicker
                  value={newMilestoneDate}
                  onChange={setNewMilestoneDate}
                  placeholder="Target date"
                />
              </div>
              <button type="submit" disabled={addingMilestone || !newMilestoneTitle.trim()}
                className="px-4 py-2 bg-[#2563EB] text-white text-[12.5px] font-medium rounded-lg disabled:opacity-50 shrink-0">
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

        {/* Tab 4: Team with Expertise Matrix & Join Requests */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Pending Join Requests (Visible to Project Manager / Owner / Admin) */}
            {(isPMOrOwner || joinRequests.some(r => r.status === 'pending')) && (
              <div id="pending-requests" className="space-y-3 scroll-mt-6 p-4 rounded-2xl bg-gradient-to-r from-[#FFFDF5] to-[#FEFDF0] border border-[#FDE68A] shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[14px] font-bold text-[#111111]">Pending Project Requests</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      joinRequests.filter(r => r.status === 'pending').length > 0
                        ? 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]'
                        : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}>
                      {joinRequests.filter(r => r.status === 'pending').length}
                    </span>
                  </div>
                </div>

                {joinRequestsLoading ? (
                  <div className="p-4 text-center text-[12px] text-gray-400">Checking pending requests...</div>
                ) : joinRequests.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] text-center text-[12.5px] text-[rgba(17,17,17,0.45)]">
                    No pending join requests for this project.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {joinRequests.filter(r => r.status === 'pending').map(req => {
                      const applicant = req.user || {};
                      const expertiseList: string[] = applicant.expertise || [];
                      const selectedRole = requestApprovalRoles[req.id] || 'CONTRIBUTOR';

                      return (
                        <div key={req.id} className="p-4 rounded-xl border border-[#FDE68A] bg-[#FFFDF5] shadow-2xs space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {renderUserAvatar(applicant.avatar, applicant.name, 'w-9 h-9', 'bg-[#2563EB] text-white font-bold text-[12px]')}
                              <div className="min-w-0">
                                <div className="text-[13.5px] font-semibold text-[#111111] truncate">{applicant.name}</div>
                                <div className="text-[11.5px] text-[rgba(17,17,17,0.5)] truncate">{applicant.email}</div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-[#FEF3C7] text-[#B45309] shrink-0">
                              {applicant.role || 'Member'}
                            </span>
                          </div>

                          {/* Expertise Matrix */}
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.45)] mb-1">
                              Expertise Matrix:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {expertiseList.length > 0 ? (
                                expertiseList.map((skill, si) => (
                                  <span key={si} className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                                    {skill}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-[rgba(17,17,17,0.4)] italic">No specific skills specified</span>
                              )}
                            </div>
                          </div>

                          {/* Note */}
                          {req.message && (
                            <div className="p-2 rounded-lg bg-white border border-[#E5E7EB] text-[12px] text-[rgba(17,17,17,0.7)] italic">
                              &ldquo;{req.message}&rdquo;
                            </div>
                          )}

                          {/* Role Selector & Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#FEEFC3]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium text-gray-500">Role:</span>
                              <select
                                value={selectedRole}
                                onChange={e => setRequestApprovalRoles(prev => ({ ...prev, [req.id]: e.target.value as ProjectRole }))}
                                className="text-[11.5px] border border-[#E5E7EB] rounded-md px-2 py-1 bg-white outline-none font-medium text-gray-700"
                              >
                                <option value="CONTRIBUTOR">Contributor</option>
                                <option value="LEAD">Project Lead</option>
                                <option value="VIEWER">Viewer</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleReviewRequest(req.id, 'reject')}
                                className="px-2.5 py-1 text-[11.5px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] rounded-md border border-[#FECACA] transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewRequest(req.id, 'approve', selectedRole)}
                                className="px-3 py-1 text-[11.5px] font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-md shadow-2xs transition-colors cursor-pointer"
                              >
                                Approve &amp; Add
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Current Project Members List */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-[14px] font-bold text-[#111111]">
                    Active Team Members ({members.length})
                  </h4>
                  <p className="text-[11.5px] text-[rgba(17,17,17,0.45)] mt-0.5">
                    Only assigned members can create tasks in this project
                  </p>
                </div>

                {isPMOrOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      fetchAvailableUsers();
                      setShowAddMemberModal(true);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-[13px] font-semibold transition-colors shadow-2xs cursor-pointer shrink-0"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Member
                  </button>
                )}
              </div>

              {membersLoading ? (
                <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">Loading team members...</div>
              ) : members.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">No members assigned to this project.</div>
              ) : (
                <div className="space-y-2">
                  {members.map(m => {
                    const roleConfig = ROLE_DESCRIPTIONS[(m.role as ProjectRole)] || ROLE_DESCRIPTIONS['VIEWER'];
                    const memberExpertise: string[] = (m as any).expertise || [];

                    return (
                      <div key={m.userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#CBD5E1] transition-all">
                        <div className="flex items-start gap-3 min-w-0">
                          {renderUserAvatar(m.avatar, m.name, 'w-10 h-10')}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13.5px] font-semibold text-[#111111]">{m.name}</span>
                              <span className="text-[11px] text-[rgba(17,17,17,0.4)] font-medium">({m.userRole || 'Member'})</span>
                            </div>
                            <div className="text-[12px] text-[rgba(17,17,17,0.45)]">{m.email}</div>

                            {/* Expertise tags */}
                            {memberExpertise.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {memberExpertise.map((skill, si) => (
                                  <span key={si} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F3F4F6] text-[#374151]">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Role & Permissions controls */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          {isPMOrOwner && m.role !== 'OWNER' ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={m.role}
                                onChange={e => handleUpdateMemberRole(m.userId, e.target.value as ProjectRole)}
                                className="text-[12px] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white font-medium text-gray-700 outline-none"
                              >
                                <option value="CONTRIBUTOR">Contributor</option>
                                <option value="LEAD">Project Lead</option>
                                <option value="VIEWER">Viewer</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m)}
                                title="Remove from project"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="text-right">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${roleConfig.badgeColor}`}>
                                {roleConfig.label}
                              </span>
                              <div className="text-[10.5px] text-[rgba(17,17,17,0.35)] mt-0.5">
                                Joined {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap shrink-0"
                          style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                        >
                          {statusCfg.label}
                        </span>
                        <span className="text-[11px] font-medium whitespace-nowrap shrink-0" style={{ color: priorityCfg.color }}>
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
                <div className="relative z-20">
                  <label className="text-[12px] font-medium text-[#374151] block mb-1">Target Due Date</label>
                  <DatePicker
                    value={editDueDate}
                    onChange={setEditDueDate}
                    placeholder="Select target due date"
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
                      type="button"
                      key={state}
                      disabled={isCurrent || isTransitioning}
                      onClick={() => handleLifecycleTransition(state)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                        isCurrent
                          ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#2563EB] cursor-default'
                          : 'border-[#E5E7EB] text-[rgba(17,17,17,0.6)] hover:bg-white hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer'
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
                Permanently delete this project. All associated tasks, milestones, team assignments, and data will be permanently removed.
              </p>
              {isPM ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
                >
                  Delete this project
                </button>
              ) : (
                <p className="text-[12px] text-gray-500 italic">
                  Only Project Managers can permanently delete projects.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowAddMemberModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] shrink-0">
              <div>
                <h3 className="text-[17px] font-bold text-[#111111]">
                  Add member by expertise matrix
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F4F6] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Expertise Matrix Filter & Requirements Toolbar */}
            <div className="p-4 border-b border-[#F3F4F6] bg-[#FAFAFB] shrink-0 space-y-3">
              <div>
                {requiredSkills.length > 0 && (
                  <div className="flex items-center justify-end mb-1.5">
                    <button
                      type="button"
                      onClick={() => setRequiredSkills([])}
                      className="text-[11px] font-medium text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Clear skills ({requiredSkills.length})
                    </button>
                  </div>
                )}

                {/* Expertise Matrix Selector Chips */}
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {[
                    'UI Design',
                    'Frontend',
                    'Backend',
                    'ML',
                    'AI',
                    'Distributed Learning',
                    'DevOps',
                    'QA Engineering',
                    'Cloud Architecture',
                    'Full Stack Engineering',
                    'Cybersecurity',
                    'Mobile Development',
                  ].map(skill => {
                    const isSelected = requiredSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          setRequiredSkills(prev =>
                            prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-[#2563EB] text-white border border-[#2563EB] shadow-xs'
                            : 'bg-white text-gray-700 border border-[#E5E7EB] hover:border-[#2563EB] hover:text-[#2563EB]'
                        }`}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Search input */}
              <div className="relative">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={e => setUserSearchTerm(e.target.value)}
                  placeholder="Search candidates by name, email, or other custom skills..."
                  className="w-full pl-9 pr-4 py-2 text-[12.5px] border border-[#E5E7EB] rounded-lg bg-white outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                />
              </div>

              {requiredSkills.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11.5px] text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded-md border border-[#BFDBFE]">
                  <span className="font-semibold">Matching needed skills:</span>
                  <span>{requiredSkills.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Candidates List with Real-time Expertise Match */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {availableUsersLoading ? (
                <div className="py-12 text-center text-[13px] text-gray-400">Loading organization users...</div>
              ) : (
                (() => {
                  const currentMemberIds = new Set(members.map(m => m.userId));
                  const candidates = availableUsers
                    .filter(u => !currentMemberIds.has(u.id))
                    .map(user => {
                      const userSkills: string[] = Array.isArray(user.expertise) ? user.expertise : [];
                      const matchedSkills = userSkills.filter(skill =>
                        requiredSkills.some(
                          req =>
                            req.toLowerCase() === skill.toLowerCase() ||
                            skill.toLowerCase().includes(req.toLowerCase()) ||
                            req.toLowerCase().includes(skill.toLowerCase())
                        )
                      );
                      const matchCount = matchedSkills.length;
                      const matchPct = requiredSkills.length > 0 ? Math.round((matchCount / requiredSkills.length) * 100) : 0;
                      return { user, userSkills, matchedSkills, matchCount, matchPct };
                    })
                    .filter(({ user, userSkills }) => {
                      if (!userSearchTerm.trim()) return true;
                      const term = userSearchTerm.toLowerCase();
                      const matchName = user.name?.toLowerCase().includes(term);
                      const matchEmail = user.email?.toLowerCase().includes(term);
                      const matchRole = user.role?.toLowerCase().includes(term);
                      const matchExpertise = userSkills.some((s: string) => s.toLowerCase().includes(term));
                      return matchName || matchEmail || matchRole || matchExpertise;
                    })
                    .sort((a, b) => {
                      // Rank candidates with more matched required skills first
                      if (requiredSkills.length > 0) {
                        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
                      }
                      return (a.user.name || '').localeCompare(b.user.name || '');
                    });

                  if (candidates.length === 0) {
                    return (
                      <div className="py-12 text-center text-[13px] text-gray-400">
                        {userSearchTerm || requiredSkills.length > 0
                          ? 'No available candidates matching the selected skills or search query.'
                          : 'All registered organization users are already members of this project.'}
                      </div>
                    );
                  }

                  return candidates.map(({ user, userSkills, matchedSkills, matchCount, matchPct }) => {
                    const candidateRole = selectedUserRoles[user.id] || 'CONTRIBUTOR';
                    const isAdding = addingUserId === user.id;

                    return (
                      <div
                        key={user.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                          matchCount > 0 && requiredSkills.length > 0
                            ? 'border-[#BFDBFE] bg-[#F8FAFF]'
                            : 'border-[#E5E7EB] bg-white hover:border-[#CBD5E1]'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {renderUserAvatar(user.avatar, user.name, 'w-10 h-10')}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13.5px] font-semibold text-[#111111]">{user.name}</span>
                              <span className="text-[11px] text-gray-500 font-medium">({user.role || 'Member'})</span>

                              {/* Match indicator badge */}
                              {requiredSkills.length > 0 && (
                                matchCount === requiredSkills.length ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                    100% Match ({matchCount}/{requiredSkills.length} skills)
                                  </span>
                                ) : matchCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                                    ✓ {matchPct}% Match ({matchCount}/{requiredSkills.length} skills)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#F3F4F6] text-[#6B7280]">
                                    0/{requiredSkills.length} skills matched
                                  </span>
                                )
                              )}
                            </div>
                            <div className="text-[12px] text-gray-400">{user.email}</div>

                            {/* Expertise tags */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {userSkills.length > 0 ? (
                                userSkills.map((skill, si) => {
                                  const isMatched = matchedSkills.includes(skill);
                                  return (
                                    <span
                                      key={si}
                                      className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors ${
                                        isMatched
                                          ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                                          : 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]'
                                      }`}
                                    >
                                      {isMatched && '✓ '}{skill}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[11px] text-gray-400 italic">No expertise tags</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Add controls */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <select
                            value={candidateRole}
                            onChange={e =>
                              setSelectedUserRoles(prev => ({
                                ...prev,
                                [user.id]: e.target.value as ProjectRole,
                              }))
                            }
                            className="text-[12px] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white font-medium text-gray-700 outline-none"
                          >
                            <option value="CONTRIBUTOR">Contributor</option>
                            <option value="LEAD">Project Lead</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <button
                            type="button"
                            disabled={isAdding}
                            onClick={() => handleAddMember(user.id, candidateRole)}
                            className="px-3.5 py-1.5 text-[12.5px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg shadow-2xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            {isAdding ? 'Adding...' : 'Add to Project'}
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal (Project Managers only) */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeletingProject && setShowDeleteModal(false)}
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
                  Are you sure you want to permanently delete <strong className="text-[#111111]">{project?.name}</strong>?
                </p>
              </div>
            </div>

            <p className="text-[12px] text-[#DC2626] bg-[#FEF2F2] p-3 rounded-lg border border-[#FEE2E2] mb-5">
              Warning: This action will permanently remove this project and all associated tasks, team memberships, and milestones. This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-2 text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={handleConfirmDeleteProject}
                className="px-4 py-2 text-[13px] font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingProject ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member / Contributor Confirmation Modal */}
      {memberToRemove && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isRemovingMember && setMemberToRemove(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-150 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              disabled={isRemovingMember}
              onClick={() => setMemberToRemove(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-[#F3F4F6] transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="18" y1="8" x2="23" y2="13" />
                  <line x1="23" y1="8" x2="18" y2="13" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-[16px] font-bold text-[#111111]">Remove Contributor</h3>
                <p className="text-[12.5px] text-[rgba(17,17,17,0.6)] mt-1 leading-relaxed">
                  Are you sure you want to remove <strong className="text-[#111111] font-semibold">{memberToRemove.name}</strong> from this project?
                </p>
              </div>
            </div>

            {/* Member Card */}
            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] mb-6 flex items-center gap-3">
              {renderUserAvatar(memberToRemove.avatar, memberToRemove.name, 'w-10 h-10')}
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-[#111111] truncate">{memberToRemove.name}</div>
                {memberToRemove.email && (
                  <div className="text-[12px] text-[rgba(17,17,17,0.5)] truncate">{memberToRemove.email}</div>
                )}
              </div>
              {memberToRemove.role && (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-gray-700 shrink-0">
                  {ROLE_DESCRIPTIONS[memberToRemove.role as ProjectRole]?.label || memberToRemove.role}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={() => setMemberToRemove(null)}
                className="px-3.5 py-2 text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={handleConfirmRemoveMember}
                className="px-4 py-2 text-[13px] font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isRemovingMember ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Removing...</span>
                  </>
                ) : (
                  'Remove Contributor'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
