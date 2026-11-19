'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users,
  Shield,
  Briefcase,
  UserCheck,
  UserPlus,
  Mail,
  Copy,
  Check,
  Clock,
  Trash2,
  Search,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  X,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  expertise?: string[];
  createdAt: string;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  initialPassword?: string | null;
  expiresAt: string;
  createdAt: string;
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  };
}


interface TeamData {
  team: {
    id: string;
    name: string;
    slug: string;
  };
  stats: {
    totalMembers: number;
    adminsCount: number;
    pmCount: number;
    usersCount: number;
    pendingInvitesCount: number;
  };
  members: TeamMember[];
  invitations: TeamInvitation[];
  currentUserRole: string;
  currentUserId: string;
}

function TeamSkeleton() {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#F9FAFB] animate-pulse">
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Workspace Brand & Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5E7EB] rounded-2xl p-5 md:p-6 shadow-xs">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-gray-200 rounded-lg" />
            <div className="h-3 w-32 bg-gray-100 rounded" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-28 bg-gray-200 rounded-xl" />
            <div className="h-8 w-8 bg-gray-200 rounded-xl" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between mb-2">
                <div className="h-3 w-20 bg-gray-200 rounded" />
                <div className="w-4 h-4 bg-gray-100 rounded" />
              </div>
              <div className="h-7 w-12 bg-gray-200 rounded" />
              <div className="h-2.5 w-28 bg-gray-100 rounded" />
            </div>
          ))}
        </div>

        {/* Toolbar & Filter Tabs Skeleton */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="h-9 w-80 bg-gray-200/70 rounded-xl" />
          <div className="h-9 w-full sm:w-64 bg-gray-200/70 rounded-xl" />
        </div>

        {/* Table Skeleton */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E5E7EB] bg-[#F9FAFB]/75 flex justify-between">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
          </div>
          <div className="divide-y divide-gray-100">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-28 bg-gray-200 rounded" />
                    <div className="h-2.5 w-36 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
                <div className="h-3 w-24 bg-gray-100 rounded hidden sm:block" />
                <div className="h-3 w-16 bg-gray-100 rounded hidden sm:block" />
                <div className="h-7 w-20 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Module-level memory cache for instantaneous 0ms perceived SWR transitions
let cachedTeamData: TeamData | null = null;

export default function TeamView() {
  const { data: session } = useSession();
  const [data, setData] = useState<TeamData | null>(cachedTeamData);
  const [loading, setLoading] = useState(!cachedTeamData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<'all' | 'admins' | 'managers' | 'members' | 'invites'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'PROJECT_MANAGER' | 'MEMBER'>('MEMBER');
  const [invitePassword, setInvitePassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const num = Math.floor(100 + Math.random() * 900);
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `FlowSync@${num}${suffix}`;
  };

  // Role & Job Title Change State
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);

  const handleCopyPassword = (password: string, id: string) => {
    navigator.clipboard.writeText(password);
    setCopiedPasswordId(id);
    setTimeout(() => setCopiedPasswordId(null), 2000);
  };

  // Remove confirmation modal
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  // Fetch Team Data
  const fetchTeamData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const res = await fetch('/api/team/members');
      const json = await res.json();
      if (json.success && json.data) {
        cachedTeamData = json.data;
        setData(json.data);
        setError(null);
      } else if (!cachedTeamData) {
        setError(json.error?.message || 'Failed to load team data');
      }
    } catch (err) {
      console.error('Error fetching team:', err);
      if (!cachedTeamData) {
        setError('Unable to load team workspace. Please refresh.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Derived user permissions
  const currentUserRole = data?.currentUserRole || (session?.user as { role?: string })?.role || 'Member';
  const isAdmin =
    currentUserRole === 'Admin' ||
    currentUserRole === 'ADMIN' ||
    currentUserRole?.toLowerCase() === 'admin';
  const isPM =
    currentUserRole === 'Project Manager' ||
    currentUserRole === 'PROJECT_MANAGER' ||
    currentUserRole?.toLowerCase() === 'project manager';
  const canInvite = isAdmin || isPM;

  // Set default invite role: PMs can only invite Members, Admins default to PM
  useEffect(() => {
    if (inviteModalOpen) {
      setInviteRole(isAdmin ? 'PROJECT_MANAGER' : 'MEMBER');
      setInviteEmail('');
      setInvitePassword(generateRandomPassword());
      setShowInvitePassword(false);
      setInviteError(null);
      setInviteSuccess(null);
    }
  }, [inviteModalOpen, isAdmin]);

  // Handle Role or Job Title Change (Admin Only) — Optimistic UI
  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!isAdmin || !data) return;
    const snapshot = data;

    // Instant optimistic update in memory
    const oldMember = data.members.find(m => m.id === memberId);
    const oldRoleLower = oldMember?.role?.toLowerCase() || '';
    const newRoleLower = newRole.toLowerCase();

    let adminsCount = data.stats.adminsCount;
    let pmCount = data.stats.pmCount;
    let usersCount = data.stats.usersCount;

    if (oldRoleLower === 'admin') adminsCount = Math.max(0, adminsCount - 1);
    else if (oldRoleLower === 'project manager' || oldRoleLower === 'project_manager') pmCount = Math.max(0, pmCount - 1);
    else usersCount = Math.max(0, usersCount - 1);

    if (newRoleLower === 'admin') adminsCount++;
    else if (newRoleLower === 'project manager' || newRoleLower === 'project_manager') pmCount++;
    else usersCount++;

    setData(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        stats: { ...prev.stats, adminsCount, pmCount, usersCount },
        members: prev.members.map(m => m.id === memberId ? { ...m, role: newRole } : m),
      };
      cachedTeamData = updated;
      return updated;
    });

    window.dispatchEvent(
      new CustomEvent('user-profile-updated', {
        detail: { id: memberId, role: newRole },
      })
    );


    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setData(snapshot);
        alert(json.error?.message || 'Failed to update role');
      }
    } catch (err) {
      setData(snapshot);
      console.error('Failed to change role:', err);
      alert('Network error while updating member role');
    }
  };


  // Handle Remove Member — Optimistic UI
  const handleRemoveMember = async () => {
    if (!memberToRemove || !isAdmin || !data) return;
    const target = memberToRemove;
    const snapshot = data;

    // Instant optimistic dismissal and removal
    setMemberToRemove(null);
    setData(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        stats: {
          ...prev.stats,
          totalMembers: Math.max(0, prev.stats.totalMembers - 1),
          usersCount: target.role?.toLowerCase() === 'admin' || target.role?.toLowerCase() === 'project manager'
            ? prev.stats.usersCount
            : Math.max(0, prev.stats.usersCount - 1),
        },
        members: prev.members.filter(m => m.id !== target.id),
      };
      cachedTeamData = updated;
      return updated;
    });

    try {
      const res = await fetch(`/api/team/members/${target.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setData(snapshot);
        alert(json.error?.message || 'Failed to remove member');
      }
    } catch (err) {
      setData(snapshot);
      console.error('Error removing member:', err);
      alert('Network error while removing member');
    }
  };

  // Handle Send Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setInviteError('Please provide a valid work email address');
      return;
    }
    setSendingInvite(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          password: invitePassword.trim(),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setInviteError(json.error?.message || json.message || 'Failed to send invitation');
        return;
      }

      setInviteSuccess(json.message || 'Invitation created successfully!');
      await fetchTeamData();
      setTimeout(() => {
        setInviteModalOpen(false);
        setInviteSuccess(null);
        setActiveTab('invites');
      }, 1400);
    } catch (err) {
      console.error('Invite error:', err);
      setInviteError('Network error while sending invite. Please try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  // Revoke Invitation — Optimistic UI
  const handleRevokeInvite = async (inviteId: string) => {
    const snapshot = data;
    setData(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        invitations: prev.invitations.filter(i => i.id !== inviteId),
        stats: {
          ...prev.stats,
          pendingInvitesCount: Math.max(0, prev.stats.pendingInvitesCount - 1),
        },
      };
      cachedTeamData = updated;
      return updated;
    });

    try {
      const res = await fetch(`/api/team/invite?id=${inviteId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) {
        setData(snapshot);
        cachedTeamData = snapshot;
        alert(json.error || 'Failed to cancel invitation');
      }
    } catch {
      setData(snapshot);
      cachedTeamData = snapshot;
      alert('Network error cancelling invitation');
    }
  };

  // Copy link helper
  const handleCopyLink = (url: string, token: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Filter members based on tab and search
  const filteredMembers = useMemo(() => {
    if (!data?.members) return [];
    return data.members.filter(m => {
      const roleLower = m.role?.toLowerCase() || '';
      const isMAdmin = roleLower === 'admin';
      const isMPM = roleLower === 'project manager' || roleLower === 'project_manager';
      const isMUser = !isMAdmin && !isMPM;

      if (activeTab === 'admins' && !isMAdmin) return false;
      if (activeTab === 'managers' && !isMPM) return false;
      if (activeTab === 'members' && !isMUser) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = m.name?.toLowerCase().includes(q);
        const matchEmail = m.email?.toLowerCase().includes(q);
        return matchName || matchEmail;
      }
      return true;
    });
  }, [data?.members, activeTab, searchQuery]);

  // Filter invitations based on search
  const filteredInvitations = useMemo(() => {
    if (!data?.invitations) return [];
    if (!searchQuery.trim()) return data.invitations;
    const q = searchQuery.toLowerCase().trim();
    return data.invitations.filter(i => i.email.toLowerCase().includes(q));
  }, [data?.invitations, searchQuery]);

  if (loading && !data) {
    return <TeamSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#F9FAFB] p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Workspace Unavailable</h2>
          <p className="text-xs text-gray-500">{error || 'Could not load team workspace.'}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchTeamData();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#F9FAFB]">
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Workspace Brand & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5E7EB] rounded-2xl p-5 md:p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#111111]">
                {data.team.name}
              </h1>
            </div>
            {isAdmin && (
              <p className="text-xs text-[#2563EB] font-medium mt-1">
                You are the Team Admin.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {canInvite && (
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="h-8 inline-flex items-center gap-2 px-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite Member</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                fetchTeamData(true);
              }}
              title="Refresh team"
              className="h-8 w-8 inline-flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 hover:text-gray-900 transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#2563EB]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Total Members */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">Total Members</span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-[#111111]">{data.stats.totalMembers}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Active team members</div>
          </div>

          {/* Admins */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-purple-600 mb-2">
              <span className="text-xs font-medium">Admins</span>
              <Shield className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-700">{data.stats.adminsCount}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Full team & business control</div>
          </div>

          {/* Project Managers */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 mb-2">
              <span className="text-xs font-medium">Project Managers</span>
              <Briefcase className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="text-2xl font-bold text-[#2563EB]">{data.stats.pmCount}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Project creation & lead</div>
          </div>

          {/* Members */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-xs font-medium">Members</span>
              <UserCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">{data.stats.usersCount}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Task execution & collaboration</div>
          </div>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-[#E5E7EB]/60 p-1 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'all'
                ? 'bg-white text-[#111111] font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              All Members ({data.stats.totalMembers})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admins')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'admins'
                ? 'bg-white text-purple-700 font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Admins ({data.stats.adminsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('managers')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'managers'
                ? 'bg-white text-[#2563EB] font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Project Managers ({data.stats.pmCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'members'
                ? 'bg-white text-emerald-700 font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Members ({data.stats.usersCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invites')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'invites'
                ? 'bg-white text-amber-700 font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <span>Pending Invites</span>
              {data.stats.pendingInvitesCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {data.stats.pendingInvitesCount}
                </span>
              )}
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search member or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Member Table Content */}
        {activeTab !== 'invites' ? (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]/75 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-5">Member</th>
                    <th className="py-3 px-5">Role</th>
                    <th className="py-3 px-5">Expertise</th>
                    <th className="py-3 px-5">Joined</th>
                    {isAdmin && <th className="py-3 px-5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="py-12 text-center text-gray-400">
                        <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <p className="font-medium text-gray-600">No members match your criteria</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Try clearing your search query</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map(member => {
                      const isSelf = member.id === data.currentUserId;
                      const roleLower = member.role?.toLowerCase() || '';
                      const isMemberAdmin = roleLower === 'admin';
                      const isMemberPM = roleLower === 'project manager' || roleLower === 'project_manager';

                      return (
                        <tr key={member.id} className="hover:bg-gray-50/70 transition-colors">
                          {/* Member info */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden ${isMemberAdmin
                                  ? 'bg-purple-600'
                                  : isMemberPM
                                    ? 'bg-[#2563EB]'
                                    : 'bg-emerald-600'
                                }`}
                              >
                                {member.avatar?.startsWith('http') || member.avatar?.startsWith('/') ? (
                                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                                ) : (
                                  (member.avatar && member.avatar.length <= 3 ? member.avatar : member.name.slice(0, 2)).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-[#111111] truncate">
                                    {member.name}
                                  </span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">{member.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                {isMemberAdmin
                                  ? 'Admin'
                                  : isMemberPM
                                    ? 'Project Manager'
                                    : 'Member'}
                              </span>
                            </div>
                          </td>

                          {/* Expertise tags */}
                          <td className="py-3.5 px-5">
                            {member.expertise && member.expertise.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {member.expertise.slice(0, 3).map((exp, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md text-[10.5px] bg-gray-100 text-gray-600 font-medium"
                                  >
                                    {exp}
                                  </span>
                                ))}
                                {member.expertise.length > 3 && (
                                  <span className="text-[10px] text-gray-400 self-center">
                                    +{member.expertise.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">No expertise set</span>
                            )}
                          </td>

                          {/* Joined date */}
                          <td className="py-3.5 px-5 text-gray-500 text-[11px]">
                            {new Date(member.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>

                          {/* Actions (Admin Only) */}
                          {isAdmin && (
                            <td className="py-3.5 px-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Role Dropdown Selector */}
                                <select
                                  disabled={updatingMemberId === member.id || (isSelf && isMemberAdmin && data.stats.adminsCount <= 1)}
                                  value={isMemberAdmin ? 'Admin' : isMemberPM ? 'Project Manager' : 'Member'}
                                  onChange={e => handleUpdateRole(member.id, e.target.value)}
                                  className="text-[11px] bg-white border border-[#E5E7EB] hover:border-gray-400 text-gray-700 py-1 px-2 rounded-lg font-medium outline-none focus:border-[#2563EB] cursor-pointer"
                                >
                                  <option value="Admin">Admin</option>
                                  <option value="Project Manager">Project Manager</option>
                                  <option value="Member">Member</option>
                                  {!['Admin', 'Project Manager', 'Member'].includes(member.role) && (
                                    <option value={member.role}>{member.role}</option>
                                  )}
                                </select>

                                {/* Remove Member */}
                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => setMemberToRemove(member)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Remove from team"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Pending Invitations Table */
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]/75 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-5">Invited Email</th>
                    <th className="py-3 px-5">Invited Role</th>
                    <th className="py-3 px-5">Temporary Password</th>
                    <th className="py-3 px-5">Invited By</th>
                    <th className="py-3 px-5">Expires</th>
                    <th className="py-3 px-5 text-right">Invitation Link & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        <Mail className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <p className="font-medium text-gray-600">No pending invitations</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Click &quot;Invite Member&quot; to bring your team aboard</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInvitations.map(inv => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      const fullLink = `${origin}/invite/accept?token=${inv.token}`;
                      const isCopied = copiedToken === inv.token;

                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3.5 px-5 font-medium text-[#111111]">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              <span>{inv.email}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              {inv.role === 'PROJECT_MANAGER'
                                ? 'Project Manager'
                                : inv.role === 'ADMIN'
                                  ? 'Admin'
                                  : 'Member'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5">
                            {inv.initialPassword ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/80">
                                <KeyRound className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="font-mono text-[11.5px] font-semibold text-gray-800 tracking-wider select-all">
                                  {revealedPasswords[inv.id] ? inv.initialPassword : '••••••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRevealedPasswords(prev => ({
                                      ...prev,
                                      [inv.id]: !prev[inv.id],
                                    }))
                                  }
                                  className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors cursor-pointer"
                                  title={revealedPasswords[inv.id] ? 'Hide password' : 'Show password'}
                                >
                                  {revealedPasswords[inv.id] ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPassword(inv.initialPassword!, inv.id)}
                                  className="p-1 text-gray-400 hover:text-[#2563EB] rounded transition-colors cursor-pointer"
                                  title="Copy password"
                                >
                                  {copiedPasswordId === inv.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs italic">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-gray-500">
                            {inv.invitedBy?.name || 'Team Lead'}
                          </td>
                          <td className="py-3.5 px-5 text-gray-400 text-[11px]">
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(fullLink, inv.token)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${isCopied
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-2xs'
                                  }`}
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-gray-500" />
                                    <span>Copy Invite Link</span>
                                  </>
                                )}
                              </button>
                              {canInvite && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeInvite(inv.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Revoke invitation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Invite Member Modal (Mobbin Minimalist Design)               */}
      {/* ============================================================ */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100 shadow-2xs">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#111111]">Invite to {data.team.name}</h3>
                  <p className="text-[11.5px] text-gray-400 mt-0.5">Send an email invitation with workspace access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notifications */}
            {inviteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            {inviteSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-900">{inviteSuccess}</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Temporary credentials have been saved to your Pending Invites table.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Select Role
                </label>
                <div className="space-y-2">
                  {/* Admin option (Admin only) */}
                  {isAdmin && (
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${inviteRole === 'ADMIN'
                        ? 'border-[#2563EB] bg-blue-50/40 ring-1 ring-[#2563EB]'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                    >
                      <input
                        type="radio"
                        name="inviteRole"
                        value="ADMIN"
                        checked={inviteRole === 'ADMIN'}
                        onChange={() => setInviteRole('ADMIN')}
                        className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#111111]">Admin</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">Full Access</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Full administrative governance, security settings, and team management.
                        </p>
                      </div>
                    </label>
                  )}

                  {/* Project Manager option (Admin only) */}
                  {isAdmin && (
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${inviteRole === 'PROJECT_MANAGER'
                        ? 'border-[#2563EB] bg-blue-50/40 ring-1 ring-[#2563EB]'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                    >
                      <input
                        type="radio"
                        name="inviteRole"
                        value="PROJECT_MANAGER"
                        checked={inviteRole === 'PROJECT_MANAGER'}
                        onChange={() => setInviteRole('PROJECT_MANAGER')}
                        className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#111111]">Project Manager</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">Recommended</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Can create projects, manage roadmaps, assign tasks, and invite members.
                        </p>
                      </div>
                    </label>
                  )}

                  {/* Member option */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${inviteRole === 'MEMBER'
                      ? 'border-[#2563EB] bg-blue-50/40 ring-1 ring-[#2563EB]'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                  >
                    <input
                      type="radio"
                      name="inviteRole"
                      value="MEMBER"
                      checked={inviteRole === 'MEMBER'}
                      onChange={() => setInviteRole('MEMBER')}
                      className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-[#111111]">Member</span>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Can participate in projects, work on assigned tasks, and submit updates.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Given Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#111111]">
                    Given Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setInvitePassword(generateRandomPassword())}
                    className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] hover:underline cursor-pointer"
                  >
                    Generate New
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showInvitePassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Initial account password"
                    value={invitePassword}
                    onChange={e => setInvitePassword(e.target.value)}
                    className="w-full pl-10 pr-14 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-mono text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInvitePassword(!showInvitePassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-500 hover:text-gray-800 cursor-pointer select-none"
                  >
                    {showInvitePassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Sent via invitation email and retained securely in your Pending Invites list.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {sendingInvite ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </span>
                  ) : (
                    'Send Invitation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Remove Member Confirmation Modal                             */}
      {/* ============================================================ */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Remove from team?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to remove <span className="font-semibold text-gray-800">{memberToRemove.name}</span> ({memberToRemove.email}) from {data.team.name}? They will lose access to team projects and tasks.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="px-3.5 py-1.5 border border-gray-300 text-xs font-semibold text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingMember}
                onClick={handleRemoveMember}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 text-xs font-semibold text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {removingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
