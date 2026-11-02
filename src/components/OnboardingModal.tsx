'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  User,
  Briefcase,
  Sparkles,
  CheckCircle2,
  Loader2,
  X,
  Palette,
  Layers,
  Lock,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProjectId?: string | null;
  onCompleteProjectNav?: (projectId: string) => void;
}

const AVAILABLE_SKILLS = [
  'Frontend',
  'Backend',
  'Full Stack',
  'UI Design',
  'UX Research',
  'DevOps',
  'Cloud Architecture',
  'QA Engineering',
  'Mobile Development',
  'AI / ML',
  'Cybersecurity',
  'Product Management',
];

const AVATAR_COLORS = [
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#059669', // Emerald
  '#DC2626', // Red
  '#D97706', // Amber
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#DB2777', // Pink
];

export default function OnboardingModal({
  isOpen,
  onClose,
  targetProjectId,
  onCompleteProjectNav,
}: OnboardingModalProps) {
  const { data: session, update } = useSession();
  const toast = useToast();

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin =
    userRole === 'Admin' ||
    userRole === 'ADMIN' ||
    userRole?.toLowerCase() === 'admin';

  const [name, setName] = useState(
    session?.user?.name && session.user.name !== 'New Member' ? session.user.name : ''
  );
  const [jobTitle, setJobTitle] = useState(
    userRole ? (userRole === 'User' ? 'Member' : userRole) : ''
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [avatarColor, setAvatarColor] = useState('#2563EB');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const initials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'YOU';

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleAddCustomSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customSkill.trim()) {
      e.preventDefault();
      const val = customSkill.trim();
      if (!selectedSkills.includes(val)) {
        setSelectedSkills(prev => [...prev, val]);
      }
      setCustomSkill('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = session?.user?.id;
      if (!userId) {
        throw new Error('User session not found.');
      }

      const payload: {
        name: string;
        avatar: string;
        expertise: string[];
        role?: string;
      } = {
        name: name.trim(),
        avatar: initials,
        expertise: selectedSkills,
      };

      // Only administrators can set or modify role / job title
      if (isAdmin && jobTitle.trim()) {
        payload.role = jobTitle.trim();
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update profile details');
      }

      // Update local NextAuth session if available
      try {
        if (update) {
          await update({
            ...session,
            user: {
              ...session?.user,
              name: name.trim(),
              ...(isAdmin && payload.role ? { role: payload.role } : {}),
              image: initials,
            },
          });
        }
      } catch {}

      toast.success('Profile completed successfully! Welcome aboard.');
      onClose();

      if (targetProjectId && onCompleteProjectNav) {
        onCompleteProjectNav(targetProjectId);
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while saving profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl border border-[#E5E7EB] shadow-2xl w-full max-w-lg max-h-[92dvh] sm:max-h-[85vh] overflow-y-auto flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 pb-safe"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner header */}
        <div className="px-6 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white relative">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/20 text-white">
              Welcome to FlowSync
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Complete Your Profile</h2>
          <p className="text-xs text-blue-100 mt-1 max-w-sm">
            Set up your identity and expertise so your teammates and project managers can collaborate with you seamlessly.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Avatar & Name Preview */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md transition-all shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-[#111111] truncate">
                {name.trim() || 'Your Name'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {jobTitle.trim() || 'Your Role / Title'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{session?.user?.email}</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all font-medium"
              />
            </div>
          </div>

          {/* Job Title / Role */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#111111]">
                Job Title / Role
              </label>
              {!isAdmin && (
                <span className="text-[10.5px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-amber-600" />
                  Admin Managed
                </span>
              )}
            </div>
            <div className="relative">
              <Briefcase className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={!isAdmin ? (userRole || 'Member') : jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                disabled={!isAdmin}
                placeholder={isAdmin ? "e.g. Admin, Project Manager, or Member" : "Assigned by Administrator"}
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all font-medium disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
            </div>
            {!isAdmin && (
              <p className="text-[10.5px] text-gray-400 mt-1">
                Your role and job title are managed by your workspace administrator.
              </p>
            )}
          </div>

          {/* Avatar Color Theme */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-gray-400" />
              <span>Avatar Color Theme</span>
            </label>
            <div className="flex items-center gap-2">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={`w-7 h-7 rounded-xl transition-transform cursor-pointer ${
                    avatarColor === color ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Skills / Expertise Matrix */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                <span>Skills & Expertise Matrix</span>
              </label>
              <span className="text-[11px] text-gray-400">
                {selectedSkills.length} selected
              </span>
            </div>
            <p className="text-[11.5px] text-gray-500 mb-2">
              Select your strengths so project managers can assign the best tasks to you:
            </p>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {AVAILABLE_SKILLS.map(skill => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#2563EB] text-white border border-[#2563EB] shadow-xs'
                        : 'bg-[#F9FAFB] text-gray-700 border border-[#E5E7EB] hover:border-gray-300'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    {skill}
                  </button>
                );
              })}
            </div>

            {/* Custom Skill Input */}
            <input
              type="text"
              value={customSkill}
              onChange={e => setCustomSkill(e.target.value)}
              onKeyDown={handleAddCustomSkill}
              placeholder="Type custom skill and press Enter..."
              className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 border-t border-[#F3F4F6] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving details...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save Profile & Enter Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
