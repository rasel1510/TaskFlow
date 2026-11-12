'use client';

/**
 * src/components/CreateProjectModal.tsx
 *
 * Modal component for creating new projects.
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 z-10 flex flex-col overflow-visible animate-in fade-in zoom-in-95 duration-150">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white tracking-tight">Create New Project</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form id="create-project-form" onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-visible flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              className="w-full px-3.5 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white dark:bg-neutral-900 transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 shadow-2xs"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Description
              </label>
              <span className="text-[11px] text-neutral-400">Optional</span>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white dark:bg-neutral-900 transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 resize-none shadow-2xs"
            />
          </div>

          {/* Color theme & Due date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Color theme */}
            <div>
              <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Color Theme
              </label>
              <div className="flex items-center gap-2 pt-0.5">
                {COLOR_PRESETS.map(preset => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setColor(preset.hex)}
                    className={`w-7 h-7 rounded-full transition-all duration-150 flex items-center justify-center cursor-pointer ${color === preset.hex
                      ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white scale-105 shadow-xs'
                      : 'hover:scale-105 opacity-85 hover:opacity-100'
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
            <div className="relative">
              <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
                Target Due Date
              </label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Select target due date"
                align="right"
                direction="up"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-project-form"
              disabled={submitting || !name.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center min-w-[110px]"
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

