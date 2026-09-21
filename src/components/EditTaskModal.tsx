'use client';

import { useState, useEffect } from 'react';
import { useTasks } from '@/context/TaskContext';
import type { DBTask, DBProject } from '@/context/TaskContext';

interface EditTaskModalProps {
  task: DBTask;
  onClose: () => void;
}

export default function EditTaskModal({ task, onClose }: EditTaskModalProps) {
  const { updateTask, users: ctxUsers } = useTasks();

  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status || 'todo');
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [projectId, setProjectId] = useState(task.projectId || '');
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || '');
  const [dueDate, setDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );
  const [estimate, setEstimate] = useState(task.estimate || '');
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch available projects
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: DBProject[]) => {
        setProjects(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: projectId || undefined,
        assigneeId: assigneeId || undefined,
        status,
        priority,
        dueDate: dueDate || undefined,
        estimate: estimate.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update task. Please try again.';
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <span className="text-[11.5px] font-semibold text-[rgba(17,17,17,0.45)] font-mono bg-[#F3F4F6] px-2 py-0.5 rounded">
              {task.taskNumber ?? task.id}
            </span>
            <h2 className="text-[16px] font-semibold text-[#111111]">Edit Task</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.4)] hover:text-[#111111] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {errorMsg && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[12.5px] text-red-600">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1">
              Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title"
              required
              className="w-full text-[15px] font-medium text-[#111111] placeholder-[#9CA3AF] outline-none border border-[#E5E7EB] rounded-lg px-3 py-2 focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add description..."
              rows={3}
              className="w-full text-[13.5px] text-[rgba(17,17,17,0.7)] placeholder-[#9CA3AF] outline-none resize-none border border-[#E5E7EB] rounded-lg px-3 py-2.5 focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Project */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">
                Project
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all"
              >
                <option value="">Unassigned</option>
                {ctxUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all"
              >
                {[
                  ['backlog', 'Backlog'],
                  ['todo', 'To Do'],
                  ['in_progress', 'In Progress'],
                  ['in_review', 'In Review'],
                  ['done', 'Done'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all"
              >
                {[
                  ['low', 'Low'],
                  ['medium', 'Medium'],
                  ['high', 'High'],
                  ['urgent', 'Urgent'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Due Date */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
              />
            </div>

            {/* Estimate */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">
                Estimate
              </label>
              <input
                type="text"
                value={estimate}
                onChange={e => setEstimate(e.target.value)}
                placeholder="e.g. 4h"
                className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] placeholder-[#9CA3AF] transition-all"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F3F4F6]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-[13px] font-medium text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting && (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {submitting ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
