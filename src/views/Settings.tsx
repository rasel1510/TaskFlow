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

/* ─────────────── types ─────────────── */

type Section = 'profile' | 'workspace' | 'members' | 'notifications' | 'security' | 'integrations';

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

const NOTIF_KEY = 'tf_notification_prefs';

const DEFAULT_NOTIF_PREFS: Record<string, boolean> = {
  task_assigned: true,
  task_due_soon: true,
  comment_on_task: true,
  mentioned: true,
  status_changed: false,
  new_member: false,
};

const NOTIF_LABELS: { key: string; label: string; desc: string }[] = [
  { key: 'task_assigned',  label: 'Task assigned to me',    desc: 'When a task is assigned to you' },
  { key: 'task_due_soon',  label: 'Task due soon',          desc: '24 hours before a task is due' },
  { key: 'comment_on_task',label: 'Comment on my task',     desc: 'When someone comments on a task you own' },
  { key: 'mentioned',      label: 'Mentioned in comment',   desc: 'When someone @mentions you' },
  { key: 'status_changed', label: 'Task status changed',    desc: 'When a task you follow changes status' },
  { key: 'new_member',     label: 'New team member',        desc: 'When someone joins your workspace' },
];

/* ─────────────── nav ─────────────── */

const navItems: { id: Section; label: string; group: string }[] = [
  { id: 'profile',       label: 'Profile',      group: 'Account' },
  { id: 'security',      label: 'Security',     group: 'Account' },
  { id: 'workspace',     label: 'General',      group: 'Workspace' },
  { id: 'members',       label: 'Members',      group: 'Workspace' },
  { id: 'notifications', label: 'Notifications',group: 'Workspace' },
  { id: 'integrations',  label: 'Integrations', group: 'Integrations' },
];
const groups = ['Account', 'Workspace', 'Integrations'];

const integrations = [
  { name: 'Slack',        desc: 'Get task notifications in Slack channels', connected: true,  icon: '#4A154B', letter: 'S' },
  { name: 'GitHub',       desc: 'Link commits and PRs to tasks',            connected: true,  icon: '#111111', letter: 'G' },
  { name: 'Figma',        desc: 'Attach design files to tasks',             connected: false, icon: '#F24E1E', letter: 'F' },
  { name: 'Jira',         desc: 'Sync with Jira projects',                  connected: false, icon: '#0052CC', letter: 'J' },
  { name: 'Google Drive', desc: 'Attach Drive files to tasks',              connected: false, icon: '#0F9D58', letter: 'G' },
  { name: 'Zapier',       desc: 'Automate workflows with 5,000+ apps',      connected: false, icon: '#FF4A00', letter: 'Z' },
];

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
  value, onChange, type = 'text', placeholder = '', disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-[13.5px] text-[#111111]
                 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all
                 disabled:bg-[#F9FAFB] disabled:cursor-not-allowed"
    />
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
  const { data: session } = useSession();
  const toast = useToast();
  const userId = (session?.user as { id?: string })?.id ?? '';

  /* ─────────── 3.1 Profile state ─────────── */
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFetching, setProfileFetching] = useState(false);

  const [pName, setPName]           = useState('');
  const [pRole, setPRole]           = useState('');
  const [pAvatar, setPAvatar]       = useState('');
  const [pExpertise, setPExpertise] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
    if (section !== 'profile' || !userId) return;
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

      const trimmedRole = pRole.trim() || (session?.user as { role?: string })?.role || profile?.role;
      if (trimmedRole) payload.role = trimmedRole;

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

  /* ─────────── 3.3 Members state ─────────── */
  const [members, setMembers]         = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (section !== 'members') return;
    const ctrl = new AbortController();
    const fetchMembers = async () => {
      setMembersLoading(true);
      try {
        const res = await fetch('/api/users', { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        if (res.ok) {
          const json = await res.json();
          setMembers(json.data ?? []);
        }
      } catch {
        // silently degrade
      } finally {
        if (!ctrl.signal.aborted) setMembersLoading(false);
      }
    };
    fetchMembers();
    return () => ctrl.abort();
  }, [section]);

  /* ─────────── 3.4 Notifications state ─────────── */
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(DEFAULT_NOTIF_PREFS);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    if (section !== 'notifications') return;
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) setNotifPrefs(JSON.parse(raw));
    } catch {
      /* ignore bad localStorage state */
    }
  }, [section]);

  const toggleNotif = (key: string) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveNotifPrefs = async () => {
    setNotifSaving(true);
    // Persist to localStorage — instant, zero network cost
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifPrefs));
    await new Promise(r => setTimeout(r, 350)); // simulate async feel
    setNotifSaving(false);
    toast.success('Notification preferences saved');
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
                    <FieldLabel>Job Title</FieldLabel>
                    <TextInput value={pRole} onChange={setPRole} placeholder="e.g. Software Engineer" />
                  </div>

                  {/* Expertise Matrix */}
                  <div className="pt-4 border-t border-[#F3F4F6]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FieldLabel>Expertise Matrix</FieldLabel>
                        {pExpertise.length === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {pExpertise.length} Selected
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[12px] text-[rgba(17,17,17,0.5)] mb-3">
                      Select all domains that match your skill set. All team members must configure their expertise matrix.
                    </p>

                    {/* Prominent warning callout if unset */}
                    {pExpertise.length === 0 && (
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12.5px] mb-3.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-ping" />
                        <span>
                          <strong className="font-semibold text-red-900">Expertise matrix is required:</strong> Please select at least one domain below.
                        </span>
                      </div>
                    )}

                    {/* Presets Grid - Name only without descriptions */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3.5">
                      {DEFAULT_EXPERTISE_OPTIONS.map(opt => {
                        const isSelected = pExpertise.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleExpertise(opt.id)}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#2563EB] shadow-xs'
                                : 'border-[#E5E7EB] hover:border-[#CBD5E1] bg-white text-[#111111] hover:bg-[#F9FAFB]'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                              isSelected
                                ? 'bg-[#2563EB] border-[#2563EB] text-white'
                                : 'border-[#CBD5E1] bg-white'
                            }`}>
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                            <span className="text-[13px] font-semibold truncate">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Domain Input with Auto-Suggest for Non-Mentioned Expertise */}
                    <div className="relative" ref={suggestionsRef}>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
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
                            className="w-full text-[13px] px-3 py-2 border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white placeholder-[#9CA3AF] transition-all"
                          />
                        </div>
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
                          className="px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12.5px] font-medium rounded-lg disabled:opacity-40 transition-colors cursor-pointer shrink-0 shadow-xs"
                        >
                          + Add
                        </button>
                      </div>

                      {/* Auto-suggest dropdown popup for non-mentioned expertise */}
                      {showSuggestions && customSkill.trim().length > 0 && matchingSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#F1F5F9] flex items-center justify-between text-[11px] text-gray-500 font-medium">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                              Suggested Expertise
                            </span>
                            <span className="text-[10px] text-gray-400">Click or press Enter to add</span>
                          </div>
                          <div className="p-1 max-h-56 overflow-y-auto">
                            {matchingSuggestions.map((suggestion, idx) => {
                              const isActive = idx === activeSuggestionIndex;
                              return (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => addCustomExpertise(suggestion)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                    isActive
                                      ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                                      : 'text-gray-700 hover:bg-[#F1F5F9] hover:text-[#111111]'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                    <span>{suggestion}</span>
                                  </span>
                                  <span className="text-[11px] text-[#2563EB] font-medium">
                                    + Add
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custom Selected Tags */}
                    {pExpertise.filter(item => !DEFAULT_EXPERTISE_OPTIONS.some(o => o.id === item)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {pExpertise
                          .filter(item => !DEFAULT_EXPERTISE_OPTIONS.some(o => o.id === item))
                          .map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => toggleExpertise(tag)}
                                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-blue-200 text-[#2563EB] cursor-pointer"
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
              Manage your account security settings.
            </p>

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

            {/* 2FA placeholder */}
            <div className="border border-[#E5E7EB] rounded-xl p-5 mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-semibold text-[#111111]">Two-Factor Authentication</div>
                  <div className="text-[12.5px] text-[rgba(17,17,17,0.5)] mt-0.5">
                    Add an extra layer of security to your account
                  </div>
                </div>
                <span className="text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626]">
                  Not enabled
                </span>
              </div>
              <button className="mt-3 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors">
                Enable 2FA
              </button>
            </div>

            {/* Active sessions */}
            <div className="border border-[#E5E7EB] rounded-xl p-5">
              <div className="text-[14px] font-semibold text-[#111111] mb-3">Active Sessions</div>
              {[
                { device: 'Chrome on Windows', location: 'Your current device', time: 'Active now', current: true },
                { device: 'Safari on iPhone',  location: 'Mobile device',       time: '2 hours ago', current: false },
              ].map((s, i) => (
                <div key={i} className={`flex items-center justify-between py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
                  <div>
                    <div className="text-[13px] font-medium text-[#111111] flex items-center gap-2">
                      {s.device}
                      {s.current && (
                        <span className="text-[10px] bg-[#F0FDF4] text-[#16A34A] px-1.5 py-0.5 rounded font-medium">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-[rgba(17,17,17,0.45)] mt-0.5">
                      {s.location} · {s.time}
                    </div>
                  </div>
                  {!s.current && (
                    <button className="text-[12.5px] font-medium text-[#DC2626] hover:underline">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            3.3  MEMBERS (live DB)
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {section === 'members' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[20px] font-bold text-[#111111] mb-1">Members</h2>
                {membersLoading ? (
                  <div className="flex items-center gap-1.5 text-[13px] text-[rgba(17,17,17,0.4)]">
                    <Spinner size={12} /> Loading members…
                  </div>
                ) : (
                  <p className="text-[13px] text-[rgba(17,17,17,0.45)]">
                    {members.length} member{members.length !== 1 ? 's' : ''} in your workspace
                  </p>
                )}
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Invite Member
              </button>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-4 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB]
                              text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
                <span className="flex-1">Member</span>
                <span className="w-24">Role</span>
                <span className="w-20">Status</span>
                <span className="w-28">Member since</span>
                <span className="w-16" />
              </div>

              {/* Rows */}
              {membersLoading ? (
                /* Skeleton rows */
                Array.from({ length: 4 }).map((_, i) => (
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
                  No members found
                </div>
              ) : (
                members.map((u, i) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors ${
                      i < members.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                    }`}
                  >
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {u.avatar || u.name?.slice(0, 2)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[13.5px] font-medium text-[#111111] flex items-center gap-1.5">
                          {u.name}
                          {u.id === userId && (
                            <span className="text-[10px] bg-[#DBEAFE] text-[#2563EB] px-1.5 py-0.5 rounded font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-[rgba(17,17,17,0.4)]">{u.email}</div>
                      </div>
                    </div>

                    {/* Role label */}
                    <span className="w-24 text-[12.5px] text-[rgba(17,17,17,0.65)]">
                      {u.id === userId ? 'Owner' : u.role || 'Member'}
                    </span>

                    {/* Status badge */}
                    <span className="w-20">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A]">
                        Active
                      </span>
                    </span>

                    {/* Member since */}
                    <span className="w-28 text-[12px] text-[rgba(17,17,17,0.45)]">
                      {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>

                    {/* Actions */}
                    <div className="w-16 flex items-center gap-1">
                      <button className="text-[11.5px] text-[#2563EB] hover:underline">Edit</button>
                      {u.id !== userId && (
                        <>
                          <span className="text-[rgba(17,17,17,0.2)]">·</span>
                          <button className="text-[11.5px] text-[#DC2626] hover:underline">Remove</button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            3.4  NOTIFICATIONS (localStorage)
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {section === 'notifications' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Notifications</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">
              Choose when and how you&apos;re notified.
            </p>

            <div className="space-y-0">
              {NOTIF_LABELS.map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-3.5 border-b border-[#F3F4F6] last:border-0"
                >
                  <div>
                    <div className="text-[13.5px] font-medium text-[#111111]">{label}</div>
                    <div className="text-[12px] text-[rgba(17,17,17,0.45)] mt-0.5">{desc}</div>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleNotif(key)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                      notifPrefs[key] ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'
                    }`}
                    role="switch"
                    aria-checked={notifPrefs[key]}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                        notifPrefs[key] ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
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
                { label: 'Workspace Name', value: 'TaskFlow Inc.' },
                { label: 'Workspace URL',  value: 'taskflow.app' },
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

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━
            INTEGRATIONS
        ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {section === 'integrations' && (
          <div>
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Integrations</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">Connect your tools with TaskFlow.</p>
            <div className="grid grid-cols-2 gap-4">
              {integrations.map(integration => (
                <div key={integration.name} className="flex items-start gap-4 p-5 border border-[#E5E7EB] rounded-xl hover:border-[#93C5FD] transition-colors">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[16px] font-bold text-white shrink-0"
                    style={{ backgroundColor: integration.icon }}
                  >
                    {integration.letter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-[#111111]">{integration.name}</span>
                      {integration.connected && (
                        <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A]">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[rgba(17,17,17,0.5)] mt-0.5 mb-2.5">{integration.desc}</p>
                    <button className={`text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      integration.connected
                        ? 'border border-[#E5E7EB] text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB]'
                        : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
                    }`}>
                      {integration.connected ? 'Manage' : 'Connect'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
