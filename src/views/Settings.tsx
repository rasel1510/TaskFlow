'use client';

/**
 * src/views/Settings.tsx
 *
 * Fully live settings view:
 *   - 3.1 Profile: PATCH /api/users/:id  (name, role, avatar initials)
 *   - 3.2 Security: PATCH /api/users/:id/password  (bcrypt verify + update)
 *   - 3.3 Members: GET  /api/users  (real DB user list)
 *   - 3.4 Notifications: persisted in localStorage (typed prefs, instant UI)
 *
 * Patterns:
 *   - Optimistic UI with rollback on error
 *   - Per-field error messages from Zod response
 *   - Loading spinners per-action (not full-page)
 *   - Zero unmounted setState warnings (AbortController cleanup)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';
import { Eye, EyeOff, Send, Shield, Briefcase, User, RefreshCw, Mail, Copy, Check, Trash2, X, Plus, Building2, Loader2, Lock } from 'lucide-react';

/* ─────────────── types ─────────────── */

type Section = 'profile' | 'workspace' | 'members' | 'notifications' | 'security';

export const DEFAULT_EXPERTISE_OPTIONS = [
  { id: 'UI Design', label: 'UI Design' },
  { id: 'Frontend', label: 'Frontend' },
  { id: 'Backend', label: 'Backend' },
  { id: 'ML', label: 'ML' },
  { id: 'AI', label: 'AI' },
  { id: 'Distributed Learning', label: 'Distributed Learning' },
];

export const NON_MENTIONED_EXPERTISE_SUGGESTIONS = [
  'DevOps',
  'Cloud Architecture',
  'AWS',
  'Google Cloud (GCP)',
  'Microsoft Azure',
  'Docker',
  'Kubernetes',
  'CI/CD Pipelines',
  'Terraform',
  'Linux Systems',
  'QA Engineering',
  'Automated Testing',
  'Jest & Playwright',
  'Cypress',
  'Performance Testing',
  'Cybersecurity',
  'Penetration Testing',
  'Mobile Development',
  'iOS (Swift)',
  'Android (Kotlin)',
  'React Native',
  'Flutter',
  'Full Stack Engineering',
  'TypeScript',
  'JavaScript',
  'Python',
  'Go (Golang)',
  'Rust',
  'Java',
  'C++',
  'C# / .NET',
  'Node.js',
  'Express.js',
  'NestJS',
  'GraphQL',
  'REST APIs',
  'WebSockets & Realtime',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'MySQL',
  'Database Architecture',
  'Data Engineering',
  'ETL & Data Pipelines',
  'Apache Kafka',
  'Big Data Analytics',
  'UX Research',
  'Product Design',
  'Figma & Design Systems',
  'Interaction Design',
  'Project Management',
  'Agile / Scrum Master',
  'System Architecture',
  'Microservices',
  'Natural Language Processing (NLP)',
  'Computer Vision',
  'Deep Learning',
  'Blockchain & Web3',
  'Site Reliability (SRE)',
  'Technical Writing',
];

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  expertise?: string[];
  createdAt: string;
}

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export interface NotificationPreferences {
  // Delivery Channels
  inApp: boolean;
  browserPush: boolean;
  emailDigest: 'instant' | 'daily' | 'off';

  // Task & Personal Workflow
  task_assigned: boolean;
  task_due_soon: boolean;
  comment_on_task: boolean;
  mentioned: boolean;
  status_changed: boolean;
  subtask_completed: boolean;
  new_member: boolean;

  // Product Manager & Sprints
  pm_project_at_risk: boolean;
  pm_sprint_milestones: boolean;

  // Admin & System Governance
  admin_security_alerts: boolean;
  admin_system_metrics: boolean;
}

const NOTIF_KEY = 'tf_notification_prefs';

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  inApp: true,
  browserPush: false,
  emailDigest: 'daily',

  task_assigned: true,
  task_due_soon: true,
  comment_on_task: true,
  mentioned: true,
  status_changed: true,
  subtask_completed: true,
  new_member: false,

  pm_project_at_risk: true,
  pm_sprint_milestones: true,
  admin_security_alerts: true,
  admin_system_metrics: false,
};

/* ─────────────── nav ─────────────── */

const navItems: { id: Section; label: string; group: string }[] = [
  { id: 'profile',       label: 'Profile',      group: 'Account' },
  { id: 'security',      label: 'Security',     group: 'Account' },
  { id: 'workspace',     label: 'General',      group: 'Workspace' },
  { id: 'members',       label: 'Members',      group: 'Workspace' },
  { id: 'notifications', label: 'Notifications',group: 'Workspace' },
];
const groups = ['Account', 'Workspace'];

/* ─────────────── helpers ─────────────── */

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      className="animate-spin"
      stroke="currentColor" strokeWidth="2.5"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </svg>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-semibold text-[rgba(17,17,17,0.55)] mb-1.5 uppercase tracking-wide">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder = '',
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="relative">
      <input
        type={isPassword ? (showPassword ? 'text' : 'password') : type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full ${isPassword ? 'pl-3.5 pr-10' : 'px-3.5'} py-2.5 border border-[#E5E7EB] rounded-lg text-[13.5px] text-[#111111]
                   outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all
                   disabled:bg-[#F9FAFB] disabled:cursor-not-allowed`}
      />
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgba(17,17,17,0.4)] hover:text-[#111111] transition-colors p-1 rounded-md hover:bg-[#F3F4F6] cursor-pointer"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
  );
}

function SaveButton({ loading, onClick, label = 'Save Changes' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2 bg-[#2563EB] text-white rounded-lg text-[13.5px]
                 font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading && <Spinner size={13} />}
      {label}
    </button>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */

export default function Settings() {
  const [section, setSection] = useState<Section>('profile');
  const { data: session, update: updateSession } = useSession();
  const toast = useToast();
  const userId = (session?.user as { id?: string })?.id ?? '';

  /* ─────────── 3.1 Profile state ─────────── */
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFetching, setProfileFetching] = useState(false);

  const [pName, setPName]           = useState('');
  const [secName, setSecName]       = useState('');
  const [secNameLoading, setSecNameLoading] = useState(false);
  const [pRole, setPRole]           = useState('');
  const [pAvatar, setPAvatar]       = useState('');
  const [pExpertise, setPExpertise] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Derived user roles with database-first priority
  const effectiveUserRole = profile?.role || (session?.user as { role?: string })?.role || '';
  const isAdmin =
    effectiveUserRole === 'Admin' ||
    effectiveUserRole === 'ADMIN' ||
    effectiveUserRole.toLowerCase() === 'admin';
  const isPM =
    isAdmin ||
    effectiveUserRole === 'Project Manager' ||
    effectiveUserRole === 'PROJECT_MANAGER' ||
    effectiveUserRole.toLowerCase() === 'project manager';

  // Close auto-suggest dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter non-mentioned expertise suggestions as the user types
  const matchingSuggestions = useMemo(() => {
    const q = customSkill.trim().toLowerCase();
    if (!q) return [];
    return NON_MENTIONED_EXPERTISE_SUGGESTIONS.filter(
      item =>
        item.toLowerCase().includes(q) &&
        !pExpertise.some(selected => selected.toLowerCase() === item.toLowerCase()) &&
        !DEFAULT_EXPERTISE_OPTIONS.some(o => o.id.toLowerCase() === item.toLowerCase())
    ).slice(0, 8);
  }, [customSkill, pExpertise]);

  // Fetch profile when section opens or userId changes
  const fetchProfileRef = useRef(false);
  const fetchProfile = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    setProfileFetching(true);
    try {
      const res = await fetch(`/api/users/${userId}`, { signal });
      if (signal?.aborted) return;
      if (res.ok) {
        const json = await res.json();
        const u: UserProfile = json.data;
        setProfile(u);
        setPName(u.name);
        setSecName(u.name);
        setPRole(u.role);
        setPAvatar(u.avatar);
        setPExpertise(Array.isArray(u.expertise) ? u.expertise : []);
      }
    } catch {
      // Aborted or network error — silently degrade
    } finally {
      if (!signal?.aborted) setProfileFetching(false);
    }
  }, [userId]);

  useEffect(() => {
    if ((section !== 'profile' && section !== 'security') || !userId) return;
    const ctrl = new AbortController();
    fetchProfile(ctrl.signal);
    return () => ctrl.abort();
  }, [section, userId, fetchProfile]);

  const toggleExpertise = (id: string) => {
    setPExpertise(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const addCustomExpertise = (skillToAdd?: string) => {
    const trimmed = (typeof skillToAdd === 'string' ? skillToAdd : customSkill).trim();
    if (!trimmed) return;
    if (!pExpertise.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
      setPExpertise(prev => [...prev, trimmed]);
    }
    setCustomSkill('');
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    if (pExpertise.length === 0) {
      toast.error('Please configure at least one domain in your Expertise Matrix');
      return;
    }
    setProfileLoading(true);
    try {
      const payload: {
        name?: string;
        role?: string;
        avatar?: string;
        expertise: string[];
      } = {
        expertise: pExpertise,
      };

      const trimmedName = pName.trim() || session?.user?.name || profile?.name;
      if (trimmedName) payload.name = trimmedName;

      // Only administrators are permitted to update their Job Title / role
      if (isAdmin) {
        const trimmedRole = pRole.trim() || (session?.user as { role?: string })?.role || profile?.role;
        if (trimmedRole) payload.role = trimmedRole;
      }

      const trimmedAvatar = pAvatar.trim() || (session?.user as { avatar?: string })?.avatar || profile?.avatar;
      if (trimmedAvatar) payload.avatar = trimmedAvatar;

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setProfile(json.data);
        if (json.data.name) {
          setPName(json.data.name);
          setSecName(json.data.name);
        }
        if (isAdmin && json.data.role) {
          setPRole(json.data.role);
        }
        try {
          await updateSession?.({
            name: json.data.name,
            ...(isAdmin && json.data.role ? { role: json.data.role } : {}),
            avatar: json.data.avatar,
          });
        } catch {
          // ignore session update errors
        }
        window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: json.data }));
        toast.success('Profile and Expertise Matrix updated successfully');
      } else {
        const detailMsg = json.error?.details
          ? Object.entries(json.error.details)
              .map(([f, msg]) => `${f}: ${msg}`)
              .join('; ')
          : json.error?.message ?? 'Failed to save profile';
        toast.error(detailMsg);
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateName = async () => {
    const targetName = (secName || pName).trim();
    if (!targetName) {
      toast.error('Please enter a valid name');
      return;
    }
    if (!userId) return;
    setSecNameLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: targetName }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setProfile(json.data);
        setPName(json.data.name);
        setSecName(json.data.name);
        try {
          await updateSession?.({
            name: json.data.name,
          });
        } catch {
          // ignore session update errors
        }
        window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: json.data }));
        toast.success('Your name has been updated successfully');
      } else {
        toast.error(json.error?.message ?? 'Failed to update name');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setSecNameLoading(false);
    }
  };

  /* ─────────── 3.2 Password state ─────────── */
  const [currPw, setCurrPw]     = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError]   = useState('');

  const handleChangePassword = async () => {
    setPwError('');
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match');
      return;
    }
    if (!userId) return;
    setPwLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCurrPw(''); setNewPw(''); setConfirmPw('');
        toast.success('Password changed successfully');
      } else {
        setPwError(json.error?.message ?? 'Failed to change password');
        toast.error(json.error?.message ?? 'Failed to change password');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setPwLoading(false);
    }
  };

  /* ─────────── 3.3 Members & Team Invites state ─────────── */
  interface PendingInvite {
    id: string;
    email: string;
    role: string;
    status: string;
    token: string;
    expiresAt: string;
    createdAt: string;
    invitedBy?: {
      name: string;
      email: string;
    };
  }

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [teamName, setTeamName] = useState<string>('Your Workspace');
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'PROJECT_MANAGER' | 'VIEWER'>('MEMBER');
  const [invitePassword, setInvitePassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [devInviteUrl, setDevInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Admin Job Title Modification state
  const [editingTitleMember, setEditingTitleMember] = useState<MemberRow | null>(null);
  const [memberJobTitleInput, setMemberJobTitleInput] = useState('');
  const [savingMemberTitle, setSavingMemberTitle] = useState(false);

  const handleOpenEditMemberTitle = (member: MemberRow) => {
    setEditingTitleMember(member);
    setMemberJobTitleInput(member.role || '');
  };

  const handleSaveMemberTitle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTitleMember || !memberJobTitleInput.trim()) return;

    const trimmedTitle = memberJobTitleInput.trim();
    setSavingMemberTitle(true);
    try {
      const res = await fetch(`/api/users/${editingTitleMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: trimmedTitle }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to update job title');
        return;
      }

      setMembers(prev =>
        prev.map(m => (m.id === editingTitleMember.id ? { ...m, role: trimmedTitle } : m))
      );

      if (editingTitleMember.id === userId) {
        setPRole(trimmedTitle);
        setProfile(prev => (prev ? { ...prev, role: trimmedTitle } : null));
        try {
          await updateSession?.({ role: trimmedTitle });
        } catch {}
      }

      window.dispatchEvent(
        new CustomEvent('user-profile-updated', {
          detail: { id: editingTitleMember.id, role: trimmedTitle },
        })
      );
      toast.success(`Job title for ${editingTitleMember.name} updated to "${trimmedTitle}"`);
      setEditingTitleMember(null);
    } catch {
      toast.error('Network error updating job title');
    } finally {
      setSavingMemberTitle(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const num = Math.floor(100 + Math.random() * 900);
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `FlowSync@${num}${suffix}`;
  };

  useEffect(() => {
    if (showInviteModal) {
      setInvitePassword(generateRandomPassword());
      setShowInvitePassword(false);
    }
  }, [showInviteModal]);

  const fetchMembersAndInvites = useCallback(async (signal?: AbortSignal) => {
    setMembersLoading(true);
    try {
      const [usersRes, invitesRes] = await Promise.all([
        fetch('/api/users', { signal }).catch(() => null),
        fetch('/api/team/invite', { signal }).catch(() => null),
      ]);

      if (signal?.aborted) return;

      if (usersRes?.ok) {
        const json = await usersRes.json();
        const userList = Array.isArray(json) ? json : (json?.data ?? []);
        setMembers(userList);
      }

      if (invitesRes?.ok) {
        const json = await invitesRes.json();
        if (json.success && json.data) {
          setTeamName(json.data.teamName || 'Your Workspace');
          setInvites(json.data.invites || []);
        }
      }
    } catch {
      // gracefully degrade
    } finally {
      if (!signal?.aborted) setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section !== 'members') return;
    const ctrl = new AbortController();
    fetchMembersAndInvites(ctrl.signal);
    return () => ctrl.abort();
  }, [section, fetchMembersAndInvites]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSendingInvite(true);
    setDevInviteUrl(null);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          password: invitePassword.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to dispatch invitation');
      } else {
        toast.success(json.message || `Invitation dispatched to ${inviteEmail}`);
        if (json.data?.inviteUrl) {
          setDevInviteUrl(json.data.inviteUrl);
        } else {
          setShowInviteModal(false);
          setInviteEmail('');
        }
        fetchMembersAndInvites();
      }
    } catch {
      toast.error('Network error dispatching invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/team/invite?id=${encodeURIComponent(inviteId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Invitation revoked');
        setInvites(prev => prev.filter(inv => inv.id !== inviteId));
      } else {
        toast.error(json.error || 'Failed to revoke invitation');
      }
    } catch {
      toast.error('Network error revoking invitation');
    }
  };

  /* ─────────── 3.4 Notifications state & real logic ─────────── */
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIF_PREFS);
  const [notifSaving, setNotifSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (section !== 'notifications') return;
    let isMounted = true;

    // 1. Initial instant load from localStorage
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setNotifPrefs(prev => ({ ...prev, ...parsed }));
      }
    } catch {}

    // 2. Fetch server persisted preferences
    fetch('/api/notifications/preferences')
      .then(res => res.json())
      .then(json => {
        if (isMounted && json.success && json.data) {
          setNotifPrefs(prev => ({ ...prev, ...json.data }));
          try {
            localStorage.setItem(NOTIF_KEY, JSON.stringify({ ...DEFAULT_NOTIF_PREFS, ...json.data }));
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [section]);

  const toggleNotif = (key: keyof NotificationPreferences) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSendTestNotification = async () => {
    setSendingTest(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'user',
          type: 'system_test',
          title: 'Notification Pipeline Verified',
          body: 'Your notification preferences are active! In-app, push, and digest channels are fully operational.',
        }),
      });

      // Dispatch global event so header bell & count updates immediately
      window.dispatchEvent(new CustomEvent('notifications-updated'));

      // If browser push is active and permitted, show OS desktop alert
      if (
        notifPrefs.browserPush &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('FlowSync Test Alert', {
          body: 'Your notification preferences are working perfectly.',
          icon: '/favicon.ico',
        });
      }

      toast.success('Test notification sent! Check the bell icon in the top header.');
    } catch {
      toast.error('Failed to send test notification');
    } finally {
      setSendingTest(false);
    }
  };

  const saveNotifPrefs = async () => {
    setNotifSaving(true);
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifPrefs),
      });

      localStorage.setItem(NOTIF_KEY, JSON.stringify(notifPrefs));
      toast.success('Notification preferences saved');
    } catch {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(notifPrefs));
      toast.success('Notification preferences saved locally');
    } finally {
      setNotifSaving(false);
    }
  };

  const resetNotifPrefs = () => {
    setNotifPrefs(DEFAULT_NOTIF_PREFS);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(DEFAULT_NOTIF_PREFS));
    toast.info('Preferences reset to default values');
  };

  const isExpertiseUnset = !profileFetching && (!profile?.expertise || profile.expertise.length === 0);

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white">

      {/* ── Mobile Category Tabs ── */}
      <div className="md:hidden flex items-center gap-1 px-3 py-2 border-b border-[#E5E7EB] bg-[#FAFAFB] overflow-x-auto no-scrollbar shrink-0">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap transition-colors shrink-0 flex items-center gap-1.5 ${
              section === item.id
                ? 'bg-white text-[#2563EB] shadow-2xs font-semibold'
                : 'text-[rgba(17,17,17,0.55)] hover:text-[#111111]'
            }`}
          >
            <span>{item.label}</span>
            {item.id === 'profile' && isExpertiseUnset && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Expertise matrix required" />
            )}
          </button>
        ))}
      </div>

      {/* ── Desktop Settings nav ── */}
      <div className="hidden md:block w-52 border-r border-[#E5E7EB] overflow-y-auto shrink-0 py-4 px-2">
        {groups.map(group => {
          const items = navItems.filter(i => i.group === group);
          return (
            <div key={group} className="mb-4">
              <div className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.35)]">
                {group}
              </div>
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${
                    section === item.id
                      ? 'bg-[#EFF6FF] text-[#2563EB]'
                      : 'text-[rgba(17,17,17,0.65)] hover:bg-[#F3F4F6] hover:text-[#111111]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.id === 'profile' && isExpertiseUnset && (
                    <span
                      title="Expertise matrix required"
                      className="flex items-center gap-1 text-[10.5px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Required
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Content panel ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-5 md:py-6">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            3.1  PROFILE
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {section === 'profile' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-6">Profile</h2>

            {profileFetching ? (
              <div className="flex items-center gap-2 text-[13px] text-[rgba(17,17,17,0.4)] py-6">
                <Spinner size={14} /> Loading profile…
              </div>
            ) : (
              <>
                {/* Avatar row */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#F3F4F6]">
                  <div className="w-16 h-16 rounded-full bg-[#2563EB] flex items-center justify-center text-[22px] font-bold text-white select-none">
                    {pAvatar || pName?.slice(0, 2)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-[12px] text-[rgba(17,17,17,0.45)] mb-2">
                      Change your initials — they appear on your avatar across the app.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={2}
                        value={pAvatar}
                        onChange={e => setPAvatar(e.target.value.toUpperCase())}
                        placeholder="AB"
                        className="w-16 px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] text-center font-bold
                                   text-[#111111] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all uppercase"
                      />
                      <span className="text-[12px] text-[rgba(17,17,17,0.4)]">max 2 chars</span>
                    </div>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  <div>
                    <FieldLabel>Full Name</FieldLabel>
                    <TextInput value={pName} onChange={setPName} placeholder="Your full name" />
                  </div>
                  <div>
                    <FieldLabel>Work Email</FieldLabel>
                    <TextInput
                      value={profile?.email ?? session?.user?.email ?? ''}
                      onChange={() => {}}
                      type="email"
                      disabled
                    />
                    <p className="text-[11px] text-[rgba(17,17,17,0.35)] mt-1">
                      Email cannot be changed from here.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FieldLabel>Job Title</FieldLabel>
                      {!isAdmin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Lock size={11} className="text-amber-600" />
                          <span>Admin managed</span>
                        </span>
                      )}
                    </div>
                    <TextInput
                      value={pRole}
                      onChange={setPRole}
                      placeholder={isAdmin ? "e.g. Software Engineer" : "No job title set"}
                      disabled={!isAdmin}
                    />
                    {!isAdmin ? (
                      <p className="text-[11px] text-[rgba(17,17,17,0.45)] mt-1.5 flex items-center gap-1.5">
                        <Lock size={12} className="text-gray-400 shrink-0" />
                        Only workspace administrators can change the job title of project managers and users.
                      </p>
                    ) : (
                      <p className="text-[11px] text-[rgba(17,17,17,0.35)] mt-1.5">
                        As an administrator, you have permission to change your job title and workspace roles.
                      </p>
                    )}
                  </div>

                  {/* Expertise Matrix */}
                  <div className="pt-5 border-t border-[#F3F4F6] space-y-3.5">
                    {/* Header with Title and Live Counter Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[12px] font-bold uppercase tracking-wider text-gray-500">
                          Expertise Matrix
                        </span>
                        {pExpertise.length === 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                            {pExpertise.length} Selected
                          </span>
                        )}
                      </div>

                      {pExpertise.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPExpertise([])}
                          className="text-[11.5px] font-medium text-gray-400 hover:text-red-600 transition-colors self-start sm:self-auto cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Prominent warning callout if unset */}
                    {pExpertise.length === 0 && (
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12.5px]">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <span>
                          <strong className="font-semibold text-red-900">Expertise matrix is required:</strong> Please select at least one domain below.
                        </span>
                      </div>
                    )}

                    {/* Presets Grid - Simple & Professional Selectable Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {DEFAULT_EXPERTISE_OPTIONS.map(opt => {
                        const isSelected = pExpertise.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleExpertise(opt.id)}
                            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none ${
                              isSelected
                                ? 'border-[#2563EB] bg-white ring-1 ring-[#2563EB] shadow-2xs'
                                : 'border-[#E5E7EB] bg-white hover:border-gray-300 hover:bg-[#F9FAFB]'
                            }`}
                          >
                            <div
                              className={`w-4.5 h-4.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-[#2563EB] border-[#2563EB] text-white'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                            <span className="text-[13.5px] font-semibold text-gray-900 truncate">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Domain Input with Auto-Suggest for Non-Mentioned Expertise */}
                    <div className="relative" ref={suggestionsRef}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customSkill}
                          onChange={e => {
                            setCustomSkill(e.target.value);
                            setShowSuggestions(true);
                            setActiveSuggestionIndex(-1);
                          }}
                          onFocus={() => {
                            if (customSkill.trim()) setShowSuggestions(true);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'ArrowDown' && showSuggestions && matchingSuggestions.length > 0) {
                              e.preventDefault();
                              setActiveSuggestionIndex(prev => (prev + 1) % matchingSuggestions.length);
                            } else if (e.key === 'ArrowUp' && showSuggestions && matchingSuggestions.length > 0) {
                              e.preventDefault();
                              setActiveSuggestionIndex(prev => (prev <= 0 ? matchingSuggestions.length - 1 : prev - 1));
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (showSuggestions && activeSuggestionIndex >= 0 && matchingSuggestions[activeSuggestionIndex]) {
                                addCustomExpertise(matchingSuggestions[activeSuggestionIndex]);
                              } else {
                                addCustomExpertise();
                              }
                            } else if (e.key === 'Escape') {
                              setShowSuggestions(false);
                            }
                          }}
                          placeholder="Add other (type any word to see suggestions, e.g. DevOps, Mobile, QA)..."
                          className="flex-1 text-[13px] px-3.5 py-2 border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] bg-white placeholder-gray-400 text-gray-800 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (showSuggestions && activeSuggestionIndex >= 0 && matchingSuggestions[activeSuggestionIndex]) {
                              addCustomExpertise(matchingSuggestions[activeSuggestionIndex]);
                            } else {
                              addCustomExpertise();
                            }
                          }}
                          disabled={!customSkill.trim()}
                          className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold rounded-lg disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                        >
                          + Add
                        </button>
                      </div>

                      {/* Auto-suggest dropdown popup for non-mentioned expertise */}
                      {showSuggestions && customSkill.trim().length > 0 && matchingSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-[#E5E7EB] rounded-lg shadow-lg overflow-hidden">
                          <div className="p-1 max-h-48 overflow-y-auto">
                            {matchingSuggestions.map((suggestion, idx) => {
                              const isActive = idx === activeSuggestionIndex;
                              return (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => addCustomExpertise(suggestion)}
                                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-left text-[12.5px] transition-colors cursor-pointer ${
                                    isActive
                                      ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                                      : 'text-gray-700 hover:bg-[#F3F4F6] hover:text-gray-900'
                                  }`}
                                >
                                  <span>{suggestion}</span>
                                  <span className="text-[11px] text-[#2563EB] font-medium">+ Add</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selected Custom Tags */}
                    {pExpertise.filter(item => !DEFAULT_EXPERTISE_OPTIONS.some(o => o.id === item)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {pExpertise
                          .filter(item => !DEFAULT_EXPERTISE_OPTIONS.some(o => o.id === item))
                          .map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] transition-colors"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => toggleExpertise(tag)}
                                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-blue-200 text-[#2563EB] cursor-pointer text-[13px] leading-none"
                                aria-label={`Remove ${tag}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <SaveButton loading={profileLoading} onClick={handleSaveProfile} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            3.2  SECURITY / PASSWORD
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {section === 'security' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Security</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">
              Manage your account credentials and personal details.
            </p>

            {/* Update Name (Similar to Password) */}
            <div className="border border-[#E5E7EB] rounded-xl p-5 mb-5 bg-white">
              <h3 className="text-[14px] font-semibold text-[#111111] mb-1">Update Name</h3>
              <p className="text-[12.5px] text-[rgba(17,17,17,0.5)] mb-4">
                Change your full name. This updates your dashboard greeting, assigned tasks, and workspace profile.
              </p>
              <div className="space-y-4">
                <div>
                  <FieldLabel>Full Name</FieldLabel>
                  <TextInput
                    value={secName || pName}
                    onChange={(val) => {
                      setSecName(val);
                      setPName(val);
                    }}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <SaveButton loading={secNameLoading} onClick={handleUpdateName} label="Update Name" />
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="border border-[#E5E7EB] rounded-xl p-5 mb-5">
              <h3 className="text-[14px] font-semibold text-[#111111] mb-4">Change Password</h3>
              <div className="space-y-4">
                <div>
                  <FieldLabel>Current Password</FieldLabel>
                  <TextInput value={currPw} onChange={setCurrPw} type="password" placeholder="Enter current password" />
                </div>
                <div>
                  <FieldLabel>New Password</FieldLabel>
                  <TextInput value={newPw} onChange={setNewPw} type="password" placeholder="Min. 6 characters" />
                </div>
                <div>
                  <FieldLabel>Confirm New Password</FieldLabel>
                  <TextInput value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Repeat new password" />
                </div>
                {pwError && (
                  <div className="text-[12.5px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3.5 py-2.5">
                    {pwError}
                  </div>
                )}
                <div className="flex justify-end pt-1">
                  <SaveButton loading={pwLoading} onClick={handleChangePassword} label="Update Password" />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            3.3  MEMBERS & TEAM INVITATIONS (Multi-Tenant SaaS)
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {section === 'members' && (
          <div className="space-y-6">
            {/* Team / Workspace Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#F3F4F6]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-bold text-[#111111] tracking-tight">{teamName}</h2>
                  </div>
                </div>
                {membersLoading ? (
                  <div className="flex items-center gap-1.5 text-[12.5px] text-[rgba(17,17,17,0.4)] mt-1">
                    <Spinner size={12} /> Loading team members…
                  </div>
                ) : (
                  <p className="text-[12.5px] text-[rgba(17,17,17,0.5)] mt-1">
                    {members.length} team member{members.length !== 1 ? 's' : ''}
                    {invites.length > 0 && ` · ${invites.length} pending invitation${invites.length !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>

              {/* Invite button — Only Project Managers or Admins */}
              {isPM && (
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(true);
                    setDevInviteUrl(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-[13px] font-semibold hover:bg-[#1D4ED8] active:scale-[0.99] transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Invite Teammate</span>
                </button>
              )}
            </div>

            {/* Active Members Table */}
            <div>
              <h3 className="text-[14px] font-bold text-[#111111] mb-2.5">Active Team Members</h3>
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-2xs">
                {/* Table header */}
                <div className="flex items-center gap-4 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
                  <span className="flex-1">Member</span>
                  <span className="w-32">Job Title / Role</span>
                  <span className="w-20">Status</span>
                  <span className="w-24">Joined</span>
                  <span className="w-24 text-right">Actions</span>
                </div>

                {/* Rows */}
                {membersLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#F3F4F6] last:border-0 animate-pulse">
                      <div className="flex-1 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#F3F4F6]" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 rounded bg-[#F3F4F6]" />
                          <div className="h-2.5 w-36 rounded bg-[#F3F4F6]" />
                        </div>
                      </div>
                      <div className="h-3 w-16 rounded bg-[#F3F4F6]" />
                      <div className="h-4 w-12 rounded-full bg-[#F3F4F6]" />
                      <div className="h-3 w-16 rounded bg-[#F3F4F6]" />
                    </div>
                  ))
                ) : members.length === 0 ? (
                  <div className="text-center py-10 text-[13px] text-[rgba(17,17,17,0.4)]">
                    No members in this team yet
                  </div>
                ) : (
                  members.map((u, i) => (
                    <div
                      key={u.id}
                      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors ${
                        i < members.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                      }`}
                    >
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                          {u.avatar || u.name?.slice(0, 2)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-medium text-[#111111] flex items-center gap-1.5 truncate">
                            <span>{u.name}</span>
                            {u.id === userId && (
                              <span className="text-[10px] bg-[#DBEAFE] text-[#2563EB] px-1.5 py-0.5 rounded font-semibold">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-[rgba(17,17,17,0.45)] truncate">{u.email}</div>
                        </div>
                      </div>

                      {/* Role label */}
                      <span className="w-32 text-[12.5px] font-medium text-gray-700 truncate" title={u.role || 'Member'}>
                        {u.role === 'PROJECT_MANAGER' || u.role === 'Project Manager' ? 'Project Manager' : u.role || 'Member'}
                      </span>

                      {/* Status badge */}
                      <span className="w-20">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A]">
                          Active
                        </span>
                      </span>

                      {/* Member since */}
                      <span className="w-24 text-[12px] text-[rgba(17,17,17,0.45)]">
                        {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>

                      {/* Actions */}
                      <div className="w-24 flex items-center justify-end gap-1 text-[11.5px]">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEditMemberTitle(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] transition-colors cursor-pointer"
                            title={`Change Job Title for ${u.name}`}
                          >
                            <span>Edit Title</span>
                          </button>
                        ) : (
                          <span className="text-gray-400">
                            {u.id === userId ? 'You' : 'Member'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pending Invitations Section (Visible to PMs) */}
            {isPM && invites.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2.5">
                  <Mail className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-[14px] font-bold text-[#111111]">Pending Email Invitations</h3>
                  <span className="text-[11px] px-2 py-0.2 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                    {invites.length} Pending
                  </span>
                </div>

                <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-2xs">
                  <div className="flex items-center gap-4 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
                    <span className="flex-1">Invited Email</span>
                    <span className="w-28">Assigned Role</span>
                    <span className="w-28">Expires</span>
                    <span className="w-20 text-right">Action</span>
                  </div>

                  {invites.map((inv, idx) => (
                    <div
                      key={inv.id}
                      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors ${
                        idx < invites.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[#111111] truncate">{inv.email}</div>
                        <div className="text-[11px] text-gray-400">
                          Invited {new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>

                      <div className="w-28 text-[12px] font-medium text-gray-700">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2563EB]">
                          {inv.role === 'PROJECT_MANAGER' ? 'Project Manager' : inv.role === 'VIEWER' ? 'Viewer' : 'Member'}
                        </span>
                      </div>

                      <div className="w-28 text-[11.5px] text-gray-500">
                        {new Date(inv.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>

                      <div className="w-20 text-right">
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-[11px] text-red-600 hover:text-red-700 hover:underline font-medium cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invite Teammate Modal */}
            {showInviteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
                <div className="relative w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xl space-y-5 animate-in zoom-in-95 duration-150">
                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setDevInviteUrl(null);
                    }}
                    className="absolute right-4 top-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#111111]">Invite Teammate</h3>
                      <p className="text-xs text-gray-500">Add a colleague to {teamName}</p>
                    </div>
                  </div>

                  {/* Dev Mode direct link display */}
                  {devInviteUrl && (
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                      <div className="text-[11px] font-semibold text-blue-900 flex items-center justify-between">
                        <span>🛠️ Dev Mode Active (Invite Link Generated)</span>
                        {copiedLink && (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Copied!
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={devInviteUrl}
                          className="flex-1 text-[11px] font-mono px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-blue-950 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(devInviteUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!devInviteUrl && (
                    <form onSubmit={handleSendInvite} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                          Colleague&apos;s Work Email
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="developer@company.com"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                          Assigned Role in Team
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'MEMBER', label: 'Member', desc: 'Can work on tasks' },
                            { id: 'PROJECT_MANAGER', label: 'PM / Co-Lead', desc: 'Can manage projects' },
                            { id: 'VIEWER', label: 'Viewer', desc: 'Read-only access' },
                          ].map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => setInviteRole(r.id as any)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                inviteRole === r.id
                                  ? 'border-[#2563EB] bg-blue-50/50 ring-1 ring-[#2563EB]'
                                  : 'border-[#E5E7EB] hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="text-xs font-semibold text-gray-900">{r.label}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{r.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Given Password Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-[#111111]">
                            Given Password
                          </label>
                          <button
                            type="button"
                            onClick={() => setInvitePassword(generateRandomPassword())}
                            className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Generate New</span>
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showInvitePassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            placeholder="Initial account password"
                            value={invitePassword}
                            onChange={e => setInvitePassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-mono text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowInvitePassword(!showInvitePassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                          >
                            {showInvitePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowInviteModal(false)}
                          className="px-4 py-2 border border-[#E5E7EB] text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={sendingInvite || !inviteEmail.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {sendingInvite ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending Invite...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Send</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {devInviteUrl && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInviteModal(false);
                          setDevInviteUrl(null);
                          setInviteEmail('');
                        }}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            3.4  NOTIFICATIONS (localStorage)
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            3.4  NOTIFICATIONS (Fully Functional Live Preferences)
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {section === 'notifications' && (
          <div className="max-w-2xl space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-bold text-[#111111] mb-1">Notification Preferences</h2>
                <p className="text-[13px] text-[rgba(17,17,17,0.5)]">
                  Configure automated workflow and role triggers.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSendTestNotification}
                disabled={sendingTest}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111111] rounded-lg text-[12px] font-medium transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Send size={13} className="text-[#2563EB]" />
                <span>{sendingTest ? 'Sending...' : 'Send Test Alert'}</span>
              </button>
            </div>

            {/* 1. Task & Workflow Triggers */}
            <div className="border border-[#E5E7EB] rounded-xl p-5 bg-white">
              <h3 className="text-[13.5px] font-semibold text-[#111111] mb-3 flex items-center gap-2">
                <User size={15} className="text-[#2563EB]" />
                <span>Task & Workflow Triggers</span>
              </h3>
              <div className="divide-y divide-[#F1F3F5]">
                {[
                  {
                    key: 'task_assigned',
                    label: 'Task Assignments',
                    desc: 'When a task or subtask is assigned to your account',
                  },
                  {
                    key: 'task_due_soon',
                    label: 'Upcoming Deadline Warnings',
                    desc: 'Remind 24 hours prior to scheduled due date',
                  },
                  {
                    key: 'comment_on_task',
                    label: 'Comments on Owned Tasks',
                    desc: 'When team members comment on tasks you created or oversee',
                  },
                  {
                    key: 'mentioned',
                    label: 'Direct Mentions (@you)',
                    desc: 'When someone tags you in a task discussion or thread',
                  },
                  {
                    key: 'status_changed',
                    label: 'Status Transitions',
                    desc: 'When a watched task changes state (e.g. In Progress → Done)',
                  },
                  {
                    key: 'subtask_completed',
                    label: 'Subtask Completions',
                    desc: 'When checklist items and subtasks are marked as resolved',
                  },
                  {
                    key: 'new_member',
                    label: 'Workspace Member Join Alerts',
                    desc: 'When a new colleague is invited or joins the workspace',
                  },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-[13px] font-medium text-[#111111]">{label}</div>
                      <div className="text-[11.5px] text-[rgba(17,17,17,0.45)] mt-0.5">{desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNotif(key as keyof NotificationPreferences)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        notifPrefs[key as keyof NotificationPreferences] ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'
                      }`}
                      role="switch"
                      aria-checked={!!notifPrefs[key as keyof NotificationPreferences]}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          notifPrefs[key as keyof NotificationPreferences] ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Product Manager & Sprints */}
            <div className="border border-[#E5E7EB] rounded-xl p-5 bg-white">
              <h3 className="text-[13.5px] font-semibold text-[#111111] mb-3 flex items-center gap-2">
                <Briefcase size={15} className="text-[#D97706]" />
                <span>Product Manager & Project Alerts</span>
              </h3>
              <div className="divide-y divide-[#F1F3F5]">
                {[
                  {
                    key: 'pm_project_at_risk',
                    label: 'Project Health Degradation (At Risk / Delayed)',
                    desc: 'Alert when project timeline falls behind or hits critical blockers',
                  },
                  {
                    key: 'pm_sprint_milestones',
                    label: 'Sprint Milestones (80%+ Completion)',
                    desc: 'Progress summary notifications when sprint targets are achieved',
                  },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-[13px] font-medium text-[#111111]">{label}</div>
                      <div className="text-[11.5px] text-[rgba(17,17,17,0.45)] mt-0.5">{desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNotif(key as keyof NotificationPreferences)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        notifPrefs[key as keyof NotificationPreferences] ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'
                      }`}
                      role="switch"
                      aria-checked={!!notifPrefs[key as keyof NotificationPreferences]}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          notifPrefs[key as keyof NotificationPreferences] ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Administration & Governance */}
            <div className="border border-[#E5E7EB] rounded-xl p-5 bg-white">
              <h3 className="text-[13.5px] font-semibold text-[#111111] mb-3 flex items-center gap-2">
                <Shield size={15} className="text-[#7C3AED]" />
                <span>Admin & Security Governance</span>
              </h3>
              <div className="divide-y divide-[#F1F3F5]">
                {[
                  {
                    key: 'admin_security_alerts',
                    label: 'Security & Access Audits',
                    desc: 'Logins from new IP addresses, role reassignments, and permission changes',
                  },
                  {
                    key: 'admin_system_metrics',
                    label: 'System & Database Health Snapshots',
                    desc: 'Database backup success, cache threshold alerts, and sync confirmations',
                  },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-[13px] font-medium text-[#111111]">{label}</div>
                      <div className="text-[11.5px] text-[rgba(17,17,17,0.45)] mt-0.5">{desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNotif(key as keyof NotificationPreferences)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        notifPrefs[key as keyof NotificationPreferences] ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'
                      }`}
                      role="switch"
                      aria-checked={!!notifPrefs[key as keyof NotificationPreferences]}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          notifPrefs[key as keyof NotificationPreferences] ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Save & Reset Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={resetNotifPrefs}
                className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] text-[rgba(17,17,17,0.55)] hover:text-[#111111] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Reset to Defaults</span>
              </button>
              <SaveButton loading={notifSaving} onClick={saveNotifPrefs} label="Save Preferences" />
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            WORKSPACE (General)
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {section === 'workspace' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Workspace General</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">Manage your workspace settings.</p>
            <div className="space-y-4">
              {[
                { label: 'Workspace Name', value: 'FlowSync Inc.' },
                { label: 'Workspace URL',  value: 'flowsync.app' },
                { label: 'Industry',       value: 'Software / Technology' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <input
                    defaultValue={value}
                    className="w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-[13.5px] text-[#111111]
                               outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button className="px-5 py-2 bg-[#2563EB] text-white rounded-lg text-[13.5px] font-semibold hover:bg-[#1D4ED8] transition-colors">
                Save Changes
              </button>
            </div>
            <div className="mt-8 pt-6 border-t border-[#F3F4F6]">
              <div className="text-[14px] font-semibold text-[#DC2626] mb-2">Danger Zone</div>
              <div className="border border-[#FECACA] rounded-xl p-4">
                <div className="text-[13px] font-medium text-[#111111] mb-0.5">Delete Workspace</div>
                <div className="text-[12px] text-[rgba(17,17,17,0.5)] mb-3">
                  This action is irreversible. All data will be permanently deleted.
                </div>
                <button className="px-4 py-1.5 border border-[#FECACA] rounded-lg text-[12.5px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors">
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Admin Edit Member Job Title Modal ── */}
        {isAdmin && editingTitleMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-xl border border-[#E5E7EB] w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                    <Shield size={16} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#111111]">Update Member Job Title</h3>
                    <p className="text-[11.5px] text-[rgba(17,17,17,0.45)]">Admin Role & Title Management</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTitleMember(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveMemberTitle} className="p-6 space-y-4">
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-[13px] font-bold text-white shrink-0">
                    {editingTitleMember.avatar || editingTitleMember.name?.slice(0, 2)?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#111111] truncate">{editingTitleMember.name}</div>
                    <div className="text-[11.5px] text-[rgba(17,17,17,0.45)] truncate">{editingTitleMember.email}</div>
                  </div>
                </div>

                <div>
                  <FieldLabel>Job Title / Role</FieldLabel>
                  <TextInput
                    value={memberJobTitleInput}
                    onChange={setMemberJobTitleInput}
                    placeholder="e.g. Senior Project Manager, Full Stack Engineer"
                  />
                </div>

                {/* Quick Preset Badges */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.4)] block mb-1.5">
                    Suggested Presets
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Project Manager',
                      'Software Engineer',
                      'Lead Developer',
                      'UI/UX Designer',
                      'QA Engineer',
                      'DevOps Engineer',
                      'Admin',
                      'User',
                    ].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMemberJobTitleInput(preset)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          memberJobTitleInput.toLowerCase() === preset.toLowerCase()
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#F3F4F6]">
                  <button
                    type="button"
                    onClick={() => setEditingTitleMember(null)}
                    className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMemberTitle || !memberJobTitleInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {savingMemberTitle ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save Job Title'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
