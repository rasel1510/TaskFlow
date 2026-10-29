'use client';

/**
 * src/components/CreateProjectModal.tsx
 *
 * Modal component for creating new projects and assigning existing team members
 * (both regular Users and other Project Managers) directly into the new project.
 *
 * Aesthetic:
 * - Linear / Supabase minimal design with crisp focus rings and refined typography.
 * - Preset color palette with active visual indicators.
 * - Sub-150ms micro-interactions, responsive scrolling, and accessible keyboard dismiss.
 */

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';
import DatePicker from '@/components/ui/DatePicker';
import { normalizeDesignation } from '@/lib/permissions';

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  expertise?: string[];
}

interface SelectedMember {
  userId: string;
  role: 'Admin' | 'Project Manager' | 'Member';
}

const COLOR_PRESETS = [
  { hex: '#2563EB', name: 'Blue' },
  { hex: '#7C3AED', name: 'Purple' },
  { hex: '#0891B2', name: 'Cyan' },
  { hex: '#16A34A', name: 'Green' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#DC2626', name: 'Red' },
];

function renderAvatar(avatar?: string, name?: string) {
  if (avatar && (avatar.startsWith('http') || avatar.startsWith('/'))) {
    return <img src={avatar} alt={name || 'User'} className="w-6 h-6 rounded-full object-cover shrink-0" />;
  }
  const initials = avatar || (name ? name.slice(0, 2).toUpperCase() : 'U');
  return (
    <div className="w-6 h-6 rounded-full bg-blue-100 text-[#2563EB] font-bold text-[10.5px] flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

export default function CreateProjectModal({ onClose, onSuccess }: CreateProjectModalProps) {
  const { data: session } = useSession();
  const toast = useToast();

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin =
    userRole === 'Admin' ||
    userRole === 'ADMIN' ||
    userRole?.toLowerCase() === 'admin';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0].hex);
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Team members selection state
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Fetch available organization team members
  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch('/api/users');
        const json = await res.json();
        const list: AvailableUser[] = Array.isArray(json) ? json : (json?.data || []);
        if (isMounted) {
          const sessionUserId = (session?.user as { id?: string })?.id;
          const sessionEmail = session?.user?.email?.toLowerCase();
          // Filter out the current user who is already the creator/owner
          const filtered = list.filter(u => u.id !== sessionUserId && u.email?.toLowerCase() !== sessionEmail);
          setAvailableUsers(filtered);
        }
      } catch (err) {
        console.warn('[CreateProjectModal] Could not fetch team users:', err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    };
    fetchUsers();
    return () => { isMounted = false; };
  }, [session]);

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.userId === userId);
      if (exists) {
        return prev.filter(m => m.userId !== userId);
      } else {
        return [...prev, { userId, role: 'Member' }];
      }
    });
  };

  const updateMemberRole = (userId: string, role: 'Admin' | 'Project Manager' | 'Member') => {
    setSelectedMembers(prev =>
      prev.map(m => (m.userId === userId ? { ...m, role } : m))
    );
  };

  const selectAllMembers = () => {
    setSelectedMembers(
      availableUsers.map(u => {
        const existing = selectedMembers.find(m => m.userId === u.id);
        return { userId: u.id, role: existing ? existing.role : 'Member' };
      })
    );
  };

  const clearAllMembers = () => {
    setSelectedMembers([]);
  };

  const filteredUsers = availableUsers.filter(u => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Project name is required');
      return;
    }

    const sessionUserId = (session?.user as { id?: string })?.id;
    if (!sessionUserId) {
      setErrorMsg('You must be logged in to create a project');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        color,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        ownerId: sessionUserId,
        initialMembers: selectedMembers.map(m => ({ userId: m.userId, role: m.role })),
      };

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const envelope = await res.json();
      if (!res.ok || envelope.success === false) {
        const message = envelope?.error?.message || envelope?.message || 'Failed to create project';
        throw new Error(message);
      }

      if (selectedMembers.length > 0) {
        toast.success(`Project "${name.trim()}" created with ${selectedMembers.length} team member${selectedMembers.length === 1 ? '' : 's'}`);
      } else {
        toast.success(`Project "${name.trim()}" created successfully`);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[CreateProjectModal] Error:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border-t sm:border border-[#E5E7EB] z-10 flex flex-col max-h-[92dvh] sm:max-h-[90vh] pb-safe overscroll-contain animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#E5E7EB]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E5E7EB] bg-white shrink-0">
          <div>
            <h2 className="text-[16px] sm:text-[17px] font-bold text-[#111111]">Create New Project</h2>
            <p className="text-[11.5px] text-gray-500 mt-0.5">Define project scope, schedule, and assign existing team members</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] active:bg-[#E5E7EB] text-[rgba(17,17,17,0.5)] hover:text-[#111111] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 pb-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
          {errorMsg && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[12.5px] text-[#DC2626]">
              {errorMsg}
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-[12.5px] font-semibold text-[#111111] mb-1.5">
              Project Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              className="w-full px-3 py-2.5 sm:py-2 text-[15px] sm:text-[13px] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all text-[#111111] placeholder-[#9CA3AF] min-h-[42px] sm:min-h-0"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12.5px] font-semibold text-[#111111] mb-1.5">
              Description <span className="text-[11px] font-normal text-[rgba(17,17,17,0.4)]">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={2}
              className="w-full px-3 py-2 sm:py-2 text-[14px] sm:text-[13px] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all text-[#111111] placeholder-[#9CA3AF] resize-none"
            />
          </div>

          {/* Color theme & Due date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Color theme */}
            <div>
              <label className="block text-[12.5px] font-semibold text-[#111111] mb-2">Color Theme</label>
              <div className="flex items-center gap-2.5">
                {COLOR_PRESETS.map(preset => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setColor(preset.hex)}
                    className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center cursor-pointer ${
                      color === preset.hex ? 'ring-2 ring-offset-2 ring-[#111111] scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={preset.name}
                  >
                    {color === preset.hex && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div className="relative z-30">
              <label className="block text-[12.5px] font-semibold text-[#111111] mb-1.5">Target Due Date</label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Select target due date"
              />
            </div>
          </div>

          {/* Assign Existing Team Members Section */}
          <div className="pt-3 border-t border-[#F3F4F6]">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <label className="block text-[12.5px] font-semibold text-[#111111]">
                  Assign Existing Team Members{' '}
                  <span className="text-[11.5px] font-semibold text-[#2563EB]">
                    ({selectedMembers.length} selected)
                  </span>
                </label>
                <p className="text-[11px] text-[rgba(17,17,17,0.5)]">
                  Add existing workspace users or project managers directly to this project
                </p>
              </div>

              {availableUsers.length > 0 && (
                <div className="flex items-center gap-2">
                  {selectedMembers.length < availableUsers.length ? (
                    <button
                      type="button"
                      onClick={selectAllMembers}
                      className="text-[11.5px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Select all
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={clearAllMembers}
                      className="text-[11.5px] font-semibold text-gray-500 hover:underline cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Selected Members Chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg mb-2 max-h-24 overflow-y-auto">
                {selectedMembers.map(item => {
                  const u = availableUsers.find(x => x.id === item.userId);
                  if (!u) return null;
                  return (
                    <div
                      key={u.id}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 bg-white border border-[#CBD5E1] rounded-md text-[11.5px] shadow-2xs"
                    >
                      {renderAvatar(u.avatar, u.name)}
                      <span className="font-semibold text-[#111111] max-w-[120px] truncate">{u.name}</span>
                      <span className="text-[10px] font-semibold px-1 py-0.2 bg-[#EFF6FF] text-[#2563EB] rounded">
                        {item.role === 'Admin' ? 'Admin' : item.role === 'Project Manager' ? 'Project Manager' : 'Member'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleMember(u.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors ml-0.5 cursor-pointer"
                        title="Remove member"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search filter for team members */}
            {availableUsers.length > 3 && (
              <div className="relative mb-2">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search by name, email, or role..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-[#E5E7EB] rounded-lg bg-white outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#DBEAFE] transition-all text-[#111111] placeholder-[#9CA3AF]"
                />
              </div>
            )}

            {/* Members selection list */}
            {loadingUsers ? (
              <div className="py-6 text-center text-[12px] text-gray-400">Loading organization team members...</div>
            ) : availableUsers.length === 0 ? (
              <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-center text-[12px] text-gray-500">
                No other team members found in the organization.
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-center text-[12px] text-gray-500">
                No members found matching &quot;{memberSearch}&quot;.
              </div>
            ) : (
              <div className="border border-[#E5E7EB] rounded-xl overflow-hidden divide-y divide-[#F3F4F6] max-h-44 overflow-y-auto bg-white">
                {filteredUsers.map(user => {
                  const selected = selectedMembers.find(m => m.userId === user.id);
                  const isSelected = !!selected;
                  const currentRole = selected ? selected.role : 'Member';

                  return (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-2.5 transition-colors ${
                        isSelected ? 'bg-[#F0F7FF]' : 'hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <div
                        onClick={() => toggleMember(user.id)}
                        className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 mr-2"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-[#2563EB] border-gray-300 focus:ring-[#2563EB] pointer-events-none"
                        />
                        {renderAvatar(user.avatar, user.name)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12.5px] font-semibold text-[#111111] truncate">{user.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded font-medium">
                              {normalizeDesignation(user.role)}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      {/* Project Role selector for selected members */}
                      {isSelected ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAdmin ? (
                            <select
                              value={currentRole}
                              onChange={e => updateMemberRole(user.id, e.target.value as any)}
                              className="text-[11.5px] font-semibold text-[#1E40AF] bg-white border border-[#BFDBFE] rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                            >
                              <option value="Member">Member</option>
                              <option value="Project Manager">Project Manager</option>
                              <option value="Admin">Admin</option>
                            </select>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-1 rounded bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                              Member
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleMember(user.id)}
                          className="text-[11.5px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF] px-2 py-1 rounded transition-colors shrink-0 cursor-pointer"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 pb-1 border-t border-[#E5E7EB] shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-[14px] sm:text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] rounded-xl sm:rounded-lg transition-colors min-h-[42px] sm:min-h-0 flex items-center justify-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 sm:flex-none px-5 py-2.5 sm:py-2 text-[14px] sm:text-[13px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl sm:rounded-lg transition-colors flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-0 shadow-sm cursor-pointer"
            >
              {submitting ? 'Creating...' : selectedMembers.length > 0 ? `Create Project (${selectedMembers.length + 1} members)` : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
