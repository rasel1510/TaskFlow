import { useState } from 'react';
import { projects, users } from '../data/mockData';

interface CreateTaskModalProps {
  onClose: () => void;
}

export default function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [projectId, setProjectId] = useState(projects[0].id);
  const [assigneeId, setAssigneeId] = useState(users[0].id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl w-full max-w-lg"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-[16px] font-semibold text-[#111111]">Create Task</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.4)] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
                className="w-full text-[16px] font-medium text-[#111111] placeholder-[#9CA3AF] outline-none border-b border-transparent focus:border-[#E5E7EB] pb-2 transition-colors"
              />
            </div>

            <div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add description..."
                rows={3}
                className="w-full text-[13.5px] text-[rgba(17,17,17,0.7)] placeholder-[#9CA3AF] outline-none resize-none border border-[#E5E7EB] rounded-lg px-3 py-2.5 focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">Project</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">Assignee</label>
                <select
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all"
                >
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all"
                >
                  {[['backlog','Backlog'],['todo','To Do'],['in_progress','In Progress'],['in_review','In Review'],['done','Done']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] bg-white transition-all"
                >
                  {[['low','Low'],['medium','Medium'],['high','High'],['urgent','Urgent']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">Due Date</label>
                <input
                  type="date"
                  className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)] mb-1.5">Estimate</label>
                <input
                  type="text"
                  placeholder="e.g. 4h"
                  className="w-full text-[13px] text-[#111111] border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] placeholder-[#9CA3AF] transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <button type="button" className="text-[13px] text-[rgba(17,17,17,0.5)] hover:text-[#111111] transition-colors">
                Save & Create Another
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-[13px] font-medium text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB] transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Save Task
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
