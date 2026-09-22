'use client';

/**
 * src/components/CreateProjectModal.tsx
 *
 * Modal component for creating new projects, persisting them to PostgreSQL.
 *
 * Aesthetic:
 * - Linear / Supabase minimal design with crisp focus rings and refined typography.
 * - Preset color palette with active visual indicators.
 * - Sub-150ms micro-interactions and accessible keyboard dismiss.
 */

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const COLOR_PRESETS = [
  { hex: '#2563EB', name: 'Blue' },
  { hex: '#7C3AED', name: 'Purple' },
  { hex: '#0891B2', name: 'Cyan' },
  { hex: '#16A34A', name: 'Green' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#DC2626', name: 'Red' },
];

export default function CreateProjectModal({ onClose, onSuccess }: CreateProjectModalProps) {
  const { data: session } = useSession();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0].hex);
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

      toast.success(`Project "${name.trim()}" created successfully`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#E5E7EB] z-10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-white">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">Create New Project</h2>
            <p className="text-[12px] text-[rgba(17,17,17,0.45)] mt-0.5">Define your project scope, timeline, and color theme.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.4)] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
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
              className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all text-[#111111] placeholder-[#9CA3AF]"
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
              rows={3}
              className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all text-[#111111] placeholder-[#9CA3AF] resize-none"
            />
          </div>

          {/* Color theme */}
          <div>
            <label className="block text-[12.5px] font-semibold text-[#111111] mb-2">Color Theme</label>
            <div className="flex items-center gap-3">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setColor(preset.hex)}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
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
          <div>
            <label className="block text-[12.5px] font-semibold text-[#111111] mb-1.5">Target Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all text-[#111111]"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
