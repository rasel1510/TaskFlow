'use client';

/**
 * src/views/Settings.tsx
 *
 * Fully live settings view:
 *   - Profile:       PATCH /api/users/:id  (name, job title, avatar initials, skills)
 *   - Security:      PATCH /api/users/:id/password  (bcrypt verify + update)
 *   - General:       read-only workspace details (name, member count, your role); people are managed on the Team page
 *   - Notifications: GET/PATCH /api/notifications/preferences (localStorage as instant cache)
 *
 * Layout: SectionHeader → Panel(s) → Row (label column + control) — one calm visual language.
 *
 * Patterns:
 *   - Optimistic UI with rollback on error
 *   - Per-field error messages from Zod response
 *   - Loading spinners per-action (not full-page)
 *   - Zero unmounted setState warnings (AbortController cleanup)
 */

import { invalidateShared } from '@/lib/sharedFetch';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';
import { Eye, EyeOff, Send, RefreshCw, Check, X, Lock } from 'lucide-react';
import { toCompanyRole } from '@/lib/companyRoles';

/* ─────────────── types ─────────────── */

type Section = 'profile' | 'workspace' | 'notifications' | 'security';

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

/** Mirrors src/lib/notificationPrefs.ts — only notifications FlowSync actually sends have a switch. */
export interface NotificationPreferences {
  task_assigned: boolean;
  mentioned: boolean;
  project_activity: boolean;
}

const NOTIF_KEY = 'tf_notification_prefs';

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  task_assigned: true,
  mentioned: true,
  project_activity: true,
};

/* ─────────────── nav ─────────────── */

const navItems: { id: Section; label: string; group: string }[] = [
  { id: 'profile', label: 'Profile', group: 'Account' },
  { id: 'security', label: 'Security', group: 'Account' },
  { id: 'workspace', label: 'General', group: 'Workspace' },
  { id: 'notifications', label: 'Notifications', group: 'Workspace' },
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

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[#111111] mb-1.5">
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
  id,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  autoComplete?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="relative">
      <input
        id={id}
        type={isPassword ? (showPassword ? 'text' : 'password') : type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`w-full h-9 ${isPassword ? 'pl-3 pr-10' : 'px-3'} border border-[#E5E7EB] rounded-lg bg-white text-[13.5px] text-[#111111] placeholder-[#9CA3AF]
                   outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-[border-color,box-shadow] duration-150 ease-out
                   disabled:bg-[#F9FAFB] disabled:text-[rgba(17,17,17,0.55)] disabled:cursor-not-allowed`}
      />
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[rgba(17,17,17,0.4)] hover:text-[#111111] transition-colors p-1.5 rounded-md hover:bg-[#F3F4F6] cursor-pointer"
        >
          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
    </div>
  );
}

function SaveButton({ loading, onClick, label = 'Save changes' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-[#2563EB] text-white rounded-lg text-[13px]
                 font-medium hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
    >
      {loading && <Spinner size={13} />}
      {label}
    </button>
  );
}

/** Page heading for a settings section */
function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h2 className="text-[18px] font-semibold text-[#111111] tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-[rgba(17,17,17,0.55)]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Bordered settings card with an optional heading and action footer */
function Panel({
  title,
  description,
  aside,
  footer,
  children,
  flush = false,
}: {
  title?: string;
  description?: string;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** No inner padding (tables) */
  flush?: boolean;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
      {(title || aside) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h3 className="text-[14px] font-semibold text-[#111111]">{title}</h3>}
            {description && <p className="mt-0.5 text-[12.5px] text-[rgba(17,17,17,0.55)]">{description}</p>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
      )}
      <div className={flush ? '' : `px-5 ${title || aside ? 'pb-5' : 'py-5'}`}>{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#F0F0F0] bg-[#FAFAFA]">{footer}</div>
      )}
    </section>
  );
}

/** Label column + control column; stacks on phones */
function Row({ label, hint, htmlFor, children }: { label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6 py-4 first:pt-0 last:pb-0 border-t border-[#F3F4F6] first:border-t-0">
      <div className="md:pt-2">
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[#111111]">
          {label}
        </label>
      </div>
      <div className="min-w-0">
        {children}
        {hint && <p className="mt-1.5 text-[12px] text-[rgba(17,17,17,0.5)]">{hint}</p>}
      </div>
    </div>
  );
}

/** Accessible on/off switch */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] ${
        checked ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/** Admin, Project Manager or Member (the platform owner shows as Super Admin) */
const roleLabel = (role?: string) =>
  (role || '').toLowerCase().replace(/_/g, ' ').trim() === 'super admin' ? 'Super Admin' : toCompanyRole(role);

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

  const [pName, setPName] = useState('');
  const [secName, setSecName] = useState('');
  const [pAvatar, setPAvatar] = useState('');
  const [pExpertise, setPExpertise] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Derived user roles with database-first priority
  const effectiveUserRole = profile?.role || (session?.user as { role?: string })?.role || '';

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
      toast.error('Choose at least one skill');
      return;
    }
    setProfileLoading(true);
    try {
      const payload: {
        name?: string;
        avatar?: string;
        expertise: string[];
      } = {
        expertise: pExpertise,
      };

      const trimmedName = pName.trim() || session?.user?.name || profile?.name;
      if (trimmedName) payload.name = trimmedName;

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
        try {
          await updateSession?.({
            name: json.data.name,
            avatar: json.data.avatar,
          });
        } catch {
          // ignore session update errors
        }
        invalidateShared('/api/users/');
        window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: json.data }));
        toast.success('Profile saved');
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

  /* ─────────── 3.2 Password state ─────────── */
  const [currPw, setCurrPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');

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

  /* ─────────── Workspace (General) data ─────────── */
  interface PendingInvite {
    id: string;
  }

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [teamName, setTeamName] = useState<string>('Your Workspace');
  const [invites, setInvites] = useState<PendingInvite[]>([]);

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
    if (section !== 'workspace') return;
    const ctrl = new AbortController();
    fetchMembersAndInvites(ctrl.signal);
    return () => ctrl.abort();
  }, [section, fetchMembersAndInvites]);

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
        const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
        setNotifPrefs(prev => ({
          task_assigned: typeof parsed.task_assigned === 'boolean' ? parsed.task_assigned : prev.task_assigned,
          mentioned: typeof parsed.mentioned === 'boolean' ? parsed.mentioned : prev.mentioned,
          project_activity: typeof parsed.project_activity === 'boolean' ? parsed.project_activity : prev.project_activity,
        }));
      }
    } catch { }

    // 2. Fetch server persisted preferences
    fetch('/api/notifications/preferences')
      .then(res => res.json())
      .then(json => {
        if (isMounted && json.success && json.data) {
          setNotifPrefs(prev => ({ ...prev, ...json.data }));
          try {
            localStorage.setItem(NOTIF_KEY, JSON.stringify({ ...DEFAULT_NOTIF_PREFS, ...json.data }));
          } catch { }
        }
      })
      .catch(() => { });

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
          title: 'Test notification',
          body: 'Notifications are working. You will see new ones here and in your Inbox.',
        }),
      });

      // Dispatch global event so header bell & count updates immediately
      window.dispatchEvent(new CustomEvent('notifications-updated'));


      toast.success('Test notification sent — check the bell menu.');
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

      {/* ── Mobile section tabs ── */}
      <div className="md:hidden flex items-center gap-1 px-3 py-2 border-b border-[#E5E7EB] bg-white overflow-x-auto no-scrollbar shrink-0">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            aria-current={section === item.id ? 'page' : undefined}
            className={`relative px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors shrink-0 ${
              section === item.id ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[rgba(17,17,17,0.6)] hover:text-[#111111]'
            }`}
          >
            {item.label}
            {item.id === 'profile' && isExpertiseUnset && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#DC2626]" aria-label="Action needed" />
            )}
          </button>
        ))}
      </div>

      {/* ── Desktop section nav ── */}
      <nav className="hidden md:block w-52 border-r border-[#E5E7EB] overflow-y-auto shrink-0 py-5 px-3" aria-label="Settings">
        {groups.map(group => {
          const items = navItems.filter(i => i.group === group);
          return (
            <div key={group} className="mb-5">
              <div className="px-2.5 pb-1.5 text-[11px] font-medium text-[rgba(17,17,17,0.4)]">{group}</div>
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  aria-current={section === item.id ? 'page' : undefined}
                  className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-md text-[13px] font-medium mb-0.5 transition-colors ${
                    section === item.id
                      ? 'bg-[#F3F4F6] text-[#111111]'
                      : 'text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB] hover:text-[#111111]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.id === 'profile' && isExpertiseUnset && (
                    <span className="text-[11px] font-medium text-[#DC2626]">Required</span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto bg-[#FCFCFD]">
        {/* Extra bottom space so the floating FlowAi button never covers the last action */}
        <div className="px-4 sm:px-6 md:px-10 pt-6 md:pt-8 pb-24">

        {/* ━━━━━━━━━━━━━━  PROFILE  ━━━━━━━━━━━━━━ */}
        {section === 'profile' && (
          <div className="max-w-3xl">
            <SectionHeader title="Profile" description="How you appear to your teammates across FlowSync." />

            {profileFetching && !profile ? (
              <div className="flex items-center gap-2 text-[13px] text-[rgba(17,17,17,0.45)] py-6">
                <Spinner size={14} /> Loading profile…
              </div>
            ) : (
              <div className="space-y-5">
                <Panel title="Personal information">
                  <Row label="Avatar" htmlFor="settings-initials" hint="Shown when you have no profile photo. Up to 2 letters.">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-[14px] font-semibold text-white select-none shrink-0">
                        {pAvatar || pName?.slice(0, 2)?.toUpperCase() || '?'}
                      </div>
                      <input
                        id="settings-initials"
                        type="text"
                        maxLength={2}
                        value={pAvatar}
                        onChange={e => setPAvatar(e.target.value.toUpperCase())}
                        placeholder="AB"
                        className="w-20 h-9 px-3 border border-[#E5E7EB] rounded-lg bg-white text-[13.5px] text-center font-medium uppercase text-[#111111] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-[border-color,box-shadow] duration-150 ease-out"
                      />
                    </div>
                  </Row>
                  <Row label="Full name" htmlFor="settings-name">
                    <TextInput id="settings-name" value={pName} onChange={setPName} placeholder="Your full name" autoComplete="name" />
                  </Row>
                  <Row label="Email" htmlFor="settings-email" hint="Your sign-in email can't be changed here.">
                    <TextInput id="settings-email" value={profile?.email ?? session?.user?.email ?? ''} onChange={() => {}} type="email" disabled />
                  </Row>
                  <Row
                    label="Role"
                    hint={
                      <span className="inline-flex items-center gap-1.5">
                        <Lock size={11} className="shrink-0" /> Admins change roles on the Team page.
                      </span>
                    }
                  >
                    <p className="md:pt-2 text-[13.5px] text-[#111111]">{roleLabel(effectiveUserRole)}</p>
                  </Row>
                </Panel>

                <Panel
                  title="Skills"
                  description="Used to match you with the right tasks. Choose at least one."
                  aside={
                    pExpertise.length > 0 ? (
                      <div className="flex items-center gap-3 text-[12.5px]">
                        <span className="text-[rgba(17,17,17,0.5)]">{pExpertise.length} selected</span>
                        <button
                          type="button"
                          onClick={() => setPExpertise([])}
                          className="font-medium text-[rgba(17,17,17,0.6)] hover:text-[#111111] transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    ) : undefined
                  }
                >
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Skills">
                    {[
                      ...DEFAULT_EXPERTISE_OPTIONS.map(o => o.id),
                      ...pExpertise.filter(item => !DEFAULT_EXPERTISE_OPTIONS.some(o => o.id === item)),
                    ].map(skill => {
                      const isSelected = pExpertise.includes(skill);
                      const isCustom = !DEFAULT_EXPERTISE_OPTIONS.some(o => o.id === skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleExpertise(skill)}
                          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] font-medium transition-colors duration-100 ease-out cursor-pointer select-none ${
                            isSelected
                              ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                              : 'border-[#E5E7EB] bg-white text-[rgba(17,17,17,0.7)] hover:border-[#D1D5DB] hover:text-[#111111]'
                          }`}
                        >
                          {isSelected && !isCustom && <Check size={13} className="shrink-0" />}
                          <span>{skill}</span>
                          {isCustom && <X size={13} className="shrink-0 opacity-60" aria-label={`Remove ${skill}`} />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add a skill that isn't listed (with suggestions) */}
                  <div className="relative mt-4 max-w-md" ref={suggestionsRef}>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customSkill}
                        aria-label="Add a skill"
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
                        placeholder="Add another skill, e.g. DevOps"
                        className="flex-1 min-w-0 h-9 px-3 border border-[#E5E7EB] rounded-lg bg-white text-[13.5px] text-[#111111] placeholder-[#9CA3AF] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-[border-color,box-shadow] duration-150 ease-out"
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
                        className="h-9 px-3.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#111111] hover:bg-[#F9FAFB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    </div>

                    {showSuggestions && customSkill.trim().length > 0 && matchingSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-[0_12px_32px_-8px_rgba(17,17,17,0.18)] max-h-56 overflow-y-auto" role="listbox">
                        {matchingSuggestions.map((suggestion, idx) => (
                          <button
                            key={suggestion}
                            type="button"
                            role="option"
                            aria-selected={idx === activeSuggestionIndex}
                            onMouseEnter={() => setActiveSuggestionIndex(idx)}
                            onClick={() => addCustomExpertise(suggestion)}
                            className={`w-full flex items-center h-8 px-2.5 rounded-lg text-left text-[13px] transition-colors cursor-pointer ${
                              idx === activeSuggestionIndex ? 'bg-[#F3F4F6] text-[#111111]' : 'text-[rgba(17,17,17,0.75)]'
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {pExpertise.length === 0 && (
                    <p className="mt-3 text-[12.5px] text-[#DC2626]">Choose at least one skill before saving.</p>
                  )}
                </Panel>

                <div className="flex justify-end">
                  <SaveButton loading={profileLoading} onClick={handleSaveProfile} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ━━━━━━━━━━━━━━  SECURITY  ━━━━━━━━━━━━━━ */}
        {section === 'security' && (
          <div className="max-w-3xl">
            <SectionHeader title="Security" description="Keep your account secure." />
            <Panel
              title="Password"
              description="Use at least 6 characters."
              footer={<SaveButton loading={pwLoading} onClick={handleChangePassword} label="Update password" />}
            >
              <Row label="Current password" htmlFor="pw-current">
                <TextInput id="pw-current" value={currPw} onChange={setCurrPw} type="password" autoComplete="current-password" />
              </Row>
              <Row label="New password" htmlFor="pw-new">
                <TextInput id="pw-new" value={newPw} onChange={setNewPw} type="password" autoComplete="new-password" />
              </Row>
              <Row label="Confirm new password" htmlFor="pw-confirm">
                <TextInput id="pw-confirm" value={confirmPw} onChange={setConfirmPw} type="password" autoComplete="new-password" />
                {pwError && <p className="mt-2 text-[12.5px] text-[#DC2626]">{pwError}</p>}
              </Row>
            </Panel>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━  GENERAL (workspace)  ━━━━━━━━━━━━━━ */}
        {section === 'workspace' && (
          <div className="max-w-3xl">
            <SectionHeader title="General" description="Details of the workspace you belong to." />
            <Panel title="Workspace">
              <Row label="Name">
                <p className="md:pt-2 text-[13.5px] text-[#111111]">{membersLoading && teamName === 'Your Workspace' ? '…' : teamName}</p>
              </Row>
              <Row label="Members">
                <p className="md:pt-2 text-[13.5px] text-[#111111]">
                  {membersLoading && members.length === 0 ? '…' : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
                  {invites.length > 0 && (
                    <span className="text-[rgba(17,17,17,0.5)]"> · {invites.length} pending</span>
                  )}
                </p>
              </Row>
              <Row label="Your role">
                <p className="md:pt-2 text-[13.5px] text-[#111111]">{roleLabel(effectiveUserRole)}</p>
              </Row>
            </Panel>
            <p className="mt-3 text-[12px] text-[rgba(17,17,17,0.5)]">
              Workspace details are set when the workspace is created. Invite and manage people from the Team page.
            </p>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━  NOTIFICATIONS  ━━━━━━━━━━━━━━ */}
        {section === 'notifications' && (
          <div className="max-w-3xl space-y-5">
            <SectionHeader
              title="Notifications"
              description="Choose what FlowSync notifies you about."
              action={
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  disabled={sendingTest}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#111111] hover:bg-[#F9FAFB] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send size={13} className="text-[rgba(17,17,17,0.55)]" />
                  {sendingTest ? 'Sending…' : 'Send test notification'}
                </button>
              }
            />

            <Panel title="In-app notifications" description="Shown in the bell menu and your Inbox.">
              <div className="divide-y divide-[#F3F4F6]">
                {(
                  [
                    { key: 'task_assigned', label: 'Task assignments', desc: 'When someone assigns a task to you.' },
                    { key: 'mentioned', label: 'Mentions and replies', desc: 'When someone @mentions you or replies to your comment.' },
                    {
                      key: 'project_activity',
                      label: 'Project activity',
                      desc: "When you're added to a project, your request to join is answered, or someone replies to your invitation.",
                    },
                  ] as { key: keyof NotificationPreferences; label: string; desc: string }[]
                ).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-[#111111]">{label}</div>
                      <div className="text-[12.5px] text-[rgba(17,17,17,0.5)] mt-0.5">{desc}</div>
                    </div>
                    <Toggle checked={notifPrefs[key]} onChange={() => toggleNotif(key)} label={label} />
                  </div>
                ))}
              </div>
            </Panel>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={resetNotifPrefs}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium text-[rgba(17,17,17,0.6)] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
                Reset to defaults
              </button>
              <SaveButton loading={notifSaving} onClick={saveNotifPrefs} label="Save preferences" />
            </div>
          </div>
        )}

        </div>

      </div>
    </div>
  );
}
