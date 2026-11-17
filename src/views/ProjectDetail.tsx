'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { statusColors, priorityColors, type ProjectHealth, type Status, type Priority } from '@/data/mockData';
import { useToast } from '@/components/ui/Toast';
import { LIFECYCLE_STATE_CONFIG, validateLifecycleTransition, type ProjectLifecycleState } from '@/lib/projectLifecycle';
import { ROLE_DESCRIPTIONS, type ProjectRole, normalizeDesignation } from '@/lib/permissions';
import type { MemberRecord } from '@/api/projects/[id]/members/route';
import type { ProjectInvitationRecord } from '@/api/projects/[id]/invitations/route';
import type { ProjectMessage } from '@/api/projects/[id]/messages/route';
import DatePicker from '@/components/ui/DatePicker';
import AddProjectMembersModal from '@/components/AddProjectMembersModal';
import { RadialTaskMenu } from '@/components/RadialTaskMenu';
import { Calendar, Plus, UserPlus, Users, X } from 'lucide-react';

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
    comments: number;
  };
}

interface TaskDateGroup {
  dateKey: string;
  label: string;
  rawDate: string | null;
  isToday: boolean;
  tasks: ProjectTask[];
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
  initialTab?: 'overview' | 'tasks' | 'about' | 'milestones' | 'members' | 'messages' | 'settings';
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

function formatTaskDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function normalizeDateKey(dueDate?: string | null): string {
  if (!dueDate) return 'no-date';
  const m = String(dueDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  try {
    const d = new Date(dueDate);
    if (isNaN(d.getTime())) return 'no-date';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return 'no-date';
  }
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

// Module-level in-memory cache for instantaneous 0ms perceived project detail switching
const cachedProjectDetails = new Map<string, ProjectData>();

function ProjectDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white animate-pulse">
      {/* Top Banner Navigation Skeleton */}
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
          <div>
            <div className="h-6 sm:h-7 w-48 bg-gray-200 rounded-md" />
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-24 bg-gray-100 rounded-lg" />
            <div className="h-8 w-24 bg-gray-200 rounded-lg" />
            <div className="h-8 w-20 bg-gray-100 rounded-lg" />
          </div>
        </div>

        {/* Tabs switcher skeleton */}
        <div className="flex items-center gap-4 sm:gap-5 mt-5 sm:mt-6 border-b border-[#F3F4F6]">
          {['Overview', 'Tasks', 'About', 'Team', 'Messages'].map((tab, idx) => (
            <div key={idx} className="pb-2.5">
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Content Area Skeleton */}
      <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-[1280px]">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs space-y-2">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-7 w-12 bg-gray-200 rounded" />
              <div className="h-2.5 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>

        {/* Tasks / Overview Body Skeleton */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs p-5 space-y-4">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-gray-50 rounded-xl border border-gray-100" />
            ))}
          </div>
        </div>
      </div>
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
  const [project, setProject] = useState<ProjectData | null>(() => cachedProjectDetails.get(projectId) || null);
  const [loading, setLoading] = useState(() => !cachedProjectDetails.has(projectId));
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'about' | 'members' | 'messages' | 'settings'>(
    initialTab === 'milestones' ? 'about' : (initialTab as any) || 'overview'
  );
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => {
      if (activeRowMenuId) {
        setActiveRowMenuId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeRowMenuId]);

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${taskToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Task deleted successfully');
        setProject(prev =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.filter(t => t.id !== taskToDelete.id),
                totalTasks: Math.max(0, prev.totalTasks - 1),
              }
            : null
        );
        setTaskToDelete(null);
      } else {
        toast.error('Failed to delete task');
      }
    } catch {
      toast.error('Failed to delete task');
    } finally {
      setIsDeletingTask(false);
    }
  };

  const [addingTaskDate, setAddingTaskDate] = useState<string | null>(null);
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  const [isCreatingInlineTask, setIsCreatingInlineTask] = useState(false);

  const handleCreateInlineTask = async (rawDate: string | null) => {
    if (!inlineTaskTitle.trim() || isCreatingInlineTask || !project) return;
    setIsCreatingInlineTask(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: inlineTaskTitle.trim(),
          projectId: project.id,
          status: 'todo',
          priority: 'medium',
          dueDate: rawDate || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        toast.success('Task created successfully');
        const newTask: ProjectTask = json.data;
        setProject(prev =>
          prev
            ? {
                ...prev,
                tasks: [newTask, ...prev.tasks],
                totalTasks: prev.totalTasks + 1,
              }
            : null
        );
        setInlineTaskTitle('');
      } else {
        toast.error(json.error?.message || 'Failed to create task');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      toast.error('Failed to create task');
    } finally {
      setIsCreatingInlineTask(false);
    }
  };

  // Messages state (Team Chat)
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ dataUrl: string; name: string; size: number } | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Members state
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Session & Project Manager authorization
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const currentUserRole = (session?.user as { role?: string })?.role;
  const isAdmin =
    currentUserRole === 'Admin' ||
    currentUserRole === 'ADMIN' ||
    currentUserRole?.toLowerCase() === 'admin';
  const isPM =
    isAdmin ||
    currentUserRole === 'Project Manager' ||
    currentUserRole === 'PROJECT_MANAGER' ||
    currentUserRole?.toLowerCase() === 'project manager';
  const isPMOrOwner = project?.owner?.id === currentUserId || isPM;

  // Join Requests state
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [requestApprovalRoles, setRequestApprovalRoles] = useState<Record<string, ProjectRole>>({});

  // Add / Invite Member Modal state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEmailInviteModal, setShowEmailInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('Member');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [invitations, setInvitations] = useState<ProjectInvitationRecord[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [copiedInviteToken, setCopiedInviteToken] = useState<string | null>(null);

  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableUsersLoading, setAvailableUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [selectedUserRoles, setSelectedUserRoles] = useState<Record<string, ProjectRole>>({});
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // Delete Project modal state (PM only)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Remove Member modal state
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
    email?: string;
    role?: string;
    avatar?: string;
  } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

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
        if (lightboxImage) {
          setLightboxImage(null);
        } else if (memberToRemove && !isRemovingMember) {
          setMemberToRemove(null);
        } else if (showDeleteModal && !isDeletingProject) {
          setShowDeleteModal(false);
        } else if (showAddMemberModal) {
          setShowAddMemberModal(false);
        } else if (showEmailInviteModal) {
          setShowEmailInviteModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, memberToRemove, isRemovingMember, showDeleteModal, isDeletingProject, showAddMemberModal, showEmailInviteModal]);

  const fetchProject = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!cachedProjectDetails.has(projectId)) {
        setLoading(true);
      }
      const res = await fetch(`/api/projects/${projectId}`, { signal });
      const json = await res.json();
      if (json.success && json.data) {
        cachedProjectDetails.set(projectId, json.data);
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

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setInvitations(json.data);
      }
    } catch (e) {
      console.warn('[ProjectDetail] Invitations fetch error:', e);
    } finally {
      setInvitationsLoading(false);
    }
  }, [projectId]);


  const fetchAvailableUsers = async () => {
    setAvailableUsersLoading(true);
    try {
      const res = await fetch(`/api/users?projectId=${encodeURIComponent(projectId)}`);
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
          role: role || requestApprovalRoles[requestId] || 'Member',
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

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSendingInvite(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || 'Failed to send invitation');
      }
      toast.success(`Invitation email sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      fetchInvitations();
      setShowEmailInviteModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvitation = async (inviteId: string) => {
    // Instant optimistic dismissal
    setInvitations(prev => prev.filter(i => i.id !== inviteId));
    toast.success('Invitation revoked successfully');
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations?inviteId=${inviteId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || 'Failed to revoke invitation');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation');
      fetchInvitations();
    }
  };

  const handleResendInvitation = async (inv: ProjectInvitationRecord) => {
    setResendingInviteId(inv.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inv.email, role: inv.role }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || 'Failed to resend invitation');
      }
      toast.success(`Invitation resent to ${inv.email}`);
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleCopyProjectInvite = (token?: string) => {
    if (!token) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/invite/accept?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedInviteToken(token);
    toast.success('Invitation link copied to clipboard!');
    setTimeout(() => setCopiedInviteToken(null), 2500);
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
    const target = memberToRemove;
    const snapshot = members;

    // Instant optimistic removal from UI
    setMemberToRemove(null);
    setMembers(prev => prev.filter(m => m.userId !== target.id));
    toast.success(`${target.name} removed from project`);

    try {
      const res = await fetch(`/api/projects/${projectId}/members?uid=${target.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || 'Failed to remove member');
      }
    } catch (err: any) {
      // Rollback
      setMembers(snapshot);
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const handleUpdateMemberRole = async (userId: string, role: ProjectRole) => {
    const snapshot = members;

    // Instant optimistic update in memory
    setMembers(prev =>
      prev.map(m =>
        m.userId === userId
          ? { ...m, role, roleConfig: ROLE_DESCRIPTIONS[role] }
          : m
      )
    );
    toast.success('Member role updated');

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
    } catch (err: any) {
      // Rollback
      setMembers(snapshot);
      toast.error(err.message || 'Failed to update member role');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchProject(controller.signal);
    return () => controller.abort();
  }, [fetchProject]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab === 'milestones' ? 'about' : initialTab);
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
    if (activeTab === 'members') {
      fetchMembers();
      fetchJoinRequests();
      fetchInvitations();
    }
    if (activeTab === 'messages') {
      fetchMessages();
      fetchMembers();
    }
  }, [activeTab, fetchMembers, fetchJoinRequests, fetchInvitations]);

  const fetchMessages = useCallback(async (signal?: AbortSignal) => {
    try {
      setMessagesLoading(true);
      const res = await fetch(`/api/projects/${projectId}/messages`, { signal });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMessages(json.data);
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      console.warn('[ProjectDetail] Messages fetch error:', e);
    } finally {
      setMessagesLoading(false);
    }
  }, [projectId]);

  // Real-time Server-Sent Events (SSE) stream for instant live delivery
  useEffect(() => {
    if (activeTab !== 'messages') return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/projects/${projectId}/messages/stream`);

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'message:created' && payload.data) {
            const newMsg: ProjectMessage = payload.data;
            setMessages(prev => {
              // Avoid duplicate if already added by sender's optimistic update
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } else if (payload.type === 'message:updated' && payload.data) {
            const updatedMsg: ProjectMessage = payload.data;
            setMessages(prev => prev.map(m => (m.id === updatedMsg.id ? updatedMsg : m)));
          } else if (payload.type === 'message:deleted' && payload.data?.id) {
            const deletedId = payload.data.id;
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
        } catch {
          // Non-JSON stream chunk or ping
        }
      };

      es.onerror = () => {
        // Handled silently
      };
    } catch (err) {
      console.warn('[SSE] EventSource init failed:', err);
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [activeTab, projectId]);

  // Scroll to bottom when messages change or tab opens
  useEffect(() => {
    if (activeTab === 'messages' && !messagesLoading) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, messagesLoading, messages.length]);

  const handleImageFileSelected = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP, GIF)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setAttachedImage({
          dataUrl,
          name: file.name,
          size: file.size,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChatPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleImageFileSelected(file);
            return;
          }
        }
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() && !attachedImage) return;

    try {
      setSendingMessage(true);
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageText.trim(),
          imageUrl: attachedImage?.dataUrl || null,
          imageName: attachedImage?.name || null,
          imageSize: attachedImage?.size || null,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setMessages(prev => [...prev, json.data]);
        setMessageText('');
        setAttachedImage(null);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      } else {
        toast.error(json.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('[ProjectDetail] Send message error:', err);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    const uid = currentUserId || '';
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        const userList = reactions[emoji] || [];
        if (userList.includes(uid)) {
          reactions[emoji] = userList.filter(id => id !== uid);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...userList, uid];
        }
        return { ...m, reactions };
      })
    );

    try {
      await fetch(`/api/projects/${projectId}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji }),
      });
    } catch (err) {
      console.error('[ProjectDetail] Reaction error:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    try {
      await fetch(`/api/projects/${projectId}/messages?messageId=${messageId}`, {
        method: 'DELETE',
      });
      toast.success('Message deleted');
    } catch (err) {
      console.error('[ProjectDetail] Delete message error:', err);
      toast.error('Failed to delete message');
    }
  };

  const filteredMessages = messages.filter(m => {
    if (!chatSearch.trim()) return true;
    const q = chatSearch.toLowerCase();
    return (
      m.content?.toLowerCase().includes(q) ||
      m.userName.toLowerCase().includes(q) ||
      m.imageName?.toLowerCase().includes(q)
    );
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const snapshot = project;

    // Instant optimistic UI update (0ms perceived latency)
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
    toast.success('Project settings updated');

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
      if (!json.success) {
        // Rollback
        setProject(snapshot);
        toast.error(json.error?.message || 'Failed to update project');
      }
    } catch (err) {
      console.error('[ProjectDetail] Update error:', err);
      setProject(snapshot);
      toast.error('Failed to update project');
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!project) return;
    const targetName = project.name;
    const targetId = project.id;

    // Instant optimistic dismissal
    setShowDeleteModal(false);
    toast.success(`Project "${targetName}" deleted successfully`);
    onBack();

    try {
      const res = await fetch(`/api/projects/${targetId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to delete project');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project';
      toast.error(msg);
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

  const filteredTasks = (project?.tasks || []).filter(task => {
    if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false;
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchNumber = task.taskNumber && task.taskNumber.toLowerCase().includes(q);
      if (!matchTitle && !matchNumber) return false;
    }
    return true;
  });

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const formattedCurrentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const taskDateGroups = useMemo<TaskDateGroup[]>(() => {
    const groupMap = new Map<string, ProjectTask[]>();

    for (const task of filteredTasks) {
      const key = normalizeDateKey(task.dueDate);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(task);
    }

    // Always ensure Today's date section is present when not actively searching
    if (!taskSearch.trim() && !groupMap.has(todayKey)) {
      groupMap.set(todayKey, []);
    }

    // Sort keys descending (today/future dates first, then past dates, with 'no-date' last)
    const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => {
      if (a === 'no-date') return 1;
      if (b === 'no-date') return -1;
      return b.localeCompare(a);
    });

    return sortedKeys.map(key => {
      const isToday = key === todayKey;
      const tasks = groupMap.get(key) || [];
      let label = 'No Due Date';
      let rawDate: string | null = null;

      if (key !== 'no-date') {
        rawDate = key;
        const [y, m, d] = key.split('-').map(Number);
        const parsed = new Date(y, m - 1, d);
        const formatted = !isNaN(parsed.getTime())
          ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : key;
        label = isToday ? `Today • ${formatted}` : formatted;
      }

      return {
        dateKey: key,
        label,
        rawDate,
        isToday,
        tasks,
      };
    });
  }, [filteredTasks, todayKey, taskSearch]);

  if (loading && !project) {
    return <ProjectDetailSkeleton onBack={onBack} />;
  }

  if (!project) return null;

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
          <div>
            <h1 className="text-[19px] sm:text-[22px] font-bold text-[#111111] tracking-tight">
              {project.name}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isPMOrOwner && (
              <button
                type="button"
                onClick={() => setShowAddMemberModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-gray-300 text-[13px] font-medium text-[#111111] transition-colors cursor-pointer"
                title="Add existing team members directly to project"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Add Members</span>
              </button>
            )}
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors ${activeTab === 'settings'
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
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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
            { key: 'about', label: 'About' },
            { key: 'members', label: 'Team' },
            { key: 'messages', label: `Messages${messages.length > 0 ? ` (${messages.length})` : ''}` },
          ] as { key: typeof activeTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-2.5 font-medium border-b-2 whitespace-nowrap transition-colors shrink-0 ${activeTab === key
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
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
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

            {/* Recent Tasks */}
            <div className="p-5 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#111111]">Recent Tasks</h3>
                  <p className="text-[12px] text-[rgba(17,17,17,0.5)]">Latest task activity and progress in this project</p>
                </div>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-[12px] font-medium text-[#2563EB] hover:underline cursor-pointer"
                >
                  View all ({project.totalTasks})
                </button>
              </div>

              {project.tasks.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[rgba(17,17,17,0.45)]">
                  No tasks created yet in this project.
                </div>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {project.tasks.slice(0, 6).map(task => {
                    const statusCfg = statusColors[task.status as Status] || { bg: '#F3F4F6', text: '#6B7280', label: task.status };
                    return (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
                        className="flex items-center justify-between py-2.5 px-2 hover:bg-[#F9FAFB] rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
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
              )}
            </div>
          </div>
        )}

        {/* Tab 3: About */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            {/* Description & Project Lead */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 p-5 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
                <h3 className="text-[15px] font-semibold text-[#111111]">About this project</h3>
                <p className="text-[13.5px] text-[rgba(17,17,17,0.7)] leading-relaxed whitespace-pre-wrap">
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

              {/* Project Lead card */}
              <div className="p-5 rounded-2xl border border-[#E5E7EB] bg-white">
                <h3 className="text-[15px] font-semibold text-[#111111] mb-3">Project Lead</h3>
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
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${joinRequests.filter(r => r.status === 'pending').length > 0
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
                      const selectedRole = requestApprovalRoles[req.id] || 'Member';

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
                              {isAdmin ? (
                                <select
                                  value={selectedRole}
                                  onChange={e => setRequestApprovalRoles(prev => ({ ...prev, [req.id]: e.target.value as ProjectRole }))}
                                  className="text-[11.5px] border border-[#E5E7EB] rounded-md px-2 py-1 bg-white outline-none font-medium text-gray-700"
                                >
                                  <option value="Member">Member</option>
                                  <option value="Project Manager">Project Manager</option>
                                  <option value="Admin">Admin</option>
                                </select>
                              ) : (
                                <span className="text-[11.5px] font-semibold text-gray-700">Member</span>
                              )}
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
                </div>

                {isPMOrOwner && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddMemberModal(true)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-[13px] font-semibold transition-colors shadow-2xs cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Team Member
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmailInviteModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E7EB] hover:bg-gray-50 text-gray-700 rounded-lg text-[13px] font-medium transition-colors cursor-pointer shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      Invite via Email
                    </button>
                  </div>
                )}
              </div>

              {membersLoading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-[#E5E7EB] bg-white animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#F3F4F6]" />
                        <div className="space-y-1.5">
                          <div className="h-4 bg-[#E5E7EB] rounded w-32" />
                          <div className="h-3 bg-[#F3F4F6] rounded w-44" />
                        </div>
                      </div>
                      <div className="h-6 w-20 bg-[#F3F4F6] rounded-full" />
                    </div>
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-[rgba(17,17,17,0.4)]">No members assigned to this project.</div>
              ) : (
                <div className="space-y-2">
                  {members.map(m => {
                    const roleConfig = ROLE_DESCRIPTIONS[(m.role as ProjectRole)] || ROLE_DESCRIPTIONS.Member;
                    const memberExpertise: string[] = (m as any).expertise || [];

                    return (
                      <div key={m.userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#CBD5E1] transition-all">
                        <div className="flex items-start gap-3 min-w-0">
                          {renderUserAvatar(m.avatar, m.name, 'w-10 h-10')}
                          <div className="min-w-0">
                            <span className="text-[13.5px] font-semibold text-[#111111]">{m.name}</span>
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
                          {isAdmin ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={m.role}
                                onChange={e => handleUpdateMemberRole(m.userId, e.target.value as ProjectRole)}
                                className="text-[12px] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white font-medium text-gray-700 outline-none focus:border-[#2563EB] cursor-pointer"
                              >
                                <option value="Member">Member</option>
                                <option value="Project Manager">Project Manager</option>
                                <option value="Admin">Admin</option>
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

            {/* Pending Email Invitations Section */}
            {isPMOrOwner && invitations.length > 0 && (
              <div className="pt-6 border-t border-[#F3F4F6] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[13.5px] font-bold text-[#111111] flex items-center gap-2">
                      <span>Pending Email Invitations</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {invitations.length}
                      </span>
                    </h4>
                    <p className="text-[11.5px] text-[rgba(17,17,17,0.45)] mt-0.5">
                      Invited members will receive a secure email to create their password and join this project
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {invitations.map(inv => {
                    const roleConfig = ROLE_DESCRIPTIONS[inv.role] || ROLE_DESCRIPTIONS.Member;
                    const isRevoking = revokingInviteId === inv.id;
                    const isResending = resendingInviteId === inv.id;

                    return (
                      <div
                        key={inv.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:bg-white transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="20" height="16" x="2" y="4" rx="2" />
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-semibold text-[#111111] truncate">{inv.email}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleConfig.badgeColor}`}>
                                {roleConfig.label}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                                Pending Accept
                              </span>
                            </div>
                            <div className="text-[11px] text-[rgba(17,17,17,0.45)] mt-0.5">
                              Invited by {inv.invitedByName} • Expires {new Date(inv.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {inv.token && (
                            <button
                              type="button"
                              onClick={() => handleCopyProjectInvite(inv.token)}
                              className="px-2.5 py-1 text-[11.5px] font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            >
                              {copiedInviteToken === inv.token ? 'Copied!' : 'Copy Link'}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isResending}
                            onClick={() => handleResendInvitation(inv)}
                            className="px-2.5 py-1 text-[11.5px] font-semibold text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            {isResending ? 'Sending...' : 'Resend Email'}
                          </button>
                          <button
                            type="button"
                            disabled={isRevoking}
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="px-2.5 py-1 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isRevoking ? 'Revoking...' : 'Revoke'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Tasks List */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Filter toolbar: In the Red shows Current Date, In the Green shows Search Box */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* In the Red: Current Date */}
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#111111] shadow-2xs shrink-0">
                <Calendar className="w-4 h-4 text-[#2563EB] shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md border border-[#DBEAFE]/60">
                  Today
                </span>
                <span className="text-[13px] font-medium text-[#111111]">
                  {formattedCurrentDate}
                </span>
              </div>

              {/* In the Green: Search box for task + Status filter */}
              <div className="flex items-center gap-3 flex-1 sm:justify-end">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[13px] focus-within:border-[#2563EB] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all w-full sm:max-w-xs shadow-2xs">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={e => setTaskSearch(e.target.value)}
                    placeholder="Search tasks..."
                    className="bg-transparent text-[#111111] placeholder-[#9CA3AF] outline-none w-full text-[13px]"
                  />
                  {taskSearch && (
                    <button
                      type="button"
                      onClick={() => setTaskSearch('')}
                      className="text-gray-400 hover:text-gray-600 text-xs px-1 cursor-pointer"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={taskStatusFilter}
                  onChange={e => setTaskStatusFilter(e.target.value)}
                  className="text-[12px] border border-[#E5E7EB] rounded-xl px-3 py-1.5 bg-white text-[#111111] outline-none shadow-2xs cursor-pointer hover:border-gray-300 transition-colors shrink-0"
                >
                  <option value="all">All statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {/* Tasks table matching MyTasks Desktop Architecture with Date Grouping */}
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <div className="min-w-[780px]">
                  {/* Table header */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] rounded-t-xl text-[11px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.4)]">
                    <span className="flex-1">Task</span>
                    <span className="w-32">Project</span>
                    <span className="w-28">Status</span>
                    <span className="w-24">Priority</span>
                    <span className="w-28">Assignee</span>
                    <span className="w-28">Due Date</span>
                    <span className="w-16">Est.</span>
                    <span className="w-20 text-right pr-2">Actions</span>
                  </div>

                  {/* Date Groups */}
                  {taskDateGroups.length === 0 ? (
                    <div className="p-8 text-center text-[13px] text-[rgba(17,17,17,0.4)]">
                      No tasks found in this project matching your filter.
                    </div>
                  ) : (
                    taskDateGroups.map((group, groupIndex) => {
                      const isAddingThisGroup = addingTaskDate === group.dateKey;

                      return (
                        <div key={group.dateKey} className="border-b border-[#E5E7EB] last:border-b-0">
                          {/* Specific Date Header */}
                          <div className="flex items-center justify-between px-5 py-2.5 bg-[#F9FAFB]/90 border-b border-[#E5E7EB] text-[12px] font-semibold text-[#111111]">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                              <span>{group.label}</span>
                              {group.isToday && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
                                  Current Date
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-medium text-[rgba(17,17,17,0.45)]">
                              {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                            </span>
                          </div>

                          {/* Tasks under this specific date */}
                          {group.tasks.map(task => {
                            const statusCfg = statusColors[task.status as Status] || { bg: '#EFF6FF', text: '#2563EB', label: task.status };
                            const priorityCfg = priorityColors[task.priority as Priority] || { color: '#6B7280', label: task.priority };

                            return (
                              <div
                                key={task.id}
                                onClick={() => onTaskClick(task.id)}
                                className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-[#F9FAFB] group border-b border-[#F3F4F6] ${
                                  activeRowMenuId === task.id ? 'z-30 relative' : 'relative'
                                }`}
                              >
                                {/* 1. Task Title */}
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[13.5px] font-medium text-[#111111] group-hover:text-[#2563EB] transition-colors truncate block ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
                                    {task.title}
                                  </span>
                                </div>

                                {/* 2. Project Name */}
                                <span className="w-32 text-[12.5px] text-[rgba(17,17,17,0.6)] truncate">
                                  {project.name}
                                </span>

                                {/* 3. Status */}
                                <div className="w-28">
                                  <span
                                    className="text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap inline-block"
                                    style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                                  >
                                    {statusCfg.label}
                                  </span>
                                </div>

                                {/* 4. Priority */}
                                <div className="w-24">
                                  <span className="text-[12.5px] text-[rgba(17,17,17,0.7)] font-normal">
                                    {priorityCfg.label}
                                  </span>
                                </div>

                                {/* 5. Assignee */}
                                <div className="w-28 flex items-center gap-2">
                                  {task.assignee ? (
                                    <>
                                      <div className="w-6 h-6 rounded-full bg-[#1D4ED8] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                        {getTwoLetterCapital(task.assignee.name, task.assignee.avatar)}
                                      </div>
                                      <span className="text-[12.5px] text-[rgba(17,17,17,0.7)] truncate font-normal">
                                        {task.assignee.name.split(' ')[0]}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-[12px] text-[rgba(17,17,17,0.35)]">Unassigned</span>
                                  )}
                                </div>

                                {/* 6. Due Date */}
                                <span className="w-28 text-[12.5px] text-[rgba(17,17,17,0.6)]">
                                  {formatTaskDate(task.dueDate)}
                                </span>

                                {/* 7. Est. */}
                                <span className="w-16 text-[12.5px] text-[rgba(17,17,17,0.5)]">
                                  {task.estimate ?? 40}
                                </span>

                                {/* 8. Actions */}
                                <div className="w-20 flex items-center justify-end pr-1 shrink-0 relative" onClick={e => e.stopPropagation()}>
                                  <RadialTaskMenu
                                    isOpen={activeRowMenuId === task.id}
                                    onToggle={() => setActiveRowMenuId(prev => (prev === task.id ? null : task.id))}
                                    onEdit={() => {
                                      onTaskClick(task.id);
                                      setActiveRowMenuId(null);
                                    }}
                                    onDelete={() => {
                                      setTaskToDelete(task);
                                      setActiveRowMenuId(null);
                                    }}
                                    taskTitle={task.title}
                                  />
                                </div>
                              </div>
                            );
                          })}

                          {/* Last Row: Add-able for this specific date */}
                          {isAddingThisGroup ? (
                            <div className="flex items-center gap-3 px-5 py-2.5 bg-[#F9FAFB]/70">
                              {/* 1. Task Title Input */}
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  autoFocus
                                  value={inlineTaskTitle}
                                  onChange={e => setInlineTaskTitle(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleCreateInlineTask(group.rawDate);
                                    } else if (e.key === 'Escape') {
                                      setAddingTaskDate(null);
                                      setInlineTaskTitle('');
                                    }
                                  }}
                                  placeholder="Task title... (Press Enter to add)"
                                  className="w-full text-[13px] px-3 py-1.5 bg-white border border-[#2563EB] rounded-lg outline-none text-[#111111] placeholder-[rgba(17,17,17,0.4)] shadow-2xs"
                                />
                              </div>

                              {/* 2. Project Name */}
                              <span className="w-32 text-[12.5px] text-[rgba(17,17,17,0.5)] truncate">
                                {project.name}
                              </span>

                              {/* 3. Status */}
                              <div className="w-28">
                                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap inline-block bg-[#EFF6FF] text-[#2563EB]">
                                  To Do
                                </span>
                              </div>

                              {/* 4. Priority */}
                              <div className="w-24">
                                <span className="text-[12.5px] text-[rgba(17,17,17,0.7)] font-normal">
                                  Medium
                                </span>
                              </div>

                              {/* 5. Assignee */}
                              <div className="w-28">
                                <span className="text-[12px] text-[rgba(17,17,17,0.35)]">Unassigned</span>
                              </div>

                              {/* 6. Due Date */}
                              <span className="w-28 text-[12.5px] text-[rgba(17,17,17,0.6)]">
                                {formatTaskDate(group.rawDate)}
                              </span>

                              {/* 7. Est. */}
                              <span className="w-16 text-[12.5px] text-[rgba(17,17,17,0.4)]">
                                —
                              </span>

                              {/* 8. Actions (Add / Cancel) */}
                              <div className="w-20 flex items-center justify-end gap-1.5 pr-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={isCreatingInlineTask || !inlineTaskTitle.trim()}
                                  onClick={() => handleCreateInlineTask(group.rawDate)}
                                  className="px-2.5 py-1 text-[11.5px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-md shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {isCreatingInlineTask ? '...' : 'Add'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddingTaskDate(null);
                                    setInlineTaskTitle('');
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-colors cursor-pointer"
                                  title="Cancel (Esc)"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setAddingTaskDate(group.dateKey);
                                setInlineTaskTitle('');
                              }}
                              className="flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors hover:bg-[#F9FAFB] text-[rgba(17,17,17,0.55)] hover:text-[#2563EB] group"
                            >
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-gray-400 group-hover:text-[#2563EB] transition-colors" />
                                <span className="text-[13px] font-medium">Add task</span>
                              </div>
                              <span className="w-32"></span>
                              <div className="w-28"></div>
                              <div className="w-24"></div>
                              <div className="w-28"></div>
                              <span className="w-28 text-[12px] text-[rgba(17,17,17,0.35)] opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatTaskDate(group.rawDate)}
                              </span>
                              <span className="w-16"></span>
                              <div className="w-20"></div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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
                <span className={`px-3 py-1 rounded-full text-[12px] font-semibold border ${LIFECYCLE_STATE_CONFIG[lifecycleState]?.badgeClass || 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]'
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
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${isCurrent
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

        {/* Tab 6: Messages & Team Chat */}
        {activeTab === 'messages' && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-col h-[700px] overflow-hidden">
            {/* Chat Channel Header */}
            <div className="px-5 py-3 border-b border-[#F1F3F5] bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-[#111111] truncate">#{project.name}</h3>
                  <p className="text-[12px] text-slate-500 truncate">
                    Direct communication &amp; image sharing for all project team members
                  </p>
                </div>
              </div>

              {/* Search & Team Participants */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative hidden sm:block">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2" className="absolute left-2.5 top-1/2 -translate-y-1/2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={chatSearch}
                    onChange={e => setChatSearch(e.target.value)}
                    placeholder="Search messages..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[12px] bg-[#FAFAFB] focus:bg-white placeholder-[#9CA3AF] outline-none focus:border-[#2563EB] w-36 sm:w-44 transition-colors"
                  />
                  {chatSearch && (
                    <button
                      type="button"
                      onClick={() => setChatSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[11px]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Team member avatars */}
                {members.length > 0 && (
                  <div className="hidden sm:flex items-center -space-x-2 pl-1" title={`${members.length} team members in channel`}>
                    {members.slice(0, 4).map(m => (
                      <div key={m.userId} className="ring-2 ring-white rounded-full">
                        {renderUserAvatar(m.avatar, m.name, 'w-7 h-7', 'bg-[#EFF6FF] text-[#2563EB] text-[10px] font-bold border border-blue-200 shadow-2xs')}
                      </div>
                    ))}
                    {members.length > 4 && (
                      <span className="w-7 h-7 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 flex items-center justify-center ring-2 ring-white border border-slate-200">
                        +{members.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Message Stream */}
            <div
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2 bg-white"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleImageFileSelected(e.dataTransfer.files[0]);
                }
              }}
            >
              {messagesLoading && messages.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center gap-2.5 text-slate-400 text-[13px]">
                  <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  Loading project conversation...
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="py-20 text-center text-[13px] text-slate-400 space-y-2.5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-700">
                    {chatSearch ? 'No messages match your search filter.' : 'No messages yet in this project.'}
                  </p>
                  <p className="text-[12px] text-slate-400 max-w-xs mx-auto">
                    {chatSearch ? 'Try a different keyword.' : 'Be the first to share an update or project image with the team!'}
                  </p>
                </div>
              ) : (
                filteredMessages.map((m, idx) => {
                  const isCurrentUser = Boolean(currentUserId && m.userId === currentUserId) || Boolean(session?.user?.email && m.userEmail === session.user.email);
                  const canDelete = isCurrentUser || isPM;
                  const dateStr = new Date(m.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const prevMsg = filteredMessages[idx - 1];
                  const prevDateStr = prevMsg
                    ? new Date(prevMsg.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                    : null;
                  const showDateDivider = dateStr !== prevDateStr;

                  return (
                    <React.Fragment key={m.id}>
                      {showDateDivider && (
                        <div className="flex items-center gap-3 my-5">
                          <div className="flex-1 h-px bg-slate-200/80" />
                          <span className="text-[11px] font-semibold text-slate-500 px-3 py-0.5 rounded-full bg-slate-50 border border-slate-200/90 shadow-2xs">
                            {dateStr}
                          </span>
                          <div className="flex-1 h-px bg-slate-200/80" />
                        </div>
                      )}

                      <div className="relative group rounded-xl px-3.5 py-2.5 hover:bg-slate-50/90 transition-colors flex items-start gap-3">
                        {/* Sender Avatar */}
                        {renderUserAvatar(m.userAvatar, m.userName, 'w-8 h-8', 'bg-blue-50 text-[#2563EB] text-[11px] font-bold border border-blue-200/90 shadow-2xs shrink-0 mt-0.5')}

                        <div className="flex-1 min-w-0">
                          {/* Sender info */}
                          <div className="flex items-center gap-2 flex-wrap pr-20 sm:pr-24">
                            <span className="text-[13px] font-semibold text-slate-900 tracking-tight">
                              {m.userName}
                            </span>
                            {m.userRole && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
                                {m.userRole}
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200">
                                You
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Message Text */}
                          {m.content && (
                            <p className="text-[13px] text-slate-800 leading-relaxed mt-1 break-words whitespace-pre-wrap">
                              {m.content}
                            </p>
                          )}

                          {/* Attached Image (Compact, professional thumbnail) */}
                          {m.imageUrl && (
                            <div className="mt-2 inline-block max-w-[240px] sm:max-w-[260px]">
                              <div
                                onClick={() => setLightboxImage({ url: m.imageUrl!, name: m.imageName || 'Image attachment' })}
                                className="relative rounded-xl overflow-hidden border border-slate-200/90 bg-slate-100 group/img cursor-pointer hover:shadow-md hover:border-blue-400 transition-all block"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={m.imageUrl}
                                  alt={m.imageName || 'Shared image'}
                                  className="w-full max-h-36 sm:max-h-40 object-cover object-center transition-transform duration-200 group-hover/img:scale-[1.02]"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                  <span className="px-2.5 py-1 rounded-full bg-black/75 text-white text-[11px] font-medium backdrop-blur-xs flex items-center gap-1.5 shadow-sm">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                                    </svg>
                                    Click to enlarge
                                  </span>
                                </div>
                              </div>
                              {m.imageName && (
                                <div className="flex items-center justify-between text-[10.5px] text-slate-500 mt-1 px-0.5">
                                  <span className="truncate max-w-[170px] font-medium">{m.imageName}</span>
                                  {m.imageSize && (
                                    <span className="shrink-0 font-mono text-[10px] text-slate-400">{(m.imageSize / 1024).toFixed(0)} KB</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Reactions strip */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {['👍', '❤️', '🚀', '🔥', '👀'].map(emoji => {
                              const reactionList = m.reactions?.[emoji] || [];
                              const hasReacted = Boolean(currentUserId && reactionList.includes(currentUserId));
                              if (reactionList.length === 0) return null;
                              return (
                                <button
                                  type="button"
                                  key={emoji}
                                  onClick={() => handleToggleReaction(m.id, emoji)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all cursor-pointer ${hasReacted
                                    ? 'bg-blue-50 border-blue-200 text-[#2563EB] font-bold shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                  title={`${reactionList.length} reaction(s)`}
                                >
                                  <span>{emoji}</span>
                                  <span>{reactionList.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Floating Action Menu on Hover (Top-Right) */}
                        <div className="absolute right-3 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg shadow-sm px-1.5 py-1 z-10">
                          {['👍', '❤️', '🚀', '🔥', '👀'].map(emoji => (
                            <button
                              type="button"
                              key={emoji}
                              onClick={() => handleToggleReaction(m.id, emoji)}
                              className="w-6 h-6 rounded hover:bg-slate-100 text-[12px] flex items-center justify-center transition-colors cursor-pointer"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                          {canDelete && (
                            <>
                              <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                title="Delete message"
                                className="w-6 h-6 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Composer (Single Unified Professional Card) */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <form onSubmit={handleSendMessage} className="rounded-xl border border-slate-200 bg-[#FAFBFD] focus-within:bg-white focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-blue-100 transition-all p-2.5 shadow-2xs">
                {/* Image attachment preview (before sending) */}
                {attachedImage && (
                  <div className="mb-2 p-2 rounded-lg border border-blue-200 bg-blue-50/70 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                    <div className="w-10 h-10 rounded-md overflow-hidden border border-blue-200 bg-white shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachedImage.dataUrl} alt="Upload preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 text-[12px]">
                      <div className="font-semibold text-blue-900 truncate">{attachedImage.name}</div>
                      <div className="text-[11px] text-blue-600">{(attachedImage.size / 1024).toFixed(0)} KB ready to send</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedImage(null)}
                      className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-blue-200 text-blue-900 transition-colors cursor-pointer text-xs"
                      title="Remove attached image"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFileSelected(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />

                {/* Textarea */}
                <textarea
                  rows={2}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  onPaste={handleChatPaste}
                  placeholder={`Write a message to #${project.name}...`}
                  className="w-full bg-transparent px-1 text-[13px] text-slate-900 placeholder-[#9CA3AF] outline-none resize-none min-h-[40px] max-h-32 leading-relaxed"
                />

                {/* Action Bar inside Container */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                  <div className="flex items-center gap-1.5">
                    {/* Attach Image Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 text-[12px] font-medium transition-colors cursor-pointer"
                      title="Attach an image file"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span className="hidden sm:inline">Attach Image</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 hidden sm:inline">Enter ↵ to send</span>
                    <button
                      type="submit"
                      disabled={sendingMessage || (!messageText.trim() && !attachedImage)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${sendingMessage || (!messageText.trim() && !attachedImage)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs'
                        }`}
                    >
                      {sendingMessage ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Send</span>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Professional Add Project Members Modal (Direct Enrollment, No Email) */}
      <AddProjectMembersModal
        projectId={project.id}
        projectName={project.name}
        existingMemberIds={members.map(m => m.userId)}
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        onSuccess={() => {
          fetchMembers();
          fetchJoinRequests();
        }}
      />

      {/* Optional External Email Invitation Modal */}
      {showEmailInviteModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowEmailInviteModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#F3F4F6]">
              <div>
                <h3 className="text-base font-bold text-[#111111]">Invite External Collaborator</h3>
                <p className="text-xs text-gray-500 mt-0.5">Send an email invitation link to someone outside your organization.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailInviteModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F4F6] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvitation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Invitee Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Initial Project Role
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as ProjectRole)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#2563EB] font-medium"
                >
                  <option value="Member">Member (Default)</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#F3F4F6] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailInviteModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite || !inviteEmail.trim()}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {sendingInvite ? 'Sending...' : 'Send Invitation Email'}
                </button>
              </div>
            </form>
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
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
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

      {/* Remove Member Confirmation Modal */}
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
                <h3 className="text-[16px] font-bold text-[#111111]">Remove Member</h3>
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
                  'Remove Member'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Task Confirmation Modal */}
      {taskToDelete && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeletingTask && setTaskToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-150 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              disabled={isDeletingTask}
              onClick={() => setTaskToDelete(null)}
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
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-[16px] font-bold text-[#111111]">Delete Task</h3>
                <p className="text-[12.5px] text-[rgba(17,17,17,0.6)] mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-[#111111] font-semibold">{taskToDelete.title}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingTask}
                onClick={() => setTaskToDelete(null)}
                className="px-3.5 py-2 text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingTask}
                onClick={handleDeleteTask}
                className="px-4 py-2 text-[13px] font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingTask ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Delete Task'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Shared Images */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div className="w-full max-w-4xl flex items-center justify-between text-white mb-3 px-2" onClick={e => e.stopPropagation()}>
            <span className="text-[14px] font-semibold truncate max-w-md">
              {lightboxImage.name || 'Shared Image Preview'}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={lightboxImage.url}
                download={lightboxImage.name || 'project_image.png'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[12px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Download
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close preview"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="max-h-[85vh] max-w-[90vw] overflow-hidden rounded-xl border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name || 'Full view'}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
