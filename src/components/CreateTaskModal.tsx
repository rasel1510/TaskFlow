'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTasks } from '@/context/TaskContext';
import type { DBUser, DBProject } from '@/context/TaskContext';
import DatePicker from '@/components/ui/DatePicker';
interface CreateTaskModalProps {
  onClose: () => void;
  prefillDate?: string;
}

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function CreateTaskModal({ onClose, prefillDate }: CreateTaskModalProps) {
  const { createTask, users: ctxUsers } = useTasks();
  const { data: session } = useSession();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState(prefillDate || '');
  const [estimate, setEstimate] = useState('');
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  const [statusDropUp, setStatusDropUp] = useState(false);
  const [priorityDropUp, setPriorityDropUp] = useState(false);
  const [projectDropUp, setProjectDropUp] = useState(false);

  const checkDropUp = (
    ref: React.RefObject<HTMLDivElement | null>,
    menuHeight = 190
  ): boolean => {
    if (!ref.current) return false;
    const rect = ref.current.getBoundingClientRect();
    const formEl = ref.current.closest('form') || ref.current.closest('.overflow-y-auto');
    const bottomBoundary = formEl ? formEl.getBoundingClientRect().bottom : window.innerHeight;
    const spaceBelow = Math.max(0, bottomBoundary - rect.bottom - 10);
    const topBoundary = formEl ? formEl.getBoundingClientRect().top : 0;
    const spaceAbove = Math.max(0, rect.top - topBoundary - 10);

    // If space below is not enough for the menu and space above is greater, drop up
    return spaceBelow < menuHeight && spaceAbove > spaceBelow;
  };

  useEffect(() => {
    if (!statusOpen) return;
    const update = () => {
      setStatusDropUp(checkDropUp(statusRef, 190));
    };
    update();
    if (statusRef.current) {
      statusRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    window.addEventListener('resize', update);
    const formEl = statusRef.current?.closest('form');
    if (formEl) formEl.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      if (formEl) formEl.removeEventListener('scroll', update);
    };
  }, [statusOpen]);

  useEffect(() => {
    if (!priorityOpen) return;
    const update = () => {
      setPriorityDropUp(checkDropUp(priorityRef, 160));
    };
    update();
    if (priorityRef.current) {
      priorityRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    window.addEventListener('resize', update);
    const formEl = priorityRef.current?.closest('form');
    if (formEl) formEl.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      if (formEl) formEl.removeEventListener('scroll', update);
    };
  }, [priorityOpen]);

  useEffect(() => {
    if (!projectOpen) return;
    const update = () => {
      setProjectDropUp(checkDropUp(projectRef, 190));
    };
    update();
    if (projectRef.current) {
      projectRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    window.addEventListener('resize', update);
    const formEl = projectRef.current?.closest('form');
    if (formEl) formEl.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      if (formEl) formEl.removeEventListener('scroll', update);
    };
  }, [projectOpen]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (statusRef.current && !statusRef.current.contains(target)) {
        setStatusOpen(false);
      }
      if (priorityRef.current && !priorityRef.current.contains(target)) {
        setPriorityOpen(false);
      }
      if (projectRef.current && !projectRef.current.contains(target)) {
        setProjectOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const userRole = (session?.user as { role?: string })?.role;
  const isElevated = userRole === 'Project Manager' || userRole === 'Admin';

  // Fetch projects from API
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(envelope => {
        const data: DBProject[] = Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
        setProjects(data);
        if (data.length > 0) {
          setProjectId(data[0].id);
        } else {
          setProjectId(''); // Default to independent task if no projects exist
        }
      })
      .catch(() => { });
  }, []);

  // Default assignee to current session user
  useEffect(() => {
    const sessionUserId = (session?.user as { id?: string })?.id;
    if (sessionUserId) {
      setAssigneeId(sessionUserId);
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: projectId || undefined,
        assigneeId: (session?.user as { id?: string })?.id || undefined,
        status,
        priority,
        dueDate: dueDate || undefined,
        estimate: estimate.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task. Please try again.';
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-[2px] overscroll-contain"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl border-t sm:border border-[#E5E7EB] shadow-2xl w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[88vh] flex flex-col overscroll-contain pb-safe animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
            <div className="w-10 h-1 rounded-full bg-[#E5E7EB]" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E5E7EB] shrink-0">
            <h2 className="text-[16px] font-semibold text-[#111111]">Create Task</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] active:bg-[#E5E7EB] text-[rgba(17,17,17,0.5)] hover:text-[#111111] transition-colors"
              aria-label="Close"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <form id="create-task-form" onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            {/* Error */}
            {errorMsg && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">
                {errorMsg}
              </div>
            )}

            <div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
                required
                className="w-full text-[17px] sm:text-[16px] font-medium text-[#111111] placeholder-[#9CA3AF] outline-none border-b border-[#E5E7EB]/80 focus:border-[#2563EB] pb-2 pt-1 transition-colors min-h-[42px] sm:min-h-0"
              />
            </div>

            <div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add description..."
                rows={3}
                className="w-full text-[16px] sm:text-[13.5px] text-[rgba(17,17,17,0.75)] placeholder-[#9CA3AF] outline-none resize-none border border-[#E5E7EB] rounded-lg px-3 py-2.5 focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Project */}
              <div className={`relative ${projectOpen ? 'z-40' : 'z-10'}`}>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.5)] mb-1.5">Project</label>
                <div className="relative" ref={projectRef}>
                  <button
                    type="button"
                    onClick={() => {
                      const willOpen = !projectOpen;
                      if (willOpen) {
                        setProjectDropUp(checkDropUp(projectRef, 190));
                      }
                      setProjectOpen(willOpen);
                      setStatusOpen(false);
                      setPriorityOpen(false);
                    }}
                    className={`w-full max-w-full flex items-center justify-between text-[15px] sm:text-[13px] text-[#111111] border rounded-lg px-3 py-2.5 sm:py-2 bg-white transition-all min-h-[42px] sm:min-h-0 cursor-pointer ${projectOpen ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]' : 'border-[#E5E7EB] hover:border-[#CBD5E1]'
                      }`}
                  >
                    <span className="truncate">
                      {projectId
                        ? (projects.find(p => p.id === projectId)?.name || 'Select project')
                        : '✨ Independent / Personal Task (No Project)'}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-gray-400 shrink-0 transition-transform duration-150 ${projectOpen ? 'rotate-180 text-[#2563EB]' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {projectOpen && (
                    <div
                      className={`absolute ${projectDropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} left-0 right-0 bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#F3F4F6]`}
                    >
                      {/* Independent / Personal task option */}
                      <button
                        type="button"
                        onClick={() => {
                          setProjectId('');
                          setProjectOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[13px] transition-colors cursor-pointer flex items-center justify-between ${
                          projectId === ''
                            ? 'bg-[#2563EB] text-white font-medium'
                            : 'text-[#111111] hover:bg-[#F3F4F6] active:bg-[#E5E7EB]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold flex items-center gap-1.5">
                            <span>✨ Independent Task</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${projectId === '' ? 'bg-white/20 text-white' : 'bg-[#EFF6FF] text-[#2563EB]'}`}>Personal</span>
                          </div>
                          <div className={`text-[11px] truncate ${projectId === '' ? 'text-white/80' : 'text-[rgba(17,17,17,0.45)]'}`}>
                            Created solely for you (no project required)
                          </div>
                        </div>
                        {projectId === '' && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>

                      {/* Project Options */}
                      <div className="py-1">
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.4)]">
                          Projects
                        </div>
                        {projects.length === 0 ? (
                          <div className="px-3 py-2 text-[12px] text-[rgba(17,17,17,0.45)] italic">
                            No projects available yet. You can create an independent task.
                          </div>
                        ) : (
                          projects.map(p => {
                            const isSelected = p.id === projectId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setProjectId(p.id);
                                  setProjectOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-[13.5px] transition-colors cursor-pointer flex items-center justify-between ${isSelected
                                  ? 'bg-[#2563EB] text-white font-medium'
                                  : 'text-[#111111] hover:bg-[#F3F4F6] active:bg-[#E5E7EB]'
                                  }`}
                              >
                                <span className="truncate">{p.name}</span>
                                {isSelected && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.5)] mb-1.5">Assignee</label>
                <div className="w-full max-w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] text-[15px] sm:text-[13px] text-[#111111] min-h-[42px] sm:min-h-0">
                  <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                    {session?.user?.name ? session.user.name.slice(0, 2).toUpperCase() : 'ME'}
                  </span>
                  <span className="font-medium truncate">{session?.user?.name || 'You'}</span>
                  <span className="ml-auto text-[11px] text-[rgba(17,17,17,0.45)] shrink-0">(You)</span>
                </div>
              </div>

              {/* Status */}
              <div className={`relative ${statusOpen ? 'z-40' : 'z-10'}`}>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.5)] mb-1.5">Status</label>
                <div className="relative" ref={statusRef}>
                  <button
                    type="button"
                    onClick={() => {
                      const willOpen = !statusOpen;
                      if (willOpen) {
                        setStatusDropUp(checkDropUp(statusRef, 190));
                      }
                      setStatusOpen(willOpen);
                      setProjectOpen(false);
                      setPriorityOpen(false);
                    }}
                    className={`w-full max-w-full flex items-center justify-between text-[15px] sm:text-[13px] text-[#111111] border rounded-lg px-3 py-2.5 sm:py-2 bg-white transition-all min-h-[42px] sm:min-h-0 cursor-pointer ${statusOpen ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]' : 'border-[#E5E7EB] hover:border-[#CBD5E1]'
                      }`}
                  >
                    <span className="truncate">
                      {STATUS_OPTIONS.find(o => o.value === status)?.label || 'To Do'}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-gray-400 shrink-0 transition-transform duration-150 ${statusOpen ? 'rotate-180 text-[#2563EB]' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {statusOpen && (
                    <div
                      className={`absolute ${statusDropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} left-0 right-0 bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100`}
                    >
                      {STATUS_OPTIONS.map(opt => {
                        const isSelected = opt.value === status;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setStatus(opt.value);
                              setStatusOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-[13.5px] transition-colors cursor-pointer flex items-center justify-between ${isSelected
                              ? 'bg-[#2563EB] text-white font-medium'
                              : 'text-[#111111] hover:bg-[#F3F4F6] active:bg-[#E5E7EB]'
                              }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div className={`relative ${priorityOpen ? 'z-40' : 'z-10'}`}>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.5)] mb-1.5">Priority</label>
                <div className="relative" ref={priorityRef}>
                  <button
                    type="button"
                    onClick={() => {
                      const willOpen = !priorityOpen;
                      if (willOpen) {
                        setPriorityDropUp(checkDropUp(priorityRef, 160));
                      }
                      setPriorityOpen(willOpen);
                      setProjectOpen(false);
                      setStatusOpen(false);
                    }}
                    className={`w-full max-w-full flex items-center justify-between text-[15px] sm:text-[13px] text-[#111111] border rounded-lg px-3 py-2.5 sm:py-2 bg-white transition-all min-h-[42px] sm:min-h-0 cursor-pointer ${priorityOpen ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]' : 'border-[#E5E7EB] hover:border-[#CBD5E1]'
                      }`}
                  >
                    <span className="truncate">
                      {PRIORITY_OPTIONS.find(o => o.value === priority)?.label || 'Medium'}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-gray-400 shrink-0 transition-transform duration-150 ${priorityOpen ? 'rotate-180 text-[#2563EB]' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {priorityOpen && (
                    <div
                      className={`absolute ${priorityDropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} left-0 right-0 bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100`}
                    >
                      {PRIORITY_OPTIONS.map(opt => {
                        const isSelected = opt.value === priority;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setPriority(opt.value);
                              setPriorityOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-[13.5px] transition-colors cursor-pointer flex items-center justify-between ${isSelected
                              ? 'bg-[#2563EB] text-white font-medium'
                              : 'text-[#111111] hover:bg-[#F3F4F6] active:bg-[#E5E7EB]'
                              }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Due Date */}
              <div className="relative z-30">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.5)] mb-1.5">Due Date</label>
                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder="Select due date"
                  align="left"
                />
              </div>

              {/* Estimate */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.5)] mb-1.5">Estimate</label>
                <input
                  type="text"
                  value={estimate}
                  onChange={e => setEstimate(e.target.value)}
                  placeholder="e.g. 4h"
                  className="w-full max-w-full text-[16px] sm:text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2.5 sm:py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white placeholder-[#9CA3AF] transition-all min-h-[42px] sm:min-h-0"
                />
              </div>
            </div>

            {/* Bottom spacer so dropdowns never get cut off */}
            <div className="h-32 shrink-0 pointer-events-none" />
          </form>

          {/* Footer - Pinned to bottom */}
          <div className="flex items-center justify-end gap-2.5 px-4 sm:px-6 py-3.5 border-t border-[#E5E7EB] bg-white shrink-0 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 border border-[#E5E7EB] rounded-xl sm:rounded-lg text-[14px] sm:text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] disabled:opacity-40 transition-colors min-h-[42px] sm:min-h-0 flex items-center justify-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-task-form"
              disabled={!title.trim() || submitting}
              className="flex-1 sm:flex-none px-5 py-2.5 sm:py-2 bg-[#2563EB] text-white rounded-xl sm:rounded-lg text-[14px] sm:text-[13px] font-semibold hover:bg-[#1D4ED8] active:bg-[#1E40AF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-h-[42px] sm:min-h-0 shadow-sm cursor-pointer"
            >
              {submitting && (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {submitting ? 'Saving...' : 'Save Task'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}







