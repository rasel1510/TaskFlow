'use client';

/**
 * Team — everyone in the company in one place.
 *
 * Shows workspace members (Admins, Project Managers, Members), people from outside the workspace
 * who collaborate on the company's projects, and pending invitations — with the projects each
 * person works in. Admins change roles and remove people; Admins and Project Managers invite.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Check, Copy, Eye, EyeOff, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { SelectMenu, type SelectOption } from '@/components/ui/Pickers';
import { useToast } from '@/components/ui/Toast';

/* ─────────────── types ─────────────── */

interface ProjectRef {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  expertise?: string[];
  createdAt: string;
  projects?: ProjectRef[];
  /** Belongs to another company's workspace; role shown is their project role here (read-only) */
  managedElsewhere?: boolean;
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
  invitedBy?: { id: string; name: string; email: string };
}

interface TeamData {
  team: { id: string; name: string; slug: string };
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

type Filter = 'all' | 'admins' | 'managers' | 'members' | 'invites';

/* ─────────────── helpers ─────────────── */

const ROLE_OPTIONS: SelectOption<'Admin' | 'Project Manager' | 'Member'>[] = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Project Manager', label: 'Project Manager' },
  { value: 'Member', label: 'Member' },
];

const roleKind = (role?: string): 'admin' | 'manager' | 'member' => {
  const r = (role || '').toLowerCase().replace(/_/g, ' ');
  if (r === 'admin') return 'admin';
  if (r === 'project manager') return 'manager';
  return 'member';
};
const roleLabel = (role?: string) => ({ admin: 'Admin', manager: 'Project Manager', member: 'Member' })[roleKind(role)];
const inviteRoleLabel = (role: string) =>
  role === 'ADMIN' ? 'Admin' : role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Member';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Avatar({ name, avatar, size = 'md' }: { name: string; avatar?: string; size?: 'md' | 'sm' }) {
  const dim = size === 'md' ? 'w-8 h-8 text-[11px]' : 'w-7 h-7 text-[10px]';
  const isUrl = avatar?.startsWith('http') || avatar?.startsWith('/');
  return (
    <span className={`${dim} rounded-full bg-[#2563EB] flex items-center justify-center font-semibold text-white shrink-0 overflow-hidden`}>
      {isUrl ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        (avatar && avatar.length <= 3 ? avatar : name?.slice(0, 2) || 'U').toUpperCase()
      )}
    </span>
  );
}

/** Up to two project names, then "+N" (full list on hover) */
function ProjectList({ projects }: { projects?: ProjectRef[] }) {
  if (!projects || projects.length === 0) {
    return <span className="text-[12.5px] text-[rgba(17,17,17,0.35)]">No projects</span>;
  }
  const shown = projects.slice(0, 2);
  const rest = projects.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0" title={projects.map(p => p.name).join(', ')}>
      {shown.map(p => (
        <span key={p.id} className="truncate max-w-full px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[12px] text-[rgba(17,17,17,0.75)]">
          {p.name}
        </span>
      ))}
      {rest > 0 && <span className="shrink-0 text-[12px] text-[rgba(17,17,17,0.5)]">+{rest}</span>}
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#FCFCFD]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-8 pb-24 animate-pulse">
        <div className="h-6 w-24 rounded bg-[#EEEEF0]" />
        <div className="mt-2 h-3.5 w-72 rounded bg-[#F3F4F6]" />
        <div className="mt-7 h-9 w-full max-w-xl rounded-lg bg-[#F3F4F6]" />
        <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-white">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-5 py-4 border-t border-[#F3F4F6] first:border-t-0">
              <div className="w-8 h-8 rounded-full bg-[#F3F4F6]" />
              <div className="space-y-1.5">
                <div className="h-3 w-32 rounded bg-[#F3F4F6]" />
                <div className="h-2.5 w-44 rounded bg-[#F6F6F7]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Module-level cache: instant paint when returning to the page
let cachedTeamData: TeamData | null = null;

/* ════════════════════════════════════════ */

export default function TeamView() {
  const { data: session } = useSession();
  const toast = useToast();
  const [data, setData] = useState<TeamData | null>(cachedTeamData);
  const [loading, setLoading] = useState(!cachedTeamData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Invite dialog
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'PROJECT_MANAGER' | 'MEMBER'>('MEMBER');
  const [invitePassword, setInvitePassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const num = Math.floor(100 + Math.random() * 900);
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `FlowSync@${num}${suffix}`;
  };

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
        setError(json.error?.message || 'Failed to load the team');
      }
    } catch {
      if (!cachedTeamData) setError('Unable to load the team. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Permissions
  const currentUserRole = data?.currentUserRole || (session?.user as { role?: string })?.role || 'Member';
  const isAdmin = roleKind(currentUserRole) === 'admin';
  const isPM = roleKind(currentUserRole) === 'manager';
  const canInvite = isAdmin || isPM;

  // Reset the invite dialog each time it opens (PMs can only invite Members)
  useEffect(() => {
    if (!inviteModalOpen) return;
    setInviteRole(isAdmin ? 'PROJECT_MANAGER' : 'MEMBER');
    setInviteEmail('');
    setInvitePassword(generateRandomPassword());
    setShowInvitePassword(false);
    setInviteError(null);
  }, [inviteModalOpen, isAdmin]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  /* ─────────── actions (optimistic with rollback) ─────────── */

  const applyLocal = (updater: (prev: TeamData) => TeamData) =>
    setData(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      cachedTeamData = next;
      return next;
    });

  const recountRoles = (members: TeamMember[]) => {
    let adminsCount = 0;
    let pmCount = 0;
    let usersCount = 0;
    for (const m of members) {
      const k = roleKind(m.role);
      if (k === 'admin') adminsCount++;
      else if (k === 'manager') pmCount++;
      else usersCount++;
    }
    return { adminsCount, pmCount, usersCount, totalMembers: members.length };
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!isAdmin || !data) return;
    const snapshot = data;
    applyLocal(prev => {
      const members = prev.members.map(m => (m.id === memberId ? { ...m, role: newRole } : m));
      return { ...prev, members, stats: { ...prev.stats, ...recountRoles(members) } };
    });
    window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: { id: memberId, role: newRole } }));
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setData(snapshot);
        cachedTeamData = snapshot;
        toast.error(json.error?.message || 'Could not change the role');
      }
    } catch {
      setData(snapshot);
      cachedTeamData = snapshot;
      toast.error('Network error — the role was not changed');
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !isAdmin || !data) return;
    const target = memberToRemove;
    const snapshot = data;
    setMemberToRemove(null);
    applyLocal(prev => {
      const members = prev.members.filter(m => m.id !== target.id);
      return { ...prev, members, stats: { ...prev.stats, ...recountRoles(members) } };
    });
    try {
      const res = await fetch(`/api/team/members/${target.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setData(snapshot);
        cachedTeamData = snapshot;
        toast.error(json.error?.message || 'Could not remove this person');
      } else {
        toast.success(`${target.name} was removed from ${snapshot.team.name}`);
      }
    } catch {
      setData(snapshot);
      cachedTeamData = snapshot;
      toast.error('Network error — nobody was removed');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setInviteError('Enter an email address.');
      return;
    }
    setSendingInvite(true);
    setInviteError(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole, password: invitePassword.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setInviteError(json.error?.message || json.message || 'Could not send the invitation');
        return;
      }
      toast.success(json.message || `Invitation sent to ${inviteEmail.trim()}`);
      setInviteModalOpen(false);
      setFilter('invites');
      await fetchTeamData();
    } catch {
      setInviteError('Network error — please try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!data) return;
    const snapshot = data;
    applyLocal(prev => {
      const invitations = prev.invitations.filter(i => i.id !== inviteId);
      return { ...prev, invitations, stats: { ...prev.stats, pendingInvitesCount: invitations.length } };
    });
    try {
      const res = await fetch(`/api/team/invite?id=${inviteId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        setData(snapshot);
        cachedTeamData = snapshot;
        toast.error(typeof json.error === 'string' ? json.error : 'Could not cancel the invitation');
      }
    } catch {
      setData(snapshot);
      cachedTeamData = snapshot;
      toast.error('Network error — the invitation was not cancelled');
    }
  };

  /* ─────────── derived lists ─────────── */

  const q = searchQuery.toLowerCase().trim();
  const matches = (name?: string, email?: string) =>
    !q || (name || '').toLowerCase().includes(q) || (email || '').toLowerCase().includes(q);

  const filteredMembers = useMemo(() => {
    if (!data) return [];
    return data.members.filter(m => {
      const k = roleKind(m.role);
      if (filter === 'admins' && k !== 'admin') return false;
      if (filter === 'managers' && k !== 'manager') return false;
      if (filter === 'members' && k !== 'member') return false;
      if (filter === 'invites') return false;
      return matches(m.name, m.email);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, q]);

  const filteredInvitations = useMemo(() => {
    if (!data || filter !== 'invites') return [];
    return data.invitations.filter(i => matches(undefined, i.email));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, q]);

  if (loading && !data) return <TeamSkeleton />;

  if (error || !data) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#FCFCFD] p-6 flex items-center justify-center">
        <div className="max-w-sm w-full text-center">
          <h2 className="text-[15px] font-semibold text-[#111111]">Couldn&apos;t load the team</h2>
          <p className="mt-1 text-[13px] text-[rgba(17,17,17,0.55)]">{error || 'Something went wrong.'}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchTeamData();
            }}
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#111111] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const peopleCount = data.members.length;
  const lastAdmin = data.members.filter(m => !m.managedElsewhere && roleKind(m.role) === 'admin').length <= 1;

  const filters: { id: Filter; label: string; count: number; show: boolean }[] = [
    { id: 'all', label: 'Everyone', count: peopleCount, show: true },
    { id: 'admins', label: 'Admins', count: data.stats.adminsCount, show: true },
    { id: 'managers', label: 'Project Managers', count: data.stats.pmCount, show: true },
    { id: 'members', label: 'Members', count: data.stats.usersCount, show: true },
    { id: 'invites', label: 'Invitations', count: data.invitations.length, show: canInvite },
  ];

  const showPeopleTable = filter !== 'invites';
  const emptyPeople = filteredMembers.length === 0;

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#FCFCFD]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-8 pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold text-[#111111] tracking-tight">Team</h1>
            <p className="mt-1 text-[13px] text-[rgba(17,17,17,0.55)]">
              Everyone at <span className="text-[#111111] font-medium">{data.team.name}</span> and the projects they work in.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchTeamData(true)}
              aria-label="Refresh"
              title="Refresh"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[rgba(17,17,17,0.6)] hover:text-[#111111] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            {canInvite && (
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Invite member
              </button>
            )}
          </div>
        </div>

        {/* Filters + search */}
        <div className="mt-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Filter people">
            {filters
              .filter(f => f.show)
              .map(f => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    filter === f.id ? 'bg-[#F3F4F6] text-[#111111]' : 'text-[rgba(17,17,17,0.55)] hover:text-[#111111]'
                  }`}
                >
                  {f.label}
                  <span className={`text-[12px] tabular-nums ${filter === f.id ? 'text-[rgba(17,17,17,0.55)]' : 'text-[rgba(17,17,17,0.35)]'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
          </div>
          <div className="relative w-full sm:max-w-sm xl:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={filter === 'invites' ? 'Search invitations' : 'Search by name or email'}
              aria-label="Search people"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E5E7EB] bg-white text-[13.5px] text-[#111111] placeholder-[#9CA3AF] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-[border-color,box-shadow] duration-150 ease-out"
            />
          </div>
        </div>

        {/* People */}
        {showPeopleTable && (
          <section className="mt-4 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.3fr)_9.5rem_minmax(0,1.3fr)_4.5rem] xl:grid-cols-[minmax(0,1.3fr)_9.5rem_minmax(0,1.3fr)_7rem_4.5rem] gap-4 items-center h-10 px-5 border-b border-[#F0F0F0] bg-[#FAFAFA] text-[11.5px] font-medium text-[rgba(17,17,17,0.5)]">
              <span>Name</span>
              <span>Role</span>
              <span>Projects</span>
              <span className="hidden xl:block">Joined</span>
              <span />
            </div>

            {emptyPeople ? (
              <div className="py-14 text-center">
                <p className="text-[13.5px] font-medium text-[#111111]">No one found</p>
                <p className="mt-1 text-[12.5px] text-[rgba(17,17,17,0.5)]">
                  {q ? 'Try a different name or email.' : 'Nobody in this group yet.'}
                </p>
              </div>
            ) : (
              <>
                {filteredMembers.map(member => {
                  const isSelf = member.id === data.currentUserId;
                  const k = roleKind(member.role);
                  const roleLocked = (isSelf && k === 'admin' && lastAdmin) || Boolean(member.managedElsewhere);
                  const canRemove = isAdmin && !isSelf && !member.managedElsewhere;
                  return (
                    <div
                      key={member.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.3fr)_9.5rem_minmax(0,1.3fr)_4.5rem] xl:grid-cols-[minmax(0,1.3fr)_9.5rem_minmax(0,1.3fr)_7rem_4.5rem] gap-x-4 gap-y-2 items-center px-5 py-3.5 border-t border-[#F3F4F6] first:border-t-0"
                    >
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={member.name} avatar={member.avatar} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-[13.5px] font-medium text-[#111111]">{member.name}</span>
                            {isSelf && <span className="shrink-0 text-[12px] text-[rgba(17,17,17,0.45)]">(you)</span>}
                          </div>
                          <div className="truncate text-[12.5px] text-[rgba(17,17,17,0.5)]">{member.email}</div>
                        </div>
                      </div>

                      {/* Role (editable by admins) */}
                      <div className="justify-self-end lg:justify-self-stretch min-w-0">
                        {isAdmin && !roleLocked ? (
                          <SelectMenu
                            ariaLabel={`Role for ${member.name}`}
                            value={roleLabel(member.role) as 'Admin' | 'Project Manager' | 'Member'}
                            options={ROLE_OPTIONS}
                            onChange={v => v && v !== roleLabel(member.role) && handleUpdateRole(member.id, v)}
                            triggerClassName="w-full min-w-0 h-8 px-2 -mx-2 inline-flex items-center gap-1 rounded-md text-left text-[13px] text-[rgba(17,17,17,0.8)] hover:bg-[#F3F4F6] transition-colors duration-100 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#DBEAFE]"
                            renderValue={opt => (
                              <>
                                <span className="truncate">{opt?.label ?? roleLabel(member.role)}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[#9CA3AF]" aria-hidden="true">
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </>
                            )}
                          />
                        ) : (
                          <span
                            className="text-[13px] text-[rgba(17,17,17,0.8)]"
                            title={
                              member.managedElsewhere
                                ? 'Their role in this company’s projects'
                                : roleLocked
                                  ? 'The only admin can’t change their own role'
                                  : undefined
                            }
                          >
                            {roleLabel(member.role)}
                          </span>
                        )}
                      </div>

                      {/* Projects */}
                      <div className="col-span-2 lg:col-span-1 min-w-0 pl-11 lg:pl-0">
                        <ProjectList projects={member.projects} />
                      </div>

                      {/* Joined */}
                      <span className="hidden xl:block text-[12.5px] text-[rgba(17,17,17,0.55)] whitespace-nowrap">
                        {shortDate(member.createdAt)}
                      </span>

                      {/* Actions */}
                      <div className="hidden lg:flex justify-end">
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            className="h-8 px-2.5 rounded-md text-[12.5px] font-medium text-[rgba(17,17,17,0.55)] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {canRemove && (
                        <div className="lg:hidden col-span-2 pl-11 -mt-1">
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            className="text-[12.5px] font-medium text-[rgba(17,17,17,0.55)] hover:text-[#DC2626] transition-colors cursor-pointer"
                          >
                            Remove from team
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              </>
            )}
          </section>
        )}

        {/* Invitations */}
        {filter === 'invites' && (
          <section className="mt-4 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="hidden lg:grid grid-cols-[minmax(0,1.4fr)_9rem_minmax(0,1fr)_7rem_auto] gap-4 items-center h-10 px-5 border-b border-[#F0F0F0] bg-[#FAFAFA] text-[11.5px] font-medium text-[rgba(17,17,17,0.5)]">
              <span>Email</span>
              <span>Role</span>
              <span>Invited by</span>
              <span>Expires</span>
              <span />
            </div>
            {filteredInvitations.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-[13.5px] font-medium text-[#111111]">No pending invitations</p>
                <p className="mt-1 text-[12.5px] text-[rgba(17,17,17,0.5)]">
                  {q ? 'Try a different email.' : 'Invitations you send will appear here until they’re accepted.'}
                </p>
              </div>
            ) : (
              filteredInvitations.map(inv => {
                const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/accept?token=${inv.token}`;
                return (
                  <div
                    key={inv.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.4fr)_9rem_minmax(0,1fr)_7rem_auto] gap-x-4 gap-y-1.5 items-center px-5 py-3.5 border-t border-[#F3F4F6] first:border-t-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium text-[#111111]">{inv.email}</div>
                      <div className="lg:hidden text-[12.5px] text-[rgba(17,17,17,0.5)]">
                        {inviteRoleLabel(inv.role)} · expires {shortDate(inv.expiresAt)}
                      </div>
                    </div>
                    <span className="hidden lg:block text-[13px] text-[rgba(17,17,17,0.8)]">{inviteRoleLabel(inv.role)}</span>
                    <span className="hidden lg:block truncate text-[13px] text-[rgba(17,17,17,0.6)]">{inv.invitedBy?.name || '—'}</span>
                    <span className="hidden lg:block text-[12.5px] text-[rgba(17,17,17,0.55)] whitespace-nowrap">{shortDate(inv.expiresAt)}</span>
                    <div className="flex items-center justify-end gap-1">
                      {inv.token && (
                        <button
                          type="button"
                          onClick={() => copy(link, `link-${inv.id}`)}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[12.5px] font-medium text-[rgba(17,17,17,0.65)] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {copiedKey === `link-${inv.id}` ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === `link-${inv.id}` ? 'Copied' : 'Copy link'}
                        </button>
                      )}
                      {inv.initialPassword && (
                        <button
                          type="button"
                          onClick={() => copy(inv.initialPassword as string, `pw-${inv.id}`)}
                          className="hidden sm:inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[12.5px] font-medium text-[rgba(17,17,17,0.65)] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer whitespace-nowrap"
                          title="Copy the temporary password"
                        >
                          {copiedKey === `pw-${inv.id}` ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === `pw-${inv.id}` ? 'Copied' : 'Password'}
                        </button>
                      )}
                      {canInvite && (
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="h-8 px-2.5 rounded-md text-[12.5px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}
      </div>

      {/* Invite dialog */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 animate-in fade-in duration-150"
          onMouseDown={e => {
            if (e.target === e.currentTarget && !sendingInvite) setInviteModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-invite-title"
            className="w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl border border-[#E5E7EB] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] overscroll-contain pb-safe"
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
              <div>
                <h3 id="team-invite-title" className="text-[15px] font-semibold text-[#111111]">Invite member</h3>
                <p className="mt-0.5 text-[12.5px] text-[rgba(17,17,17,0.55)]">Add someone to {data.team.name}.</p>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                aria-label="Close"
                className="p-1.5 -mr-1.5 rounded-md text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite}>
              <div className="px-5 pb-5 space-y-4">
                <div>
                  <label htmlFor="team-invite-email" className="block text-[13px] font-medium text-[#111111] mb-1.5">Email</label>
                  <input
                    id="team-invite-email"
                    type="email"
                    required
                    autoFocus
                    placeholder="name@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[13.5px] text-[#111111] placeholder-[#9CA3AF] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-[border-color,box-shadow] duration-150 ease-out"
                  />
                </div>

                <div>
                  <p className="text-[13px] font-medium text-[#111111] mb-1.5">Role</p>
                  <div className="grid gap-2" role="radiogroup" aria-label="Role">
                    {[
                      { id: 'MEMBER' as const, label: 'Member', desc: 'Works on tasks and collaborates.', allowed: true },
                      { id: 'PROJECT_MANAGER' as const, label: 'Project Manager', desc: 'Creates and manages projects.', allowed: isAdmin },
                      { id: 'ADMIN' as const, label: 'Admin', desc: 'Full access to the workspace.', allowed: isAdmin },
                    ]
                      .filter(r => r.allowed)
                      .map(r => {
                        const active = inviteRole === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setInviteRole(r.id)}
                            className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                              active ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${active ? 'border-[#2563EB]' : 'border-[#D1D5DB]'}`}
                              aria-hidden="true"
                            >
                              {active && <span className="w-2 h-2 rounded-full bg-[#2563EB]" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-[#111111]">{r.label}</span>
                              <span className="block text-[12px] text-[rgba(17,17,17,0.55)]">{r.desc}</span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  {!isAdmin && (
                    <p className="mt-1.5 text-[12px] text-[rgba(17,17,17,0.5)]">Project Managers can invite Members.</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="team-invite-password" className="text-[13px] font-medium text-[#111111]">Temporary password</label>
                    <button
                      type="button"
                      onClick={() => setInvitePassword(generateRandomPassword())}
                      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[rgba(17,17,17,0.6)] hover:text-[#111111] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="team-invite-password"
                      type={showInvitePassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={invitePassword}
                      onChange={e => setInvitePassword(e.target.value)}
                      className="w-full h-9 pl-3 pr-10 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-mono text-[#111111] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-[border-color,box-shadow] duration-150 ease-out"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInvitePassword(v => !v)}
                      aria-label={showInvitePassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[rgba(17,17,17,0.4)] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                    >
                      {showInvitePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[12px] text-[rgba(17,17,17,0.5)]">They can change it after signing in.</p>
                </div>

                {inviteError && <p className="text-[12.5px] text-[#DC2626]">{inviteError}</p>}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#F0F0F0] bg-[#FAFAFA]">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="h-9 px-3.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#111111] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite || !inviteEmail.trim()}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {sendingInvite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {sendingInvite ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 animate-in fade-in duration-150"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setMemberToRemove(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="team-remove-title"
            className="w-full sm:max-w-sm bg-white sm:rounded-2xl rounded-t-2xl border border-[#E5E7EB] shadow-xl pb-safe"
          >
            <div className="px-5 pt-5 pb-4">
              <h3 id="team-remove-title" className="text-[15px] font-semibold text-[#111111]">Remove {memberToRemove.name}?</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[rgba(17,17,17,0.6)]">
                They&apos;ll lose access to {data.team.name}&apos;s projects and tasks. You can invite them again later.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#F0F0F0] bg-[#FAFAFA] rounded-b-2xl">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="h-9 px-3.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#111111] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveMember}
                className="h-9 px-4 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[13px] font-medium transition-colors cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
