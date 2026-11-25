/**
 * src/components/AddProjectMembersModal.tsx
 *
 * "Add members" dialog for a project. Two simple ways in:
 *   1. Invite by email — anyone; they accept from the email and join with the chosen role.
 *   2. People in your company — tick people, pick each person's role, Add (instant, no email).
 *
 * Roles are the company's three: Admin, Project Manager, Member. Only company Admins can grant
 * Admin (the API enforces the same rule).
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';
import { SelectMenu, type SelectOption } from '@/components/ui/Pickers';
import InviteByEmail, { Chevron } from '@/components/project/InviteByEmail';
import { toCompanyRole, type CompanyRole } from '@/lib/companyRoles';
import { useWorkspaces } from '@/lib/useWorkspaces';

export interface AvailableUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  expertise?: string[];
}

interface AddProjectMembersModalProps {
  projectId: string;
  projectName: string;
  existingMemberIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Called after an email invitation is sent, resent or cancelled */
  onInvited?: () => void;
}

const ALL_ROLES: SelectOption<CompanyRole>[] = [
  { value: 'Member', label: 'Member' },
  { value: 'Project Manager', label: 'Project Manager' },
  { value: 'Admin', label: 'Admin' },
];

function Avatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar && (avatar.startsWith('http') || avatar.startsWith('/'))) {
    return <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />;
  }
  const parts = (name || '').trim().split(/\s+/);
  const initials = (avatar && /^[A-Za-z]{1,3}$/.test(avatar) ? avatar : (parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  return (
    <span className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-semibold flex items-center justify-center shrink-0">
      {initials}
    </span>
  );
}

export default function AddProjectMembersModal({
  projectId,
  projectName,
  existingMemberIds,
  isOpen,
  onClose,
  onSuccess,
  onInvited,
}: AddProjectMembersModalProps) {
  const toast = useToast();
  const { data: session } = useSession();
  const workspaceKind = useWorkspaces().current?.kind;
  const isAdmin = toCompanyRole((session?.user as { role?: string })?.role) === 'Admin';
  // Only company Admins can make someone an Admin
  const roleOptions = useMemo(() => (isAdmin ? ALL_ROLES : ALL_ROLES.filter(r => r.value !== 'Admin')), [isAdmin]);

  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, CompanyRole>>({});
  const [submitting, setSubmitting] = useState(false);

  // Load company people each time the dialog opens; start clean
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setSelected({});
    setQuery('');
    setLoading(true);
    fetch(`/api/users?projectId=${encodeURIComponent(projectId)}`)
      .then(r => r.json())
      .then(json => {
        if (alive) setUsers(Array.isArray(json) ? json : json?.data || []);
      })
      .catch(() => alive && toast.error('Couldn’t load people in your company'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isOpen, projectId, toast]);

  // Escape closes (unless saving)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, submitting, onClose]);

  const existing = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);
  const candidates = useMemo(() => users.filter(u => !existing.has(u.id)), [users, existing]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [candidates, query]);

  const selectedIds = Object.keys(selected);
  const count = selectedIds.length;

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 'Member';
      return next;
    });

  const handleAdd = async () => {
    if (count === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: selectedIds.map(userId => ({ userId, role: selected[userId] })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.error?.message || 'Couldn’t add members');
      toast.success(count === 1 ? `Added to ${projectName}` : `${count} people added to ${projectName}`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add members');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // A personal workspace is just for its owner — working with others starts with a team
  if (workspaceKind === 'personal') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="personal-members-title"
          className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl border border-[#E5E7EB] p-5 shadow-[0_24px_48px_-12px_rgba(17,17,17,0.25)]"
          onClick={e => e.stopPropagation()}
        >
          <h3 id="personal-members-title" className="text-[15px] font-semibold text-[#111111]">Your personal workspace</h3>
          <p className="mt-1.5 text-[13px] text-[rgba(17,17,17,0.6)]">
            It’s just for you. To work with others, create a team — you can invite people there.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] cursor-pointer">
              Not now
            </button>
            <a href="/onboarding/plans" className="h-9 px-4 inline-flex items-center rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium">
              Create a team
            </a>
          </div>
        </div>
      </div>
    );
  }

  const hasCandidates = candidates.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 animate-in fade-in duration-150"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-members-title"
        className="bg-white w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-xl border border-[#E5E7EB] shadow-[0_24px_48px_-12px_rgba(17,17,17,0.25)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 sm:zoom-in-[0.98] duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#F0F0F0]">
          <div className="min-w-0">
            <h3 id="add-members-title" className="text-[15px] font-semibold text-[#111111]">
              Add members
            </h3>
            <p className="mt-0.5 text-[12.5px] text-[rgba(17,17,17,0.55)] truncate">
              to <span className="text-[#111111] font-medium">{projectName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="-mr-1.5 w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <InviteByEmail projectId={projectId} roleOptions={roleOptions} onInvited={onInvited} />

          {/* People already in the company */}
          <section className="px-5 pt-4 pb-3 border-t border-[#F0F0F0]" aria-labelledby="company-people-title">
            <h4 id="company-people-title" className="text-[12.5px] font-medium text-[rgba(17,17,17,0.6)]">
              People in your company
            </h4>

            {loading ? (
              <ul className="mt-2" aria-hidden="true">
                {[0, 1, 2].map(i => (
                  <li key={i} className="flex items-center gap-3 h-12">
                    <span className="w-4 h-4 rounded bg-[#F3F4F6]" />
                    <span className="w-8 h-8 rounded-full bg-[#F3F4F6]" />
                    <span className="flex-1 space-y-1.5">
                      <span className="block h-2.5 w-32 rounded bg-[#F3F4F6]" />
                      <span className="block h-2 w-44 rounded bg-[#F5F5F5]" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : !hasCandidates ? (
              <p className="mt-2 py-3 text-[13px] text-[rgba(17,17,17,0.5)]">
                Everyone in your company is already in this project. Invite someone new by email.
              </p>
            ) : (
              <>
                {candidates.length > 5 && (
                  <div className="relative mt-2">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                    <input
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search by name or email"
                      aria-label="Search people"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-[border-color,box-shadow] duration-150 ease-out"
                    />
                  </div>
                )}

                {visible.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[rgba(17,17,17,0.5)]">No one matches “{query.trim()}”.</p>
                ) : (
                  <ul className="mt-1">
                    {visible.map(user => {
                      const role = selected[user.id];
                      const isSelected = Boolean(role);
                      return (
                        <li key={user.id} className="flex items-center gap-3 min-h-12 py-1.5">
                          <button
                            type="button"
                            onClick={() => toggle(user.id)}
                            aria-pressed={isSelected}
                            className="flex flex-1 min-w-0 items-center gap-3 text-left -mx-2 px-2 py-1 rounded-lg hover:bg-[#F9FAFB] transition-colors duration-100 ease-out cursor-pointer"
                          >
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors duration-100 ${
                                isSelected ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'border-[#D1D5DB] bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                            </span>
                            <Avatar name={user.name} avatar={user.avatar} />
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px] font-medium text-[#111111]">{user.name}</span>
                              <span className="block truncate text-[12px] text-[rgba(17,17,17,0.5)]">{user.email}</span>
                            </span>
                          </button>

                          {isSelected && (
                            <SelectMenu
                              ariaLabel={`Role for ${user.name}`}
                              value={role}
                              options={roleOptions}
                              onChange={v => v && setSelected(prev => ({ ...prev, [user.id]: v }))}
                              triggerClassName="h-8 px-2 inline-flex items-center gap-1 rounded-md text-[12.5px] text-[rgba(17,17,17,0.8)] hover:bg-[#F3F4F6] transition-colors duration-100 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#DBEAFE] shrink-0"
                              renderValue={opt => (
                                <>
                                  <span>{opt?.label ?? role}</span>
                                  <Chevron />
                                </>
                              )}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#F0F0F0]">
          <span className="text-[12.5px] text-[rgba(17,17,17,0.5)]">
            {hasCandidates && count > 0 ? `${count} selected` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            >
              {hasCandidates ? 'Cancel' : 'Done'}
            </button>
            {hasCandidates && (
              <button
                type="button"
                onClick={handleAdd}
                disabled={submitting || count === 0}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium transition-colors duration-100 ease-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {count > 1 ? `Add ${count} people` : 'Add'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
