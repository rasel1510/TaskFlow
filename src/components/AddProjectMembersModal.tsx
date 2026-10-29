/**
 * src/components/AddProjectMembersModal.tsx
 *
 * Dedicated, professional modal for Workspace Administrators and Project Managers
 * to directly assign existing organization users to an existing project.
 *
 * Key Capabilities:
 * - Direct enrollment (NO invitation emails sent to users; instant project access).
 * - Multi-select candidate users with batch enrollment.
 * - Single-click individual enrollment with instant feedback.
 * - Fine-grained project designation selection (Member, Project Manager, Admin).
 * - Real-time candidate filtering by name, email, job title, and expertise/skills.
 * - Linear/Supabase minimalist aesthetic with sub-150ms micro-interactions.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  UserPlus,
  Check,
  CheckSquare,
  Square,
  Shield,
  Briefcase,
  Users,
  Sparkles,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';
import { type ProjectRole, normalizeDesignation } from '@/lib/permissions';

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
}

const COMMON_SKILLS = [
  'Frontend',
  'Backend',
  'Full Stack Engineering',
  'UI Design',
  'DevOps',
  'QA Engineering',
  'Cloud Architecture',
  'Mobile Development',
  'AI',
  'ML',
  'Cybersecurity',
];

function renderAvatar(avatar?: string, name?: string) {
  if (avatar && (avatar.startsWith('http') || avatar.startsWith('/'))) {
    return <img src={avatar} alt={name || 'User'} className="w-9 h-9 rounded-full object-cover shrink-0" />;
  }
  const initials = avatar || (name ? name.slice(0, 2).toUpperCase() : 'U');
  return (
    <div className="w-9 h-9 rounded-full bg-blue-100 text-[#2563EB] font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
      {initials}
    </div>
  );
}

export default function AddProjectMembersModal({
  projectId,
  projectName,
  existingMemberIds,
  isOpen,
  onClose,
  onSuccess,
}: AddProjectMembersModalProps) {
  const toast = useToast();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin =
    userRole === 'Admin' ||
    userRole === 'ADMIN' ||
    userRole?.toLowerCase() === 'admin';

  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'PM' | 'MEMBER'>('ALL');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  
  // Multi-selection state
  const [selectedMap, setSelectedMap] = useState<Record<string, ProjectRole>>({});
  const [bulkRole, setBulkRole] = useState<ProjectRole>('Member');
  
  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [singleAddingId, setSingleAddingId] = useState<string | null>(null);
  const [showAlreadyEnrolled, setShowAlreadyEnrolled] = useState(false);

  // Fetch organization users when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch(`/api/users?projectId=${encodeURIComponent(projectId)}`);
        const json = await res.json();
        const list: AvailableUser[] = Array.isArray(json) ? json : (json?.data || []);
        if (isMounted) {
          setUsers(list);
        }
      } catch (err) {
        console.warn('[AddProjectMembersModal] Failed to load organization users:', err);
        toast.error('Failed to load team members');
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    };

    fetchUsers();
    return () => { isMounted = false; };
  }, [isOpen, projectId, toast]);

  // Keyboard dismiss (Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  // Existing member IDs set for O(1) checks
  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  // Filter candidates
  const { availableCandidates, alreadyEnrolledUsers } = useMemo(() => {
    const available: AvailableUser[] = [];
    const enrolled: AvailableUser[] = [];

    const query = searchTerm.trim().toLowerCase();

    for (const u of users) {
      const isEnrolled = existingSet.has(u.id);
      
      // Text search matching
      const userSkills: string[] = Array.isArray(u.expertise) ? u.expertise : [];
      const matchesSearch =
        !query ||
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.role?.toLowerCase().includes(query) ||
        userSkills.some(s => s.toLowerCase().includes(query));

      if (!matchesSearch) continue;

      // Role filter matching
      if (roleFilter !== 'ALL') {
        const r = (u.role || '').toLowerCase();
        const isAdm = r.includes('admin');
        const isPM = r.includes('manager') || r.includes('pm') || r.includes('lead');
        if (roleFilter === 'ADMIN' && !isAdm) continue;
        if (roleFilter === 'PM' && !isPM) continue;
        if (roleFilter === 'MEMBER' && (isAdm || isPM)) continue;
      }

      // Skill filter matching
      if (selectedSkills.length > 0) {
        const hasSkill = selectedSkills.some(req =>
          userSkills.some(s => s.toLowerCase() === req.toLowerCase())
        );
        if (!hasSkill) continue;
      }

      if (isEnrolled) {
        enrolled.push(u);
      } else {
        available.push(u);
      }
    }

    return { availableCandidates: available, alreadyEnrolledUsers: enrolled };
  }, [users, existingSet, searchTerm, roleFilter, selectedSkills]);

  const selectedCount = Object.keys(selectedMap).length;

  // Toggle selection for a user
  const toggleSelectUser = (userId: string) => {
    setSelectedMap(prev => {
      const next = { ...prev };
      if (next[userId]) {
        delete next[userId];
      } else {
        next[userId] = bulkRole;
      }
      return next;
    });
  };

  // Update specific selected user's role
  const setRoleForUser = (userId: string, role: ProjectRole) => {
    setSelectedMap(prev => ({
      ...prev,
      [userId]: role,
    }));
  };

  // Select all available visible candidates
  const handleSelectAll = () => {
    const next: Record<string, ProjectRole> = { ...selectedMap };
    for (const u of availableCandidates) {
      if (!next[u.id]) {
        next[u.id] = bulkRole;
      }
    }
    setSelectedMap(next);
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedMap({});
  };

  // Apply bulk role to all currently selected users
  const handleApplyBulkRole = (newRole: ProjectRole) => {
    setBulkRole(newRole);
    setSelectedMap(prev => {
      const next: Record<string, ProjectRole> = {};
      for (const k of Object.keys(prev)) {
        next[k] = newRole;
      }
      return next;
    });
  };

  // Single-user instant addition
  const handleAddSingle = async (userId: string, role: ProjectRole) => {
    setSingleAddingId(userId);
    const assignedRole = isAdmin ? role : 'Member';
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: assignedRole }),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || 'Failed to add member');
      }

      const target = users.find(u => u.id === userId);
      toast.success(`${target?.name || 'User'} added to ${projectName} as a ${role}`);
      
      // Remove from selected if present
      setSelectedMap(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });

      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member to project');
    } finally {
      setSingleAddingId(null);
    }
  };

  // Batch addition of all selected users
  const handleAddBatch = async () => {
    const entries = Object.entries(selectedMap);
    if (entries.length === 0) {
      toast.error('Please select at least one team member');
      return;
    }

    setSubmitting(true);
    try {
      const membersPayload = entries.map(([userId, role]) => ({ userId, role: isAdmin ? role : 'Member' }));

      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: membersPayload }),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || 'Failed to add members');
      }

      toast.success(`Successfully added ${entries.length} member${entries.length === 1 ? '' : 's'} to ${projectName}!`);
      setSelectedMap({});
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[AddProjectMembersModal] Batch add error:', err);
      toast.error(err.message || 'Failed to add selected members');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16.5px] font-bold text-[#111111] tracking-tight">
                Add Team Members
              </h3>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Assign existing organization members directly to <span className="font-semibold text-gray-800">{projectName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F4F6] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reassurance Banner: Direct Addition without Email */}
        <div className="px-6 py-2.5 bg-[#EFF6FF] border-b border-[#DBEAFE] flex items-center gap-2.5 shrink-0 text-[12px] text-blue-900">
          <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0" />
          <div>
            <span className="font-bold text-blue-950">Direct Enrollment: </span>
            <span>Members are added immediately with full workspace access. No invitation emails or confirmation delays.</span>
          </div>
        </div>

        {/* Search, Filter & Bulk Controls Toolbar */}
        <div className="p-4 border-b border-[#F3F4F6] bg-[#FAFAFB] shrink-0 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, job title, or skill..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-[#E5E7EB] rounded-xl bg-white outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all font-medium text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Role Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Role:
            </span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ADMIN', label: 'Admins' },
              { id: 'PM', label: 'Project Managers' },
              { id: 'MEMBER', label: 'Members' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRoleFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                  roleFilter === f.id
                    ? 'bg-[#2563EB] text-white shadow-2xs'
                    : 'bg-white border border-[#E5E7EB] text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Quick Skill Filters */}
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
            {COMMON_SKILLS.map(skill => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() =>
                    setSelectedSkills(prev =>
                      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
                    )
                  }
                  className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                      : 'bg-white text-gray-600 border border-[#E5E7EB] hover:border-gray-300'
                  }`}
                >
                  {isSelected && <Check className="w-2.5 h-2.5" />}
                  {skill}
                </button>
              );
            })}
            {selectedSkills.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSkills([])}
                className="text-[10.5px] font-semibold text-[#2563EB] hover:underline px-1 cursor-pointer"
              >
                Clear skills
              </button>
            )}
          </div>

          {/* Multi-Selection Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB] text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAll}
                className="font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Select All ({availableCandidates.length})
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="font-medium text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-[11px] font-medium">Default Role:</span>
                {isAdmin ? (
                  <select
                    value={bulkRole}
                    onChange={e => handleApplyBulkRole(e.target.value as ProjectRole)}
                    className="text-[11.5px] font-semibold border border-[#E5E7EB] rounded-lg px-2 py-1 bg-white text-gray-700 outline-none focus:border-[#2563EB]"
                  >
                    <option value="Member">Member</option>
                    <option value="Project Manager">Project Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                ) : (
                  <span className="text-[11.5px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">Member</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Candidate List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-white">
          {loadingUsers ? (
            <div className="py-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
              <span>Loading organization team members...</span>
            </div>
          ) : availableCandidates.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500 px-4">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">No available candidates found</p>
              <p className="text-gray-400 text-[11.5px] mt-0.5">
                {searchTerm || selectedSkills.length > 0 || roleFilter !== 'ALL'
                  ? 'Try adjusting your search terms or filters.'
                  : 'All users in your organization are already enrolled in this project.'}
              </p>
            </div>
          ) : (
            availableCandidates.map(user => {
              const isSelected = Boolean(selectedMap[user.id]);
              const userRoleInProject = selectedMap[user.id] || bulkRole;
              const isAddingSingle = singleAddingId === user.id;
              const userSkills: string[] = Array.isArray(user.expertise) ? user.expertise : [];

              return (
                <div
                  key={user.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[#2563EB] bg-blue-50/40 ring-1 ring-[#2563EB]/20 shadow-2xs'
                      : 'border-[#E5E7EB] bg-white hover:border-gray-300'
                  }`}
                >
                  {/* Left: Checkbox + Avatar + Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelectUser(user.id)}
                      className="mt-1 text-gray-400 hover:text-[#2563EB] cursor-pointer shrink-0"
                    >
                      {isSelected ? (
                        <div className="w-4 h-4 rounded bg-[#2563EB] text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border border-gray-300 hover:border-[#2563EB]" />
                      )}
                    </button>

                    {renderAvatar(user.avatar, user.name)}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 truncate">{user.name}</span>
                        <span className="text-[10.5px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {normalizeDesignation(user.role)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">{user.email}</div>

                      {/* Skills Tags */}
                      {userSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {userSkills.slice(0, 4).map((skill, si) => (
                            <span
                              key={si}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
                            >
                              {skill}
                            </span>
                          ))}
                          {userSkills.length > 4 && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              +{userSkills.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Role selection & Action */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-7 sm:pl-0">
                    {isAdmin ? (
                      <select
                        value={userRoleInProject}
                        onChange={e => {
                          const newRole = e.target.value as ProjectRole;
                          setRoleForUser(user.id, newRole);
                        }}
                        className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white font-medium text-gray-700 outline-none focus:border-[#2563EB]"
                      >
                        <option value="Member">Member</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Admin">Admin</option>
                      </select>
                    ) : (
                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">Member</span>
                    )}

                    <button
                      type="button"
                      disabled={isAddingSingle || submitting}
                      onClick={() => handleAddSingle(user.id, userRoleInProject)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      {isAddingSingle ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Adding...</span>
                        </>
                      ) : (
                        <span>Add</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Already Enrolled Section (Collapsible Accordion) */}
          {alreadyEnrolledUsers.length > 0 && (
            <div className="pt-3 border-t border-[#F3F4F6]">
              <button
                type="button"
                onClick={() => setShowAlreadyEnrolled(prev => !prev)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Already enrolled members ({alreadyEnrolledUsers.length})</span>
                <span className="text-[11px] text-gray-400">
                  {showAlreadyEnrolled ? '▲ Hide' : '▼ View'}
                </span>
              </button>

              {showAlreadyEnrolled && (
                <div className="mt-2 space-y-2 opacity-75">
                  {alreadyEnrolledUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50/70"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {renderAvatar(user.avatar, user.name)}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{user.name}</div>
                          <div className="text-[11px] text-gray-400 truncate">{user.email}</div>
                        </div>
                      </div>
                      <span className="text-[10.5px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-600" />
                        Active Member
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#F3F4F6] bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-600">
            {selectedCount > 0 ? (
              <span className="font-semibold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                {selectedCount} member{selectedCount === 1 ? '' : 's'} selected
              </span>
            ) : (
              <span className="text-gray-400">Select candidates or click Add</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || selectedCount === 0}
              onClick={handleAddBatch}
              className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding {selectedCount} Members...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Selected ({selectedCount}) Members</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

